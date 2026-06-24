const API = 'https://api.erpimpar.com.br/rh/combustivel/';
let COLABS = [];
let BASE = null;
let RESUMO = null;
let charts = {};

const $ = (id) => document.getElementById(id);
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2 });
const intFmt = (v) => Number(v || 0).toLocaleString('pt-BR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const dateBR = (iso) => { if(!iso) return '-'; const [y,m,d]=String(iso).split('-'); return d&&m&&y ? `${d}/${m}/${y}` : iso; };

function toast(msg, type='ok'){
  const el = document.createElement('div');
  el.className = `toast ${type==='error'?'error':''}`;
  el.textContent = msg;
  $('toastWrap').appendChild(el);
  setTimeout(()=>el.remove(), 4200);
}

function setServer(data){
  if (typeof data === 'string') $('serverBox').textContent = data;
  else if (data?.ok && data?.mensagem) {
    $('serverBox').textContent = `${data.mensagem}\n${intFmt(data.total_registros)} registros importados\nTotal: ${brl(data.total_valor)}`;
  } else $('serverBox').textContent = JSON.stringify(data, null, 2);
}

async function getJson(url){
  const r = await fetch(url, {cache:'no-store'});
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(t || 'Resposta inválida do servidor'); }
}
async function postJson(url, data){
  const r = await fetch(url, { method:'POST', body: JSON.stringify(data) });
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(t || 'Resposta inválida do servidor'); }
}

function loadUser(){
  const keys = ['ERPIMPAR_USER','usuarioLogado','impar_user','ERP_IMPAR_USER'];
  let u = null;
  for (const k of keys){
    const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
    if(raw){ try{ u = JSON.parse(raw); } catch { u = {nome: raw}; } break; }
  }
  const nome = u?.nome || u?.Nome || 'Usuário RP';
  const email = u?.email || u?.Email || 'sessão local';
  $('userName').textContent = nome;
  $('userEmail').textContent = email;
  $('avatar').textContent = nome.trim().charAt(0).toUpperCase() || 'U';
}

function updateResumoImport(){
  const selecionados = COLABS.filter(c => !!c.obra).length;
  const total = COLABS.filter(c => !!c.obra).reduce((s,c)=>s + Number(c.valor_total||0), 0);
  const registros = COLABS.reduce((s,c)=>s + Number(c.registros||0), 0);
  $('mSelecionados').textContent = intFmt(selecionados);
  $('mRegistros').textContent = intFmt(registros);
  $('mTotal').textContent = brl(total);
  $('badgeColabs').textContent = `${intFmt(COLABS.length)} colaboradores`;
}

function renderColabs(){
  const q = $('buscaColab').value.trim().toUpperCase();
  const list = COLABS.filter(c => !q || String(c.nome_origem).toUpperCase().includes(q) || String(c.normalizado).toUpperCase().includes(q));
  if(!list.length){ $('colabList').innerHTML = '<div class="empty">Nenhum colaborador encontrado.</div>'; return; }
  $('colabList').innerHTML = list.map((c) => {
    const idx = COLABS.findIndex(x => x.key === c.key);
    return `<div class="colab-item ${c.obra ? 'on':'off'}">
      <input type="checkbox" ${c.obra?'checked':''} onchange="toggleColab(${idx}, this.checked)">
      <div><div class="colab-name">${esc(c.nome_origem)}</div><div class="colab-meta">${esc((c.fontes||[]).join(' + '))} • ${intFmt(c.registros)} registros</div></div>
      <input class="normaliza" value="${esc(c.normalizado)}" onchange="normalizaColab(${idx}, this.value)">
      <div class="money">${brl(c.valor_total)}</div>
      <div class="status-label">${c.obra ? 'Obras':'Ignorar'}</div>
    </div>`;
  }).join('');
  updateResumoImport();
}
window.toggleColab = (idx, checked) => { COLABS[idx].obra = checked; renderColabs(); };
window.normalizaColab = (idx, value) => { COLABS[idx].normalizado = value; };

async function carregarColaboradores(){
  setServer('Lendo planilhas no servidor...');
  const j = await getJson(API + 'listar_colaboradores.php');
  if(!j.ok) throw new Error(j.erro || 'Erro ao carregar colaboradores');
  COLABS = j.colaboradores || [];
  renderColabs();
  setServer(`Colaboradores carregados\n${intFmt(j.total_colaboradores || COLABS.length)} colaboradores\n${intFmt(j.total_registros)} registros lidos`);
  toast('Colaboradores carregados com sucesso.');
}

async function salvarSelecao(){
  const j = await postJson(API + 'salvar_config.php', { colaboradores: COLABS });
  if(!j.ok) throw new Error(j.erro || 'Erro ao salvar seleção');
  setServer(`Seleção salva\n${intFmt(j.total)} colaboradores gravados\nArquivo: ${j.arquivo}`);
  toast('Seleção salva no KingHost.');
}

async function gerarBase(){
  setServer('Gerando base final...');
  const j = await getJson(API + 'gerar_combustivel.php');
  if(!j.ok) throw new Error(j.erro || 'Erro ao gerar base');
  setServer(j);
  toast('Base de combustível gerada.');
  await carregarDashboard();
}

function destroyChart(id){ if(charts[id]){ charts[id].destroy(); charts[id]=null; } }
function chartOptions(){ return {responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#dbeafe'}}}, scales:{x:{ticks:{color:'#cbd5e1'}, grid:{color:'rgba(255,255,255,.06)'}}, y:{ticks:{color:'#cbd5e1'}, grid:{color:'rgba(255,255,255,.06)'}}}}; }

async function carregarDashboard(){
  RESUMO = await getJson(API + 'data/combustivel_resumo.json?t=' + Date.now());
  BASE = await getJson(API + 'data/combustivel.json?t=' + Date.now());
  if(!RESUMO.ok || !BASE.ok) throw new Error('JSON de combustível ainda não foi gerado.');
  renderDashboard();
  renderTabela();
}

function renderDashboard(){
  const porCol = RESUMO.por_colaborador || [];
  const porFonte = RESUMO.por_fonte || [];
  const porMes = RESUMO.por_mes || [];
  const lider = porCol[0];
  const fonte = porFonte[0];
  $('kTotal').textContent = brl(RESUMO.total_valor);
  $('kRegistros').textContent = intFmt(RESUMO.total_registros);
  $('kLider').textContent = lider ? lider.colaborador : '-';
  $('kLiderSub').textContent = lider ? brl(lider.valor) : '-';
  $('kFonte').textContent = fonte ? fonte.fonte : '-';
  $('kFonteSub').textContent = fonte ? brl(fonte.valor) : '-';

  $('insights').innerHTML = lider ? `
    <p><b>${esc(lider.colaborador)}</b> concentra ${brl(lider.valor)} no período importado.</p>
    <p>O total consolidado é <b>${brl(RESUMO.total_valor)}</b>, distribuído em <b>${intFmt(RESUMO.total_registros)}</b> abastecimentos.</p>
    <p>A fonte líder é <b>${esc(fonte?.fonte || '-')}</b>, com ${brl(fonte?.valor || 0)}.</p>` : 'Sem dados disponíveis.';

  destroyChart('chartMes');
  charts.chartMes = new Chart($('chartMes'), {type:'line', data:{labels:porMes.map(x=>x.mes), datasets:[{label:'Valor por mês', data:porMes.map(x=>x.valor), borderColor:'#9be329', backgroundColor:'rgba(155,227,41,.18)', fill:true, tension:.3, borderWidth:3}]}, options:chartOptions()});
  destroyChart('chartColaborador');
  charts.chartColaborador = new Chart($('chartColaborador'), {type:'bar', data:{labels:porCol.slice(0,10).map(x=>x.colaborador), datasets:[{label:'Valor', data:porCol.slice(0,10).map(x=>x.valor), backgroundColor:'#22c55e', borderRadius:10}]}, options:{...chartOptions(), indexAxis:'y'}});
  destroyChart('chartFonte');
  charts.chartFonte = new Chart($('chartFonte'), {type:'doughnut', data:{labels:porFonte.map(x=>x.fonte), datasets:[{data:porFonte.map(x=>x.valor), backgroundColor:['#22c55e','#60a5fa','#9be329','#f59e0b'], borderColor:'#041422'}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#dbeafe'}}}, cutout:'58%'}});
  fillFilters();
}

function fillFilters(){
  const regs = BASE?.registros || [];
  const colabs = [...new Set(regs.map(r=>r.colaborador).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const fontes = [...new Set(regs.map(r=>r.fonte).filter(Boolean))].sort();
  $('fColaborador').innerHTML = '<option value="">Todos colaboradores</option>' + colabs.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('fFonte').innerHTML = '<option value="">Todas fontes</option>' + fontes.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
}

function filteredRows(){
  const regs = BASE?.registros || [];
  const c = $('fColaborador').value;
  const f = $('fFonte').value;
  const q = $('fBusca').value.trim().toUpperCase();
  return regs.filter(r => {
    if(c && r.colaborador !== c) return false;
    if(f && r.fonte !== f) return false;
    if(q){
      const hay = `${r.placa} ${r.carro} ${r.arquivo} ${r.colaborador} ${r.fonte}`.toUpperCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}
function renderTabela(){
  const rows = filteredRows();
  $('tblBody').innerHTML = rows.map(r=>`<tr><td>${dateBR(r.data)}</td><td>${esc(r.colaborador)}</td><td>${esc(r.carro)}</td><td>${esc(r.placa)}</td><td>${esc(r.fonte)}</td><td class="valor">${brl(r.valor)}</td><td>${esc(r.arquivo)}</td></tr>`).join('') || '<tr><td colspan="7">Nenhum registro encontrado.</td></tr>';
}

function exportCsv(){
  const rows = filteredRows();
  const header = ['Data','Colaborador','Carro','Placa','Fonte','Valor','Arquivo'];
  const lines = [header.join(';')].concat(rows.map(r=>[dateBR(r.data), r.colaborador, r.carro, r.placa, r.fonte, String(r.valor).replace('.',','), r.arquivo].map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')));
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'combustivel_detalhado.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function initTabs(){
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b===btn));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active', p.id===btn.dataset.tab));
  }));
}
function bind(){
  $('btnStatus').onclick = async()=>{ try{ const j=await getJson(API+'status.php'); setServer(j); toast('Status consultado.'); }catch(e){ setServer(e.message); toast(e.message,'error'); }};
  $('btnLoad').onclick = ()=>carregarColaboradores().catch(e=>{setServer(e.message); toast(e.message,'error')});
  $('btnSave').onclick = ()=>salvarSelecao().catch(e=>{setServer(e.message); toast(e.message,'error')});
  $('btnGenerate').onclick = ()=>gerarBase().catch(e=>{setServer(e.message); toast(e.message,'error')});
  $('buscaColab').oninput = renderColabs;
  $('fColaborador').onchange = renderTabela; $('fFonte').onchange = renderTabela; $('fBusca').oninput = renderTabela;
  $('btnExportCsv').onclick = exportCsv;
}

loadUser(); initTabs(); bind();
carregarDashboard().catch(()=>{});
