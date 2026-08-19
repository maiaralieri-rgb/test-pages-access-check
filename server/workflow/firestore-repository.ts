import type { Firestore, Transaction } from "firebase-admin/firestore";

import type { WorkflowDocument } from "../../lib/workflow-types";
import { getFirestoreDb } from "../firebase/admin";
import type { StoredSignature, WorkflowRepository, WorkflowTx } from "./repository";

const PROCESSES = "processes";
const SIGNATURES = "signatures";

/**
 * Firestore layout
 *
 *   processes/{processId}                     header + stages + events
 *   processes/{processId}/signatures/{stage}  immutable signature evidence
 *
 * Stages and events live inside the process document because every workflow
 * operation reads and writes them together; keeping them in one document makes
 * each operation a single atomic write. A process holds ten stages and a bounded
 * number of audit events, which stays far below the 1 MiB document limit.
 *
 * Signatures are a subcollection: they are written once, never updated, and are
 * looked up on their own for the idempotency check.
 */
function toDocument(data: FirebaseFirestore.DocumentData): WorkflowDocument {
  return {
    id: data.id,
    protocol: data.protocol,
    candidateName: data.candidateName,
    candidateRank: data.candidateRank,
    grade: data.grade,
    opm: data.opm,
    status: data.status,
    source: data.source,
    certificationState: data.certificationState,
    version: data.version,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    stages: data.stages ?? [],
    events: data.events ?? [],
  };
}

/** Firestore rejects `undefined`; optional stage fields must be dropped, not sent. */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class FirestoreTx implements WorkflowTx {
  /**
   * Firestore requires every read to happen before the first write in a
   * transaction, but the service re-reads the process after saving it to return
   * the stored state. This cache answers that read from the pending write
   * instead of hitting the database again.
   */
  private readonly pending = new Map<string, WorkflowDocument>();
  private readonly pendingSignatures: StoredSignature[] = [];

  constructor(
    private readonly db: Firestore,
    private readonly tx: Transaction,
  ) {}

  async listProcesses(): Promise<WorkflowDocument[]> {
    const snapshot = await this.tx.get(this.db.collection(PROCESSES).orderBy("createdAt", "desc"));
    return snapshot.docs.map((doc) => this.pending.get(doc.id) ?? toDocument(doc.data()));
  }

  async getProcess(processId: string): Promise<WorkflowDocument | undefined> {
    const cached = this.pending.get(processId);
    if (cached) return cached;
    const snapshot = await this.tx.get(this.db.collection(PROCESSES).doc(processId));
    return snapshot.exists ? toDocument(snapshot.data() as FirebaseFirestore.DocumentData) : undefined;
  }

  async insertProcess(document: WorkflowDocument, createdByAccountId: string | null): Promise<void> {
    this.pending.set(document.id, document);
    this.tx.set(this.db.collection(PROCESSES).doc(document.id), stripUndefined({ ...document, createdByAccountId }));
  }

  async saveProcess(document: WorkflowDocument): Promise<void> {
    this.pending.set(document.id, document);
    this.tx.set(
      this.db.collection(PROCESSES).doc(document.id),
      stripUndefined({ ...document, updatedAt: new Date().toISOString() }),
      { merge: true },
    );
  }

  async getSignature(processId: string, stageKey: string): Promise<StoredSignature | undefined> {
    const local = this.pendingSignatures.find((item) => item.processId === processId && item.stageKey === stageKey);
    if (local) return local;
    const snapshot = await this.tx.get(this.db.collection(PROCESSES).doc(processId).collection(SIGNATURES).doc(stageKey));
    return snapshot.exists ? (snapshot.data() as StoredSignature) : undefined;
  }

  async getSignatureByIdempotencyKey(idempotencyKey: string): Promise<StoredSignature | undefined> {
    const local = this.pendingSignatures.find((item) => item.idempotencyKey === idempotencyKey);
    if (local) return local;
    // The key is `${processId}:${stageKey}:${accountId}`, so the document is
    // addressable directly instead of needing a collection group query.
    const [processId, stageKey] = idempotencyKey.split(":");
    const snapshot = await this.tx.get(this.db.collection(PROCESSES).doc(processId).collection(SIGNATURES).doc(stageKey));
    if (!snapshot.exists) return undefined;
    const signature = snapshot.data() as StoredSignature;
    return signature.idempotencyKey === idempotencyKey ? signature : undefined;
  }

  async insertSignature(signature: StoredSignature): Promise<void> {
    this.pendingSignatures.push(signature);
    const ref = this.db.collection(PROCESSES).doc(signature.processId).collection(SIGNATURES).doc(signature.stageKey);
    // `create` fails if the document already exists, so a concurrent second
    // signature for the same stage aborts the transaction instead of overwriting.
    this.tx.create(ref, stripUndefined(signature));
  }

  async listSignatures(processId: string): Promise<StoredSignature[]> {
    const snapshot = await this.tx.get(
      this.db.collection(PROCESSES).doc(processId).collection(SIGNATURES).orderBy("signatureOrder"),
    );
    return snapshot.docs.map((doc) => doc.data() as StoredSignature);
  }
}

export class FirestoreWorkflowRepository implements WorkflowRepository {
  async transaction<T>(handler: (tx: WorkflowTx) => Promise<T>): Promise<T> {
    const db = getFirestoreDb();
    return db.runTransaction(async (tx) => handler(new FirestoreTx(db, tx)));
  }
}
