import { beforeEach, describe, expect, it } from "vitest";

import { FirestoreWorkflowRepository } from "../server/workflow/firestore-repository";
import { WorkflowService, type MembershipLookup, type WorkflowActor } from "../server/workflow/service";

/**
 * Runs the workflow rules against a real Firestore, which is the only way to
 * prove the adapter honours the transaction contract — in particular that reads
 * never follow writes and that a duplicated signature is rejected by `create`.
 *
 * Start the emulators with `pnpm fb:emulators` and run:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-assinafluxo pnpm test
 */
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const project = process.env.FIREBASE_PROJECT_ID ?? "demo-assinafluxo";

const coordinator: WorkflowActor = { accountId: "uid-coord", name: "Cap. Marina Souto", registrationId: "111111-1", role: "coordinator" };
const signer: WorkflowActor = { accountId: "uid-signer", name: "Cap. Bruno Azevedo", registrationId: "222222-2", role: "signer" };

const memberships = new Map([["uid-signer:pessoal", { functionKey: "p1", signatureOrder: 2 }]]);
const membership: MembershipLookup = async (_p, accountId, stageKey) => memberships.get(`${accountId}:${stageKey}`);

const newProcess = {
  protocol: "SEI/SP 300/2026",
  candidateName: "Sd. Luís Henrique Alves",
  candidateRank: "Soldado PM",
  grade: "3º grau",
  opm: "7º BPM/M",
};
const consent = { consentimento: true } as const;

describe.skipIf(!emulator)("trâmite sobre Firestore", () => {
  let service: WorkflowService;

  beforeEach(async () => {
    await fetch(`http://${emulator}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: "DELETE" });
    service = new WorkflowService({ repository: new FirestoreWorkflowRepository(), membership });
  });

  it("grava o processo e o recupera com as etapas na ordem", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    const reloaded = await service.getProcess(created.id);

    expect(reloaded?.stages).toHaveLength(10);
    expect(reloaded?.stages[0].status).toBe("active");
    expect(reloaded?.stages.map((stage) => stage.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(reloaded?.version).toBe(1);
  });

  it("assina dentro de uma transação e libera a etapa seguinte", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    const result = await service.signStage(coordinator, { processId: created.id, stageKey: "indicacao", fields: consent });

    expect(result.integrityHash).toHaveLength(64);
    const stored = await service.getProcess(created.id);
    expect(stored?.stages[0].status).toBe("signed");
    expect(stored?.stages[1].status).toBe("active");
  });

  it("recusa assinatura fora da função e fora da ordem", async () => {
    const created = await service.createProcess(coordinator, newProcess);

    await expect(
      service.signStage(signer, { processId: created.id, stageKey: "indicacao", fields: consent }),
    ).rejects.toMatchObject({ code: "not_authorized" });

    await expect(
      service.signStage(signer, { processId: created.id, stageKey: "pessoal", fields: consent }),
    ).rejects.toMatchObject({ code: "stage_not_released" });
  });

  it("mantém uma única assinatura por etapa mesmo com reenvio", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    const first = await service.signStage(coordinator, { processId: created.id, stageKey: "indicacao", fields: consent });
    const retry = await service.signStage(coordinator, { processId: created.id, stageKey: "indicacao", fields: consent });

    expect(retry.replayed).toBe(true);
    expect(retry.integrityHash).toBe(first.integrityHash);
    expect(await service.listSignatures(created.id)).toHaveLength(1);
  });

  it("detecta edição concorrente pela versão", async () => {
    const created = await service.createProcess(coordinator, newProcess);
    await service.saveStageDraft(coordinator, { processId: created.id, stageKey: "indicacao", fields: { sintese: "primeira" } });

    await expect(
      service.saveStageDraft(coordinator, { processId: created.id, stageKey: "indicacao", fields: { sintese: "segunda" }, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "version_conflict" });
  });
});
