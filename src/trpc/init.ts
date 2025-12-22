import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { auth } from "@/server/auth";

/**
 * Create context for each tRPC request
 */
export const createTRPCContext = cache(async () => {
  const session = await auth();

  return {
    session,
    userId: session?.user?.id,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create();

/**
 * Create a router
 */
export const createTRPCRouter = t.router;

/**
 * Create a caller factory for server-side calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure - accessible to everyone
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      session: ctx.session,
      userId: ctx.userId,
    },
  });
});
