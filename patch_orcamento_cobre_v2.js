/*
  patch_orcamento_cobre.js
  ERP ÍMPAR - Patch do autocomplete para cobre KG -> METRO.
  Como instalar:
  1) Subir conversao_cobre.json e conversao_cobre.php em /materiais/data/
  2) Colar este script no HTML do orçamento depois das funções originais,
     ou incluir antes de </body>:
     <script src="patch_orcamento_cobre.js"></script>
*/

(function(){
  const URL_CONVERSAO = 'https://api.erpimpar.com.br/materiais/data/conversao_cobre.json';
  let tabelaCobre = null;

  function norm(s){
    try {
      return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[º°]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
    } catch(e){ return (s||'').toString().toLowerCase(); }
  }

  function money(n){
    n = Number(n)||0;
    return n.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
  }

  function isCopperKg(m){
    const txt = norm([m.material, m.grupo, m.unidade].join(' '));
    return txt.includes('cobre') && (txt.includes('kilograma') || txt.includes('quilograma') || norm(m.unidade).includes('kg'));
  }

  function diamVariantes(d){
    d = String(d||'').replace(/"/g,'').trim();
    const out = new Set([d, d.replace(/\./g,' '), d.replace(/\./g,''), d.replace(/\./g,'/')]);
    const m = d.match(/^1\.(\d)\/(\d)$/);
    if(m){ out.add(`1 ${m[1]}/${m[2]}`); out.add(`1.${m[1]}/${m[2]}`); out.add(`1${m[1]}/${m[2]}`); }
    return Array.from(out).map(norm);
  }

  function findConversao(m, tipo){
    if(!tabelaCobre || !Array.isArray(tabelaCobre.itens)) return null;
    const desc = norm([m.material, m.grupo].join(' '));
    return tabelaCobre.itens.find(it => String(it.tipo_obra||'').toUpperCase() === tipo &&
      diamVariantes(it.diametro).some(v => v && desc.includes(v))
    ) || null;
  }

  function converterItem(m, tipo){
    const conv = findConversao(m, tipo);
    if(!conv) return null;

    const valorKg = Number(m.valor_unitario || m.valor || 0);
    const fator = Number(conv.fator_conversao_kg_por_metro || 0);
    const margem = Number(conv.fator_margem || 0);
    if(!valorKg || !fator) return null;

    const valorMetro = (valorKg / fator) * (1 + margem);
    const unidade = `${tipo} - METRO`;

    return Object.assign({}, m, {
      material: String(m.material||'').replace(/KILOGRAMA/gi, 'METRO'),
      unidade: unidade,
      valor_unitario: Number(valorMetro.toFixed(2)),
      _deparaCobre: true,
      _tipoDepara: tipo,
      _unidadeOriginal: m.unidade || 'KILOGRAMA',
      _valorOriginalKg: valorKg,
      _fatorConversao: fator,
      _fatorMargem: margem,
      _diametro: conv.diametro,
      _avisoDepara: `DE/PARA ${tipo}: KILOGRAMA convertido para METRO • fator ${String(fator).replace('.', ',')} • margem ${(margem*100).toFixed(0)}%`
    });
  }

  function expandirListaComDeparas(lista){
    const out = [];
    (lista || []).forEach(m => {
      out.push(m);
      if(isCopperKg(m)){
        const vrf = converterItem(m, 'VRF');
        const split = converterItem(m, 'SPLIT');
        if(vrf) out.push(vrf);
        if(split) out.push(split);
      }
    });
    return out;
  }

  function optionHtml(m, ix, i){
    const st = (typeof statusPreco === 'function') ? statusPreco(m) : {cls:'', txt:''};
    const css = m._deparaCobre ? (m._tipoDepara === 'VRF' ? ' cobre-depara cobre-vrf' : ' cobre-depara cobre-split') : '';
    const label = m._deparaCobre ? `<span class="depara-label">${m._tipoDepara} • DE/PARA</span>` : '';
    return `<div class="material-option${css}" onmousedown="selecionarMaterial(${i},${ix})">
      <b>${esc(m.material||'')}</b>
      <small>${label}${esc(m.grupo||'')} • ${esc(m.unidade||'')} • cód. ${esc(m.codigo||'')} • <span class="preco">${money(m.valor_unitario||0)}</span></small>
      ${m._deparaCobre ? `<em class="depara-info">${esc(m._avisoDepara||'')}</em>` : `<span class="price-badge ${st.cls}">${st.txt}</span>`}
    </div>`;
  }

  const css = document.createElement('style');
  css.textContent = `
    .material-option.cobre-depara{border-left:5px solid #19d3c5; position:relative;}
    .material-option.cobre-vrf{background:linear-gradient(90deg,rgba(0,210,190,.16),rgba(0,80,130,.10));}
    .material-option.cobre-split{background:linear-gradient(90deg,rgba(255,190,40,.18),rgba(160,90,0,.08));}
    .material-option .depara-label{display:inline-block;margin-right:7px;padding:2px 7px;border-radius:999px;font-weight:800;font-size:10px;letter-spacing:.4px;background:#072033;color:#8ff7ed;border:1px solid rgba(143,247,237,.45);}
    .material-option.cobre-split .depara-label{background:#2d2100;color:#ffd36a;border-color:rgba(255,211,106,.55);}
    .material-option .depara-info{display:block;margin-top:4px;font-size:10px;font-style:normal;color:#d8f7ff;opacity:.95;}
    .material-option.cobre-split .depara-info{color:#fff1c5;}
    .cobre-row-badge{display:inline-block;margin-top:6px;padding:4px 8px;border-radius:999px;background:#073847;color:#8ff7ed;border:1px solid rgba(143,247,237,.45);font-size:10px;font-weight:800;}
    #btnTabelaConversaoCobre{margin-left:8px;border:1px solid rgba(143,247,237,.35);background:#073847;color:#dff;padding:8px 12px;border-radius:12px;font-weight:800;cursor:pointer;}
    #modalConversaoCobre{position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:99999;display:none;align-items:center;justify-content:center;padding:22px;}
    #modalConversaoCobre.open{display:flex;}
    #modalConversaoCobre .box{max-width:900px;width:100%;max-height:82vh;overflow:auto;background:#06283a;color:#fff;border:1px solid rgba(143,247,237,.35);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.45);}
    #modalConversaoCobre header{position:sticky;top:0;background:#073847;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:14px;}
    #modalConversaoCobre h3{margin:0;font-size:18px;}
    #modalConversaoCobre button{border:0;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;}
    #modalConversaoCobre table{width:100%;border-collapse:collapse;font-size:12px;}
    #modalConversaoCobre th,#modalConversaoCobre td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.10);text-align:left;}
    #modalConversaoCobre th{background:rgba(255,255,255,.08);position:sticky;top:54px;}
  `;
  document.head.appendChild(css);

  async function carregarTabelaCobre(){
    if(tabelaCobre) return tabelaCobre;
    try{
      const r = await fetch(URL_CONVERSAO + '?v=' + Date.now(), {cache:'no-store'});
      tabelaCobre = await r.json();
    }catch(e){
      console.warn('Não foi possível carregar conversao_cobre.json', e);
      tabelaCobre = {itens:[]};
    }
    return tabelaCobre;
  }

  const buscarOriginal = window.buscarMateriais;
  const mostrarOriginal = window.mostrarSugestoes;
  const selecionarOriginal = window.selecionarMaterial;
  const badgeOriginal = window.badgeLinha;

  window.mostrarSugestoes = async function(i, valor){
    const box = document.getElementById('sugMat'+i); if(!box) return;
    await carregarTabelaCobre();
    const listaBase = (typeof buscarOriginal === 'function') ? buscarOriginal(valor) : [];
    const lista = expandirListaComDeparas(listaBase);
    if(!lista.length){ box.classList.remove('open'); box.innerHTML=''; return; }
    box.innerHTML = lista.map((m,ix)=>optionHtml(m,ix,i)).join('');
    box.__lista = lista;
    box.classList.add('open');
  };

  window.selecionarMaterial = function(i, ix){
    const box = document.getElementById('sugMat'+i);
    const m = box?.__lista?.[ix];
    if(!m || !rows[i]) return;

    rows[i].material = m.material || '';
    rows[i].unid = m.unidade || '';
    rows[i].unitMat = Number(m.valor_unitario)||0;
    rows[i].codigo = m.codigo || '';
    rows[i].grupoBase = m.grupo || '';
    rows[i].ncm = m.ncm || '';
    rows[i].dataUltimaCompra = m.data_ultima_compra || '';
    rows[i].deparaCobre = m._deparaCobre ? {
      tipo: m._tipoDepara,
      unidadeOriginal: m._unidadeOriginal,
      valorOriginalKg: m._valorOriginalKg,
      fatorConversao: m._fatorConversao,
      margem: m._fatorMargem,
      diametro: m._diametro,
      aviso: m._avisoDepara
    } : null;
    render();
  };

  window.badgeLinha = function(r){
    const base = (typeof badgeOriginal === 'function') ? badgeOriginal(r) : '';
    const dep = r && r.deparaCobre ? `<span class="cobre-row-badge" title="${esc(r.deparaCobre.aviso||'')}">DE/PARA ${esc(r.deparaCobre.tipo||'')}</span>` : '';
    return base + dep;
  };

  function abrirModalTabela(){
    carregarTabelaCobre().then(tab => {
      let html = `<div id="modalConversaoCobre" class="open"><div class="box">
        <header><h3>Tabela de Conversão de Cobre</h3><button onclick="document.getElementById('modalConversaoCobre').remove()">Fechar</button></header>
        <table><thead><tr><th>Tipo</th><th>Diâmetro</th><th>Unid. Original</th><th>Unid. Convertida</th><th>Fator kg/m</th><th>Margem</th></tr></thead><tbody>`;
      (tab.itens||[]).forEach(it => {
        html += `<tr><td>${esc(it.tipo_obra||'')}</td><td>${esc(it.diametro||'')}</td><td>KILOGRAMA</td><td>${esc((it.tipo_obra||'')+' - METRO')}</td><td>${String(it.fator_conversao_kg_por_metro||'').replace('.',',')}</td><td>${((Number(it.fator_margem)||0)*100).toFixed(0)}%</td></tr>`;
      });
      html += `</tbody></table></div></div>`;
      document.body.insertAdjacentHTML('beforeend', html);
    });
  }

  function inserirBotaoTabela(){
    if(document.getElementById('btnTabelaConversaoCobre')) return;
    const btn = document.createElement('button');
    btn.id = 'btnTabelaConversaoCobre';
    btn.type = 'button';
    btn.textContent = 'Tabela Conversão Cobre';
    btn.onclick = abrirModalTabela;

    const alvo = document.querySelector('.topbar, .toolbar, header, .actions, .page-actions') || document.body;
    alvo.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', function(){
    carregarTabelaCobre();
    inserirBotaoTabela();
  });
  setTimeout(inserirBotaoTabela, 800);
})();
