import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

function getTodayDateInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function stripAnswerFields<T extends { answer: string; answerKeywords: string[]; answerSnippet: unknown }>(
  question: T,
) {
  const { answer, answerKeywords, answerSnippet, ...rest } = question;
  return rest;
}

export const getArchive = query({
  args: { quizSlug: v.string() },
  handler: async (ctx, args) => {
    const todayDate = getTodayDateInIndia();
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz_date", (q) =>
        q.eq("quizSlug", args.quizSlug).lte("date", todayDate),
      )
      .order("desc")
      .take(1000);

    return questions.map((q) => stripAnswerFields(q));
  },
});

export const getLatestQuestion = query({
  args: { quizSlug: v.string() },
  handler: async (ctx, args) => {
    const todayDate = getTodayDateInIndia();
    const question = await ctx.db
      .query("questions")
      .withIndex("by_quiz_date", (q) =>
        q.eq("quizSlug", args.quizSlug).lte("date", todayDate),
      )
      .order("desc")
      .take(1);

    return question[0] ? stripAnswerFields(question[0]) : null;
  },
});

export const getQuestion = query({
  args: { quizSlug: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    const todayDate = getTodayDateInIndia();
    if (args.date > todayDate) {
      return null;
    }

    const question = await ctx.db
      .query("questions")
      .withIndex("by_quiz_date", (q) =>
        q.eq("quizSlug", args.quizSlug).eq("date", args.date),
      )
      .unique();

    return question ? stripAnswerFields(question) : null;
  },
});

export const getAnswer = query({
  args: { quizSlug: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    const todayDate = getTodayDateInIndia();
    if (args.date > todayDate) {
      return null;
    }

    const question = await ctx.db
      .query("questions")
      .withIndex("by_quiz_date", (q) =>
        q.eq("quizSlug", args.quizSlug).eq("date", args.date),
      )
      .unique();

    if (!question) return null;

    return {
      answer: question.answer,
      answerKeywords: question.answerKeywords,
      answerSnippet: question.answerSnippet,
    };
  },
});

export const recordCompletion = mutation({
  args: {
    id: v.id("questions"),
    score: v.number(),
    elapsedSeconds: v.number(),
    visibleCardCount: v.number(),
    paragraphsRevealed: v.number(),
    totalWordsSeen: v.number(),
    totalAvailableWords: v.number(),
    answerQuality: v.number(),
    wrongAttempts: v.number(),
  },
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.id);
    if (!question) throw new Error("Question not found");

    await ctx.db.patch(args.id, {
      playersToday: question.playersToday + 1,
    });

    await ctx.db.insert("questionTelemetry", {
      questionId: args.id,
      quizSlug: question.quizSlug,
      date: question.date,
      score: args.score,
      elapsedSeconds: args.elapsedSeconds,
      visibleCardCount: args.visibleCardCount,
      paragraphsRevealed: args.paragraphsRevealed,
      totalWordsSeen: args.totalWordsSeen,
      totalAvailableWords: args.totalAvailableWords,
      answerQuality: args.answerQuality,
      wrongAttempts: args.wrongAttempts,
      createdAt: Date.now(),
    });
  },
});

export const getResultStats = query({
  args: {
    questionId: v.id("questions"),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    const entries = await ctx.db
      .query("questionTelemetry")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .take(1000);

    const attempts = Math.max(question.playersToday, 1);
    const betterScores = entries.filter((entry) => entry.score > args.score);

    return {
      playersToday: attempts,
      rank: Math.max(1, Math.min(attempts, betterScores.length + 1)),
    };
  },
});

export const createQuestion = mutation({
  args: {
    quizSlug: v.string(),
    date: v.string(),
    number: v.number(),
    title: v.string(),
    answer: v.string(),
    answerKeywords: v.array(v.string()),
    category: v.string(),
    question: v.string(),
    paragraphs: v.array(v.any()),
    answerSnippet: v.object({
      title: v.string(),
      body: v.any(),
    }),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("questions")
      .withIndex("by_quiz_date", (q) =>
        q.eq("quizSlug", args.quizSlug).eq("date", args.date),
      )
      .unique();

    if (existing) {
      throw new Error(`Question for date ${args.date} already exists`);
    }

    return await ctx.db.insert("questions", {
      ...args,
      playersToday: 0,
    });
  },
});

export const updateQuestion = mutation({
  args: {
    id: v.id("questions"),
    title: v.string(),
    answer: v.string(),
    answerKeywords: v.array(v.string()),
    category: v.string(),
    question: v.string(),
    paragraphs: v.array(v.any()),
    answerSnippet: v.object({
      title: v.string(),
      body: v.any(),
    }),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
