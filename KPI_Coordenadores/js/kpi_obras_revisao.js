/* kpi_obras_revisao.js */
const LIST_OBRA = ["FALTA", "FÉRIAS", "EMPRESA", "THERMO", "ASTEL", "COOPERATIVA FUMACENSE DE ELETRICIDADE FINAL", "GARANTIA", "CASA GRANDE", "CASSOL", "CASSOL FRENTE DE CAIXA", "CORPORATE 8", "EDUARDA TONIETTO", "TEATRO ELIAS ANGELONI", "CLÍNICA RENAL IMBITUBA", "FIESC", "FORUM ARAQUARI", "FUSION", "GIASSI ARARANGUA", "GIASSI TUBARÃO", "HOSPITAL NOSSA SENHORA DE FÁTIMA", "HOSPITAL SANTA TEREZINHA", "HOSPITAL SÃO CAMILO", "HOSPITAL SÃO SEBASTIÃO", "KO0BO", "CORPORATE 8 - LOJAS", "KHRONOS", "IMPACT HUB", "SOS CARDIO ISOLAMENTO", "HOSPITAL SÃO JUDAS - MELEIRO", "RESIDENCIAL JOAO LOHN", "UBS ENCOSTA DO SOL - SÃO LUDGERO", "SOS ONCOLOGIA", "PATIO MILANO"];

function normalizarObra(texto) {
  return String(texto || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function inferirCoordenadorPorEmail(email) {
  const e = String(email || "").toLowerCase().trim();
  if (!e) return "";
  if (e.includes("cristiano")) return "CRISTIANO";
  if (e.includes("silvio")) return "SILVIO";
  if (e.includes("fabio")) return "FABIO";
  if (e.includes("nicolas")) return "NICOLAS";
  return "";
}
function getUsuarioLogadoERP() {
  return (
    localStorage.getItem('usuarioNome') ||
    localStorage.getItem('usuario') ||
    localStorage.getItem('nome') ||
    localStorage.getItem('user') ||
    sessionStorage.getItem('usuarioNome') ||
    sessionStorage.getItem('usuario') ||
    sessionStorage.getItem('nome') ||
    sessionStorage.getItem('user') ||
    'Sistema'
  );
}
function indexarListaObra(lista = LIST_OBRA) {
  const mapa = new Map();
  for (const nome of lista) mapa.set(normalizarObra(nome), nome);
  return mapa;
}
function indexarAliases(aliasList = []) {
  const mapa = new Map();
  for (const item of aliasList || []) {
    const canonica = String(item.canonica || "").trim();
    if (!canonica) continue;
    mapa.set(normalizarObra(canonica), canonica);
    for (const alias of item.aliases || []) mapa.set(normalizarObra(alias), canonica);
  }
  return mapa;
}
function indexarQPI(obrasQPI = []) {
  const mapa = new Map();
  for (const item of obrasQPI || []) {
    const obra = String(item.Obra || "").trim();
    if (!obra) continue;
    mapa.set(normalizarObra(obra), item);
  }
  return mapa;
}
function encontrarCanonicaPelaLista(nomeOrigem, listaMap, aliasMap) {
  const nomeNorm = normalizarObra(nomeOrigem);
  if (listaMap.has(nomeNorm)) return listaMap.get(nomeNorm);
  const canonicaAlias = aliasMap.get(nomeNorm);
  if (canonicaAlias) return canonicaAlias;
  return null;
}
function encontrarQPIporCanonica(canonica, qpiMap) {
  if (!canonica) return null;
  return qpiMap.get(normalizarObra(canonica)) || null;
}
function classificarMatchObra(nomeOrigem, listaMap, aliasMap, qpiMap) {
  const origem = String(nomeOrigem || "").trim();
  const origemNorm = normalizarObra(origem);
  if (!origemNorm) return { obra_origem: origem, obra_lista: null, obra_canonica: null, obra_qpi: null, centro_custo: "", email: "", coordenador: "", status_match: "VAZIO", confiavel: false };
  const exatoQPI = qpiMap.get(origemNorm);
  if (exatoQPI) return { obra_origem: origem, obra_lista: origem, obra_canonica: exatoQPI.Obra, obra_qpi: exatoQPI.Obra, centro_custo: exatoQPI["Centro de Custo"] || "", email: exatoQPI.Email || "", coordenador: inferirCoordenadorPorEmail(exatoQPI.Email || ""), status_match: "MATCH_EXATO_QPI", confiavel: true };
  const obraLista = encontrarCanonicaPelaLista(origem, listaMap, aliasMap);
  if (!obraLista) return { obra_origem: origem, obra_lista: null, obra_canonica: null, obra_qpi: null, centro_custo: "", email: "", coordenador: "", status_match: "PENDENTE_REVISAO", confiavel: false };
  const itemQPI = encontrarQPIporCanonica(obraLista, qpiMap);
  if (!itemQPI) return { obra_origem: origem, obra_lista: obraLista, obra_canonica: obraLista, obra_qpi: null, centro_custo: "", email: "", coordenador: "", status_match: "LISTA_SEM_QPI", confiavel: false };
  const tipo = normalizarObra(origem) === normalizarObra(obraLista) ? "MATCH_LISTA" : "MATCH_ALIAS_LISTA";
  return { obra_origem: origem, obra_lista: obraLista, obra_canonica: obraLista, obra_qpi: itemQPI.Obra || "", centro_custo: itemQPI["Centro de Custo"] || "", email: itemQPI.Email || "", coordenador: inferirCoordenadorPorEmail(itemQPI.Email || ""), status_match: tipo, confiavel: true };
}
function processarObrasTV(projetosTV = [], obrasQPI = [], aliasList = []) {
  const listaMap = indexarListaObra(LIST_OBRA);
  const aliasMap = indexarAliases(aliasList);
  const qpiMap = indexarQPI(obrasQPI);
  return (projetosTV || []).map((proj) => {
    const match = classificarMatchObra(proj.nome || "", listaMap, aliasMap, qpiMap);
    return { id_tv: proj.id || "", obra_tv: proj.nome || "", coordenador_tv: proj.coordenador || "", status_tv: proj.status || "", execucao_tv: proj.execucao || "", farol_tv: proj.farol || "", data_atualizacao_tv: proj.data_atualizacao || "", usuario_atualizacao_tv: proj.usuario_atualizacao || "", ...match };
  });
}
function podeEntrarNoKPI(item) {
  return ['MATCH_EXATO_QPI', 'MATCH_LISTA', 'MATCH_ALIAS_LISTA'].includes(item.status_match);
}
function penalizaNoKPI(item) {
  return item.status_match === 'REVISAO_VENCIDA';
}
function consolidarPorCoordenador(resultados = []) {
  const mapa = new Map();
  for (const item of resultados) {
    const coord = item.coordenador || item.coordenador_tv || 'SEM_COORDENADOR';
    if (!mapa.has(coord)) mapa.set(coord, { coordenador: coord, total: 0, validas_kpi: 0, pendentes: 0, nao_se_aplica: 0, penalizadas: 0 });
    const acc = mapa.get(coord);
    acc.total += 1;
    if (podeEntrarNoKPI(item)) acc.validas_kpi += 1;
    else if (item.status_match === 'NAO_SE_APLICA') acc.nao_se_aplica += 1;
    else if (item.status_match === 'REVISAO_VENCIDA') acc.penalizadas += 1;
    else acc.pendentes += 1;
  }
  return Array.from(mapa.values());
}
function criarBotaoAjuste(item, onOpen) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-ajustar-obra';
  btn.textContent = 'Ajustar obra';
  btn.addEventListener('click', () => onOpen(item));
  return btn;
}
function garantirEstilosModalKPI() {
  if (document.getElementById('kpi-revisao-estilos')) return;
  const style = document.createElement('style');
  style.id = 'kpi-revisao-estilos';
  style.textContent = `.btn-ajustar-obra{border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:#02140a;font-weight:900;border-radius:999px;padding:8px 14px;cursor:pointer;box-shadow:0 8px 24px rgba(22,163,74,.35)}.kpi-modal-bg{position:fixed;inset:0;background:rgba(2,6,23,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:999999}.kpi-modal-card{width:min(720px,92vw);background:rgba(2,6,23,.96);color:#e5e7eb;border:1px solid rgba(148,163,184,.26);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.55);padding:18px}.kpi-modal-grid{display:grid;grid-template-columns:1fr;gap:12px}.kpi-modal-card h3{margin:0 0 8px}.kpi-modal-card label{font-size:12px;font-weight:800;display:block;margin-bottom:6px}.kpi-modal-card input,.kpi-modal-card select,.kpi-modal-card textarea{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.25);background:#020617;color:#fff}.kpi-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}.kpi-btn{border:none;border-radius:999px;padding:10px 16px;font-weight:900;cursor:pointer}.kpi-btn.save{background:linear-gradient(135deg,#22c55e,#16a34a);color:#02140a}.kpi-btn.warn{background:linear-gradient(135deg,#facc15,#eab308);color:#221700}.kpi-btn.dark{background:#1f2937;color:#fff}.kpi-help{font-size:12px;opacity:.82}`;
  document.head.appendChild(style);
}
function abrirModalRevisaoKPI(item, onSave) {
  garantirEstilosModalKPI();
  const bg = document.createElement('div');
  bg.className = 'kpi-modal-bg';
  bg.innerHTML = `<div class="kpi-modal-card"><h3>Revisão de obra pendente</h3><div class="kpi-modal-grid"><div><label>Nome que chegou da TV/sistema</label><input type="text" id="kpi_obra_origem" value="${escapeHtmlAttr(item.obra_tv || item.obra_origem || '')}" readonly></div><div><label>Obra oficial</label><select id="kpi_obra_canonica"><option value="">Selecione a obra correta</option>${LIST_OBRA.map(nome => `<option value="${escapeHtmlAttr(nome)}">${escapeHtml(nome)}</option>`).join('')}</select></div><div><label>Ação</label><select id="kpi_acao"><option value="alias">Criar alias e reprocessar</option><option value="nao_se_aplica">Marcar como não se aplica</option></select></div><div><label>Observação</label><textarea id="kpi_obs" rows="3" placeholder="Motivo / contexto"></textarea></div><div class="kpi-help">Pendente revisão não penaliza imediatamente. Se ninguém tratar em 7 dias, vira revisão vencida e penaliza.</div></div><div class="kpi-actions"><button class="kpi-btn dark" type="button" id="kpi_cancelar">Cancelar</button><button class="kpi-btn warn" type="button" id="kpi_nao_se_aplica">Não se aplica</button><button class="kpi-btn save" type="button" id="kpi_salvar">Salvar</button></div></div>`;
  document.body.appendChild(bg);
  function close(){ bg.remove(); }
  bg.querySelector('#kpi_cancelar').onclick = close;
  bg.querySelector('#kpi_nao_se_aplica').onclick = async () => {
    await onSave({ acao:'nao_se_aplica', obra_origem:item.obra_tv || item.obra_origem || '', observacao:bg.querySelector('#kpi_obs').value || '', usuario:getUsuarioLogadoERP() });
    close();
  };
  bg.querySelector('#kpi_salvar').onclick = async () => {
    await onSave({ acao:bg.querySelector('#kpi_acao').value, obra_origem:item.obra_tv || item.obra_origem || '', obra_canonica:bg.querySelector('#kpi_obra_canonica').value, observacao:bg.querySelector('#kpi_obs').value || '', usuario:getUsuarioLogadoERP() });
    close();
  };
}
function escapeHtml(str){ return String(str || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function escapeHtmlAttr(str){ return escapeHtml(str); }
async function loadAliasState({ aliasApiList, aliasDataUrl, pendenciasUrl }) {
  try {
    const [aliasesResp, pendenciasResp] = await Promise.all([
      fetch(aliasApiList).then(r => r.json()).catch(()=>[]),
      fetch(pendenciasUrl).then(r => r.json()).catch(()=>[])
    ]);

    const aliases = Array.isArray(aliasesResp)
      ? aliasesResp
      : Array.isArray(aliasesResp?.data)
        ? aliasesResp.data
        : Array.isArray(aliasesResp?.aliases)
          ? aliasesResp.aliases
          : [];

    const pendencias = Array.isArray(pendenciasResp)
      ? pendenciasResp
      : Array.isArray(pendenciasResp?.data)
        ? pendenciasResp.data
        : Array.isArray(pendenciasResp?.pendencias)
          ? pendenciasResp.pendencias
          : [];

    return { aliases, pendencias };
  } catch (e) {
    console.warn('Erro ao carregar aliasState:', e);
    return { aliases: [], pendencias: [] };
  }
}
async function salvarRevisao({ aliasApiSave, alias, canonica, naoSeAplica, usuario }) {
  try {
    await fetch(aliasApiSave, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias,
        canonica,
        naoSeAplica,
        usuario
      })
    });
  } catch (e) {
    console.warn('Erro ao salvar revisão:', e);
  }
}
window.KPI_REVISAO = {
  loadAliasState,
  salvarRevisao,
  processarObrasTV,
  abrirModalRevisaoKPI,
  criarBotaoAjuste,
  podeEntrarNoKPI,
  penalizaNoKPI,
  consolidarPorCoordenador
};

window.LIST_OBRA = LIST_OBRA;
window.normalizarObra = normalizarObra;
