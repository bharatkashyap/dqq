import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    if (user.email) {
      return user;
    }

    for await (const authAccount of ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))) {
      if (
        authAccount.providerAccountId &&
        authAccount.providerAccountId.includes("@")
      ) {
        return {
          ...user,
          email: authAccount.providerAccountId,
        };
      }
    }

    return user;
  },
});
