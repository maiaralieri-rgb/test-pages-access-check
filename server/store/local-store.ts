import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { WorkflowDocument } from "../../lib/workflow-types";
import type { StoredSignature } from "../workflow/repository";

/**
 * Zero-configuration persistence used when DATABASE_URL is not set.
 *
 * It keeps the whole dataset in memory and writes it to a JSON file after every
 * committed change. Unlike the old browser storage this lives in the server
 * process, so every signer connected to the same server sees the same document
 * — which is the property the workflow actually depends on.
 *
 * It is deliberately single-process: good for a pilot or a local run, not for
 * several server instances behind a load balancer. For that, set DATABASE_URL
 * and the MySQL adapter takes over.
 */

export type AccountRecord = {
  id: number;
  name: string;
  email: string;
  registrationId: string;
  role: "coordinator" | "signer" | "viewer";
  passwordHash: string;
  passwordSalt: string;
  isActive: boolean;
  createdAt: string;
  lastSignedIn?: string;
};

export type SessionRecord = {
  accountId: number;
  tokenHash: string;
  expiresAt: string;
  revokedAt?: string;
};

export type InviteRecord = {
  id: number;
  tokenHash: string;
  processId: string;
  stageId: string;
  functionKey: string;
  signatureOrder: number;
  expiresAt: string;
  usedAt?: string;
};

export type MemberRecord = {
  processId: string;
  accountId: string;
  functionKey: string;
  stageId: string;
  signatureOrder: number;
};

export type StoreShape = {
  accounts: AccountRecord[];
  sessions: SessionRecord[];
  invites: InviteRecord[];
  members: MemberRecord[];
  documents: WorkflowDocument[];
  signatures: StoredSignature[];
  sequences: { account: number; invite: number };
};

const emptyStore = (): StoreShape => ({
  accounts: [],
  sessions: [],
  invites: [],
  members: [],
  documents: [],
  signatures: [],
  sequences: { account: 0, invite: 0 },
});

function dataFilePath() {
  return resolve(process.env.ASSINAFLUXO_DATA_FILE ?? ".data/assinafluxo.json");
}

let cache: StoreShape | null = null;

function load(): StoreShape {
  if (cache) return cache;
  const file = dataFilePath();
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<StoreShape>;
      cache = { ...emptyStore(), ...parsed, sequences: { ...emptyStore().sequences, ...parsed.sequences } };
      return cache;
    } catch (error) {
      // A corrupted file must not silently discard signatures.
      throw new Error(`Arquivo de dados inválido em ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  cache = emptyStore();
  return cache;
}

/** Written to a temp file first so an interrupted write cannot truncate the data. */
function persist(state: StoreShape) {
  const file = dataFilePath();
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(state, null, 2), "utf8");
  renameSync(temporary, file);
  cache = state;
}

export function readStore(): StoreShape {
  return load();
}

/** Applies a change and flushes it to disk, keeping memory and file in step. */
export function mutateStore<T>(handler: (state: StoreShape) => T): T {
  const state = load();
  const result = handler(state);
  persist(state);
  return result;
}

export function nextSequence(kind: keyof StoreShape["sequences"]) {
  return mutateStore((state) => {
    state.sequences[kind] += 1;
    return state.sequences[kind];
  });
}

export function isFileStoreActive() {
  return !process.env.DATABASE_URL;
}

export function describeStore() {
  return isFileStoreActive()
    ? `armazenamento local em ${dataFilePath()} (processo único)`
    : "banco MySQL compartilhado";
}

/** Test helper: drops the cached dataset so a suite can start clean. */
export function resetStoreCache() {
  cache = null;
}
