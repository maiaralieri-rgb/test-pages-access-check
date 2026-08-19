import { COOKIE_NAME } from "../shared/const.js";
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { createOpaqueToken, createPasswordHash, getLocalAccountForRequest, getSessionToken, hashOpaqueToken, isStrongPassword, LOCAL_SESSION_COOKIE, LOCAL_SESSION_DAYS, validateRegistrationCode, verifyPassword } from "./auth/local-auth";
import { WorkflowError } from "../lib/workflow-server-core";
import { getWorkflowService, type WorkflowActor } from "./workflow";

const stageFields = z.record(z.string().max(80), z.union([z.string().max(8000), z.boolean()]));

/** Every workflow mutation runs as an authenticated account; there is no anonymous write path. */
async function requireActor(req: Request): Promise<WorkflowActor> {
  const account = await getLocalAccountForRequest(req);
  if (!account || !account.isActive) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre com sua conta particular para continuar." });
  }
  return { accountId: account.id, name: account.name, registrationId: account.registrationId, role: account.role };
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
      if (!validateRegistrationCode(input.registrationCode)) throw new Error("Código de cadastro inválido.");
      if (!isStrongPassword(input.password)) throw new Error("A senha deve ter ao menos 10 caracteres, uma maiúscula, uma minúscula e um número.");
      if (await db.getLocalAccountByEmail(input.email)) throw new Error("Já existe uma conta com este e-mail.");
      const accountCount = await db.getLocalAccountCount();
      let invitation = input.inviteToken ? await db.getRegistrationLink(hashOpaqueToken(input.inviteToken)) : undefined;
      if (input.inviteToken && !invitation) throw new Error("O link de cadastro expirou, já foi utilizado ou não é válido.");
      const role = invitation?.functionKey === "coordenacao" || accountCount === 0 ? "coordinator" : "signer";
      const password = createPasswordHash(input.password);
      const accountId = await db.createLocalAccount({ name: input.name, email: input.email, registrationId: input.registrationId, role, passwordHash: password.hash, passwordSalt: password.salt });
      if (invitation) {
        await db.createProcessMember({ processId: invitation.processId, accountId, functionKey: invitation.functionKey, stageId: invitation.stageId, signatureOrder: invitation.signatureOrder });
        await db.consumeRegistrationLink(invitation.id);
      }
      const sessionToken = createOpaqueToken();
      await db.createLocalSession({ accountId, tokenHash: hashOpaqueToken(sessionToken), expiresAt: new Date(Date.now() + LOCAL_SESSION_DAYS * 24 * 60 * 60 * 1000) });
      ctx.res.cookie(LOCAL_SESSION_COOKIE, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: LOCAL_SESSION_DAYS * 24 * 60 * 60 * 1000 });
      return { accountId, name: input.name, email: input.email, role };
    }),
    login: publicProcedure.input(z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const account = await db.getLocalAccountByEmail(input.email);
      if (!account || !account.isActive || !verifyPassword(input.password, account.passwordSalt, account.passwordHash)) throw new Error("E-mail ou senha inválidos.");
      const sessionToken = createOpaqueToken();
      await db.createLocalSession({ accountId: account.id, tokenHash: hashOpaqueToken(sessionToken), expiresAt: new Date(Date.now() + LOCAL_SESSION_DAYS * 24 * 60 * 60 * 1000) });
      await db.updateLastSignedIn(account.id);
      ctx.res.cookie(LOCAL_SESSION_COOKIE, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: LOCAL_SESSION_DAYS * 24 * 60 * 60 * 1000 });
      return { accountId: account.id, name: account.name, email: account.email, role: account.role };
    }),
    me: publicProcedure.query(async ({ ctx }) => {
      const account = await getLocalAccountForRequest(ctx.req);
      return account ? { accountId: account.id, name: account.name, email: account.email, role: account.role } : null;
    }),
    authorization: publicProcedure.input(z.object({ processId: z.string().min(1).max(128), stageId: z.string().min(1).max(64) })).query(async ({ ctx, input }) => {
      const account = await getLocalAccountForRequest(ctx.req);
      if (!account) return null;
      if (account.role === "coordinator") return { functionKey: "coordenacao", stageId: input.stageId, signatureOrder: 0 };
      const member = await db.getProcessMember(input.processId, account.id, input.stageId);
      return member ? { functionKey: member.functionKey, stageId: member.stageId, signatureOrder: member.signatureOrder } : null;
    }),
    assertCanSign: publicProcedure.input(z.object({ processId: z.string().min(1).max(128), stageId: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const account = await getLocalAccountForRequest(ctx.req);
      if (!account) throw new Error("Entre com sua conta particular antes de assinar.");
      if (account.role !== "coordinator" && !(await db.getProcessMember(input.processId, account.id, input.stageId))) throw new Error("Sua função não está autorizada a assinar este campo.");
      return { allowed: true, accountId: account.id } as const;
    }),
    createInvite: publicProcedure.input(z.object({ processId: z.string().min(1).max(128), stageId: z.string().min(1).max(64), functionKey: z.string().min(1).max(80), signatureOrder: z.number().int().min(1).max(99), expiresInHours: z.number().int().min(1).max(720).default(72) })).mutation(async ({ ctx, input }) => {
      const account = await getLocalAccountForRequest(ctx.req);
      if (!account || account.role !== "coordinator") throw new Error("Somente a coordenação pode criar links de cadastro.");
      const token = createOpaqueToken(32);
      await db.createRegistrationLink({ tokenHash: hashOpaqueToken(token), processId: input.processId, stageId: input.stageId, functionKey: input.functionKey, signatureOrder: input.signatureOrder, expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000) });
      return { token, expiresInHours: input.expiresInHours };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = getSessionToken(ctx.req);
      if (token) await db.revokeLocalSession(hashOpaqueToken(token));
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...getSessionCookieOptions(ctx.req), maxAge: 0 });
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
