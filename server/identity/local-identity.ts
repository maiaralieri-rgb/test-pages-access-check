import type { Request } from "express";

import {
  createOpaqueToken,
  createPasswordHash,
  getLocalAccountForRequest,
  getSessionToken,
  hashOpaqueToken,
  isStrongPassword,
  LOCAL_SESSION_COOKIE,
  LOCAL_SESSION_DAYS,
  validateRegistrationCode,
  verifyPassword,
} from "../auth/local-auth";
import { getSessionCookieOptions } from "../_core/cookies";
import * as db from "../db";
import type {
  IdentityAccount,
  IdentityProvider,
  InviteInput,
  RegisterInput,
  ResponseLike,
  StageMembership,
} from "./types";

const SESSION_MS = LOCAL_SESSION_DAYS * 24 * 60 * 60 * 1000;

/** Original provider: local accounts, scrypt passwords and cookie sessions. */
export class LocalIdentityProvider implements IdentityProvider {
  readonly id = "local" as const;
  readonly usesBearerToken = false;

  constructor(private readonly cookieOptions: (req: Request) => Record<string, unknown> = getSessionCookieOptions) {}

  async accountFromRequest(req: Request): Promise<IdentityAccount | undefined> {
    const account = await getLocalAccountForRequest(req);
    if (!account || !account.isActive) return undefined;
    return {
      accountId: String(account.id),
      name: account.name,
      email: account.email,
      registrationId: account.registrationId,
      role: account.role,
    };
  }

  private async startSession(req: Request, res: ResponseLike, accountId: number) {
    const token = createOpaqueToken();
    await db.createLocalSession({
      accountId,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + SESSION_MS),
    });
    res.cookie(LOCAL_SESSION_COOKIE, token, { ...this.cookieOptions(req), maxAge: SESSION_MS });
  }

  async register(input: RegisterInput, req: Request, res: ResponseLike): Promise<IdentityAccount> {
    if (!validateRegistrationCode(input.registrationCode)) throw new Error("Código de cadastro inválido.");
    if (!isStrongPassword(input.password)) {
      throw new Error("A senha deve ter ao menos 10 caracteres, uma maiúscula, uma minúscula e um número.");
    }
    if (await db.getLocalAccountByEmail(input.email)) throw new Error("Já existe uma conta com este e-mail.");

    const accountCount = await db.getLocalAccountCount();
    const invitation = input.inviteToken ? await db.getRegistrationLink(hashOpaqueToken(input.inviteToken)) : undefined;
    if (input.inviteToken && !invitation) {
      throw new Error("O link de cadastro expirou, já foi utilizado ou não é válido.");
    }

    const role = invitation?.functionKey === "coordenacao" || accountCount === 0 ? "coordinator" : "signer";
    const password = createPasswordHash(input.password);
    const accountId = await db.createLocalAccount({
      name: input.name,
      email: input.email,
      registrationId: input.registrationId,
      role,
      passwordHash: password.hash,
      passwordSalt: password.salt,
    });

    if (invitation) {
      await db.createProcessMember({
        processId: invitation.processId,
        accountId: String(accountId),
        functionKey: invitation.functionKey,
        stageId: invitation.stageId,
        signatureOrder: invitation.signatureOrder,
      });
      await db.consumeRegistrationLink(invitation.id);
    }

    await this.startSession(req, res, accountId);
    return {
      accountId: String(accountId),
      name: input.name,
      email: input.email,
      registrationId: input.registrationId,
      role,
    };
  }

  async login(email: string, password: string, req: Request, res: ResponseLike): Promise<IdentityAccount> {
    const account = await db.getLocalAccountByEmail(email);
    if (!account || !account.isActive || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      throw new Error("E-mail ou senha inválidos.");
    }
    await this.startSession(req, res, account.id);
    await db.updateLastSignedIn(account.id);
    return {
      accountId: String(account.id),
      name: account.name,
      email: account.email,
      registrationId: account.registrationId,
      role: account.role,
    };
  }

  async logout(req: Request, res: ResponseLike): Promise<void> {
    const token = getSessionToken(req);
    if (token) await db.revokeLocalSession(hashOpaqueToken(token));
    res.clearCookie(LOCAL_SESSION_COOKIE, { ...this.cookieOptions(req), maxAge: 0 });
  }

  async createInvite(actor: IdentityAccount, input: InviteInput) {
    if (actor.role !== "coordinator") throw new Error("Somente a coordenação pode criar links de cadastro.");
    const token = createOpaqueToken(32);
    await db.createRegistrationLink({
      tokenHash: hashOpaqueToken(token),
      processId: input.processId,
      stageId: input.stageId,
      functionKey: input.functionKey,
      signatureOrder: input.signatureOrder,
      expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000),
    });
    return { token, expiresInHours: input.expiresInHours };
  }

  async getMembership(processId: string, accountId: string, stageId: string): Promise<StageMembership | undefined> {
    const member = await db.getProcessMember(processId, accountId, stageId);
    return member
      ? { functionKey: member.functionKey, stageId: member.stageId, signatureOrder: member.signatureOrder }
      : undefined;
  }
}
