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
  } catch {
    return "";
  }
}

function readUserCandidate(raw) {
  if (!raw) return null;

  try {
    const u = JSON.parse(raw);

    const nome = u.Nome || u.nome || u.name || u.userName || u.usuario || u.usuarioNome || u.userNome || "";
    const email = u.Email || u.email || u.mail || u.userEmail || u.usuarioEmail || "";
    const cargo = u.Cargo || u.cargo || u.Setor || u.setor || u.departamento || "Obras";
    const telefone = u.Telefone || u.telefone || u.Tel || u.tel || u.whatsapp || u.celular || "";
    const foto = u.Foto || u.foto || u.avatar || u.photo || u.imagem || u.image || u.profilePhoto || u.fotoPerfil || u.urlFoto || u.picture || "";

    if (nome || email) return { nome: nome || "Usuário", email: email || "—", cargo, telefone, foto };
  } catch {
    if (raw.includes("@")) {
      const parts = raw.split("|");
      return { nome: parts[0] || "Usuário", email: parts[1] || raw, cargo: "Obras", telefone: "", foto: "" };
    }
  }
  return null;
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
    "ERPIMPARUSER",
    "USER"
  ];

  for (const key of keys) {
    const localUser = readUserCandidate(safeGetStorage("local", key));
    if (localUser) return localUser;

    const sessionUser = readUserCandidate(safeGetStorage("session", key));
    if (sessionUser) return sessionUser;
  }

  return { nome: "Usuário", email: "—", cargo: "Obras", telefone: "", foto: "" };
}

function normalizarFotoUsuario(foto) {
  let url = String(foto || "").trim();

  if (!url) return "";

  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  ) {
    return url;
  }

  url = url.replace(/^\.\//, "").replace(/^\.\.\//, "");

  if (url.startsWith("/")) {
    return url;
  }

  return "/" + url;
}

function aplicarUsuario() {
  const user = getLoggedUser();
  const nome = user.nome || "Usuário";
  const iniciais = nome.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "U";

  $("userNome").textContent = nome;
  $("userCargo").textContent = user.cargo || "Obras";
  $("userTel").textContent = user.telefone || "—";
  $("userEmail").textContent = user.email || "—";
  $("userEmail").href = user.email && user.email !== "—" ? `mailto:${user.email}` : "#";

  const img = $("userFoto");
  const ini = $("userIniciais");
  const fotoUrl = normalizarFotoUsuario(user.foto);

  if (fotoUrl) {
    img.src = fotoUrl;
    img.style.display = "block";
    ini.style.display = "none";

    img.onerror = () => {
      img.removeAttribute("src");
      img.style.display = "none";
      ini.textContent = iniciais;
      ini.style.display = "block";
    };
    return;
  }

  img.removeAttribute("src");
  img.style.display = "none";
  ini.textContent = iniciais;
  ini.style.display = "block";
}

function voltarMenu() {
  window.location.href = "https://www.erpimpar.com.br/index.html";
}

function abrirModal() {
  $("modalOCR").style.display = "flex";
  document.body.style.overflow = "hidden";
}

function fecharModal() {
  $("modalOCR").style.display = "none";
  document.body.style.overflow = "";
}

function abrirSucesso(texto) {
  $("successText").textContent = texto || "Processamento concluído.";
  $("successModal").style.display = "flex";
  document.body.style.overflow = "hidden";
}

function fecharSucesso() {
  $("successModal").style.display = "none";
  document.body.style.overflow = "";
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
  if (!dataStr || dataStr === "-") return null;
  const raw = String(dataStr).trim();

  if (raw.includes("/")) {
    const [d, m, a] = raw.split("/").map(Number);
    if (!d || !m || !a) return null;
    const dt = new Date(a, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function idadeNota(dataStr) {
  const dt = parseDataBR(dataStr);
  if (!dt) return "-";

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
    notas: Number(cards.notas ?? cards.total_notas ?? 0),
    itens: Number(cards.itens ?? cards.materiais ?? cards.total_itens ?? 0),
    fornecedores: Number(cards.fornecedores ?? cards.total_fornecedores ?? 0),
    pendencias: Number(cards.pendencias ?? cards.sem_item ?? cards.total_erros ?? 0)
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

    const atualizado = json.ultima_atualizacao || json.config?.ultimo_processamento || new Date().toLocaleDateString("pt-BR");
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
  $("tbodyResultados").innerHTML = `<tr><td colspan="9" class="empty">Buscando materiais...</td></tr>`;

  try {
    let json;
    try {
      json = await getJson(`${API_BASE}/buscar.php?q=${encodeURIComponent(termo)}`);
    } catch {
      json = await getJson(`${API_BASE}/listar_materiais.php?q=${encodeURIComponent(termo)}`);
    }

    const data = json.data || json.itens || [];
    ultimosResultados = data;
    renderResultados(data);
  } catch (e) {
    console.error(e);
    $("tbodyResultados").innerHTML = `<tr><td colspan="9" class="empty">Erro ao buscar materiais na API.</td></tr>`;
    $("contadorResultados").textContent = "Falha na consulta";
  }
}

function getField(obj, campos, fallback = "-") {
  for (const campo of campos) {
    const valor = obj?.[campo];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") return valor;
  }
  return fallback;
}

function renderResultados(data) {
  if (!data.length) {
    $("tbodyResultados").innerHTML = `<tr><td colspan="9" class="empty">Nenhum material encontrado.</td></tr>`;
    $("contadorResultados").textContent = "0 materiais encontrados";
    return;
  }

  $("contadorResultados").textContent = `${data.length} materiais encontrados`;

  $("tbodyResultados").innerHTML = data.map((item, idx) => {
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
        <td><button class="btn-secondary" style="padding:8px 12px;border-radius:12px;" onclick="adicionarOrcamento(${idx})">+ Orçamento</button></td>
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
    const material = getField(item, ["material", "descricao", "descricao_item", "xProd"]);
    const valor = getField(item, ["valor_unitario", "vUnCom", "valor", "preco_unitario_item"]);
    const fornecedor = getField(item, ["fornecedor", "emitente", "xNome", "cnpj_emitente", "fornecedor_cnpj"]);

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

async function enviarLoteParaRender(filesLote) {
  const formData = new FormData();
  filesLote.forEach(file => formData.append("files", file));

  const resp = await fetch(OCR_RENDER_ENDPOINT, {
    method: "POST",
    body: formData,
    mode: "cors",
    credentials: "omit"
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  return await resp.json();
}

async function processarPDFs() {
  const files = Array.from($("pdfs").files || []);

  if (!files.length) {
    alert("Selecione pelo menos um PDF.");
    return;
  }

  const TAMANHO_LOTE = 5;
  const totalArquivosSelecionados = files.length;
  const totalLotes = Math.ceil(totalArquivosSelecionados / TAMANHO_LOTE);

  $("progressBar").style.width = "3%";
  $("statusOCR").textContent = "Preparando lotes para o motor OCR Render...";
  $("statusResumoOCR").textContent = `${totalArquivosSelecionados} arquivo(s) em ${totalLotes} lote(s)`;

  logOCR(`Iniciando processamento em lote: ${totalArquivosSelecionados} PDF(s), ${totalLotes} lote(s) de até ${TAMANHO_LOTE}.`);

  let totalArquivos = 0;
  let totalItens = 0;
  let totalPendencias = 0;
  let erros = 0;

  try {
    for (let i = 0; i < totalLotes; i++) {
      const inicio = i * TAMANHO_LOTE;
      const fim = inicio + TAMANHO_LOTE;
      const lote = files.slice(inicio, fim);

      const progressoInicio = Math.round((i / totalLotes) * 90) + 5;
      $("progressBar").style.width = `${progressoInicio}%`;

      $("statusOCR").textContent = `Processando lote ${i + 1} de ${totalLotes}...`;
      $("statusResumoOCR").textContent = `${lote.length} arquivo(s) no lote atual`;

      logOCR(`Enviando lote ${i + 1}/${totalLotes}: ${lote.map(f => f.name).join(", ")}`);

      const json = await enviarLoteParaRender(lote);

      const resultados = json.resultados || [];
      const itensLote = resultados.reduce((acc, r) => acc + (Number(r.total_itens) || 0), 0);
      const pendenciasLote = resultados.filter(r => !Number(r.total_itens)).length;

      totalArquivos += Number(json.total_arquivos || resultados.length || lote.length);
      totalItens += itensLote;
      totalPendencias += pendenciasLote;

      if (json.erp_sync) {
        logOCR(`Lote ${i + 1}: sincronização ERP ${json.erp_sync.ok ? "OK" : "WARN"}.`, json.erp_sync.ok ? "OK" : "WARN");
      }

      logOCR(`Lote ${i + 1}/${totalLotes} concluído: ${itensLote} item(ns), ${pendenciasLote} pendência(s).`, "OK");
    }

    $("progressBar").style.width = "100%";
    $("statusOCR").textContent = "Base atualizada com sucesso.";
    $("statusResumoOCR").textContent = `${totalItens} item(ns) extraído(s)`;

    logOCR(`Processamento finalizado: ${totalArquivos} arquivo(s), ${totalItens} item(ns), ${totalPendencias} pendência(s).`, "OK");

    await carregarDashboard();
    await buscarMateriais();

    abrirSucesso(`${totalArquivos} DANFE(s) processadas e ${totalItens} item(ns) extraídos.`);
  } catch (e) {
    erros++;
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
