import { and, desc, eq, sql } from "drizzle-orm";

import type { WorkflowStage } from "../../lib/workflow-rules";
import type { AuditEvent, WorkflowDocument } from "../../lib/workflow-types";
import { processEvents, processSignatures, processStages, processes } from "../../drizzle/schema";
import { getDb } from "../db";
import type { StoredSignature, WorkflowRepository, WorkflowTx } from "./repository";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const toIso = (value: Date | string | null | undefined) =>
  value ? (value instanceof Date ? value.toISOString() : new Date(value).toISOString()) : undefined;

function mapStage(row: typeof processStages.$inferSelect): WorkflowStage {
  return {
    id: row.stageKey,
    order: row.stageOrder,
    title: row.title,
    role: row.role,
    signerName: row.signerName,
    optional: row.optional,
    status: row.status,
    fields: row.fields ?? {},
    signedAt: toIso(row.signedAt),
    integrityHash: row.integrityHash ?? undefined,
  };
}

function mapEvent(row: typeof processEvents.$inferSelect): AuditEvent {
  return {
    id: row.eventKey,
    at: toIso(row.at) ?? new Date().toISOString(),
    actor: row.actor,
    type: row.type,
    description: row.description,
    hash: row.hash ?? undefined,
  };
}

function mapSignature(row: typeof processSignatures.$inferSelect): StoredSignature {
  return {
    processId: row.processId,
    stageKey: row.stageKey,
    accountId: row.accountId,
    signerName: row.signerName,
    signerRegistrationId: row.signerRegistrationId,
    functionKey: row.functionKey,
    signatureOrder: row.signatureOrder,
    integrityHash: row.integrityHash,
    documentVersion: row.documentVersion,
    idempotencyKey: row.idempotencyKey,
    provider: row.provider,
    providerReference: row.providerReference ?? undefined,
    signedAt: toIso(row.signedAt) ?? new Date().toISOString(),
  };
}

async function loadDocument(executor: Executor, processId: string): Promise<WorkflowDocument | undefined> {
  const [header] = await executor.select().from(processes).where(eq(processes.id, processId)).limit(1);
  if (!header) return undefined;
  const stageRows = await executor
    .select()
    .from(processStages)
    .where(eq(processStages.processId, processId))
    .orderBy(processStages.stageOrder);
  const eventRows = await executor
    .select()
    .from(processEvents)
    .where(eq(processEvents.processId, processId))
    .orderBy(processEvents.at, processEvents.id);
  return {
    id: header.id,
    protocol: header.protocol,
    candidateName: header.candidateName,
    candidateRank: header.candidateRank,
    grade: header.grade,
    opm: header.opm,
    status: header.status,
    source: header.source as WorkflowDocument["source"],
    certificationState: header.certificationState as WorkflowDocument["certificationState"],
    version: header.version,
    createdAt: toIso(header.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(header.updatedAt) ?? new Date().toISOString(),
    stages: stageRows.map(mapStage),
    events: eventRows.map(mapEvent),
  };
}

function createTx(executor: Executor): WorkflowTx {
  return {
    async listProcesses() {
      const headers = await executor.select({ id: processes.id }).from(processes).orderBy(desc(processes.createdAt));
      const documents: WorkflowDocument[] = [];
      for (const header of headers) {
        const document = await loadDocument(executor, header.id);
        if (document) documents.push(document);
      }
      return documents;
    },

    async getProcess(processId) {
      return loadDocument(executor, processId);
    },

    async insertProcess(document, createdByAccountId) {
      await executor.insert(processes).values({
        id: document.id,
        protocol: document.protocol,
        candidateName: document.candidateName,
        candidateRank: document.candidateRank,
        grade: document.grade,
        opm: document.opm,
        status: document.status,
        source: document.source,
        certificationState: document.certificationState,
        version: document.version,
        createdByAccountId,
      });
      if (document.stages.length > 0) {
        await executor.insert(processStages).values(
          document.stages.map((stage) => ({
            processId: document.id,
            stageKey: stage.id,
            stageOrder: stage.order,
            title: stage.title,
            role: stage.role,
            signerName: stage.signerName,
            optional: Boolean(stage.optional),
            status: stage.status,
            fields: stage.fields,
            signedAt: stage.signedAt ? new Date(stage.signedAt) : null,
            integrityHash: stage.integrityHash ?? null,
          })),
        );
      }
      if (document.events.length > 0) {
        await executor.insert(processEvents).values(
          document.events.map((event) => ({
            eventKey: event.id,
            processId: document.id,
            actor: event.actor,
            type: event.type,
            description: event.description,
            hash: event.hash ?? null,
            at: new Date(event.at),
          })),
        );
      }
    },

    async saveProcess(document) {
      await executor
        .update(processes)
        .set({ status: document.status, version: document.version })
        .where(eq(processes.id, document.id));

      for (const stage of document.stages) {
        await executor
          .update(processStages)
          .set({
            status: stage.status,
            fields: stage.fields,
            signedAt: stage.signedAt ? new Date(stage.signedAt) : null,
            integrityHash: stage.integrityHash ?? null,
          })
          .where(and(eq(processStages.processId, document.id), eq(processStages.stageKey, stage.id)));
      }

      // Events are append-only; eventKey is unique so replaying a save is a no-op.
      for (const event of document.events) {
        await executor
          .insert(processEvents)
          .values({
            eventKey: event.id,
            processId: document.id,
            actor: event.actor,
            type: event.type,
            description: event.description,
            hash: event.hash ?? null,
            at: new Date(event.at),
          })
          .onDuplicateKeyUpdate({ set: { eventKey: sql`${processEvents.eventKey}` } });
      }
    },

    async getSignature(processId, stageKey) {
      const [row] = await executor
        .select()
        .from(processSignatures)
        .where(and(eq(processSignatures.processId, processId), eq(processSignatures.stageKey, stageKey)))
        .limit(1);
      return row ? mapSignature(row) : undefined;
    },

    async getSignatureByIdempotencyKey(idempotencyKey) {
      const [row] = await executor
        .select()
        .from(processSignatures)
        .where(eq(processSignatures.idempotencyKey, idempotencyKey))
        .limit(1);
      return row ? mapSignature(row) : undefined;
    },

    async insertSignature(signature) {
      await executor.insert(processSignatures).values({
        processId: signature.processId,
        stageKey: signature.stageKey,
        accountId: signature.accountId,
        signerName: signature.signerName,
        signerRegistrationId: signature.signerRegistrationId,
        functionKey: signature.functionKey,
        signatureOrder: signature.signatureOrder,
        integrityHash: signature.integrityHash,
        documentVersion: signature.documentVersion,
        idempotencyKey: signature.idempotencyKey,
        provider: signature.provider,
        providerReference: signature.providerReference ?? null,
        signedAt: new Date(signature.signedAt),
      });
    },

    async listSignatures(processId) {
      const rows = await executor
        .select()
        .from(processSignatures)
        .where(eq(processSignatures.processId, processId))
        .orderBy(processSignatures.signatureOrder);
      return rows.map(mapSignature);
    },
  };
}

export class DrizzleWorkflowRepository implements WorkflowRepository {
  async transaction<T>(handler: (tx: WorkflowTx) => Promise<T>): Promise<T> {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível. Configure DATABASE_URL para compartilhar os processos.");
    return db.transaction(async (tx) => handler(createTx(tx)));
  }
}
