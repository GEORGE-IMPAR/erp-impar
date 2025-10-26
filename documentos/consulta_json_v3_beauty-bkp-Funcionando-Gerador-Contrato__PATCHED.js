/* ============================================================================
   consulta_json_v3_beauty_brand_fixclose_loader.js
   - UI moderna (lista + decidir)
   - Fecha modais antigos automaticamente
   - Loader preto “Processando...”
   - Botão “Gerar contrato” pré-carrega como “Atualizar” (injeta código, fillForm)
   - Exporta helpers em window.__CJFIX_API__
   ============================================================================ */

/* ---- Fechamento idempotente de qualquer UI da consulta ---- */
if (!window.__forceCloseConsultaUI) {
  window.__forceCloseConsultaUI = function () {
    try { if (typeof hideAll === 'function') hideAll(); } catch (e) {}
    ['cj_list_back','cj_decide_back','cj_loader_back','cj_side','cj_side_back','cj_confirm_back']
      .forEach(function (id) {
        var n = document.getElementById(id);
        if (n) n.style.display = 'none';
      });
    ['consultaModal','actionModal','dupeModal'].forEach(function (id) {
      var m = document.getElementById(id);
      if (m) { m.style.display = 'none'; m.style.visibility = 'hidden'; m.style.opacity = '0'; }
    });
  };
}

(function(){
  var BRAND = { primary:'#0A1A3A', primaryDark:'#08142E', accent:'#3B82F6' };
  var JSON_URL   = 'https://api.erpimpar.com.br/gerador/json_table_cors.php';
  var SAVE_TOKEN = '8ce29ab4b2d531b0eca93b9f3a8882e543cbad73663b77';

  function el(t,a,h){var e=document.createElement(t);if(a){for(var k in a){if(a.hasOwnProperty(k))e.setAttribute(k,a[k]);}}if(h!=null)e.innerHTML=h;return e;}
  function q(id){return document.getElementById(id);}

  /* ---- Esconde qualquer modal legado ---- */
  function hideLegacy(){
    ['cj_modal','cj_actions','consultaModal','consulta_modal','consulta_json_modal'].forEach(function(id){
      var n=q(id); if(n){ n.style.setProperty('display','none','important'); n.hidden=true; }
    });
    try{
      var nodes=document.querySelectorAll('div,section,aside');
      for(var i=0;i<nodes.length;i++){
        var n=nodes[i]; var txt=(n.textContent||'').trim();
        if(txt && txt.indexOf('Consulta de documentos (Excel)')!==-1){
          n.style.setProperty('display','none','important'); n.hidden=true;
        }
      }
    }catch(_){}
  }

  /* ---- CSS do componente ---- */
  function injectCSS(){
    if(q('cj_fix_css')) return;
    var css=[
      '@keyframes cjfade{from{opacity:0}to{opacity:1}}',
      '@keyframes cjscale{from{transform:translate(-50%,-46%) scale(.96);opacity:.03}to{transform:translate(-50%,-50%) scale(1);opacity:1}}',
      '@keyframes cjspin{to{transform:rotate(360deg)}}',
      '.cj-back{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:100000;background:rgba(2,6,23,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:cjfade .2s ease-out}',
      '.cj-box{position:relative;width:92%;max-width:980px;border-radius:20px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.9));border:1px solid rgba(226,232,240,.75);box-shadow:0 28px 80px rgba(2,6,23,.35)}',
      '.cj-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:linear-gradient(90deg,'+BRAND.primary+','+BRAND.primaryDark+');color:#fff}',
      '.cj-title{font-weight:900;letter-spacing:.3px}',
      '.cj-x{background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;padding:6px 10px;border-radius:12px}',
      '.cj-x:hover{background:rgba(255,255,255,.12)}',
      '.cj-body{padding:6px 0 10px;max-height:66vh;overflow:auto;background:linear-gradient(180deg,#f8fafc,#eef2f7)}',
      '.cj-row{display:grid;grid-template-columns:200px 170px 1fr;gap:12px;align-items:center;padding:12px 20px;border-bottom:1px solid #e2e8f0;cursor:pointer}',
      '.cj-code{font-weight:800;color:'+BRAND.primary+'}',
      '.cj-date{color:#475569;font-size:13px}',
      '.cj-client{color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cj-empty{padding:20px;color:#64748b}',

      '.cj-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.9));border:1px solid rgba(226,232,240,.75);border-radius:20px;box-shadow:0 28px 80px rgba(2,6,23,.35);width:92%;max-width:520px;overflow:hidden;animation:cjscale .2s ease-out}',
      '.cj-card-head{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,'+BRAND.primary+','+BRAND.primaryDark+');color:#fff;padding:16px 20px}',
      '.cj-chip{display:inline-block;background:'+BRAND.primaryDark+';color:#cbd5e1;border:1px solid #334155;padding:4px 12px;border-radius:999px;font-size:12px;margin-left:8px}',
      '.cj-card-body{padding:18px;color:#0f172a}',
      '.cj-actions{display:flex;gap:12px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #e2e8f0;background:linear-gradient(180deg,#f8fafc,#eef2f7)}',
      '.btn{border:none;border-radius:999px;padding:12px 16px;cursor:pointer;font-weight:800;letter-spacing:.2px}',
      '.btn.ghost{background:#e2e8f0;color:'+BRAND.primary+'}',
      '.btn.primary{background:linear-gradient(90deg,'+BRAND.primaryDark+','+BRAND.primary+');color:#fff}',

      /* Loader preto com borda e texto brancos */
      '.cj-loader-back{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:100001;background:rgba(0,0,0,.8)}',
      '.cj-loader-box{display:flex;flex-direction:column;align-items:center;gap:14px;background:#000;color:#fff;border:2px solid #fff;padding:26px 28px;border-radius:18px;box-shadow:0 22px 60px rgba(0,0,0,.6)}',
      '.cj-spinner{width:46px;height:46px;border-radius:50%;border:4px solid rgba(255,255,255,.25);border-top-color:#fff;animation:cjspin .9s linear infinite}',
      '.cj-loader-text{font-weight:800;letter-spacing:.2px;color:#fff}'
    ].join('');
    document.head.appendChild(el('style',{id:'cj_fix_css'},css));
  }

  /* ---- Constrói estrutura ---- */
  function build(){
    if(q('cj_list_back')) return;
    injectCSS();

    var b1=el('div',{id:'cj_list_back',class:'cj-back'});
    var box=el('div',{class:'cj-box'});
    box.innerHTML=
      '<div class="cj-head"><div class="cj-title">Consulta de documentos</div>'+
      '<button class="cj-x" id="cj_x1">×</button></div>'+
      '<div class="cj-body" id="cj_list_body"><div class="cj-empty">Carregando...</div></div>';
    b1.appendChild(box); document.body.appendChild(b1);

    var b2=el('div',{id:'cj_decide_back',class:'cj-back'});
    var card=el('div',{class:'cj-card'});
    card.innerHTML=
      '<div class="cj-card-head"><div class="cj-title">Documento <span id="cj_code_chip" class="cj-chip">—</span></div>'+
      '<button class="cj-x" id="cj_x2">×</button></div>'+
      '<div class="cj-card-body">O que você deseja fazer com este documento?</div>'+
      '<div class="cj-actions">'+
        '<button class="btn ghost" id="cj_btn_close">Fechar</button>'+
        '<button class="btn ghost" id="cj_btn_gerar">Gerar contrato</button>'+
        '<button class="btn primary" id="cj_btn_atualizar">Atualizar documento</button>'+
      '</div>';
    b2.appendChild(card); document.body.appendChild(b2);

    // Loader
    var lback=el('div',{id:'cj_loader_back',class:'cj-loader-back'});
    var lbox=el('div',{class:'cj-loader-box'});
    lbox.innerHTML='<div class="cj-spinner"></div><div class="cj-loader-text">Processando... aguarde...</div>';
    lback.appendChild(lbox);
    document.body.appendChild(lback);

    function _hideAll(){ b1.style.display='none'; b2.style.display='none'; hideLegacy(); }
    q('cj_x1').onclick=_hideAll; q('cj_x2').onclick=_hideAll; q('cj_btn_close').onclick=_hideAll;

    /* --- Atualizar documento --- */
    q('cj_btn_atualizar').onclick=function(){
      var code=(q('cj_code_chip').getAttribute('data-code')||'').trim();
      
	// DEBUG
  	window.__DBG__?.log('btn_atualizar CLICK', { codeFromChip: code });

      if(!code){ _hideAll(); return; }
      var inp=q('codigo'); if (inp) inp.value=code;
      fetchDoc(code).then(function(item){
        try { fillForm(item); } catch(_){}

	window.__DBG__?.log('btn_atualizar AFTER fillForm', { itemCodigo: item?.codigo, snap: window.__DBG__?.snap() });

        try { if (typeof goTo==='function') goTo(2); } catch(_){}
        _hideAll();
        window.scrollTo({top:0,behavior:'smooth'});
      }).catch(function(){ _hideAll(); });
    };

    /* --- Pré-carrega como “Atualizar” para garantir código e dados no form --- */
    function __preloadDocForContract(code){
      return (async function(){
        const codeUpper = (code || '').toUpperCase();

        // 1) injeta no input principal e dispara eventos
        const inp = q('codigo');
        if (inp) {
          inp.value = codeUpper;
          try { inp.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_) {}
          try { inp.dispatchEvent(new Event('change', { bubbles:true })); } catch(_) {}
        }

        // 2) espelhos
        try { document.querySelectorAll('[id^="codigoVal"]').forEach(el => el.textContent = codeUpper); } catch(_){}

        // 3) busca item e preenche, sem navegar
        let savedGoTo = window.goTo;
        window.goTo = function(){}; // no-op temporário
        let item = null;
        try {
          if (typeof fetchDoc === 'function') {
            item = await fetchDoc(codeUpper);
            try { if (typeof fillForm === 'function') fillForm(item); } catch(_){}
          }
	  
	  try { if (typeof fillForm === 'function') fillForm(item); } catch(_){}
          window.__DBG__?.log('__preload after fillForm', { itemCodigo: item?.codigo, nome: item?.nomeContratante });

          		
          await Promise.resolve();
          await new Promise(r => requestAnimationFrame(r));
          await new Promise(r => requestAnimationFrame(r));
        } finally {
          window.goTo = savedGoTo;
        }
        return item;
      })();
    }

    /* --- Gerar contrato (com pré-carregamento) --- */
    q('cj_btn_gerar').onclick = async function(){
      
    window.__DBG__?.log('btn_gerar CLICK', { chip: (q('cj_code_chip')?.getAttribute('data-code')||'').trim() });

      var code = (q('cj_code_chip').getAttribute('data-code') || '').trim();
      if (!code){
        try { if (typeof __forceCloseConsultaUI === 'function') __forceCloseConsultaUI(); } catch(_){}
        return;
      }

      var inp = q('codigo'); if (inp) inp.value = code; // compat

      const item = await __preloadDocForContract(code);

      window.__DBG__?.log('btn_gerar AFTER preload', { snap: window.__DBG__?.snap() });

      openSideConfirm(code, async () => {
        if (q('cj_loader_back')) {
          q('cj_loader_back').style.display = 'flex';
          var t = q('cj_loader_back').querySelector('.cj-loader-text');
          if (t) t.textContent = 'Gerando contrato...';
        }

        try {

          window.__DBG__?.log('btn_gerar BEFORE fetch', { queryCode: code });

          const res = await fetch('/api/gerador/make_contract.php?codigo=' + encodeURIComponent(code));

	  		
          const j   = await res.json();

          if (j && j.ok && j.url)
          
          window.__DBG__?.log('btn_gerar SUCCESS', { url: j.url, snap: window.__DBG__?.snap() });

	 {
            window.open(j.url, '_blank');

            // fecha modal imediatamente
            try { if (typeof __forceCloseConsultaUI === 'function') __forceCloseConsultaUI(); } catch(_){}

            // toast moderno
            try {
              const nome = (item && item.nomeContratante) || (q('nomeContratante')?.value || '');
              window.contratoSucesso?.({
                titulo: 'Documento gerado com sucesso',
                codigo: code.toUpperCase(),
                nome
              });
            } catch(_){}
          } else {
            alert('Não foi possível gerar o contrato. Verifique os dados.');
          }
        } catch (err) {
          console.error('Erro ao gerar contrato:', err);
          alert('Erro inesperado ao gerar contrato.');
        } finally {
          if (q('cj_loader_back')) q('cj_loader_back').style.display = 'none';
          try { if (typeof __forceCloseConsultaUI === 'function') __forceCloseConsultaUI(); } catch(_){}
        }
      }, () => {
        try { if (typeof __forceCloseConsultaUI === 'function') __forceCloseConsultaUI(); } catch(_){}
      });
    };

    window.__CJFIX__ = { b1:b1, b2:b2, loaderBack:lback };
  }

  /* ---- Aberturas ---- */
  function openList(){
    build(); hideLegacy();
    window.__CJFIX__.b2.style.display='none';
    window.__CJFIX__.b1.style.display='flex';
  }
  function openDecide(code){
    build();
    q('cj_code_chip').textContent=code;
    q('cj_code_chip').setAttribute('data-code',code);
    window.__CJFIX__.b1.style.display='none';
    window.__CJFIX__.b2.style.display='flex';
    hideLegacy();

  // DEBUG
   window.__DBG__?.log('openDecide', { codeParam: code });	
  
  }

  /* ---- Fetch/helpers ---- */
  function fetchList(){
    var u=JSON_URL+'?op=list'+(SAVE_TOKEN?'&token='+encodeURIComponent(SAVE_TOKEN):'');
    return fetch(u).then(function(r){return r.json();});
  }
  function fetchDoc(c){
    var u=JSON_URL+'?op=get&codigo='+encodeURIComponent(c)+(SAVE_TOKEN?'&token='+encodeURIComponent(SAVE_TOKEN):'');
    return fetch(u).then(function(r){return r.json();}).then(function(j){ if(!j||!j.ok) throw 0; return j.item; });
  }
  function fillForm(d){
    if(!d) return;
    for(var k in d){
      if(!d.hasOwnProperty(k)) continue;
      var f=q(k); if(f&&'value' in f){ f.value=d[k]; }
    }
  }

  function render(items){
    var body=q('cj_list_body'); body.innerHTML='';
    if(!items||!items.length){ body.innerHTML='<div class="cj-empty">Sem registros.</div>'; return; }
    items.forEach(function(r){
      var d=el('div',{class:'cj-row'});
      d.innerHTML=
        '<div class="cj-code">'+(r.codigo||'')+'</div>'+
        '<div class="cj-date">'+((r.data_criacao||"").slice(0,10))+'</div>'+
        '<div class="cj-client">'+(r.nomeContratante||"")+'</div>';
      d.onclick=function(){ openDecide(r.codigo||''); };
      body.appendChild(d);
    });
  }

  function onSearch(ev){
    ev&&ev.preventDefault();
    openList();
    fetchList().then(function(j){
      if(!j||!j.ok){ q('cj_list_body').innerHTML='<div class="cj-empty">Sem registros.</div>'; return; }
      render(j.items||[]);
    }).catch(function(){
      q('cj_list_body').innerHTML='<div class="cj-empty">Sem registros.</div>';
    });
  }

  function init(){
    var btn=q('searchJsonBtn'); if(!btn) return;
    btn.addEventListener('click', onSearch);
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }

  // Exporta API p/ uso externo (Continuar etapa 1, etc.)
  window.__CJFIX_API__ = {
    openList, openDecide, fetchList, fetchDoc
  };
})();
/* ====== TEMP DEBUG: painel e helpers ====== */
(function(){
  // Ativa/desativa debug: localStorage.DEBUG_CONSULTA = '1' / '0'
  const ACTIVE = (localStorage.getItem('DEBUG_CONSULTA') === '1');
  if (!ACTIVE) {
    window.__DBG__ = { log: function(){}, snap: function(){ return {}; } };
    return;
  }

  // CSS do painel
  (function(){
    const css = `
    #cj_dbg{position:fixed;left:12px;bottom:12px;z-index:999999;max-width:44vw;
      background:rgba(24,24,27,.95);color:#e5e7eb;border:1px solid #555;
      font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      border-radius:8px;padding:8px 10px;box-shadow:0 8px 24px rgba(0,0,0,.45)}
    #cj_dbg h4{margin:0 0 6px 0;font-weight:800;color:#93c5fd}
    #cj_dbg pre{margin:0;white-space:pre-wrap;word-break:break-word;max-height:36vh;overflow:auto}
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  })();

  // Painel
  const box = document.createElement('div');
  box.id = 'cj_dbg';
  box.innerHTML = '<h4>DEBUG Consulta</h4><pre id="cj_dbg_pre"></pre>';
  document.body.appendChild(box);
  const pre = document.getElementById('cj_dbg_pre');

  function snap(){
    let chip = '';
    try { chip = (document.getElementById('cj_code_chip')?.getAttribute('data-code') || '').trim(); } catch(_){}
    let input = '';
    try { input = (document.getElementById('codigo')?.value || '').trim(); } catch(_){}
    let docCode = '';
    try { docCode = (window.__DOC?.codigo || window.__CURRENT_DOC?.codigo || '').trim(); } catch(_){}
    let lastSave = '';
    try { lastSave = (window.__lastSave?.dados?.codigo || '').trim(); } catch(_){}
    return { chip, input, docCode, lastSave };
  }

  function log(tag, extra){
    const s = snap();
    const line = `[${new Date().toLocaleTimeString()}] ${tag}\n` +
                 JSON.stringify({ ...s, ...extra }, null, 2) + '\n\n';
    pre.textContent = (line + pre.textContent).slice(0, 20000);
    console.log('DEBUG CONSULTA ::', tag, s, extra||{});
  }

  window.__DBG__ = { log, snap };
})();

