import type { Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  getUserRole,
  isAdminUser,
  optionalAuth,
  requireAdmin,
} from "./lib/auth";

async function getUserEmail(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  if (user.email) return user.email;

  for await (const authAccount of ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))) {
    if (
      authAccount.providerAccountId &&
      authAccount.providerAccountId.includes("@")
    ) {
      return authAccount.providerAccountId;
    }
  }

  return null;
}

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        email: null,
        userId: null,
        role: null,
      };
    }

    const role = await getUserRole(ctx, userId);
    const email = await getUserEmail(ctx, userId);

    return {
      isAuthenticated: true,
      isAdmin: await isAdminUser(ctx, userId),
      email,
      userId,
      role,
    };
  },
});

export const getArchive = query({
  args: { quizSlug: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    return await ctx.db
      .query("questions")
      .withIndex("by_quiz_date", (q) => q.eq("quizSlug", args.quizSlug))
      .order("desc")
      .take(1000);
  },
});

export const getAnswer = query({
  args: { quizSlug: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const question = await ctx.db
      .query("questions")
      .withIndex("by_quiz_date", (q) =>
        q.eq("quizSlug", args.quizSlug).eq("date", args.date),
      )
      .unique();

    if (!question) {
      return null;
    }

    return {
      answer: question.answer,
      answerKeywords: question.answerKeywords,
      answerSnippet: question.answerSnippet,
    };
  },
});

export const setUserRole = internalMutation({
  args: {
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { userRole: args.role });

    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }

    return await ctx.db.insert("userRoles", args);
  },
});

export const setUserRoleByEmail = internalMutation({
  args: {
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (!user?._id) {
      throw new Error(`No auth user found for ${email}`);
    }

    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    await ctx.db.patch(user._id, { userRole: args.role });

    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }

    return await ctx.db.insert("userRoles", {
      userId: user._id,
      role: args.role,
    });
  },
});
