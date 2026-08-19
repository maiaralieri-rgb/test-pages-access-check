export type WorkflowStageStatus = "waiting" | "active" | "signed" | "skipped";

export type WorkflowStage = {
  id: string;
  order: number;
  title: string;
  role: string;
  signerName: string;
  optional?: boolean;
  status: WorkflowStageStatus;
  fields: Record<string, string | boolean>;
  signedAt?: string;
  integrityHash?: string;
};

export const stageBlueprint = [
  { id: "indicacao", title: "Responsável pela indicação", role: "Autoridade do Art. 6º", signerName: "Cap. Marina Souto" },
  { id: "pessoal", title: "Informações pessoais", role: "Oficial P/1 ou secretário", signerName: "Cap. Bruno Azevedo" },
  { id: "disciplinar", title: "Informações disciplinares", role: "Oficial PJMD ou equivalente", signerName: "Cap. Henrique Lacerda" },
  { id: "cia", title: "Parecer Cmt Cia", role: "Etapa opcional", signerName: "Cap. Denise Moraes", optional: true },
  { id: "btl", title: "Parecer Cmt Btl", role: "Etapa opcional", signerName: "Ten.-Cel. Mauro Freitas", optional: true },
  { id: "parecer", title: "Parecer da autoridade", role: "Autoridade do Art. 8º", signerName: "Cel. Rafael Viana" },
  { id: "excepcional", title: "Situação excepcional", role: "Autoridade do Art. 8º, inciso V", signerName: "Cel. Rafael Viana", optional: true },
  { id: "subcomando", title: "Aprovação do Subcomandante", role: "Somente situações excepcionais", signerName: "Cel. Otávio Nunes", optional: true },
  { id: "concessao", title: "Concessão", role: "Autoridade do Art. 8º", signerName: "Cel. Rafael Viana" },
  { id: "fechamento", title: "Publicação e remessa", role: "Setor de encerramento", signerName: "Sd. Larissa Campos" },
] as const;

export const createStages = (): WorkflowStage[] =>
  stageBlueprint.map((stage, index) => ({
    ...stage,
    order: index + 1,
    status: index === 0 ? "active" : "waiting",
    fields: {},
  }));

export function canEditStage(stage: WorkflowStage) {
  return stage.status === "active";
}

export function getNextPendingStage(stages: WorkflowStage[], completedStageId: string) {
  const completedIndex = stages.findIndex((stage) => stage.id === completedStageId);
  return stages.slice(completedIndex + 1).find((stage) => stage.status === "waiting");
}

export function nextStatuses(stages: WorkflowStage[], completedStageId: string): WorkflowStage[] {
  const nextStage = getNextPendingStage(stages, completedStageId);
  return stages.map((stage) => {
    if (stage.id === nextStage?.id) return { ...stage, status: "active" as const };
    return stage;
  });
}

export function isWorkflowComplete(stages: WorkflowStage[]) {
  return stages.every((stage) => stage.status === "signed" || stage.status === "skipped");
}

export function stageStatusLabel(status: WorkflowStageStatus) {
  const labels: Record<WorkflowStageStatus, string> = {
    waiting: "Aguardando",
    active: "Pendente",
    signed: "Assinada",
    skipped: "Não aplicável",
  };
  return labels[status];
}
