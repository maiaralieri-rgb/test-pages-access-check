import { readFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildWorkflowPdf } from "../lib/pdf-export-core";
import { createStages } from "../lib/workflow-rules";
import type { WorkflowDocument } from "../lib/workflow-types";

describe("exportação da PM-COM-002", () => {
  it("mantém as duas páginas do formulário original ao preencher dados do processo", async () => {
    const stages = createStages();
    stages[0] = { ...stages[0], status: "signed", signedAt: "2026-08-17T12:00:00.000Z", fields: { sintese: "Histórico funcional de mérito para conferência da exportação.", extemporaneidade: "Não aplicável" } };
    stages[1] = { ...stages[1], status: "active", fields: { tempoServico: "14 anos", grauAnterior: "4º grau", avaliacao: "Superior", requisitos: true } };
    const workflow: WorkflowDocument = {
      id: "teste-pdf",
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
    };
    const original = readFileSync("assets/forms/PM-COM-002.pdf");
    const exported = await buildWorkflowPdf(original, workflow);
    const result = await PDFDocument.load(exported);

    expect(result.getPageCount()).toBe(2);
    expect(result.getTitle()).toBe("PM-COM-002 — SEI/SP 042/2026");
  });
});
