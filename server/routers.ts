import { COOKIE_NAME } from "../shared/const.js";
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getIdentityProvider } from "./identity";
import { WorkflowError } from "../lib/workflow-server-core";
import { getWorkflowService, type WorkflowActor } from "./workflow";

const stageFields = z.record(z.string().max(80), z.union([z.string().max(8000), z.boolean()]));

/** Every workflow mutation runs as an authenticated account; there is no anonymous write path. */
async function requireActor(req: Request): Promise<WorkflowActor> {
  const account = await getIdentityProvider().accountFromRequest(req);
  if (!account) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre com sua conta particular para continuar." });
  }
  return { accountId: account.accountId, name: account.name, registrationId: account.registrationId, role: account.role };
}

/** Domain codes become transport codes so the UI can distinguish a conflict from a denial. */
function toTrpcError(error: unknown): never {
  if (error instanceof WorkflowError) {
    const code = error.code === "not_authorized" ? "FORBIDDEN" : error.code === "version_conflict" ? "CONFLICT" : error.code === "stage_not_found" ? "NOT_FOUND" : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message, cause: error });
  }
  throw error;
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  localAuth: router({
    register: publicProcedure.input(z.object({
      name: z.string().trim().min(2).max(180),
      email: z.string().trim().email().max(320),
      registrationId: z.string().trim().min(3).max(80),
      password: z.string().min(10).max(128),
      registrationCode: z.string().min(1).max(256),
      inviteToken: z.string().max(256).optional(),
    })).mutation(async ({ ctx, input }) => {
      const account = await getIdentityProvider().register(input, ctx.req, ctx.res);
      return { accountId: account.accountId, name: account.name, email: account.email, role: account.role };
    }),
    login: publicProcedure.input(z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const account = await getIdentityProvider().login(input.email, input.password, ctx.req, ctx.res);
      return { accountId: account.accountId, name: account.name, email: account.email, role: account.role };
    }),
    me: publicProcedure.query(async ({ ctx }) => {
      const account = await getIdentityProvider().accountFromRequest(ctx.req);
      return account ? { accountId: account.accountId, name: account.name, email: account.email, role: account.role } : null;
    }),
    /** Tells the client which sign-in mechanism this deployment uses. */
    mode: publicProcedure.query(() => {
      const identity = getIdentityProvider();
      return { provider: identity.id, usesBearerToken: identity.usesBearerToken } as const;
    }),
    authorization: publicProcedure.input(z.object({ processId: z.string().min(1).max(128), stageId: z.string().min(1).max(64) })).query(async ({ ctx, input }) => {
      const identity = getIdentityProvider();
      const account = await identity.accountFromRequest(ctx.req);
      if (!account) return null;
      if (account.role === "coordinator") return { functionKey: "coordenacao", stageId: input.stageId, signatureOrder: 0 };
      const member = await identity.getMembership(input.processId, account.accountId, input.stageId);
      return member ? { functionKey: member.functionKey, stageId: member.stageId, signatureOrder: member.signatureOrder } : null;
    }),
    createInvite: publicProcedure.input(z.object({ processId: z.string().min(1).max(128), stageId: z.string().min(1).max(64), functionKey: z.string().min(1).max(80), signatureOrder: z.number().int().min(1).max(99), expiresInHours: z.number().int().min(1).max(720).default(72) })).mutation(async ({ ctx, input }) => {
      const identity = getIdentityProvider();
      const account = await identity.accountFromRequest(ctx.req);
      if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre com sua conta para criar links." });
      return identity.createInvite(account, input);
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await getIdentityProvider().logout(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  /**
   * Shared source of truth for the planilha. Replaces the browser-local store:
   * every read and write goes through the transactional service so two signers
   * always see the same document.
   */
  workflow: router({
    list: publicProcedure.query(async ({ ctx }) => {
      await requireActor(ctx.req);
      return getWorkflowService().listProcesses();
    }),
    get: publicProcedure.input(z.object({ processId: z.string().min(1).max(128) })).query(async ({ ctx, input }) => {
      await requireActor(ctx.req);
      const document = await getWorkflowService().getProcess(input.processId);
      if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Processo não encontrado." });
      return document;
    }),
    signatures: publicProcedure.input(z.object({ processId: z.string().min(1).max(128) })).query(async ({ ctx, input }) => {
      await requireActor(ctx.req);
      return getWorkflowService().listSignatures(input.processId);
    }),
    create: publicProcedure.input(z.object({
      protocol: z.string().trim().min(1).max(180),
      candidateName: z.string().trim().min(2).max(180),
      candidateRank: z.string().trim().min(1).max(120),
      grade: z.string().trim().min(1).max(80),
      opm: z.string().trim().min(1).max(180),
    })).mutation(async ({ ctx, input }) => {
      const actor = await requireActor(ctx.req);
      try {
        return await getWorkflowService().createProcess(actor, input);
      } catch (error) {
        toTrpcError(error);
      }
    }),
    saveDraft: publicProcedure.input(z.object({
      processId: z.string().min(1).max(128),
      stageId: z.string().min(1).max(64),
      fields: stageFields,
      expectedVersion: z.number().int().min(1).optional(),
    })).mutation(async ({ ctx, input }) => {
      const actor = await requireActor(ctx.req);
      try {
        return await getWorkflowService().saveStageDraft(actor, { processId: input.processId, stageKey: input.stageId, fields: input.fields, expectedVersion: input.expectedVersion });
      } catch (error) {
        toTrpcError(error);
      }
    }),
    sign: publicProcedure.input(z.object({
      processId: z.string().min(1).max(128),
      stageId: z.string().min(1).max(64),
      fields: stageFields.optional(),
      expectedVersion: z.number().int().min(1).optional(),
    })).mutation(async ({ ctx, input }) => {
      const actor = await requireActor(ctx.req);
      try {
        return await getWorkflowService().signStage(actor, { processId: input.processId, stageKey: input.stageId, fields: input.fields, expectedVersion: input.expectedVersion });
      } catch (error) {
        toTrpcError(error);
      }
    }),
    skip: publicProcedure.input(z.object({ processId: z.string().min(1).max(128), stageId: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const actor = await requireActor(ctx.req);
      try {
        return await getWorkflowService().skipStage(actor, { processId: input.processId, stageKey: input.stageId });
      } catch (error) {
        toTrpcError(error);
      }
    }),
    reminder: publicProcedure.input(z.object({ processId: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const actor = await requireActor(ctx.req);
      try {
        return await getWorkflowService().sendReminder(actor, input.processId);
      } catch (error) {
        toTrpcError(error);
      }
    }),
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
