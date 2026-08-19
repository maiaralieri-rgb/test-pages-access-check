import type { WorkflowDocument } from "../../lib/workflow-types";

export type StoredSignature = {
  processId: string;
  stageKey: string;
  accountId: string;
  signerName: string;
  signerRegistrationId: string;
  functionKey: string;
  signatureOrder: number;
  integrityHash: string;
  documentVersion: number;
  idempotencyKey: string;
  provider: string;
  providerReference?: string;
  signedAt: string;
};

/**
 * Reads and writes available inside one atomic unit of work. The service layer
 * only ever touches the store through this, so the same logic runs against
 * MySQL in production and against the in-memory adapter in tests.
 */
export type WorkflowTx = {
  listProcesses(): Promise<WorkflowDocument[]>;
  getProcess(processId: string): Promise<WorkflowDocument | undefined>;
  insertProcess(document: WorkflowDocument, createdByAccountId: string | null): Promise<void>;
  saveProcess(document: WorkflowDocument): Promise<void>;
  getSignature(processId: string, stageKey: string): Promise<StoredSignature | undefined>;
  getSignatureByIdempotencyKey(idempotencyKey: string): Promise<StoredSignature | undefined>;
  insertSignature(signature: StoredSignature): Promise<void>;
  listSignatures(processId: string): Promise<StoredSignature[]>;
};

export interface WorkflowRepository {
  transaction<T>(handler: (tx: WorkflowTx) => Promise<T>): Promise<T>;
}

type MemoryState = {
  documents: Map<string, WorkflowDocument>;
  signatures: StoredSignature[];
};

/**
 * Optional durability hook. Without it the repository is pure memory (tests);
 * with it, every committed transaction is flushed so the data survives a
 * restart.
 */
export type WorkflowPersistence = {
  load(): { documents: WorkflowDocument[]; signatures: StoredSignature[] };
  save(state: { documents: WorkflowDocument[]; signatures: StoredSignature[] }): void;
};

/**
 * Reference adapter used by tests and by local runs without a database.
 * Transactions are serialised through a promise chain and roll back by
 * restoring the previous snapshot, which mirrors the guarantees the service
 * relies on: either all writes of an operation land, or none do.
 */
export class InMemoryWorkflowRepository implements WorkflowRepository {
  private state: MemoryState = { documents: new Map(), signatures: [] };
  private queue: Promise<unknown> = Promise.resolve();
  private readonly persistence?: WorkflowPersistence;
  private loaded = false;

  constructor(persistence?: WorkflowPersistence) {
    this.persistence = persistence;
  }

  private ensureLoaded() {
    if (this.loaded || !this.persistence) {
      this.loaded = true;
      return;
    }
    const stored = this.persistence.load();
    this.state = {
      documents: new Map(stored.documents.map((document) => [document.id, document])),
      signatures: stored.signatures,
    };
    this.loaded = true;
  }

  private flush() {
    this.persistence?.save({
      documents: [...this.state.documents.values()],
      signatures: this.state.signatures,
    });
  }

  async transaction<T>(handler: (tx: WorkflowTx) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      this.ensureLoaded();
      const snapshot: MemoryState = {
        documents: new Map([...this.state.documents].map(([key, value]) => [key, structuredClone(value)])),
        signatures: this.state.signatures.map((item) => ({ ...item })),
      };
      try {
        const result = await handler(this.createTx());
        this.flush();
        return result;
      } catch (error) {
        this.state = snapshot;
        throw error;
      }
    });
    this.queue = run.catch(() => undefined);
    return run as Promise<T>;
  }

  private createTx(): WorkflowTx {
    const state = () => this.state;
    return {
      async listProcesses() {
        return [...state().documents.values()]
          .map((document) => structuredClone(document))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      async getProcess(processId) {
        const found = state().documents.get(processId);
        return found ? structuredClone(found) : undefined;
      },
      async insertProcess(document) {
        state().documents.set(document.id, structuredClone(document));
      },
      async saveProcess(document) {
        state().documents.set(document.id, structuredClone(document));
      },
      async getSignature(processId, stageKey) {
        return state().signatures.find((item) => item.processId === processId && item.stageKey === stageKey);
      },
      async getSignatureByIdempotencyKey(idempotencyKey) {
        return state().signatures.find((item) => item.idempotencyKey === idempotencyKey);
      },
      async insertSignature(signature) {
        const duplicate = state().signatures.some(
          (item) =>
            item.idempotencyKey === signature.idempotencyKey ||
            (item.processId === signature.processId && item.stageKey === signature.stageKey),
        );
        if (duplicate) throw new Error("Assinatura já registrada para esta etapa.");
        state().signatures.push({ ...signature });
      },
      async listSignatures(processId) {
        return state().signatures.filter((item) => item.processId === processId).map((item) => ({ ...item }));
      },
    };
  }
}
