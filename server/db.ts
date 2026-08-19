import { and, eq, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, localAccounts, localSessions, processMembers, registrationLinks, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { isFileStoreActive, mutateStore, nextSequence, readStore } from "./store/local-store";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Local identity and workflow membership.
 *
 * Each function has two paths: the shared MySQL tables when DATABASE_URL is
 * configured, and the file-backed store otherwise, so the application is usable
 * without provisioning a database. Both paths honour the same rules — unique
 * e-mail, single-use invites, session expiry and revocation.
 */

export async function getLocalAccountCount() {
  if (isFileStoreActive()) return readStore().accounts.length;
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ id: localAccounts.id }).from(localAccounts);
  return rows.length;
}

export async function getLocalAccountByEmail(email: string) {
  if (isFileStoreActive()) return readStore().accounts.find((account) => account.email === email.toLowerCase());
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(localAccounts).where(eq(localAccounts.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function getLocalAccountById(id: number) {
  if (isFileStoreActive()) return readStore().accounts.find((account) => account.id === id);
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(localAccounts).where(eq(localAccounts.id, id)).limit(1);
  return result[0];
}

export async function createLocalAccount(data: { name: string; email: string; registrationId: string; role: "coordinator" | "signer" | "viewer"; passwordHash: string; passwordSalt: string }) {
  if (isFileStoreActive()) {
    const id = nextSequence("account");
    mutateStore((state) => {
      state.accounts.push({ ...data, id, email: data.email.toLowerCase(), isActive: true, createdAt: new Date().toISOString() });
    });
    return id;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(localAccounts).values({ ...data, email: data.email.toLowerCase() });
  return Number(result[0].insertId);
}

export async function updateLastSignedIn(id: number) {
  if (isFileStoreActive()) {
    mutateStore((state) => {
      const account = state.accounts.find((item) => item.id === id);
      if (account) account.lastSignedIn = new Date().toISOString();
    });
    return;
  }
  const db = await getDb();
  if (!db) return;
  await db.update(localAccounts).set({ lastSignedIn: new Date() }).where(eq(localAccounts.id, id));
}

export async function createLocalSession(data: { accountId: number; tokenHash: string; expiresAt: Date }) {
  if (isFileStoreActive()) {
    mutateStore((state) => {
      state.sessions.push({ accountId: data.accountId, tokenHash: data.tokenHash, expiresAt: data.expiresAt.toISOString() });
    });
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(localSessions).values(data);
}

export async function getActiveLocalSession(tokenHash: string) {
  if (isFileStoreActive()) {
    const now = Date.now();
    return readStore().sessions.find(
      (session) => session.tokenHash === tokenHash && !session.revokedAt && Date.parse(session.expiresAt) > now,
    );
  }
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(localSessions).where(and(eq(localSessions.tokenHash, tokenHash), isNull(localSessions.revokedAt), gt(localSessions.expiresAt, new Date()))).limit(1);
  return result[0];
}

export async function revokeLocalSession(tokenHash: string) {
  if (isFileStoreActive()) {
    mutateStore((state) => {
      const session = state.sessions.find((item) => item.tokenHash === tokenHash);
      if (session) session.revokedAt = new Date().toISOString();
    });
    return;
  }
  const db = await getDb();
  if (!db) return;
  await db.update(localSessions).set({ revokedAt: new Date() }).where(eq(localSessions.tokenHash, tokenHash));
}

export async function getRegistrationLink(tokenHash: string) {
  if (isFileStoreActive()) {
    const now = Date.now();
    return readStore().invites.find(
      (invite) => invite.tokenHash === tokenHash && !invite.usedAt && Date.parse(invite.expiresAt) > now,
    );
  }
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(registrationLinks).where(and(eq(registrationLinks.tokenHash, tokenHash), isNull(registrationLinks.usedAt), gt(registrationLinks.expiresAt, new Date()))).limit(1);
  return result[0];
}

export async function consumeRegistrationLink(id: number) {
  if (isFileStoreActive()) {
    mutateStore((state) => {
      const invite = state.invites.find((item) => item.id === id);
      if (invite) invite.usedAt = new Date().toISOString();
    });
    return;
  }
  const db = await getDb();
  if (!db) return;
  await db.update(registrationLinks).set({ usedAt: new Date() }).where(eq(registrationLinks.id, id));
}

export async function createRegistrationLink(data: { tokenHash: string; processId: string; stageId: string; functionKey: string; signatureOrder: number; expiresAt: Date }) {
  if (isFileStoreActive()) {
    const id = nextSequence("invite");
    mutateStore((state) => {
      state.invites.push({ ...data, id, expiresAt: data.expiresAt.toISOString() });
    });
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(registrationLinks).values(data);
}

export async function createProcessMember(data: { processId: string; accountId: number; functionKey: string; stageId: string; signatureOrder: number }) {
  if (isFileStoreActive()) {
    mutateStore((state) => {
      const exists = state.members.some(
        (member) => member.processId === data.processId && member.accountId === data.accountId && member.stageId === data.stageId,
      );
      if (!exists) state.members.push({ ...data });
    });
    return;
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(processMembers).values(data);
}

export async function getProcessMember(processId: string, accountId: number, stageId: string) {
  if (isFileStoreActive()) {
    return readStore().members.find(
      (member) => member.processId === processId && member.accountId === accountId && member.stageId === stageId,
    );
  }
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(processMembers).where(and(eq(processMembers.processId, processId), eq(processMembers.accountId, accountId), eq(processMembers.stageId, stageId))).limit(1);
  return result[0];
}
