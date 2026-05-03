// =========================================================
// ERP ÍMPAR • Materiais Inteligentes
// Frontend: consulta KingHost + processamento OCR Render
// =========================================================

const API_BASE = "https://api.erpimpar.com.br/danfe";
const OCR_RENDER_ENDPOINT = "https://ocr-danfe-impar.onrender.com/processar-lote";

let ultimosResultados = [];
let itensOrcamento = [];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function voltarMenu() {
  window.location.href = "/";
}

function abrirModal() {
  $("modalOCR").style.display = "flex";
}

function fecharModal() {
  $("modalOCR").style.display = "none";
}

function limparOCR() {
  $("pdfs").value = "";
  $("progressBar").style.width = "0%";
  $("statusOCR").textContent = "Aguardando seleção dos PDFs...";
  $("statusResumoOCR").textContent = "0 arquivo(s)";
  $("logsOCR").innerHTML = "[INFO] Motor OCR Render pronto para receber PDFs.";
}

function logOCR(msg, tipo = "INFO") {
  const agora = new Date().toLocaleTimeString("pt-BR");
  $("logsOCR").innerHTML += `<br>[${tipo}] ${agora} - ${escapeHtml(msg)}`;
  $("logsOCR").scrollTop = $("logsOCR").scrollHeight;
}

function parseDataBR(dataStr) {
  if (!dataStr || !String(dataStr).includes("/")) return null;

  const [d, m, a] = String(dataStr).split("/").map(Number);
  if (!d || !m || !a) return null;

  const dt = new Date(a, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function idadeNota(dataStr) {
  const dt = parseDataBR(dataStr);
  if (!dt) return "-";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dias = Math.floor((hoje - dt) / 86400000);

  if (dias > 90) {
    return `<span class="old">${dias} dias</span>`;
  }

  if (dias > 30) {
    return `<span style="color:#fbbf24;font-weight:800;">${dias} dias</span>`;
  }

  return `<span style="color:#86efac;font-weight:800;">${dias} dias</span>`;
}

async function getJson(url) {
  const sep = url.includes("?") ? "&" : "?";
  const resp = await fetch(url + sep + "t=" + Date.now());

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  return await resp.json();
}

function normalizarCards(cards) {
  return {
    notas: cards?.notas ?? cards?.total_notas ?? 0,
    itens: cards?.itens ?? cards?.materiais ?? cards?.total_itens ?? 0,
    fornecedores: cards?.fornecedores ?? cards?.total_fornecedores ?? 0,
    pendencias: cards?.pendencias ?? cards?.sem_item ?? cards?.total_erros ?? 0
  };
}

async function carregarDashboard() {
  try {
    const json = await getJson(`${API_BASE}/dashboard.php`);
    const cards = normalizarCards(json.cards || json);

    $("kNotas").textContent = cards.notas;
    $("kMateriais").textContent = cards.itens;
    $("kFornecedores").textContent = cards.fornecedores;
    $("kPendencias").textContent = cards.pendencias;

    const agora = new Date().toLocaleDateString("pt-BR");
    $("ultimaAtualizacao").textContent = json.config?.ultimo_processamento
      ? new Date(json.config.ultimo_processamento).toLocaleDateString("pt-BR")
      : agora;

    $("resumoBase").textContent =
      `${cards.notas} DANFEs • ${cards.itens} itens • ${cards.pendencias} pendências`;

  } catch (e) {
    console.error(e);
    $("resumoBase").textContent = "Falha ao carregar dashboard da API.";
  }
}

async function buscarMateriais() {
  const termo = $("busca").value.trim();

  $("tbody").innerHTML = `
    <tr>
      <td colspan="8">Buscando materiais...</td>
    </tr>
  `;

  try {
    let url = `${API_BASE}/buscar.php?q=${encodeURIComponent(termo)}`;

    // Compatibilidade se a API estiver com o nome antigo.
    let json;
    try {
      json = await getJson(url);
    } catch (e) {
      json = await getJson(`${API_BASE}/listar_materiais.php?q=${encodeURIComponent(termo)}`);
    }

    const data = json.data || json.itens || [];
    ultimosResultados = data;

    renderResultados(data);

  } catch (e) {
    console.error(e);
    $("tbody").innerHTML = `
      <tr>
        <td colspan="8">Erro ao buscar materiais na API.</td>
      </tr>
    `;
    $("contadorResultados").textContent = "Falha na consulta";
  }
}

function renderResultados(data) {
  const tbody = $("tbody");

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">Nenhum material encontrado.</td>
      </tr>
    `;
    $("contadorResultados").textContent = "0 materiais encontrados";
    return;
  }

  $("contadorResultados").textContent = `${data.length} materiais encontrados`;

  tbody.innerHTML = data.map((item, idx) => {
    const material = item.material || item.descricao || "";
    const fornecedor = item.fornecedor || item.fornecedor_cnpj || item.cnpj_emitente || "";
    const nf = item.numero_nfe || item.nf || "";
    const dataNota = item.data_saida || item.data || "";
    const qtd = item.quantidade || "";
    const un = item.unidade || "";
    const valor = item.valor_unitario || item.valor || "";

    return `
      <tr>
        <td class="material">${escapeHtml(material)}</td>
        <td>${escapeHtml(fornecedor)}</td>
        <td>${escapeHtml(nf)}</td>
        <td>${escapeHtml(dataNota)}</td>
        <td>${escapeHtml(qtd)} ${escapeHtml(un)}</td>
        <td class="price">R$ ${escapeHtml(valor)}</td>
        <td>${idadeNota(dataNota)}</td>
        <td>
          <button class="update-btn" style="padding:8px 12px;border-radius:12px;" onclick="adicionarOrcamento(${idx})">
            + Orçamento
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function adicionarOrcamento(idx) {
  const item = ultimosResultados[idx];
  if (!item) return;

  itensOrcamento.push(item);
  alert("Material adicionado à base orçamentária.");
}

async function processarPDFs() {
  const files = $("pdfs").files;

  if (!files.length) {
    alert("Selecione pelo menos um PDF.");
    return;
  }

  $("progressBar").style.width = "15%";
  $("statusOCR").textContent = "Enviando PDFs para o motor OCR Render...";
  $("statusResumoOCR").textContent = `${files.length} arquivo(s)`;
  logOCR(`Enviando ${files.length} PDF(s) para ${OCR_RENDER_ENDPOINT}`);

  const formData = new FormData();
  Array.from(files).forEach(file => formData.append("files", file));

  try {
    $("progressBar").style.width = "35%";
    logOCR("Processamento iniciado. Aguarde...");

    const resp = await fetch(OCR_RENDER_ENDPOINT, {
      method: "POST",
      body: formData
    });

    $("progressBar").style.width = "75%";

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const json = await resp.json();

    const totalArquivos = json.total_arquivos || 0;
    const resultados = json.resultados || [];
    const totalItens = resultados.reduce((acc, r) => acc + (r.total_itens || 0), 0);
    const semItem = resultados.filter(r => !r.total_itens).length;

    logOCR(`Processamento finalizado: ${totalArquivos} arquivo(s), ${totalItens} item(ns), ${semItem} pendência(s).`, "OK");

    if (json.erp_sync) {
      logOCR(`Sincronização ERP: ${JSON.stringify(json.erp_sync).slice(0, 500)}`, json.erp_sync.ok ? "OK" : "WARN");
    }

    $("progressBar").style.width = "100%";
    $("statusOCR").textContent = "Base atualizada com sucesso.";
    $("statusResumoOCR").textContent = `${totalItens} item(ns) extraído(s)`;

    await carregarDashboard();
    await buscarMateriais();

  } catch (e) {
    console.error(e);
    $("progressBar").style.width = "100%";
    $("statusOCR").textContent = "Erro no processamento OCR.";
    logOCR(e.message || e, "ERRO");
    alert("Erro ao processar PDFs. Veja o log do modal.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await carregarDashboard();
  await buscarMateriais();
});
