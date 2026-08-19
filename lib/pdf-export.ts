import { Platform } from "react-native";

import { getApiBaseUrl } from "@/constants/oauth";
import type { WorkflowDocument } from "@/lib/workflow-store";

function fileName(document: WorkflowDocument) {
  const protocol = document.protocol.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `PM-COM-002-${protocol || document.id}.pdf`;
}

export async function downloadWorkflowPdf(document: WorkflowDocument) {
  if (Platform.OS !== "web") throw new Error("A exportação desta versão está disponível no navegador de PC.");
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/pdf/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ workflow: document }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Não foi possível gerar o PDF a partir do formulário original.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement("a");
  link.href = url;
  link.download = fileName(document);
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
