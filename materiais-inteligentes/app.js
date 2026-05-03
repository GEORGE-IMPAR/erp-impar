
// =========================================================
// ERP ÍMPAR • Materiais Inteligentes
// Frontend: consulta KingHost + processamento OCR Render
// =========================================================

const API_BASE = "https://api.erpimpar.com.br/danfe";
const OCR_RENDER_ENDPOINT = "https://ocr-danfe-impar.onrender.com/processar-lote";

let ultimosResultados = [];
let itensOrcamento = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeGetStorage(kind, key) {
  try {
    const storage = kind === "session" ? sessionStorage : localStorage;
    return (storage.getItem(key) || "").trim();
  } catch (e) {
    return "";
  }
}

function getLoggedUser() {
  const keys = [
    "ERPIMPAR_USER",
    "usuarioLogado",
    "impar_user",
    "imparUser",
    "user",
    "ERP_IMPAR_USER",
    "ERPIMPAR_LOGIN",
    "USER"
  ];

  for (const key of keys) {
    const raw = safeGetStorage("local", key) || safeGetStorage("session", key);

    if (!raw) continue;

    try {
      const u = JSON.parse(raw);

      const nome = u.Nome || u.nome || u.name || u.userName || u.usuario || u.usuarioNome || u.userNome || "";
      const email = u.Email || u.email || u.mail || u.userEmail || u.usuarioEmail || "";
      const cargo = u.Cargo || u.cargo || u.Setor || u.setor || "Obras";
      const telefone = u.Telefone || u.telefone || u.Tel || u.tel || u.whatsapp || "";
      const foto = u.Foto || u.foto || u.photo || u.avatar || "";

      if (nome || email) {
        return {
          nome: nome || "Usuário",
          email: email || "—",
          cargo,
          telefone,
          foto
        };
      }
    } catch (e) {
      if (raw.includes("@")) {
        const parts = raw.split("|");
        return {
          nome: parts[0] || "Usuário",
          email: parts[1] || raw,
          cargo: "Obras",
          telefone: "",
          foto: ""
        };
      }
    }
  }

  return {
    nome: "Usuário",
    email: "—",
    cargo: "Obras",
    telefone: "",
    foto: ""
  };
}

function aplicarUsuario() {
  const user = getLoggedUser();

  const nome = user.nome || "Usuário";
  const email = user.email || "—";
  const cargo = user.cargo || "Obras";
  const telefone = user.telefone || "";
  const foto = user.foto || "";

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join("")
    .toUpperCase() || "U";

  $("userNome").textContent = nome;
  $("userCargo").textContent = cargo;
  $("userTel").textContent = telefone || "—";

  $("userEmail").textContent = email;
  $("userEmail").href = email && email !== "—" ? `mailto:${email}` : "#";

  const img = $("userFoto");
  const ini = $("userIniciais");

  if (foto && String(foto).trim()) {
    img.src = foto;
    img.style.display = "block";
    ini.style.display = "none";

    img.onerror = () => {
      img.removeAttribute("src");
      img.style.display = "none";
      ini.textContent = iniciais;
      ini.style.display = "block";
    };
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
    ini.textContent = iniciais;
    ini.style.display = "block";
  }
}

function voltarMenu() {
  window.location.href = "/menu.html";
}

function abrirModal() {
  $("modalOCR").style.display = "flex";
}

function fecharModal() {
  $("modalOCR").style.display = "none";
}

function abrirSucesso(texto) {
  $("successText").textContent = texto || "Processamento concluído.";
  $("successModal").style.display = "flex";
}

function fecharSucesso() {
  $("successModal").style.display = "none";
  fecharModal();
}

function limparOCR() {
  $("pdfs").value = "";
  $("fileInfo").textContent = "Nenhum arquivo selecionado.";
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
  if (!dataStr || dataStr === "-") return "-";

  let dt = null;
  const raw = String(dataStr).trim();

  if (raw.includes("/")) {
    const [d, m, a] = raw.split("/").map(Number);
    if (!d || !m || !a) return "-";
    dt = new Date(a, m - 1, d);
  } else {
    dt = new Date(raw);
  }

  if (!dt || Number.isNaN(dt.getTime())) return "-";

  dt.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dias = Math.floor((hoje - dt) / 86400000);

  if (dias > 180) return `<span class="old">${dias} dias</span>`;
  if (dias > 60) return `<span style="color:#fbbf24;font-weight:900;">${dias} dias</span>`;
  return `<span style="color:#86efac;font-weight:900;">${dias} dias</span>`;
}

async function getJson(url) {
  const sep = url.includes("?") ? "&" : "?";
  const resp = await fetch(url + sep + "t=" + Date.now(), { cache: "no-store" });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.json();
}

function normalizarCards(json) {
  const cards = json.cards || json;

  return {
    notas: cards.notas ?? cards.total_notas ?? 0,
    itens: cards.itens ?? cards.materiais ?? cards.total_itens ?? 0,
    fornecedores: cards.fornecedores ?? cards.total_fornecedores ?? 0,
    pendencias: cards.pendencias ?? cards.sem_item ?? cards.total_erros ?? 0
  };
}

async function carregarDashboard() {
  try {
    const json = await getJson(`${API_BASE}/dashboard.php`);
    const cards = normalizarCards(json);

    $("kNotas").textContent = cards.notas;
    $("kMateriais").textContent = cards.itens;
    $("kFornecedores").textContent = cards.fornecedores;
    $("kPendencias").textContent = cards.pendencias;

    const totalGeral = cards.notas + cards.itens + cards.fornecedores;
    $("baseBar").style.width = totalGeral > 0 ? "100%" : "8%";

    const atualizado = json.config?.ultimo_processamento
      ? new Date(json.config.ultimo_processamento).toLocaleDateString("pt-BR")
      : new Date().toLocaleDateString("pt-BR");

    $("ultimaAtualizacao").textContent = atualizado;
    $("resumoBase").textContent = `${cards.notas} DANFEs • ${cards.itens} itens • ${cards.pendencias} pendência(s)`;
    $("pillStatusBase").textContent = "Base online";
  } catch (e) {
    console.error(e);
    $("pillStatusBase").textContent = "API indisponível";
    $("resumoBase").textContent = "Falha ao carregar dashboard da API.";
  }
}

async function buscarMateriais() {
  const termo = $("busca").value.trim();

  $("tbodyResultados").innerHTML = `
    <tr>
      <td colspan="9" class="empty">Buscando materiais...</td>
    </tr>
  `;

  try {
    let json;

    try {
      json = await getJson(`${API_BASE}/buscar.php?q=${encodeURIComponent(termo)}`);
    } catch (e) {
      json = await getJson(`${API_BASE}/listar_materiais.php?q=${encodeURIComponent(termo)}`);
    }

    const data = json.data || json.itens || [];
    ultimosResultados = data;

    renderResultados(data);
  } catch (e) {
    console.error(e);
    $("tbodyResultados").innerHTML = `
      <tr>
        <td colspan="9" class="empty">Erro ao buscar materiais na API.</td>
      </tr>
    `;
    $("contadorResultados").textContent = "Falha na consulta";
  }
}


function getField(obj, campos, fallback = "-") {
  for (const campo of campos) {
    const valor = obj?.[campo];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return valor;
    }
  }
  return fallback;
}

function renderResultados(data) {
  if (!data.length) {
    document.getElementById('tbodyResultados').innerHTML = `
      <tr>
        <td colspan="9" class="empty">Nenhum material encontrado.</td>
      </tr>
    `;
    document.getElementById('contadorResultados').textContent = "0 materiais encontrados";
    return;
  }

  document.getElementById('contadorResultados').textContent = `${data.length} materiais encontrados`;

  document.getElementById('tbodyResultados').innerHTML = data.map((item, idx) => {
    const material = getField(item, ["material", "descricao", "descricao_item", "xProd"]);
    const fornecedor = getField(item, ["fornecedor", "emitente", "razao_social", "razao_social_emitente", "nome_emitente", "fornecedor_nome", "xNome", "cnpj_emitente", "fornecedor_cnpj"]);
    const nf = getField(item, ["numero_nfe", "numero_nf", "numero_nota", "nNF", "nota", "nf"]);
    const dataNota = getField(item, ["data_saida", "data_emissao", "dhEmi", "data", "emissao"]);
    const qtd = getField(item, ["quantidade", "qCom", "qtd", "quantidade_item"]);
    const un = getField(item, ["unidade", "uCom", "un"]);
    const valor = getField(item, ["valor_unitario", "vUnCom", "valor", "preco_unitario_item"]);

    return `
      <tr>
        <td class="material">${escapeHtml(material)}</td>
        <td>${escapeHtml(fornecedor)}</td>
        <td>${escapeHtml(nf)}</td>
        <td>${escapeHtml(dataNota)}</td>
        <td>${escapeHtml(qtd)}</td>
        <td>${escapeHtml(un)}</td>
        <td class="price">R$ ${escapeHtml(valor)}</td>
        <td>${idadeNota(dataNota)}</td>
        <td>
          <button class="btn-secondary" style="padding:8px 12px;border-radius:12px;" onclick="adicionarOrcamento(${idx})">
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
  renderOrcamento();
}

function renderOrcamento() {
  $("kOrcamento").textContent = itensOrcamento.length;

  if (!itensOrcamento.length) {
    $("listaOrcamento").innerHTML = `<div class="empty-card">Nenhum material selecionado ainda.</div>`;
    return;
  }

  $("listaOrcamento").innerHTML = itensOrcamento.map((item, idx) => {
    const material = item.material || item.descricao || "";
    const valor = item.valor_unitario || item.valor || "";
    const fornecedor = item.fornecedor || item.fornecedor_cnpj || item.cnpj_emitente || "";

    return `
      <div class="budget-item">
        <div>
          <strong>${escapeHtml(material)}</strong><br>
          <span style="color:rgba(238,246,255,.72);font-size:12px;">${escapeHtml(fornecedor)} • R$ ${escapeHtml(valor)}</span>
        </div>
        <button class="btn-secondary" style="padding:8px 12px;" onclick="removerOrcamento(${idx})">Remover</button>
      </div>
    `;
  }).join("");
}

function removerOrcamento(idx) {
  itensOrcamento.splice(idx, 1);
  renderOrcamento();
}

async function processarPDFs() {
  const files = $("pdfs").files;

  if (!files.length) {
    alert("Selecione pelo menos um PDF.");
    return;
  }

  $("progressBar").style.width = "10%";
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

    $("progressBar").style.width = "78%";

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const json = await resp.json();

    const totalArquivos = json.total_arquivos || 0;
    const resultados = json.resultados || [];
    const totalItens = resultados.reduce((acc, r) => acc + (Number(r.total_itens) || 0), 0);
    const semItem = resultados.filter(r => !Number(r.total_itens)).length;

    logOCR(`Processamento finalizado: ${totalArquivos} arquivo(s), ${totalItens} item(ns), ${semItem} pendência(s).`, "OK");

    if (json.erp_sync) {
      logOCR(`Sincronização ERP: ${JSON.stringify(json.erp_sync).slice(0, 500)}`, json.erp_sync.ok ? "OK" : "WARN");
    }

    $("progressBar").style.width = "100%";
    $("statusOCR").textContent = "Base atualizada com sucesso.";
    $("statusResumoOCR").textContent = `${totalItens} item(ns) extraído(s)`;

    await carregarDashboard();
    await buscarMateriais();

    abrirSucesso(`${totalArquivos} DANFE(s) processadas e ${totalItens} item(ns) extraídos.`);

  } catch (e) {
    console.error(e);
    $("progressBar").style.width = "100%";
    $("statusOCR").textContent = "Erro no processamento OCR.";
    logOCR(e.message || e, "ERRO");
    alert("Erro ao processar PDFs. Veja o log do modal.");
  }
}

function atualizarFileInfo() {
  const files = $("pdfs").files;
  if (!files.length) {
    $("fileInfo").textContent = "Nenhum arquivo selecionado.";
    $("statusResumoOCR").textContent = "0 arquivo(s)";
    return;
  }

  $("fileInfo").textContent = `${files.length} arquivo(s) selecionado(s).`;
  $("statusResumoOCR").textContent = `${files.length} arquivo(s)`;
}

document.addEventListener("DOMContentLoaded", async () => {
  $("btnVoltarMenu").addEventListener("click", voltarMenu);
  $("btnAtualizarBase").addEventListener("click", abrirModal);
  $("btnFecharModal").addEventListener("click", fecharModal);
  $("btnProcessarPDFs").addEventListener("click", processarPDFs);
  $("btnLimparOCR").addEventListener("click", limparOCR);
  $("btnSuccessOk").addEventListener("click", fecharSucesso);
  $("btnBuscar").addEventListener("click", buscarMateriais);
  $("btnLimparBusca").addEventListener("click", () => {
    $("busca").value = "";
    buscarMateriais();
  });
  $("btnLimparOrcamento").addEventListener("click", () => {
    itensOrcamento = [];
    renderOrcamento();
  });
  $("pdfs").addEventListener("change", atualizarFileInfo);
  $("busca").addEventListener("keydown", (event) => {
    if (event.key === "Enter") buscarMateriais();
  });

  aplicarUsuario();
  renderOrcamento();
  await carregarDashboard();
  await buscarMateriais();
});
