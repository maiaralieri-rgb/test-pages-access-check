import type { Request } from "express";
import { FieldValue } from "firebase-admin/firestore";

import { createOpaqueToken, hashOpaqueToken, isStrongPassword, validateRegistrationCode } from "../auth/local-auth";
import { getFirebaseAuth, getFirestoreDb } from "../firebase/admin";
import type {
  IdentityAccount,
  IdentityProvider,
  InviteInput,
  RegisterInput,
  ResponseLike,
  StageMembership,
} from "./types";

const ACCOUNTS = "accounts";
const INVITES = "invites";
const MEMBERS = "members";

const memberKey = (processId: string, accountId: string, stageId: string) => `${processId}__${accountId}__${stageId}`;

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
}

/**
 * Firebase Auth holds the credentials (so password reset, rate limiting and
 * token rotation are Google's problem, not ours) while the corporate profile —
 * posto/graduação, matrícula, função — lives in Firestore under the same uid.
 *
 * Accounts are created through the Admin SDK inside `register`, never by the
 * client directly, so the registration code and the stage invite are validated
 * before any credential exists.
 */
export class FirebaseIdentityProvider implements IdentityProvider {
  readonly id = "firebase" as const;
  readonly usesBearerToken = true;

  async accountFromRequest(req: Request): Promise<IdentityAccount | undefined> {
    const token = bearerToken(req);
    if (!token) return undefined;
    let uid: string;
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return undefined;
    }
    const snapshot = await getFirestoreDb().collection(ACCOUNTS).doc(uid).get();
    if (!snapshot.exists) return undefined;
    const data = snapshot.data() as Omit<IdentityAccount, "accountId"> & { isActive?: boolean };
    if (data.isActive === false) return undefined;
    return {
      accountId: uid,
      name: data.name,
      email: data.email,
      registrationId: data.registrationId,
      role: data.role,
    };
  }

  async register(input: RegisterInput, _req: Request, _res: ResponseLike): Promise<IdentityAccount> {
    if (!validateRegistrationCode(input.registrationCode)) throw new Error("Código de cadastro inválido.");
    if (!isStrongPassword(input.password)) {
      throw new Error("A senha deve ter ao menos 10 caracteres, uma maiúscula, uma minúscula e um número.");
    }

    const db = getFirestoreDb();
    const auth = getFirebaseAuth();

    const inviteRef = input.inviteToken ? db.collection(INVITES).doc(hashOpaqueToken(input.inviteToken)) : undefined;
    let invite: FirebaseFirestore.DocumentData | undefined;
    if (inviteRef) {
      const snapshot = await inviteRef.get();
      invite = snapshot.exists ? snapshot.data() : undefined;
      const expired = invite && Date.parse(invite.expiresAt) <= Date.now();
      if (!invite || invite.usedAt || expired) {
        throw new Error("O link de cadastro expirou, já foi utilizado ou não é válido.");
      }
    }

    // The very first account bootstraps coordination; everyone else is a signer
    // unless the invite explicitly grants coordination.
    const existing = await db.collection(ACCOUNTS).limit(1).get();
    const role = invite?.functionKey === "coordenacao" || existing.empty ? "coordinator" : "signer";

    const user = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
    });

    // Role travels in a custom claim so Security Rules can read it without a lookup.
    await auth.setCustomUserClaims(user.uid, { role });

    const account: IdentityAccount = {
      accountId: user.uid,
      name: input.name,
      email: input.email.toLowerCase(),
      registrationId: input.registrationId,
      role,
    };

    const batch = db.batch();
    batch.set(db.collection(ACCOUNTS).doc(user.uid), {
      name: account.name,
      email: account.email,
      registrationId: account.registrationId,
      role,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (invite && inviteRef) {
      batch.set(db.collection(MEMBERS).doc(memberKey(invite.processId, user.uid, invite.stageId)), {
        processId: invite.processId,
        accountId: user.uid,
        functionKey: invite.functionKey,
        stageId: invite.stageId,
        signatureOrder: invite.signatureOrder,
      });
      batch.update(inviteRef, { usedAt: new Date().toISOString(), usedBy: user.uid });
    }
    await batch.commit();

    return account;
  }

  async login(): Promise<IdentityAccount> {
    // Firebase Auth signs in on the client with the Web SDK; the server only
    // ever verifies the resulting ID token.
    throw new Error("Com o Firebase, a autenticação é feita no navegador. Use a tela de acesso do aplicativo.");
  }

  async logout(): Promise<void> {
    // Sign-out is a client-side operation against the Firebase SDK.
  }

  async createInvite(actor: IdentityAccount, input: InviteInput) {
    if (actor.role !== "coordinator") throw new Error("Somente a coordenação pode criar links de cadastro.");
    const token = createOpaqueToken(32);
    await getFirestoreDb()
      .collection(INVITES)
      .doc(hashOpaqueToken(token))
      .set({
        processId: input.processId,
        stageId: input.stageId,
        functionKey: input.functionKey,
        signatureOrder: input.signatureOrder,
        expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: actor.accountId,
        usedAt: null,
      });
    return { token, expiresInHours: input.expiresInHours };
  }

  async getMembership(processId: string, accountId: string, stageId: string): Promise<StageMembership | undefined> {
    const snapshot = await getFirestoreDb().collection(MEMBERS).doc(memberKey(processId, accountId, stageId)).get();
    if (!snapshot.exists) return undefined;
    const data = snapshot.data() as StageMembership;
    return { functionKey: data.functionKey, stageId: data.stageId, signatureOrder: data.signatureOrder };
  }
}
