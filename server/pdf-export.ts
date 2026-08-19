import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Express, Request, Response } from "express";

import { buildWorkflowPdf } from "../lib/pdf-export-core";
import type { WorkflowDocument } from "../lib/workflow-store";

function safeFileName(protocol: string, fallback: string) {
  const value = protocol.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `PM-COM-002-${value || fallback}.pdf`;
}

function hasWorkflowShape(value: unknown): value is WorkflowDocument {
  if (!value || typeof value !== "object") return false;
  const workflow = value as Partial<WorkflowDocument>;
  return typeof workflow.id === "string" && typeof workflow.protocol === "string" && typeof workflow.candidateName === "string" && Array.isArray(workflow.stages);
}

async function exportPdf(req: Request, res: Response) {
  const workflow = req.body?.workflow;
  if (!hasWorkflowShape(workflow)) {
    res.status(400).json({ error: "Os dados do processo não são válidos para geração do PDF." });
    return;
  }
  try {
    const source = resolve(process.cwd(), "assets/forms/PM-COM-002.pdf");
    const template = await readFile(source);
    const bytes = await buildWorkflowPdf(template, workflow);
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(workflow.protocol, workflow.id)}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(bytes));
  } catch (error) {
    console.error("[pdf-export]", error);
    res.status(500).json({ error: "Não foi possível gerar o PDF a partir do formulário original." });
  }
}

export function registerPdfExportRoute(app: Express) {
  app.post("/api/pdf/export", exportPdf);
}
