import { canEditStage, getNextPendingStage, isWorkflowComplete, nextStatuses, type WorkflowStage } from "./workflow-rules";

export type WorkflowErrorCode =
  | "stage_not_found"
  | "stage_locked"
  | "stage_not_released"
  | "previous_stage_pending"
  | "stage_not_optional"
  | "consent_missing"
  | "version_conflict"
  | "not_authorized";

/** Domain failure with a stable code so the client can react without parsing text. */
export class WorkflowError extends Error {
  readonly code: WorkflowErrorCode;

  constructor(code: WorkflowErrorCode, message: string) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
  }
}

export type SignerIdentity = {
  accountId: number;
  name: string;
  registrationId: string;
  functionKey: string;
  signatureOrder: number;
};

export function findStage(stages: WorkflowStage[], stageKey: string) {
  const stage = stages.find((item) => item.id === stageKey);
  if (!stage) throw new WorkflowError("stage_not_found", "Esta etapa não existe neste processo.");
  return stage;
}

/**
 * A stage only accepts edits while it is the released one. Signed and skipped
 * stages stay frozen, and stages further down the line stay closed so the
 * planilha cannot be filled out of order.
 */
export function assertStageEditable(stages: WorkflowStage[], stageKey: string) {
  const stage = findStage(stages, stageKey);
  if (stage.status === "signed") throw new WorkflowError("stage_locked", "Esta etapa já foi assinada e permanece bloqueada.");
  if (stage.status === "skipped") throw new WorkflowError("stage_locked", "Esta etapa foi registrada como não aplicável.");
  if (!canEditStage(stage)) throw new WorkflowError("stage_not_released", "Esta etapa ainda não foi liberada pela etapa anterior.");
  return stage;
}

/**
 * Guards the signature order itself: no stage may be signed while an earlier
 * one is still open, even if a request arrives with a released stage id.
 */
export function assertSignatureOrder(stages: WorkflowStage[], stageKey: string) {
  const stage = assertStageEditable(stages, stageKey);
  const pending = stages
    .filter((item) => item.order < stage.order)
    .find((item) => item.status !== "signed" && item.status !== "skipped");
  if (pending) {
    throw new WorkflowError(
      "previous_stage_pending",
      `A etapa “${pending.title}” precisa ser concluída antes desta assinatura.`,
    );
  }
  return stage;
}

export function assertVersionMatches(currentVersion: number, expectedVersion?: number) {
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    throw new WorkflowError(
      "version_conflict",
      "O processo foi alterado por outro usuário. Recarregue o documento e revise os campos antes de assinar.",
    );
  }
}

export function assertConsent(fields: Record<string, string | boolean>) {
  if (fields.consentimento !== true) {
    throw new WorkflowError("consent_missing", "A manifestação de vontade deve ser confirmada antes da assinatura.");
  }
}

/**
 * Deterministic representation of what the signer is committing to. Field order
 * is normalised so the same content always produces the same hash, regardless
 * of the order the client sent the keys in.
 */
export function canonicalSignaturePayload(input: {
  processId: string;
  protocol: string;
  source: string;
  candidateName: string;
  stage: WorkflowStage;
  fields: Record<string, string | boolean>;
  signer: SignerIdentity;
  documentVersion: number;
  signedAt: string;
}) {
  return JSON.stringify({
    documentId: input.processId,
    protocol: input.protocol,
    source: input.source,
    candidate: input.candidateName,
    stageId: input.stage.id,
    stageOrder: input.stage.order,
    signer: {
      accountId: input.signer.accountId,
      name: input.signer.name,
      registrationId: input.signer.registrationId,
      functionKey: input.signer.functionKey,
    },
    documentVersion: input.documentVersion,
    signedAt: input.signedAt,
    fields: Object.entries(input.fields).sort(([a], [b]) => a.localeCompare(b)),
  });
}

/**
 * Deliberately free of the document version: a retried request (lost response,
 * double click) must resolve to the same key so it replays the stored evidence
 * instead of failing or recording a second signature. One account signs a given
 * stage once, which is the business rule the unique index also enforces.
 */
export function buildIdempotencyKey(processId: string, stageKey: string, accountId: number) {
  return `${processId}:${stageKey}:${accountId}`;
}

export function applyStageFields(stages: WorkflowStage[], stageKey: string, fields: Record<string, string | boolean>) {
  return stages.map((stage) => (stage.id === stageKey ? { ...stage, fields: { ...stage.fields, ...fields } } : stage));
}

export function applyStageSignature(
  stages: WorkflowStage[],
  stageKey: string,
  signature: { fields: Record<string, string | boolean>; signedAt: string; integrityHash: string },
) {
  const advanced = nextStatuses(stages, stageKey);
  const updated = advanced.map((stage) =>
    stage.id === stageKey
      ? {
          ...stage,
          fields: signature.fields,
          status: "signed" as const,
          signedAt: signature.signedAt,
          integrityHash: signature.integrityHash,
        }
      : stage,
  );
  return { stages: updated, next: getNextPendingStage(updated, stageKey), complete: isWorkflowComplete(updated) };
}

export function applyStageSkip(stages: WorkflowStage[], stageKey: string) {
  const stage = findStage(stages, stageKey);
  if (!stage.optional) throw new WorkflowError("stage_not_optional", "Somente etapas opcionais podem ser dispensadas.");
  const advanced = nextStatuses(stages, stageKey);
  const updated = advanced.map((item) => (item.id === stageKey ? { ...item, status: "skipped" as const } : item));
  return { stages: updated, next: getNextPendingStage(updated, stageKey), complete: isWorkflowComplete(updated) };
}
