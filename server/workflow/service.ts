import { randomUUID } from "node:crypto";

import { createStages } from "../../lib/workflow-rules";
import type { AuditEvent, AuditEventType, CreateWorkflowInput, WorkflowDocument } from "../../lib/workflow-types";
import {
  applyStageFields,
  applyStageSignature,
  applyStageSkip,
  assertConsent,
  assertSignatureOrder,
  assertStageEditable,
  assertVersionMatches,
  buildIdempotencyKey,
  canonicalSignaturePayload,
  findStage,
  WorkflowError,
  type SignerIdentity,
} from "../../lib/workflow-server-core";
import { getSignatureProvider, type SignatureProvider } from "../signature/provider";
import type { WorkflowRepository, WorkflowTx } from "./repository";

export type WorkflowActor = {
  accountId: string;
  name: string;
  registrationId: string;
  role: "coordinator" | "signer" | "viewer";
};

export type StageMembership = { functionKey: string; signatureOrder: number };

export type MembershipLookup = (
  processId: string,
  accountId: string,
  stageKey: string,
) => Promise<StageMembership | undefined>;

export type WorkflowServiceDeps = {
  repository: WorkflowRepository;
  membership: MembershipLookup;
  provider?: SignatureProvider;
  now?: () => Date;
  newId?: () => string;
};

const COORDINATION_FUNCTION = "coordenacao";

export class WorkflowService {
  private readonly repository: WorkflowRepository;
  private readonly membership: MembershipLookup;
  private readonly provider: SignatureProvider | undefined;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(deps: WorkflowServiceDeps) {
    this.repository = deps.repository;
    this.membership = deps.membership;
    this.provider = deps.provider;
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => randomUUID());
  }

  private signatureProvider() {
    return this.provider ?? getSignatureProvider();
  }

  private event(actor: string, type: AuditEventType, description: string, hash?: string): AuditEvent {
    return { id: this.newId(), at: this.now().toISOString(), actor, type, description, hash };
  }

  /**
   * Resolves what the account is allowed to do on a stage. Coordination keeps
   * the override it already had in the prototype; every other account needs an
   * explicit membership created by the stage invite.
   */
  private async resolveSigner(actor: WorkflowActor, processId: string, stageKey: string): Promise<SignerIdentity> {
    if (actor.role === "viewer") {
      throw new WorkflowError("not_authorized", "Contas de consulta não podem editar ou assinar etapas.");
    }
    const member = await this.membership(processId, actor.accountId, stageKey);
    if (!member && actor.role !== "coordinator") {
      throw new WorkflowError("not_authorized", "Sua função não está autorizada a assinar este campo.");
    }
    return {
      accountId: actor.accountId,
      name: actor.name,
      registrationId: actor.registrationId,
      functionKey: member?.functionKey ?? COORDINATION_FUNCTION,
      signatureOrder: member?.signatureOrder ?? 0,
    };
  }

  private async requireProcess(tx: WorkflowTx, processId: string) {
    const document = await tx.getProcess(processId);
    if (!document) throw new WorkflowError("stage_not_found", "Processo não encontrado.");
    return document;
  }

  async listProcesses(): Promise<WorkflowDocument[]> {
    return this.repository.transaction((tx) => tx.listProcesses());
  }

  async getProcess(processId: string): Promise<WorkflowDocument | undefined> {
    return this.repository.transaction((tx) => tx.getProcess(processId));
  }

  async listSignatures(processId: string) {
    return this.repository.transaction((tx) => tx.listSignatures(processId));
  }

  async createProcess(actor: WorkflowActor, input: CreateWorkflowInput): Promise<WorkflowDocument> {
    if (actor.role === "viewer") {
      throw new WorkflowError("not_authorized", "Contas de consulta não podem abrir processos.");
    }
    const timestamp = this.now().toISOString();
    const document: WorkflowDocument = {
      id: this.newId(),
      ...input,
      status: "in_progress",
      createdAt: timestamp,
      updatedAt: timestamp,
      source: "PM-COM-002",
      certificationState: "evidence_pending_qualification",
      version: 1,
      stages: createStages(),
      events: [this.event(actor.name, "created", "Processo criado e primeira etapa liberada para preenchimento.")],
    };

    return this.repository.transaction(async (tx) => {
      await tx.insertProcess(document, actor.accountId);
      return (await tx.getProcess(document.id)) ?? document;
    });
  }

  /** Saves a draft without signing. Keeps the stage editable and bumps the version. */
  async saveStageDraft(
    actor: WorkflowActor,
    input: { processId: string; stageKey: string; fields: Record<string, string | boolean>; expectedVersion?: number },
  ): Promise<WorkflowDocument> {
    const signer = await this.resolveSigner(actor, input.processId, input.stageKey);
    return this.repository.transaction(async (tx) => {
      const document = await this.requireProcess(tx, input.processId);
      assertVersionMatches(document.version, input.expectedVersion);
      const stage = assertStageEditable(document.stages, input.stageKey);

      const stages = applyStageFields(document.stages, input.stageKey, input.fields);
      const updated: WorkflowDocument = {
        ...document,
        stages,
        version: document.version + 1,
        events: [...document.events, this.event(signer.name, "saved", `Rascunho salvo em “${stage.title}”.`)],
      };
      await tx.saveProcess(updated);
      return (await tx.getProcess(input.processId)) ?? updated;
    });
  }

  /**
   * Records a signature atomically: session and role were already checked, and
   * inside the transaction we re-check ordering, consent and document version
   * before writing the evidence, freezing the stage and releasing the next one.
   */
  async signStage(
    actor: WorkflowActor,
    input: {
      processId: string;
      stageKey: string;
      fields?: Record<string, string | boolean>;
      expectedVersion?: number;
    },
  ): Promise<{ document: WorkflowDocument; integrityHash: string; qualified: boolean; replayed: boolean }> {
    const signer = await this.resolveSigner(actor, input.processId, input.stageKey);
    const provider = this.signatureProvider();

    return this.repository.transaction(async (tx) => {
      const document = await this.requireProcess(tx, input.processId);

      // Replay check comes before the version guard: a retry of a signature that
      // already landed must return the original evidence, not a conflict.
      const idempotencyKey = buildIdempotencyKey(input.processId, input.stageKey, signer.accountId);
      const replay = await tx.getSignatureByIdempotencyKey(idempotencyKey);
      if (replay) {
        return { document, integrityHash: replay.integrityHash, qualified: provider.qualified, replayed: true };
      }

      const existing = await tx.getSignature(input.processId, input.stageKey);
      if (existing) throw new WorkflowError("stage_locked", "Esta etapa já foi assinada e permanece bloqueada.");

      assertVersionMatches(document.version, input.expectedVersion);
      const stage = assertSignatureOrder(document.stages, input.stageKey);
      const fields = { ...stage.fields, ...(input.fields ?? {}) };
      assertConsent(fields);

      const signedAt = this.now().toISOString();
      const canonicalPayload = canonicalSignaturePayload({
        processId: document.id,
        protocol: document.protocol,
        source: document.source,
        candidateName: document.candidateName,
        stage,
        fields,
        signer,
        documentVersion: document.version,
        signedAt,
      });
      const evidence = await provider.sign({
        canonicalPayload,
        processId: document.id,
        stageKey: stage.id,
        signerAccountId: signer.accountId,
        signerName: signer.name,
        signerRegistrationId: signer.registrationId,
        signedAt,
      });

      const applied = applyStageSignature(document.stages, input.stageKey, {
        fields,
        signedAt,
        integrityHash: evidence.integrityHash,
      });

      const events = [
        ...document.events,
        this.event(signer.name, "signed", `Etapa “${stage.title}” confirmada, registrada e bloqueada.`, evidence.integrityHash),
        ...(applied.next
          ? [this.event("Sistema", "forwarded", `Etapa “${applied.next.title}” liberada para ${applied.next.signerName}.`)]
          : []),
      ];

      const updated: WorkflowDocument = {
        ...document,
        stages: applied.stages,
        status: applied.complete ? "completed" : "in_progress",
        version: document.version + 1,
        events,
      };

      await tx.insertSignature({
        processId: document.id,
        stageKey: stage.id,
        accountId: signer.accountId,
        signerName: signer.name,
        signerRegistrationId: signer.registrationId,
        functionKey: signer.functionKey,
        signatureOrder: stage.order,
        integrityHash: evidence.integrityHash,
        documentVersion: document.version,
        idempotencyKey,
        provider: evidence.provider,
        providerReference: evidence.providerReference,
        signedAt,
      });
      await tx.saveProcess(updated);

      const stored = (await tx.getProcess(document.id)) ?? updated;
      return { document: stored, integrityHash: evidence.integrityHash, qualified: evidence.qualified, replayed: false };
    });
  }

  async skipStage(actor: WorkflowActor, input: { processId: string; stageKey: string }): Promise<WorkflowDocument> {
    const signer = await this.resolveSigner(actor, input.processId, input.stageKey);
    return this.repository.transaction(async (tx) => {
      const document = await this.requireProcess(tx, input.processId);
      const stage = assertStageEditable(document.stages, input.stageKey);
      const applied = applyStageSkip(document.stages, input.stageKey);

      const updated: WorkflowDocument = {
        ...document,
        stages: applied.stages,
        status: applied.complete ? "completed" : "in_progress",
        version: document.version + 1,
        events: [
          ...document.events,
          this.event(signer.name, "skipped", `Etapa opcional “${stage.title}” marcada como não aplicável.`),
          ...(applied.next
            ? [this.event("Sistema", "forwarded", `Etapa “${applied.next.title}” liberada para ${applied.next.signerName}.`)]
            : []),
        ],
      };
      await tx.saveProcess(updated);
      return (await tx.getProcess(input.processId)) ?? updated;
    });
  }

  async sendReminder(actor: WorkflowActor, processId: string): Promise<WorkflowDocument> {
    return this.repository.transaction(async (tx) => {
      const document = await this.requireProcess(tx, processId);
      const active = document.stages.find((stage) => stage.status === "active");
      if (!active) throw new WorkflowError("stage_not_found", "Não há etapa pendente para lembrar.");
      // A reminder only appends an audit event. It deliberately leaves the
      // version untouched so it cannot invalidate a signature already in flight.
      const updated: WorkflowDocument = {
        ...document,
        events: [
          ...document.events,
          this.event(actor.name, "reminder", `Aviso de pendência preparado para ${active.signerName}.`),
        ],
      };
      await tx.saveProcess(updated);
      return (await tx.getProcess(processId)) ?? updated;
    });
  }

  /** Read-only check used by the UI to enable or disable the stage controls. */
  async describeAuthorization(actor: WorkflowActor, processId: string, stageKey: string) {
    try {
      const signer = await this.resolveSigner(actor, processId, stageKey);
      const document = await this.getProcess(processId);
      const stage = document ? findStage(document.stages, stageKey) : undefined;
      return {
        functionKey: signer.functionKey,
        stageId: stageKey,
        signatureOrder: signer.signatureOrder,
        canEdit: stage?.status === "active",
      };
    } catch {
      return null;
    }
  }
}
