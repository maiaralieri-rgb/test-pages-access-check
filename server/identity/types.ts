import type { Request } from "express";

export type AccountRole = "coordinator" | "signer" | "viewer";

export type IdentityAccount = {
  accountId: string;
  name: string;
  email: string;
  registrationId: string;
  role: AccountRole;
};

export type RegisterInput = {
  name: string;
  email: string;
  registrationId: string;
  password: string;
  registrationCode: string;
  inviteToken?: string;
};

export type InviteInput = {
  processId: string;
  stageId: string;
  functionKey: string;
  signatureOrder: number;
  expiresInHours: number;
};

export type StageMembership = { functionKey: string; stageId: string; signatureOrder: number };

/**
 * Identity port. Two implementations exist: the original local accounts with
 * hand-rolled sessions, and Firebase Auth. The routers only ever talk to this,
 * so switching providers does not touch the workflow rules.
 */
export interface IdentityProvider {
  readonly id: "local" | "firebase";
  /** True when the client authenticates with an ID token instead of a cookie. */
  readonly usesBearerToken: boolean;
  accountFromRequest(req: Request): Promise<IdentityAccount | undefined>;
  register(input: RegisterInput, req: Request, res: ResponseLike): Promise<IdentityAccount>;
  login(email: string, password: string, req: Request, res: ResponseLike): Promise<IdentityAccount>;
  logout(req: Request, res: ResponseLike): Promise<void>;
  createInvite(actor: IdentityAccount, input: InviteInput): Promise<{ token: string; expiresInHours: number }>;
  getMembership(processId: string, accountId: string, stageId: string): Promise<StageMembership | undefined>;
}

/** Only the cookie helpers Express gives us; keeps the port testable. */
export type ResponseLike = {
  cookie: (name: string, value: string, options?: Record<string, unknown>) => unknown;
  clearCookie: (name: string, options?: Record<string, unknown>) => unknown;
};
