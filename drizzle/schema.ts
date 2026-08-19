import { boolean, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const localAccounts = mysqlTable("local_accounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  registrationId: varchar("registrationId", { length: 80 }).notNull().unique(),
  role: mysqlEnum("role", ["coordinator", "signer", "viewer"]).default("signer").notNull(),
  passwordHash: text("passwordHash").notNull(),
  passwordSalt: varchar("passwordSalt", { length: 64 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export const registrationLinks = mysqlTable("registration_links", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  processId: varchar("processId", { length: 128 }).notNull(),
  stageId: varchar("stageId", { length: 64 }).notNull(),
  functionKey: varchar("functionKey", { length: 80 }).notNull(),
  signatureOrder: int("signatureOrder").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const localSessions = mysqlTable("local_sessions", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const processMembers = mysqlTable("process_members", {
  id: int("id").autoincrement().primaryKey(),
  processId: varchar("processId", { length: 128 }).notNull(),
  accountId: varchar("accountId", { length: 128 }).notNull(),
  functionKey: varchar("functionKey", { length: 80 }).notNull(),
  stageId: varchar("stageId", { length: 64 }).notNull(),
  signatureOrder: int("signatureOrder").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LocalAccount = typeof localAccounts.$inferSelect;
export type RegistrationLink = typeof registrationLinks.$inferSelect;
export type LocalSession = typeof localSessions.$inferSelect;
export type ProcessMember = typeof processMembers.$inferSelect;

/**
 * Shared source of truth for the LMP workflow. Until these tables existed the
 * planilha lived only in each browser, so two signers never saw the same
 * document. Every edit, signature and audit event now lands here.
 */
export const processes = mysqlTable("processes", {
  id: varchar("id", { length: 128 }).primaryKey(),
  protocol: varchar("protocol", { length: 180 }).notNull(),
  candidateName: varchar("candidateName", { length: 180 }).notNull(),
  candidateRank: varchar("candidateRank", { length: 120 }).notNull(),
  grade: varchar("grade", { length: 80 }).notNull(),
  opm: varchar("opm", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["in_progress", "completed"]).default("in_progress").notNull(),
  source: varchar("source", { length: 40 }).default("PM-COM-002").notNull(),
  certificationState: varchar("certificationState", { length: 64 }).default("evidence_pending_qualification").notNull(),
  /** Optimistic concurrency guard: every mutation bumps it and signatures pin it. */
  version: int("version").default(1).notNull(),
  createdByAccountId: varchar("createdByAccountId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const processStages = mysqlTable("process_stages", {
  id: int("id").autoincrement().primaryKey(),
  processId: varchar("processId", { length: 128 }).notNull(),
  stageKey: varchar("stageKey", { length: 64 }).notNull(),
  stageOrder: int("stageOrder").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  role: varchar("role", { length: 180 }).notNull(),
  signerName: varchar("signerName", { length: 180 }).notNull(),
  optional: boolean("optional").default(false).notNull(),
  status: mysqlEnum("status", ["waiting", "active", "signed", "skipped"]).default("waiting").notNull(),
  fields: json("fields").$type<Record<string, string | boolean>>(),
  signedAt: timestamp("signedAt"),
  integrityHash: varchar("integrityHash", { length: 128 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("process_stages_process_stage_idx").on(table.processId, table.stageKey),
]);

export const processEvents = mysqlTable("process_events", {
  id: int("id").autoincrement().primaryKey(),
  eventKey: varchar("eventKey", { length: 64 }).notNull().unique(),
  processId: varchar("processId", { length: 128 }).notNull(),
  actor: varchar("actor", { length: 180 }).notNull(),
  type: mysqlEnum("type", ["created", "saved", "signed", "forwarded", "reminder", "skipped"]).notNull(),
  description: text("description").notNull(),
  hash: varchar("hash", { length: 128 }),
  accountId: varchar("accountId", { length: 128 }),
  at: timestamp("at").defaultNow().notNull(),
}, (table) => [
  index("process_events_process_idx").on(table.processId),
]);

/**
 * Immutable signature evidence. `idempotencyKey` makes a retried request
 * return the original signature instead of recording a second one.
 */
export const processSignatures = mysqlTable("process_signatures", {
  id: int("id").autoincrement().primaryKey(),
  processId: varchar("processId", { length: 128 }).notNull(),
  stageKey: varchar("stageKey", { length: 64 }).notNull(),
  accountId: varchar("accountId", { length: 128 }).notNull(),
  signerName: varchar("signerName", { length: 180 }).notNull(),
  signerRegistrationId: varchar("signerRegistrationId", { length: 80 }).notNull(),
  functionKey: varchar("functionKey", { length: 80 }).notNull(),
  signatureOrder: int("signatureOrder").notNull(),
  integrityHash: varchar("integrityHash", { length: 128 }).notNull(),
  documentVersion: int("documentVersion").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull().unique(),
  /** Which adapter produced the evidence. Local evidence is not qualified certification. */
  provider: varchar("provider", { length: 64 }).default("local-evidence").notNull(),
  providerReference: text("providerReference"),
  signedAt: timestamp("signedAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("process_signatures_process_stage_idx").on(table.processId, table.stageKey),
]);

export type ProcessRow = typeof processes.$inferSelect;
export type ProcessStageRow = typeof processStages.$inferSelect;
export type ProcessEventRow = typeof processEvents.$inferSelect;
export type ProcessSignatureRow = typeof processSignatures.$inferSelect;
