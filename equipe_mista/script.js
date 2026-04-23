(() => {
  const API_BASE = "https://api.erpimpar.com.br/api/equipe_mista";
  const DOCS_URL = "https://www.erpimpar.com.br/documentos/index.html";
  const LS_EQUIPES = "ERPIMPAR_EQUIPE_MISTA_LOCAL";

  const state = {
    obras: [],
    equipesBase: { impar: [], thermo: [] },
    selecionados: [],
    historico: [],
    pendingPayload: null,
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    obraSelect: $("obraSelect"),
    tipoObraInputs: [...document.querySelectorAll('input[name="tipoObra"]')],
    listaImpar: $("listaImpar"),
    listaThermo: $("listaThermo"),
    listaSelecionados: $("listaSelecionados"),
    dropPanel: $("dropPanel"),
    dropEmpty: $("dropEmpty"),
    btnFinalizar: $("btnFinalizar"),
    btnGerarPdf: $("btnGerarPdf"),
    btnCompartilhar: $("btnCompartilhar"),
    btnCancelarModal: $("btnCancelarModal"),
    btnFecharSucesso: $("btnFecharSucesso"),
    btnNovoDocumento: $("btnNovoDocumento"),
    btnAtualizarObras: $("btnAtualizarObras"),
    btnRecarregarHistorico: $("btnRecarregarHistorico"),
    acaoModal: $("acaoModal"),
    sucessoModal: $("sucessoModal"),
    historicoEquipes: $("historicoEquipes"),
    statusStrip: $("statusStrip"),
    obraViagem: $("obraViagem"),
    totalEquipeBadge: $("totalEquipeBadge"),
    totalImparBadge: $("totalImparBadge"),
    totalThermoBadge: $("totalThermoBadge"),
    counterListaImpar: $("counterListaImpar"),
    counterListaThermo: $("counterListaThermo"),
    usuarioLogadoLabel: $("usuarioLogadoLabel"),
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    preencherUsuario();
    registrarEventos();
    carregarEquipesBase();
    renderListasOrigem();
    await Promise.all([carregarObras(), carregarHistorico()]);
    atualizarEstadoTela();
  }

  function preencherUsuario() {
    const possiveis = [
      safeJson(localStorage.getItem("ERPIMPAR_USER")),
      safeJson(sessionStorage.getItem("ERPIMPAR_USER")),
      safeJson(localStorage.getItem("usuarioLogado")),
      safeJson(localStorage.getItem("impar_user")),
      safeJson(sessionStorage.getItem("usuarioLogado")),
    ].filter(Boolean);

    const user = possiveis.find(Boolean) || {};
    const nome = user.nome || user.name || user.usuario || user.email || "Usuário do sistema";
    els.usuarioLogadoLabel.textContent = nome;
  }

  function registrarEventos() {
    els.obraSelect.addEventListener("change", atualizarEstadoTela);
    els.tipoObraInputs.forEach((input) => input.addEventListener("change", atualizarEstadoTela));

    els.dropPanel.addEventListener("dragover", (e) => {
      if (!canDrop()) return;
      e.preventDefault();
      els.dropPanel.classList.add("active-drop");
    });

    els.dropPanel.addEventListener("dragleave", () => {
      els.dropPanel.classList.remove("active-drop");
    });

    els.dropPanel.addEventListener("drop", (e) => {
      e.preventDefault();
      els.dropPanel.classList.remove("active-drop");
      if (!canDrop()) return avisar("Selecione a obra e o tipo da obra antes de montar a equipe.");

      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const pessoa = JSON.parse(raw);
      adicionarSelecionado(pessoa);
    });

    els.btnFinalizar.addEventListener("click", abrirModalAcao);
    els.btnCancelarModal.addEventListener("click", () => toggleModal(els.acaoModal, false));
    els.btnFecharSucesso.addEventListener("click", () => toggleModal(els.sucessoModal, false));

    els.btnGerarPdf.addEventListener("click", () => salvarEquipe("pdf"));
    els.btnCompartilhar.addEventListener("click", () => salvarEquipe("compartilhar"));

    els.btnNovoDocumento.addEventListener("click", () => {
      window.open(DOCS_URL, "_blank");
    });

    els.btnAtualizarObras.addEventListener("click", carregarObras);
    els.btnRecarregarHistorico.addEventListener("click", carregarHistorico);
  }

  function carregarEquipesBase() {
    state.equipesBase.impar = [
      { id: "imp-001", nome: "Cristiano", empresa: "impar" },
      { id: "imp-002", nome: "Fábio", empresa: "impar" },
      { id: "imp-003", nome: "Silvio", empresa: "impar" },
      { id: "imp-004", nome: "Henrique", empresa: "impar" },
      { id: "imp-005", nome: "Ibrais", empresa: "impar" },
      { id: "imp-006", nome: "Renan Ribeiro", empresa: "impar" },
      { id: "imp-007", nome: "Neri", empresa: "impar" },
      { id: "imp-008", nome: "Selo", empresa: "impar" },
      { id: "imp-009", nome: "Nicolas Vaz", empresa: "impar" },
    ];

    state.equipesBase.thermo = [
      { id: "th-001", nome: "Cristiano", empresa: "thermo" },
      { id: "th-002", nome: "Fábio", empresa: "thermo" },
      { id: "th-003", nome: "Silvio", empresa: "thermo" },
      { id: "th-004", nome: "Henrique", empresa: "thermo" },
      { id: "th-005", nome: "Ibrais", empresa: "thermo" },
      { id: "th-006", nome: "Renan Ribeiro", empresa: "thermo" },
      { id: "th-007", nome: "Neri", empresa: "thermo" },
      { id: "th-008", nome: "Selo", empresa: "thermo" },
      { id: "th-009", nome: "Nicolas Vaz", empresa: "thermo" },
    ];
  }

  async function carregarObras() {
    try {
      setObraLoading("Carregando obras...");
      const res = await fetch(`${API_BASE}/listar_obras.php`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao buscar obras");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Erro ao listar obras");
      state.obras = Array.isArray(json.obras) ? json.obras : [];
      renderObras();
    } catch (err) {
      console.warn("[Equipe Mista] listar_obras falhou, usando fallback local.", err);
      state.obras = [
        { id: "obra-001", nome: "UBS Centro", tipo: "impar" },
        { id: "obra-002", nome: "Hospital Thermo Sul", tipo: "thermo" },
        { id: "obra-003", nome: "Ampliação Matriz", tipo: "impar" },
      ];
      renderObras();
      avisar("API de obras indisponível. A tela entrou em modo de teste com lista local.");
    }
  }

  function renderObras() {
    const atual = els.obraSelect.value;
    els.obraSelect.innerHTML = `
      <option value="">Selecione uma obra</option>
      ${state.obras.map((obra) => `<option value="${escapeAttr(obra.id)}">${escapeHtml(obra.nome)}</option>`).join("")}
    `;
    if (atual && state.obras.some((o) => o.id === atual)) {
      els.obraSelect.value = atual;
    }
    sincronizarTipoObraComSelecao();
    atualizarEstadoTela();
  }

  function setObraLoading(text) {
    els.obraSelect.innerHTML = `<option value="">${escapeHtml(text)}</option>`;
  }

  function sincronizarTipoObraComSelecao() {
    const obra = getObraSelecionada();
    if (!obra || !obra.tipo) return;
    const input = els.tipoObraInputs.find((i) => i.value === String(obra.tipo).toLowerCase());
    if (input) input.checked = true;
  }

  function renderListasOrigem() {
    renderListaOrigem("impar", els.listaImpar);
    renderListaOrigem("thermo", els.listaThermo);
    els.counterListaImpar.textContent = String(state.equipesBase.impar.length);
    els.counterListaThermo.textContent = String(state.equipesBase.thermo.length);
  }

  function renderListaOrigem(tipo, container) {
    container.innerHTML = "";
    state.equipesBase[tipo].forEach((pessoa) => {
      const card = document.createElement("article");
      card.className = "person-card";
      card.draggable = true;
      card.innerHTML = `
        <strong>${escapeHtml(pessoa.nome)}</strong>
        <span>${tipo === "impar" ? "Equipe Ímpar" : "Equipe Thermo"}</span>
      `;

      card.addEventListener("dragstart", (e) => {
        if (!canDrop()) {
          e.preventDefault();
          avisar("Selecione a obra e o tipo antes de arrastar colaboradores.");
          return;
        }
        card.classList.add("dragging");
        e.dataTransfer.setData("application/json", JSON.stringify(pessoa));
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      container.appendChild(card);
    });
  }

  function adicionarSelecionado(pessoa) {
    const jaExiste = state.selecionados.some((item) => item.id === pessoa.id);
    if (jaExiste) return avisar("Esse colaborador já foi adicionado à equipe.");

    state.selecionados.push({ ...pessoa });
    renderSelecionados();
    atualizarEstadoTela();
  }

  function removerSelecionado(id) {
    state.selecionados = state.selecionados.filter((item) => item.id !== id);
    renderSelecionados();
    atualizarEstadoTela();
  }

  function renderSelecionados() {
    els.listaSelecionados.innerHTML = "";

    if (!state.selecionados.length) {
      els.dropEmpty.classList.remove("hidden");
      return;
    }

    els.dropEmpty.classList.add("hidden");

    state.selecionados.forEach((item) => {
      const card = document.createElement("article");
      card.className = "selected-card";
      card.innerHTML = `
        <div class="selected-meta">
          <strong>${escapeHtml(item.nome)}</strong>
          <span>${item.empresa === "impar" ? "Equipe Ímpar" : "Equipe Thermo"}</span>
        </div>
        <div class="selected-actions">
          <span class="badge-origin">${item.empresa === "impar" ? "ÍMPAR" : "THERMO"}</span>
          <button class="remove-btn" type="button" title="Remover">×</button>
        </div>
      `;
      card.querySelector(".remove-btn").addEventListener("click", () => removerSelecionado(item.id));
      els.listaSelecionados.appendChild(card);
    });
  }

  function atualizarEstadoTela() {
    const liberado = canDrop();
    els.dropPanel.classList.toggle("locked", !liberado);

    if (liberado) {
      els.statusStrip.textContent = "Obra e tipo definidos. Agora você pode arrastar os colaboradores para montar a equipe.";
      els.statusStrip.classList.add("ready");
    } else {
      els.statusStrip.textContent = "Selecione a obra e o tipo para liberar o arraste dos colaboradores.";
      els.statusStrip.classList.remove("ready");
    }

    const total = state.selecionados.length;
    const totalImpar = state.selecionados.filter((p) => p.empresa === "impar").length;
    const totalThermo = state.selecionados.filter((p) => p.empresa === "thermo").length;

    els.totalEquipeBadge.textContent = String(total);
    els.totalImparBadge.textContent = String(totalImpar);
    els.totalThermoBadge.textContent = String(totalThermo);

    els.btnFinalizar.disabled = !liberado || total === 0;
  }

  function canDrop() {
    return Boolean(els.obraSelect.value && getTipoObraSelecionado());
  }

  function getTipoObraSelecionado() {
    return els.tipoObraInputs.find((i) => i.checked)?.value || "";
  }

  function getObraSelecionada() {
    return state.obras.find((o) => o.id === els.obraSelect.value) || null;
  }

  function abrirModalAcao() {
    if (!canDrop()) return avisar("Selecione a obra e o tipo da obra.");
    if (!state.selecionados.length) return avisar("Adicione pelo menos um colaborador à equipe.");

    state.pendingPayload = montarPayloadBase();
    toggleModal(els.acaoModal, true);
  }

  async function salvarEquipe(acao) {
    if (!state.pendingPayload) state.pendingPayload = montarPayloadBase();
    const payload = { ...state.pendingPayload, acaoExecutada: acao };

    try {
      const res = await fetch(`${API_BASE}/salvar_equipe.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Falha HTTP ao salvar equipe");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Erro ao salvar equipe");

      finalizarFluxoSucesso(payload, json.registro || null);
    } catch (err) {
      console.warn("[Equipe Mista] salvar_equipe falhou, salvando em localStorage.", err);
      salvarEquipeLocal(payload);
      finalizarFluxoSucesso(payload, null);
      avisar("API indisponível. O registro foi salvo localmente para teste.");
    }
  }

  function finalizarFluxoSucesso(payload, registroServidor) {
    toggleModal(els.acaoModal, false);

    if (payload.acaoExecutada === "pdf") {
      gerarPdfFake(payload);
    } else if (payload.acaoExecutada === "compartilhar") {
      compartilharEquipe(payload);
    }

    limparFormulario();
    carregarHistorico();
    toggleModal(els.sucessoModal, true);
    state.pendingPayload = null;
  }

  function montarPayloadBase() {
    const obra = getObraSelecionada();
    const tipoObra = getTipoObraSelecionado();
    const usuario = els.usuarioLogadoLabel.textContent.trim() || "Usuário do sistema";
    const totalImpar = state.selecionados.filter((p) => p.empresa === "impar").length;
    const totalThermo = state.selecionados.filter((p) => p.empresa === "thermo").length;

    return {
      id: `EQM-${Date.now()}`,
      criadoEm: new Date().toISOString(),
      usuario,
      obraId: obra?.id || "",
      obraNome: obra?.nome || "",
      tipoObra,
      viagem: !!els.obraViagem.checked,
      membros: state.selecionados.map((item) => ({
        id: item.id,
        nome: item.nome,
        empresa: item.empresa,
      })),
      totais: {
        impar: totalImpar,
        thermo: totalThermo,
        geral: state.selecionados.length,
      },
    };
  }

  function limparFormulario() {
    els.obraSelect.value = "";
    els.tipoObraInputs.forEach((i) => (i.checked = false));
    els.obraViagem.checked = false;
    state.selecionados = [];
    renderSelecionados();
    atualizarEstadoTela();
  }

  async function carregarHistorico() {
    try {
      const res = await fetch(`${API_BASE}/listar_equipes.php`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao listar histórico");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Erro ao listar equipes");
      state.historico = Array.isArray(json.registros) ? json.registros : [];
    } catch (err) {
      console.warn("[Equipe Mista] listar_equipes falhou, usando localStorage.", err);
      state.historico = carregarEquipeLocal();
    }
    renderHistorico();
  }

  function renderHistorico() {
    const lista = [...state.historico].sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

    if (!lista.length) {
      els.historicoEquipes.innerHTML = `<div class="history-empty">Nenhuma equipe registrada ainda.</div>`;
      return;
    }

    els.historicoEquipes.innerHTML = lista.map((item) => {
      const membros = Array.isArray(item.membros) ? item.membros : [];
      const badges = [
        `Tipo: ${String(item.tipoObra || "-").toUpperCase()}`,
        `Ação: ${String(item.acaoExecutada || "salvo").toUpperCase()}`,
        `Ímpar: ${item.totais?.impar ?? membros.filter((m) => m.empresa === "impar").length}`,
        `Thermo: ${item.totais?.thermo ?? membros.filter((m) => m.empresa === "thermo").length}`,
        item.viagem ? "Viagem" : "Sem viagem",
      ];

      return `
        <article class="history-item">
          <div class="history-top">
            <div>
              <h4>${escapeHtml(item.obraNome || "Obra sem nome")}</h4>
              <p>${formatDateTime(item.criadoEm)} • por ${escapeHtml(item.usuario || "Usuário do sistema")}</p>
            </div>
            <div class="history-badge">${escapeHtml(item.id || "sem-id")}</div>
          </div>
          <div class="history-badges">
            ${badges.map((b) => `<span class="history-badge">${escapeHtml(b)}</span>`).join("")}
          </div>
          <div class="history-members">
            ${membros.map((m) => `<span class="member-pill">${escapeHtml(m.nome)} • ${m.empresa === "impar" ? "Ímpar" : "Thermo"}</span>`).join("")}
          </div>
        </article>
      `;
    }).join("");
  }

  function salvarEquipeLocal(payload) {
    const lista = carregarEquipeLocal();
    lista.push(payload);
    localStorage.setItem(LS_EQUIPES, JSON.stringify(lista));
  }

  function carregarEquipeLocal() {
    return safeJson(localStorage.getItem(LS_EQUIPES)) || [];
  }

  function toggleModal(el, open) {
    el.classList.toggle("hidden", !open);
  }

  function gerarPdfFake(payload) {
    const conteudo = `
      <html><head><title>Equipe Mista - ${escapeHtml(payload.obraNome)}</title></head>
      <body style="font-family:Arial;padding:30px;">
        <h1>Equipe Mista</h1>
        <p><strong>Obra:</strong> ${escapeHtml(payload.obraNome)}</p>
        <p><strong>Tipo:</strong> ${escapeHtml(payload.tipoObra.toUpperCase())}</p>
        <p><strong>Usuário:</strong> ${escapeHtml(payload.usuario)}</p>
        <p><strong>Data:</strong> ${escapeHtml(formatDateTime(payload.criadoEm))}</p>
        <h3>Colaboradores</h3>
        <ul>${payload.membros.map((m) => `<li>${escapeHtml(m.nome)} - ${m.empresa === "impar" ? "Ímpar" : "Thermo"}</li>`).join("")}</ul>
        <script>window.onload = () => window.print();</script>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(conteudo);
      w.document.close();
    }
  }

  async function compartilharEquipe(payload) {
    const texto = [
      `Equipe mista registrada`,
      `Obra: ${payload.obraNome}`,
      `Tipo da obra: ${payload.tipoObra.toUpperCase()}`,
      `Colaboradores: ${payload.membros.map((m) => `${m.nome} (${m.empresa === "impar" ? "Ímpar" : "Thermo"})`).join(", ")}`,
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "Equipe Mista", text: texto });
        return;
      } catch (_) {}
    }

    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  }

  function avisar(msg) {
    els.statusStrip.textContent = msg;
    els.statusStrip.classList.remove("ready");
  }

  function safeJson(value) {
    try { return JSON.parse(value); } catch { return null; }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function formatDateTime(iso) {
    if (!iso) return "-";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }
})();
