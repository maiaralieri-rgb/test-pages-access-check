/* ===== PM-COM-002 — Tramitação Digital da Láurea do Mérito Pessoal ===== */

// Ordem oficial de tramitação. Etapas obrigatórias travam a sequência;
// etapas opcionais podem ser puladas, mas, se assinadas, respeitam a posição.
const ETAPAS = [
  { id: "indicacao",         titulo: "Responsável pela Indicação",                       papel: "Autoridade do Art. 6º",            obrigatoria: true },
  { id: "infoPessoais",      titulo: "Informações Pessoais",                             papel: "Oficial P/1 ou Secretário",        obrigatoria: true },
  { id: "infoDisciplinares", titulo: "Informações Disciplinares",                        papel: "Oficial PJMD ou equivalente",      obrigatoria: true },
  { id: "parecerCia",        titulo: "Parecer Cmt Cia / equivalente",                    papel: "Opcional — quando não autoridade do Art. 8º", obrigatoria: false },
  { id: "parecerBtl",        titulo: "Parecer Cmt Btl / equivalente",                    papel: "Opcional — quando não autoridade do Art. 8º", obrigatoria: false },
  { id: "parecerGeral",      titulo: "Parecer",                                          papel: "Opcional — quando não autoridade do Art. 8º", obrigatoria: false },
  { id: "parecerExcepcional",titulo: "Parecer para Situações Excepcionais",              papel: "Autoridade do Art. 8º, inciso V",  obrigatoria: false },
  { id: "aprovacaoSubCmt",   titulo: "Aprovação do Subcomandante PM (sit. excepcionais)",papel: "Subcomandante PM",                 obrigatoria: false },
  { id: "concessao",         titulo: "Concessão",                                        papel: "Autoridades previstas no Art. 8º", obrigatoria: true },
  { id: "visto",             titulo: "Publicação e Visto",                               papel: "OPM responsável pela publicação",  obrigatoria: true },
];

const GRADUACOES = [
  "Coronel PM", "Tenente-Coronel PM", "Major PM", "Capitão PM",
  "1º Tenente PM", "2º Tenente PM", "Aspirante a Oficial PM",
  "Subtenente PM", "1º Sargento PM", "2º Sargento PM", "3º Sargento PM",
  "Cabo PM", "Soldado PM 1ª Classe", "Soldado PM 2ª Classe",
];

const STORAGE_KEY = "pmcom002_planilhas";

let planilhas = [];
let atual = null; // planilha aberta
let etapaAssinando = null;

/* ===== Persistência ===== */
function carregar() {
  try { planilhas = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { planilhas = []; }
}
function salvar(mostrarStatus = true) {
  if (atual) {
    atual.atualizadaEm = new Date().toISOString();
    coletarCampos();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(planilhas));
  renderLista();
  if (mostrarStatus && atual) {
    const el = document.getElementById("statusSalvo");
    el.textContent = "Salvo às " + new Date().toLocaleTimeString("pt-BR");
    setTimeout(() => { el.textContent = ""; }, 4000);
  }
}

function novaPlanilha() {
  const p = {
    id: "lmp-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
    criadaEm: new Date().toISOString(),
    atualizadaEm: new Date().toISOString(),
    campos: {},
    assinaturas: {},
  };
  planilhas.unshift(p);
  abrir(p.id);
  salvar(false);
}

function abrir(id) {
  if (atual) salvar(false);
  atual = planilhas.find(p => p.id === id) || null;
  renderTudo();
}

function excluirAtual() {
  if (!atual) return;
  const nome = atual.campos.nomeCompleto || "(sem nome)";
  if (!confirm(`Excluir a planilha de ${nome}? Esta ação não pode ser desfeita.`)) return;
  planilhas = planilhas.filter(p => p.id !== atual.id);
  atual = null;
  salvar(false);
  renderTudo();
}

/* ===== Campos do formulário ===== */
function coletarCampos() {
  if (!atual) return;
  document.querySelectorAll("[data-campo]").forEach(el => {
    atual.campos[el.dataset.campo] = el.value;
  });
  document.querySelectorAll("[data-radio]").forEach(grupo => {
    const sel = grupo.querySelector("input:checked");
    atual.campos[grupo.dataset.radio] = sel ? sel.value : "";
  });
  document.querySelectorAll("[data-check]").forEach(grupo => {
    const vals = [...grupo.querySelectorAll("input:checked")].map(i => i.value);
    atual.campos[grupo.dataset.check] = vals;
  });
}

function preencherCampos() {
  if (!atual) return;
  document.querySelectorAll("[data-campo]").forEach(el => {
    el.value = atual.campos[el.dataset.campo] || "";
  });
  document.querySelectorAll("[data-radio]").forEach(grupo => {
    const v = atual.campos[grupo.dataset.radio] || "";
    grupo.querySelectorAll("input").forEach(i => { i.checked = i.value === v; });
  });
  document.querySelectorAll("[data-check]").forEach(grupo => {
    const vals = atual.campos[grupo.dataset.check] || [];
    grupo.querySelectorAll("input").forEach(i => { i.checked = vals.includes(i.value); });
  });
}

/* ===== Regras de ordem das assinaturas ===== */
function indiceEtapa(id) { return ETAPAS.findIndex(e => e.id === id); }

// Próxima etapa obrigatória ainda não assinada.
function proximaObrigatoria() {
  return ETAPAS.find(e => e.obrigatoria && !atual.assinaturas[e.id]) || null;
}

// Uma etapa pode ser assinada se:
//  - ainda não foi assinada;
//  - todas as obrigatórias anteriores a ela já foram assinadas;
//  - nenhuma etapa posterior já foi assinada (a tramitação não retrocede).
function podeAssinar(id) {
  if (!atual || atual.assinaturas[id]) return false;
  const idx = indiceEtapa(id);
  for (let i = 0; i < idx; i++) {
    if (ETAPAS[i].obrigatoria && !atual.assinaturas[ETAPAS[i].id]) return false;
  }
  for (let i = idx + 1; i < ETAPAS.length; i++) {
    if (atual.assinaturas[ETAPAS[i].id]) return false;
  }
  return true;
}

/* ===== CPF ===== */
function formatarCpf(v) {
  v = v.replace(/\D/g, "").slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

function cpfValido(cpf) {
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += parseInt(cpf[i]) * (t + 1 - i);
    const dig = ((soma * 10) % 11) % 10;
    if (dig !== parseInt(cpf[t])) return false;
  }
  return true;
}

function mascararCpf(cpf) {
  // Exibição pública parcial: ***.456.789-** (LGPD)
  const d = cpf.replace(/\D/g, "");
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/* ===== Assinatura digital ===== */
async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function assinarEtapa(etapaId, nome, graduacao, cpf) {
  coletarCampos();
  const dataHora = new Date().toISOString();
  // O hash vincula signatário + etapa + conteúdo do documento no momento da assinatura.
  const conteudo = JSON.stringify({
    planilha: atual.id,
    etapa: etapaId,
    nome, graduacao, cpf: cpf.replace(/\D/g, ""),
    dataHora,
    campos: atual.campos,
    anteriores: Object.fromEntries(
      Object.entries(atual.assinaturas).map(([k, a]) => [k, a.hash])
    ),
  });
  const hash = await sha256Hex(conteudo);
  atual.assinaturas[etapaId] = { nome, graduacao, cpf, dataHora, hash };
  salvar();
  renderTudo();
}

/* ===== Renderização ===== */
function renderLista() {
  const ul = document.getElementById("listaPlanilhas");
  ul.innerHTML = "";
  if (planilhas.length === 0) {
    ul.innerHTML = '<li style="cursor:default;color:#6b7280">Nenhuma planilha criada ainda.</li>';
    return;
  }
  for (const p of planilhas) {
    const li = document.createElement("li");
    if (atual && p.id === atual.id) li.classList.add("ativa");
    const obrig = ETAPAS.filter(e => e.obrigatoria);
    const feitas = obrig.filter(e => p.assinaturas[e.id]).length;
    li.innerHTML = `
      <div class="li-titulo">${escapeHtml(p.campos.nomeCompleto || "Planilha sem identificação")}</div>
      <div class="li-meta">${escapeHtml(p.campos.opm || "OPM não informada")} · Grau ${escapeHtml(p.campos.grau || "—")} · ${new Date(p.criadaEm).toLocaleDateString("pt-BR")}</div>
      <div class="li-progresso">${feitas}/${obrig.length} assinaturas obrigatórias</div>`;
    li.addEventListener("click", () => abrir(p.id));
    ul.appendChild(li);
  }
}

function renderFluxo() {
  const ol = document.getElementById("fluxoSteps");
  ol.innerHTML = "";
  const proxima = proximaObrigatoria();
  for (const etapa of ETAPAS) {
    const li = document.createElement("li");
    const ass = atual.assinaturas[etapa.id];
    let tag = `<span class="tag">${etapa.obrigatoria ? "Aguardando" : "Opcional"}</span>`;
    let assinante = "";
    if (ass) {
      li.classList.add("assinada");
      tag = '<span class="tag tag-ok">Assinada</span>';
      assinante = `<div class="passo-assinante">✓ ${escapeHtml(ass.graduacao)} ${escapeHtml(ass.nome)} — ${new Date(ass.dataHora).toLocaleString("pt-BR")}</div>`;
    } else if (proxima && etapa.id === proxima.id) {
      li.classList.add("proxima");
      tag = '<span class="tag tag-proxima">Próxima a assinar</span>';
    }
    li.innerHTML = `
      <div class="passo-info">
        <div class="passo-titulo">${etapa.titulo}</div>
        <div class="passo-papel">${etapa.papel}</div>
        ${assinante}
      </div>
      ${tag}`;
    ol.appendChild(li);
  }
}

function renderBlocosAssinatura() {
  document.querySelectorAll(".bloco-assinatura").forEach(bloco => {
    const id = bloco.dataset.step;
    const etapa = ETAPAS.find(e => e.id === id);
    const ass = atual.assinaturas[id];
    if (ass) {
      bloco.innerHTML = `
        <div class="ass-realizada">
          <div class="ass-selo">
            <div class="ass-check">✔</div>
            <div>
              <div class="ass-nome">${escapeHtml(ass.nome)}</div>
              <div class="ass-detalhe">${escapeHtml(ass.graduacao)} · CPF ${mascararCpf(ass.cpf)}</div>
              <div class="ass-detalhe">Assinado digitalmente em ${new Date(ass.dataHora).toLocaleString("pt-BR")}</div>
              <div class="ass-hash">Código de verificação (SHA-256): ${ass.hash}</div>
            </div>
          </div>
        </div>`;
    } else if (podeAssinar(id)) {
      bloco.innerHTML = `
        <div class="ass-pendente no-print">
          <span>Etapa ${indiceEtapa(id) + 1} — ${etapa.titulo}: aguardando assinatura.</span>
          <button class="btn btn-primary btn-assinar" data-etapa="${id}">✍ Assinar esta etapa</button>
        </div>
        <div class="ass-pendente" style="display:none"></div>`;
      bloco.querySelector(".btn-assinar").addEventListener("click", () => abrirModal(id));
    } else {
      const motivo = atualTemPosterior(id)
        ? "etapa não preenchida — tramitação já avançou (dispensada)"
        : "bloqueada — aguarde as assinaturas anteriores da ordem de tramitação";
      bloco.innerHTML = `<div class="ass-bloqueada no-print">Etapa ${indiceEtapa(id) + 1} — ${etapa.titulo}: ${motivo}.</div>`;
    }
  });
}

function atualTemPosterior(id) {
  const idx = indiceEtapa(id);
  return ETAPAS.some((e, i) => i > idx && atual.assinaturas[e.id]);
}

function renderTudo() {
  renderLista();
  const doc = document.getElementById("documento");
  const vazia = document.getElementById("telaVazia");
  if (!atual) {
    doc.hidden = true;
    vazia.hidden = false;
    return;
  }
  doc.hidden = false;
  vazia.hidden = true;
  preencherCampos();
  renderFluxo();
  renderBlocosAssinatura();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ===== Modal de assinatura ===== */
function abrirModal(etapaId) {
  etapaAssinando = etapaId;
  const etapa = ETAPAS.find(e => e.id === etapaId);
  document.getElementById("modalTitulo").textContent =
    `Assinar — ${etapa.titulo}`;
  document.getElementById("modalSubtitulo").textContent =
    `${etapa.papel} · Etapa ${indiceEtapa(etapaId) + 1} de ${ETAPAS.length}`;
  document.getElementById("assNome").value = "";
  document.getElementById("assCpf").value = "";
  document.getElementById("assGraduacao").value = "";
  document.getElementById("assDeclaro").checked = false;
  document.getElementById("btnConfirmarAss").disabled = true;
  document.getElementById("assErro").hidden = true;
  document.getElementById("modalAssinatura").hidden = false;
  document.getElementById("assNome").focus();
}

function fecharModal() {
  document.getElementById("modalAssinatura").hidden = true;
  etapaAssinando = null;
}

async function confirmarAssinatura() {
  const nome = document.getElementById("assNome").value.trim();
  const graduacao = document.getElementById("assGraduacao").value;
  const cpf = document.getElementById("assCpf").value.trim();
  const erro = document.getElementById("assErro");

  const falha = (msg) => { erro.textContent = msg; erro.hidden = false; };
  if (nome.split(/\s+/).length < 2) return falha("Informe o nome completo (nome e sobrenome).");
  if (!graduacao) return falha("Selecione o posto/graduação.");
  if (!cpfValido(cpf)) return falha("CPF inválido. Verifique os dígitos informados.");
  if (!podeAssinar(etapaAssinando)) return falha("Esta etapa não pode mais ser assinada — verifique a ordem de tramitação.");

  const btn = document.getElementById("btnConfirmarAss");
  btn.disabled = true;
  btn.textContent = "Assinando...";
  await assinarEtapa(etapaAssinando, nome, graduacao, cpf);
  btn.textContent = "✍ Assinar digitalmente";
  fecharModal();
}

/* ===== Exportação / Importação ===== */
function exportarJson() {
  coletarCampos();
  const blob = new Blob([JSON.stringify(atual, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `LMP_${(atual.campos.nomeCompleto || atual.id).replace(/\s+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importarJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const p = JSON.parse(reader.result);
      if (!p.id || typeof p.campos !== "object" || typeof p.assinaturas !== "object") {
        throw new Error("estrutura inválida");
      }
      const existente = planilhas.findIndex(x => x.id === p.id);
      if (existente >= 0) {
        if (!confirm("Já existe uma planilha com este identificador. Substituir pela versão importada?")) return;
        planilhas[existente] = p;
      } else {
        planilhas.unshift(p);
      }
      abrir(p.id);
      salvar(false);
    } catch {
      alert("Arquivo inválido: selecione um JSON exportado por este sistema.");
    }
  };
  reader.readAsText(file);
}

function exportarPdf() {
  coletarCampos();
  salvar(false);
  renderTudo();
  const tituloOriginal = document.title;
  document.title = `LMP_${atual.campos.nomeCompleto || "PM-COM-002"}`;
  window.print();
  document.title = tituloOriginal;
}

/* ===== Inicialização ===== */
function init() {
  // Popular selects de graduação
  for (const sel of [document.querySelector(".select-graduacao"), document.getElementById("assGraduacao")]) {
    sel.innerHTML = '<option value="">Selecione...</option>' +
      GRADUACOES.map(g => `<option>${g}</option>`).join("");
  }

  document.getElementById("btnNova").addEventListener("click", novaPlanilha);
  document.getElementById("btnSalvar").addEventListener("click", () => salvar());
  document.getElementById("btnExcluir").addEventListener("click", excluirAtual);
  document.getElementById("btnExportPdf").addEventListener("click", exportarPdf);
  document.getElementById("btnExportJson").addEventListener("click", exportarJson);
  document.getElementById("btnImportar").addEventListener("click", () =>
    document.getElementById("inputImport").click());
  document.getElementById("inputImport").addEventListener("change", e => {
    if (e.target.files[0]) importarJson(e.target.files[0]);
    e.target.value = "";
  });

  // Modal
  document.getElementById("btnCancelarAss").addEventListener("click", fecharModal);
  document.getElementById("btnConfirmarAss").addEventListener("click", confirmarAssinatura);
  document.getElementById("assDeclaro").addEventListener("change", e => {
    document.getElementById("btnConfirmarAss").disabled = !e.target.checked;
  });
  document.getElementById("assCpf").addEventListener("input", e => {
    e.target.value = formatarCpf(e.target.value);
  });
  document.getElementById("modalAssinatura").addEventListener("click", e => {
    if (e.target.id === "modalAssinatura") fecharModal();
  });

  // Autosave ao editar campos (campos permanecem editáveis a qualquer momento)
  document.getElementById("documento").addEventListener("change", () => salvar(false));

  carregar();
  if (planilhas.length > 0) abrir(planilhas[0].id);
  else renderTudo();
}

document.addEventListener("DOMContentLoaded", init);
