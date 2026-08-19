import { beforeEach, describe, expect, it } from "vitest";

import { WorkflowError } from "../lib/workflow-server-core";
import { InMemoryWorkflowRepository } from "../server/workflow/repository";
import { WorkflowService, type MembershipLookup, type WorkflowActor } from "../server/workflow/service";

const coordinator: WorkflowActor = { accountId: 1, name: "Cap. Marina Souto", registrationId: "111111-1", role: "coordinator" };
const indicationSigner: WorkflowActor = { accountId: 2, name: "Ten. Paulo Andrade", registrationId: "222222-2", role: "signer" };
const personalSigner: WorkflowActor = { accountId: 3, name: "Cap. Bruno Azevedo", registrationId: "333333-3", role: "signer" };

/**
 * Stands in for the process_members rows that a stage invite creates: account 2
 * was invited to the indication stage, account 3 to the personal-data stage.
 */
const memberships = new Map<string, { functionKey: string; signatureOrder: number }>([
  ["2:indicacao", { functionKey: "art6", signatureOrder: 1 }],
  ["3:pessoal", { functionKey: "p1", signatureOrder: 2 }],
]);

const membership: MembershipLookup = async (_processId, accountId, stageKey) =>
  memberships.get(`${accountId}:${stageKey}`);

function createService() {
  let counter = 0;
  return new WorkflowService({
    repository: new InMemoryWorkflowRepository(),
    membership,
    newId: () => `id-${++counter}`,
  });
}

const newProcess = {
  protocol: "SEI/SP 099/2026",
  candidateName: "Sd. Luís Henrique Alves",
  candidateRank: "Soldado PM",
  grade: "3º grau",
  opm: "7º BPM/M",
};

const consent = { consentimento: true } as const;

describe("fonte compartilhada do trâmite LMP", () => {
  let service: WorkflowService;

  beforeEach(() => {
    service = createService();
  });

  it("cria o processo com a primeira etapa liberada e registra o evento de abertura", async () => {
    const document = await service.createProcess(coordinator, newProcess);

    expect(document.version).toBe(1);
    expect(document.stages[0].id).toBe("indicacao");
    expect(document.stages[0].status).toBe("active");
    expect(document.stages.slice(1).every((stage) => stage.status === "waiting")).toBe(true);
    expect(document.events).toHaveLength(1);
    expect(document.events[0].type).toBe("created");
  });

  it("compartilha o mesmo documento entre usuários diferentes", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    await service.saveStageDraft(indicationSigner, {
      processId: created.id,
      stageKey: "indicacao",
      fields: { sintese: "Atuação destacada em ocorrência operacional." },
    });

    // A different account reading the process sees the other account's edit.
    const seenByOther = await service.getProcess(created.id);
    expect(seenByOther?.stages[0].fields.sintese).toBe("Atuação destacada em ocorrência operacional.");
    expect(seenByOther?.version).toBe(2);
  });

  it("recusa a assinatura de quem não tem a função da etapa", async () => {
    const created = await service.createProcess(coordinator, newProcess);

    // Account 3 was invited to "pessoal", not to "indicacao".
    await expect(
      service.signStage(personalSigner, { processId: created.id, stageKey: "indicacao", fields: consent }),
    ).rejects.toMatchObject({ code: "not_authorized" });

    const unchanged = await service.getProcess(created.id);
    expect(unchanged?.stages[0].status).toBe("active");
  });

  it("impede que a segunda assinatura ocorra antes da primeira", async () => {
    const created = await service.createProcess(coordinator, newProcess);

    await expect(
      service.signStage(personalSigner, { processId: created.id, stageKey: "pessoal", fields: consent }),
    ).rejects.toMatchObject({ code: "stage_not_released" });
  });

  it("permite que o usuário correto assine e libera a etapa seguinte", async () => {
    const created = await service.createProcess(coordinator, newProcess);

    const result = await service.signStage(indicationSigner, {
      processId: created.id,
      stageKey: "indicacao",
      fields: { sintese: "Mérito comprovado.", ...consent },
    });

    expect(result.replayed).toBe(false);
    expect(result.integrityHash).toHaveLength(64);
    expect(result.qualified).toBe(false);

    const stages = result.document.stages;
    expect(stages.find((stage) => stage.id === "indicacao")?.status).toBe("signed");
    expect(stages.find((stage) => stage.id === "pessoal")?.status).toBe("active");
    expect(stages.find((stage) => stage.id === "disciplinar")?.status).toBe("waiting");

    // Now the second signer can act, and only then.
    const second = await service.signStage(personalSigner, {
      processId: created.id,
      stageKey: "pessoal",
      fields: { tempoServico: "14 anos", ...consent },
    });
    expect(second.document.stages.find((stage) => stage.id === "pessoal")?.status).toBe("signed");
  });

  it("exige manifestação de vontade antes de registrar a assinatura", async () => {
    const created = await service.createProcess(coordinator, newProcess);

    await expect(
      service.signStage(indicationSigner, { processId: created.id, stageKey: "indicacao", fields: { sintese: "Mérito." } }),
    ).rejects.toMatchObject({ code: "consent_missing" });
  });

  it("bloqueia a etapa assinada contra novas edições e assinaturas", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    await service.signStage(indicationSigner, { processId: created.id, stageKey: "indicacao", fields: consent });

    await expect(
      service.saveStageDraft(indicationSigner, { processId: created.id, stageKey: "indicacao", fields: { sintese: "alteração" } }),
    ).rejects.toMatchObject({ code: "stage_locked" });

    // Another authorised account cannot overwrite a stage that is already closed.
    await expect(
      service.signStage(coordinator, { processId: created.id, stageKey: "indicacao", fields: consent }),
    ).rejects.toMatchObject({ code: "stage_locked" });
  });

  it("trata a reapresentação da mesma assinatura como idempotente", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    const first = await service.signStage(indicationSigner, { processId: created.id, stageKey: "indicacao", fields: consent });
    const retry = await service.signStage(indicationSigner, { processId: created.id, stageKey: "indicacao", fields: consent });

    expect(retry.replayed).toBe(true);
    expect(retry.integrityHash).toBe(first.integrityHash);

    const signatures = await service.listSignatures(created.id);
    expect(signatures).toHaveLength(1);
  });

  it("detecta edição concorrente pela versão do documento", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    await service.saveStageDraft(indicationSigner, { processId: created.id, stageKey: "indicacao", fields: { sintese: "primeira" } });

    // The second account still holds version 1 and must be told to reload.
    await expect(
      service.saveStageDraft(coordinator, { processId: created.id, stageKey: "indicacao", fields: { sintese: "segunda" }, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("registra a evidência da assinatura com identidade e versão do documento", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    await service.signStage(indicationSigner, { processId: created.id, stageKey: "indicacao", fields: consent });

    const [signature] = await service.listSignatures(created.id);
    expect(signature.accountId).toBe(indicationSigner.accountId);
    expect(signature.signerRegistrationId).toBe("222222-2");
    expect(signature.functionKey).toBe("art6");
    expect(signature.documentVersion).toBe(1);
    expect(signature.provider).toBe("local-evidence");
  });

  it("dispensa apenas etapas opcionais e libera a seguinte", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    await service.signStage(indicationSigner, { processId: created.id, stageKey: "indicacao", fields: consent });
    await service.signStage(personalSigner, { processId: created.id, stageKey: "pessoal", fields: consent });

    await expect(
      service.skipStage(coordinator, { processId: created.id, stageKey: "disciplinar" }),
    ).rejects.toBeInstanceOf(WorkflowError);

    await service.signStage(coordinator, { processId: created.id, stageKey: "disciplinar", fields: consent });
    const skipped = await service.skipStage(coordinator, { processId: created.id, stageKey: "cia" });

    expect(skipped.stages.find((stage) => stage.id === "cia")?.status).toBe("skipped");
    expect(skipped.stages.find((stage) => stage.id === "btl")?.status).toBe("active");
  });

  it("não deixa contas de consulta editar nem assinar", async () => {
    const viewer: WorkflowActor = { accountId: 9, name: "Sd. Consulta", registrationId: "999999-9", role: "viewer" };
    const created = await service.createProcess(coordinator, newProcess);

    await expect(
      service.signStage(viewer, { processId: created.id, stageKey: "indicacao", fields: consent }),
    ).rejects.toMatchObject({ code: "not_authorized" });
  });
});
