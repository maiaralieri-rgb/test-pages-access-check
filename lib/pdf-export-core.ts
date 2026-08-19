import { StandardFonts, PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { WorkflowStage } from "./workflow-rules";
import type { WorkflowDocument } from "./workflow-types";

const ink = rgb(0.08, 0.13, 0.18);
const evidenceInk = rgb(0.18, 0.36, 0.28);

function stage(document: WorkflowDocument, id: string) {
  return document.stages.find((item) => item.id === id);
}

function value(item: WorkflowStage | undefined, key: string) {
  const raw = item?.fields[key];
  if (raw === true) return "Sim";
  if (raw === false) return "Não";
  return typeof raw === "string" ? raw.trim() : "";
}

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

function fitSize(font: PDFFont, text: string, maxWidth: number, initial = 9, minimum = 5) {
  for (let size = initial; size >= minimum; size -= 0.5) if (font.widthOfTextAtSize(text, size) <= maxWidth) return size;
  return minimum;
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, maxWidth: number, initialSize = 9, color = ink) {
  if (!text) return;
  page.drawText(text, { x, y, size: fitSize(font, text, maxWidth, initialSize), font, color, maxWidth });
}

function drawWrappedText(page: PDFPage, font: PDFFont, text: string, x: number, top: number, maxWidth: number, maxHeight: number, initialSize = 9) {
  if (!text) return;
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  const size = initialSize;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  const lineHeight = size * 1.28;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  lines.slice(0, maxLines).forEach((item, index) => page.drawText(item, { x, y: top - (index * lineHeight), size, font, color: ink }));
}

function mark(page: PDFPage, x: number, y: number, active: boolean) {
  if (!active) return;
  page.drawText("X", { x: x + 1.2, y: y + 0.4, size: 8, color: ink });
}

function signedEvidence(page: PDFPage, font: PDFFont, item: WorkflowStage | undefined, x: number, y: number, maxWidth: number, dateX?: number, dateY?: number) {
  if (!item || (item.status !== "signed" && item.status !== "skipped")) return;
  if (item.status === "skipped") {
    drawText(page, font, "NÃO APLICÁVEL", x, y, maxWidth, 6.5, evidenceInk);
    return;
  }
  const date = formatDate(item.signedAt);
  drawWrappedText(page, font, `Assinado eletronicamente\n${item.signerName}\n${date}`, x, y + 17, maxWidth, 25, 6.3);
  if (dateX !== undefined && dateY !== undefined) drawText(page, font, date, dateX, dateY, 56, 7, evidenceInk);
}

function isDecision(valueText: string, terms: string[]) {
  const normalized = valueText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export async function buildWorkflowPdf(templateBytes: ArrayBuffer | Uint8Array, document: WorkflowDocument) {
  const pdf = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const [pageOne, pageTwo] = pdf.getPages();
  const indication = stage(document, "indicacao");
  const personal = stage(document, "pessoal");
  const disciplinary = stage(document, "disciplinar");
  const cia = stage(document, "cia");
  const btl = stage(document, "btl");
  const parecer = stage(document, "parecer");
  const exceptional = stage(document, "excepcional");
  const subcommand = stage(document, "subcomando");
  const concession = stage(document, "concessao");
  const closure = stage(document, "fechamento");

  // Página 1 — dados cadastrais e indicação.
  drawText(pageOne, font, document.opm, 323, 747, 62, 8);
  drawText(pageOne, font, document.grade, 402, 747, 72, 8);
  drawText(pageOne, font, document.protocol, 491, 746, 74, 7.2);
  drawText(pageOne, font, document.candidateRank, 68, 693, 62, 7.5);
  drawText(pageOne, font, document.candidateName, 221, 696, 305, 8);
  drawWrappedText(pageOne, font, value(indication, "sintese"), 68, 655, 497, 510, 9);
  drawWrappedText(pageOne, font, value(indication, "extemporaneidade"), 76, 70, 300, 35, 8);
  signedEvidence(pageOne, font, indication, 457, 54, 107, 391, 93);

  // Página 2 — informações pessoais.
  drawText(pageTwo, font, value(personal, "tempoServico"), 65, 775, 62, 7.3);
  const priorGrade = value(personal, "grauAnterior");
  mark(pageTwo, 138, 773, priorGrade.includes("5"));
  mark(pageTwo, 158, 772, priorGrade.includes("4"));
  mark(pageTwo, 178, 773, priorGrade.includes("3"));
  mark(pageTwo, 199, 773, priorGrade.includes("2"));
  const assessment = value(personal, "avaliacao");
  mark(pageTwo, 67, 750, isDecision(assessment, ["inferior"]) && !isDecision(assessment, ["tendencia"]));
  mark(pageTwo, 138, 752, isDecision(assessment, ["tendencia a inferior"]));
  mark(pageTwo, 67, 737, isDecision(assessment, ["tendencia a superior"]));
  mark(pageTwo, 216, 736, isDecision(assessment, ["superior"]) && !isDecision(assessment, ["tendencia"]));
  mark(pageTwo, 307, 740, value(personal, "requisitos") === "Sim");
  mark(pageTwo, 348, 740, value(personal, "requisitos") === "Não");
  signedEvidence(pageTwo, font, personal, 449, 742, 116, 383, 754);

  // Página 2 — informações disciplinares.
  const behavior = value(disciplinary, "comportamento");
  mark(pageTwo, 67, 687, isDecision(behavior, ["excelente"]));
  mark(pageTwo, 144, 687, isDecision(behavior, ["otimo"]));
  mark(pageTwo, 229, 686, isDecision(behavior, ["bom"]));
  mark(pageTwo, 67, 670, isDecision(behavior, ["regular"]));
  mark(pageTwo, 144, 669, isDecision(behavior, ["mau"]));
  const proceeding = value(disciplinary, "processo");
  mark(pageTwo, 307, 660, isDecision(proceeding, ["sim"]));
  mark(pageTwo, 333, 660, isDecision(proceeding, ["nao"]));
  drawText(pageTwo, font, value(disciplinary, "observacoes"), 320, 642, 55, 6.5);
  const previousCancellation = value(disciplinary, "cassacao");
  mark(pageTwo, 67, 630, isDecision(previousCancellation, ["nao"]));
  mark(pageTwo, 67, 616, isDecision(previousCancellation, ["sim"]));
  mark(pageTwo, 216, 629, value(disciplinary, "requisitos") === "Sim");
  mark(pageTwo, 216, 616, value(disciplinary, "requisitos") === "Não");
  signedEvidence(pageTwo, font, disciplinary, 421, 622, 145, 320, 642);

  // Página 2 — pareceres, concessão e encerramento.
  const ciaDecision = value(cia, "decisao");
  mark(pageTwo, 67, 569, isDecision(ciaDecision, ["favoravel"]));
  mark(pageTwo, 193, 568, isDecision(ciaDecision, ["desfavoravel"]));
  signedEvidence(pageTwo, font, cia, 137, 529, 165, 64, 543);
  const btlDecision = value(btl, "decisao");
  mark(pageTwo, 325, 569, isDecision(btlDecision, ["favoravel"]));
  mark(pageTwo, 451, 568, isDecision(btlDecision, ["desfavoravel"]));
  signedEvidence(pageTwo, font, btl, 392, 529, 170, 322, 543);
  const authorityDecision = value(parecer, "decisao");
  mark(pageTwo, 67, 476, isDecision(authorityDecision, ["favoravel"]));
  mark(pageTwo, 193, 476, isDecision(authorityDecision, ["desfavoravel"]));
  signedEvidence(pageTwo, font, parecer, 137, 460, 165, 64, 453);
  const exceptionDecision = value(exceptional, "decisao");
  mark(pageTwo, 325, 476, isDecision(exceptionDecision, ["favoravel"]));
  mark(pageTwo, 451, 476, isDecision(exceptionDecision, ["desfavoravel"]));
  signedEvidence(pageTwo, font, exceptional, 392, 460, 170, 322, 453);
  const subcommandDecision = value(subcommand, "decisao");
  mark(pageTwo, 67, 383, isDecision(subcommandDecision, ["aprovacao", "favoravel"]));
  mark(pageTwo, 193, 383, isDecision(subcommandDecision, ["desfavoravel"]));
  signedEvidence(pageTwo, font, subcommand, 137, 347, 165, 64, 361);
  const concessionDecision = value(concession, "decisao");
  mark(pageTwo, 325, 383, isDecision(concessionDecision, ["concedo", "favoravel"]));
  mark(pageTwo, 453, 383, isDecision(concessionDecision, ["negado", "desfavoravel"]));
  signedEvidence(pageTwo, font, concession, 392, 347, 170, 322, 361);
  drawText(pageTwo, font, value(closure, "observacoes"), 87, 292, 55, 6.5);
  signedEvidence(pageTwo, font, closure, 135, 266, 170, 193, 293);

  pdf.setTitle(`PM-COM-002 — ${document.protocol}`);
  pdf.setSubject("Láurea do Mérito Pessoal — extrato do trâmite AssinaFluxo");
  pdf.setCreator("AssinaFluxo");
  return pdf.save();
}
