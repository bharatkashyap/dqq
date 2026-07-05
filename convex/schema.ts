import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  answerSlideValidator,
  answerSnippetValidator,
} from "./lib/answerSlides";

export default defineSchema({
  ...authTables,

  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    userRole: v.optional(v.string()),
  }).index("email", ["email"]),

  questions: defineTable({
    quizSlug: v.string(),
    date: v.string(),
    number: v.number(),
    title: v.string(),
    answer: v.string(),
    answerKeywords: v.array(v.string()),
    category: v.string(),
    playersToday: v.number(),
    question: v.string(),
    paragraphs: v.array(v.any()),
    answerSnippet: answerSnippetValidator,
    answerSlides: v.optional(v.array(answerSlideValidator)),
  })
    .index("by_quiz_date", ["quizSlug", "date"])
    .index("by_quiz_number", ["quizSlug", "number"]),

  questionTelemetry: defineTable({
    questionId: v.id("questions"),
    quizSlug: v.string(),
    date: v.string(),
    score: v.number(),
    elapsedSeconds: v.number(),
    visibleCardCount: v.number(),
    paragraphsRevealed: v.number(),
    totalWordsSeen: v.number(),
    totalAvailableWords: v.number(),
    answerQuality: v.number(),
    wrongAttempts: v.number(),
    createdAt: v.number(),
  })
    .index("by_question", ["questionId"])
    .index("by_quiz_date", ["quizSlug", "date"]),

  userRoles: defineTable({
    userId: v.id("users"),
    role: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_role", ["role"]),
});
