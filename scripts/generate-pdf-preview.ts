import { readFile, writeFile } from "node:fs/promises";

import { buildWorkflowPdf } from "../lib/pdf-export-core";
import { createStages } from "../lib/workflow-rules";

async function main() {
  const stages = createStages();
  stages[0] = {
    ...stages[0],
    status: "signed",
    signedAt: "2026-08-17T12:00:00.000Z",
    fields: {
      sintese: "Atuação destacada em ocorrência operacional, com relevante histórico funcional e mérito reconhecido na unidade.",
      extemporaneidade: "Não aplicável",
    },
  };
  stages[1] = {
    ...stages[1],
    status: "active",
    fields: { tempoServico: "14 anos e 8 meses", grauAnterior: "4º grau", avaliacao: "Superior", requisitos: true },
  };
  const template = await readFile("assets/forms/PM-COM-002.pdf");
  const result = await buildWorkflowPdf(template, {
    id: "preview-pdf",
    protocol: "SEI/SP 042/2026",
    candidateName: "João da Silva",
    candidateRank: "Soldado PM",
    grade: "3º grau",
    opm: "7º BPM/M",
    status: "in_progress",
    createdAt: "2026-08-17T12:00:00.000Z",
    updatedAt: "2026-08-17T12:00:00.000Z",
    source: "PM-COM-002",
    certificationState: "evidence_pending_qualification",
    version: 1,
    stages,
    events: [],
  });
  await writeFile("pdf-preview-generated.pdf", result);
}

main();
