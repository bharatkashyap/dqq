import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Unauthorized: Please log in");
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("Unauthorized: User not found");
  }

  return userId;
}

export async function optionalAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const user = await ctx.db.get(userId);
  if (!user) return null;

  return userId;
}

export async function getUserRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<string | null> {
  const user = await ctx.db.get(userId);
  if (!user) return null;

  if (typeof user.userRole === "string" && user.userRole.trim()) {
    return user.userRole;
  }

  const role = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  return role?.role ?? null;
}

export async function isAdminUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  return (await getUserRole(ctx, userId)) === "admin";
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await requireAuth(ctx);
  const isAdmin = await isAdminUser(ctx, userId);

  if (!isAdmin) {
    throw new ConvexError("Unauthorized: Admin access required");
  }

  return userId;
}
