import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../init";

export const appRouter = createTRPCRouter({
  // Public procedure example
  hello: publicProcedure
    .input(z.object({ text: z.string().optional() }).optional())
    .query(({ input }) => {
      return {
        greeting: `Hello ${input?.text ?? "world"}!`,
      };
    }),

  // Protected procedure example - requires authentication
  getSecretMessage: protectedProcedure.query(({ ctx }) => {
    return {
      message: `Hello ${ctx.session.user?.name ?? "user"}! This is a protected message.`,
    };
  }),
});

export type AppRouter = typeof appRouter;
