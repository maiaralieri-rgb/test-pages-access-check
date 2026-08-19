import { describe, expect, it } from "vitest";

import { canEditStage, createStages, getNextPendingStage, isWorkflowComplete, nextStatuses } from "../lib/workflow-rules";

describe("regras do trâmite LMP", () => {
  it("inicia somente a etapa de indicação como editável", () => {
    const stages = createStages();

    expect(stages[0].status).toBe("active");
    expect(canEditStage(stages[0])).toBe(true);
    expect(stages.slice(1).every((stage) => stage.status === "waiting")).toBe(true);
  });

  it("libera apenas a próxima etapa depois da assinatura", () => {
    const stages = createStages();
    const withSignedIndication = stages.map((stage) => stage.id === "indicacao" ? { ...stage, status: "signed" as const } : stage);
    const advanced = nextStatuses(withSignedIndication, "indicacao");

    expect(advanced.find((stage) => stage.id === "indicacao")?.status).toBe("signed");
    expect(advanced.find((stage) => stage.id === "pessoal")?.status).toBe("active");
    expect(advanced.find((stage) => stage.id === "disciplinar")?.status).toBe("waiting");
  });

  it("não permite edição de uma etapa já assinada", () => {
    const stage = { ...createStages()[0], status: "signed" as const };

    expect(canEditStage(stage)).toBe(false);
  });

  it("encontra o próximo bloco pendente preservando a ordem do formulário", () => {
    const stages = createStages();
    const next = getNextPendingStage(stages, "indicacao");

    expect(next?.id).toBe("pessoal");
    expect(next?.order).toBe(2);
  });

  it("só considera concluído quando todas as etapas foram encerradas", () => {
    const incomplete = createStages();
    const completed = createStages().map((stage) => ({ ...stage, status: "signed" as const }));

    expect(isWorkflowComplete(incomplete)).toBe(false);
    expect(isWorkflowComplete(completed)).toBe(true);
  });
});
