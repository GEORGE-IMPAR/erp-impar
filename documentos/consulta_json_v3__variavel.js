/* consulta_json_v3_beauty_brand_fixclose_loader.js  (VERSÃO: loader preto + fetch fix)
   - UI moderna azul-marinho (lista + decisão)
   - Suprime qualquer modal legado ao abrir/fechar (FixClose)
   - Loader preto “Processando... aguarde...” com borda e texto brancos
   - RISCO ZERO: usa somente #searchJsonBtn, não mexe nas rotinas antigas
*/

// valores padrão; o clique dos botões vai trocar isso
window.__DOC_KIND__ = 'CONTRATO';                         // 'CONTRATO' ou 'OS'
window.__DOC_MAKE__ = '/api/gerador/make_contract.php';   // endpoint do PHP a chamar

(function(){
  var BRAND = { primary:'#0A1A3A', primaryDark:'#08142E', accent:'#3B82F6' };
  var JSON_URL   = 'https://api.erpimpar.com.br/gerador/json_table_cors.php';
  var SAVE_TOKEN = '8ce29ab4b2d531b0eca93b9f3a8882e543cbad73663b77';

  function el(t,a,h){var e=document.createElement(t);if(a){for(var k in a){if(a.hasOwnProperty(k))e.setAttribute(k,a[k]);}}if(h!=null)e.innerHTML=h;return e;}
  function q(id){return document.getElementById(id);}

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

      /* Loader preto com borda branca e texto branco */
      '.cj-loader-back{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:100001;background:rgba(0,0,0,.8)}',
      '.cj-loader-box{display:flex;flex-direction:column;align-items:center;gap:14px;background:#000;color:#fff;border:2px solid #fff;padding:26px 28px;border-radius:18px;box-shadow:0 22px 60px rgba(0,0,0,.6)}',
      '.cj-spinner{width:46px;height:46px;border-radius:50%;border:4px solid rgba(255,255,255,.25);border-top-color:#fff;animation:cjspin .9s linear infinite}',
      '.cj-loader-text{font-weight:800;letter-spacing:.2px;color:#fff}'
    ].join('');
    document.head.appendChild(el('style',{id:'cj_fix_css'},css));
  }

  function build(){
    if(q('cj_list_back')) return;
    injectCSS();

    var b1=el('div',{id:'cj_list_back',class:'cj-back'});
    var box=el('div',{class:'cj-box'});
    box.innerHTML='<div class="cj-head"><div class="cj-title">Consulta de documentos</div><button class="cj-x" id="cj_x1">×</button></div><div class="cj-body" id="cj_list_body"><div class="cj-empty">Carregando...</div></div>';
    b1.appendChild(box); document.body.appendChild(b1);

    var b2=el('div',{id:'cj_decide_back',class:'cj-back'});
    var card=el('div',{class:'cj-card'});
    card.innerHTML = '<div class="cj-card-head"><div class="cj-title">Documento <span id="cj_code_chip" class="cj-chip">—</span></div><button class="cj-x" id="cj_x2">×</button></div><div class="cj-card-body">O que você deseja fazer com este documento?</div><div class="cj-actions"><button class="btn ghost" id="cj_btn_os" type="button">Gerar OS</button><button class="btn ghost" id="cj_btn_gerar" type="button">Gerar contrato</button><button class="btn primary" id="cj_btn_atualizar" type="button">Atualizar documento</button></div>';
    b2.appendChild(card); document.body.appendChild(b2);

    // Loader
    var lback=el('div',{id:'cj_loader_back',class:'cj-loader-back'});
    var lbox=el('div',{class:'cj-loader-box'});
    lbox.innerHTML='<div class="cj-spinner"></div><div class="cj-loader-text">Processando... aguarde...</div>';
    lback.appendChild(lbox);
    document.body.appendChild(lback);

    // EXPOE objetos para openList/openDecide
    window.__CJFIX__ = { b1:b1, b2:b2, loaderBack:lback };

    function hideAll(){ b1.style.display='none'; b2.style.display='none'; hideLegacy(); }
    q('cj_x1').onclick=hideAll; q('cj_x2').onclick=hideAll;

    /* --- Atualizar documento --- */
    q('cj_btn_atualizar').onclick=function(){
      var code=(q('cj_code_chip').getAttribute('data-code')||'').trim();
      if(!code){ hideAll(); return; }
      var inp=q('codigo'); if (inp) inp.value=code;
      fetchDoc(code).then(function(item){
        try { fillForm(item); } catch(_){}
        try { if (typeof goTo==='function') goTo(2); } catch(_){}
        hideAll();
        window.scrollTo({top:0,behavior:'smooth'});
      }).catch(function(){ hideAll(); });
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
          await Promise.resolve();
          await new Promise(r => requestAnimationFrame(r));
          await new Promise(r => requestAnimationFrame(r));
        } finally {
          window.goTo = savedGoTo;
        }
        return item;
      })();
    }

    /* --- Gerar CONTRATO (com pré-carregamento) --- */
    var _btnGerar = q('cj_btn_gerar');
    if (_btnGerar && !_btnGerar.__hooked) {
      _btnGerar.__hooked = true;
      _btnGerar.onclick = async function () {
        window.__DOC_KIND__ = 'CONTRATO';
        var code = (q('cj_code_chip')?.getAttribute('data-code') || '').trim();
        if (!code) { try { __forceCloseConsultaUI && __forceCloseConsultaUI(); } catch (_) {} return; }

        const NOT_FOUND_REGEX = /não\s*encontr|nao\s*encontr|c[oó]digo.*n[aã]o.*exist|abra.*console|veja.*console/i;

        const inp = q('codigo');
        if (inp) inp.value = '';

        const loader = q('cj_loader_back');
        const setLoader = (msg) => {
          if (!loader) return;
          loader.style.display = 'flex';
          const t = loader.querySelector('.cj-loader-text');
          if (t && msg) t.textContent = msg;
        };
        const hideLoader = () => { if (loader) loader.style.display = 'none'; };

        const originalAlert = window.alert;
        let sawNotFound = false;
        window.alert = function (msg) {
          if (typeof msg === 'string' && NOT_FOUND_REGEX.test(msg)) {
            sawNotFound = true;
            setLoader('Gerando documento...');
          }
          return originalAlert.call(window, msg);
        };

        async function gerarContratoOnce(c) {
          try {
            const res = await fetch('/api/gerador/make_contract.php?codigo=' + encodeURIComponent(c), { cache: 'no-store' });
            const j = await res.json();
            if (j && j.ok && j.url) {
              window.open(j.url, '_blank');
              try {
                const nome = (q('nomeContratante')?.value || '').trim();
                window.contratoSucesso?.({ titulo: 'Documento gerado com sucesso', codigo: c.toUpperCase(), nome });
              } catch (_) {}
              return true;
            }
          } catch (e) {
            console.error('Erro ao gerar contrato:', e);
          }
          return false;
        }

        setLoader('Processando... aguarde...');
        if (inp) {
          inp.value = code.toUpperCase();
          try { inp.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_) {}
          try { inp.dispatchEvent(new Event('change', { bubbles:true })); } catch(_) {}
        }
        await new Promise(r => setTimeout(r, 500));
        let ok = await gerarContratoOnce(code);

        if (!ok || sawNotFound) {
          if (inp && !inp.value) {
            inp.value = code.toUpperCase();
            try { inp.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_) {}
            try { inp.dispatchEvent(new Event('change', { bubbles:true })); } catch(_) {}
          }
          setLoader('Gerando documento...');
          await new Promise(r => setTimeout(r, 350));
          ok = await gerarContratoOnce(code);
        }

        window.alert = originalAlert;
        hideLoader();
        try { __forceCloseConsultaUI && __forceCloseConsultaUI(); } catch (_) {}
      };
    }

    /* --- Gerar OS (com pré-carregamento) --- */
    var _btnOS = q('cj_btn_os');
    if (_btnOS && !_btnOS.__hooked) {
      _btnOS.__hooked = true;
      _btnOS.onclick = async function () {
        window.__DOC_KIND__ = 'OS';
        var code = (q('cj_code_chip')?.getAttribute('data-code') || '').trim();
        if (!code) { try { __forceCloseConsultaUI && __forceCloseConsultaUI(); } catch (_) {} return; }

        const NOT_FOUND_REGEX = /não\s*encontr|nao\s*encontr|c[oó]digo.*n[aã]o.*exist|abra.*console|veja.*console/i;

        const inp = q('codigo');
        if (inp) inp.value = '';

        const loader = q('cj_loader_back');
        const setLoader = (msg) => {
          if (!loader) return;
          loader.style.display = 'flex';
          const t = loader.querySelector('.cj-loader-text');
          if (t && msg) t.textContent = msg;
        };
        const hideLoader = () => { if (loader) loader.style.display = 'none'; };

        const originalAlert = window.alert;
        let sawNotFound = false;
        window.alert = function (msg) {
          if (typeof msg === 'string' && NOT_FOUND_REGEX.test(msg)) {
            sawNotFound = true;
            setLoader('Gerando documento...');
          }
          return originalAlert.call(window, msg);
        };

        async function gerarContratoOnce(c) {
          try {
            const res = await fetch('/api/gerador/make_os.php?codigo=' + encodeURIComponent(c), { cache: 'no-store' });
            const j = await res.json();
            if (j && j.ok && j.url) {
              window.open(j.url, '_blank');
              try {
                const nome = (q('nomeContratante')?.value || '').trim();
                window.contratoSucesso?.({ titulo: 'Documento gerado com sucesso', codigo: c.toUpperCase(), nome });
              } catch (_) {}
              return true;
            }
          } catch (e) {
            console.error('Erro ao gerar contrato:', e);
          }
          return false;
        }

        setLoader('Processando... aguarde...');
        if (inp) {
          inp.value = code.toUpperCase();
          try { inp.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_) {}
          try { inp.dispatchEvent(new Event('change', { bubbles:true })); } catch(_) {}
        }
        await new Promise(r => setTimeout(r, 500));
        let ok = await gerarContratoOnce(code);

        if (!ok || sawNotFound) {
          if (inp && !inp.value) {
            inp.value = code.toUpperCase();
            try { inp.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_) {}
            try { inp.dispatchEvent(new Event('change', { bubbles:true })); } catch(_) {}
          }
          setLoader('Gerando documento...');
          await new Promise(r => setTimeout(r, 350));
          ok = await gerarContratoOnce(code);
        }

        window.alert = originalAlert;
        hideLoader();
        try { __forceCloseConsultaUI && __forceCloseConsultaUI(); } catch (_) {}
      };
    }
  } // <-- fim do build()

  async function openList(){
    build(); hideLegacy();
    window.__CJFIX__.b2.style.display='none';
    window.__CJFIX__.b1.style.display='flex';
  }

  async function openDecide(code){
    // === CJ PATCH: popular campo "codigo" da Etapa 1 assim que o modal abre ===
    (function(){
      try {
        const codeUpper = (typeof code === 'string' ? code : (code?.toString?.() ?? '')).toUpperCase();
        try { q('cj_code_chip').textContent = codeUpper; } catch(e){}
        try { q('cj_code_chip').setAttribute('data-code', codeUpper); } catch(e){}
        const inp = q('codigo');
        if (inp) {
          inp.value = codeUpper;
          try { inp.dispatchEvent(new Event('input',  { bubbles: true })); } catch(_) {}
          try { inp.dispatchEvent(new Event('change', { bubbles: true })); } catch(_) {}
        }
        try { document.querySelectorAll('[id^="codigoVal"]').forEach(el => { el.textContent = codeUpper; }); } catch(_){}
      } catch(_){}
    })();
    // === FIM CJ PATCH ===

    build();
    q('cj_code_chip').textContent=code;
    q('cj_code_chip').setAttribute('data-code',code);
    window.__CJFIX__.b1.style.display='none';
    window.__CJFIX__.b2.style.display='flex';
    hideLegacy();
  }

  function fetchList(){ var u=JSON_URL+'?op=list'+(SAVE_TOKEN?'&token='+encodeURIComponent(SAVE_TOKEN):''); return fetch(u).then(function(r){return r.json();}); }
  function fetchDoc(c){ var u=JSON_URL+'?op=get&codigo='+encodeURIComponent(c)+(SAVE_TOKEN?'&token='+encodeURIComponent(SAVE_TOKEN):''); return fetch(u).then(function(r){return r.json();}).then(function(j){ if(!j||!j.ok) throw 0; return j.item; }); }
  function fillForm(d){ if(!d) return; for(var k in d){ if(!d.hasOwnProperty(k)) continue; var f=q(k); if(f&&'value' in f){ f.value=d[k]; } } }

  function render(items){
    var body=q('cj_list_body'); body.innerHTML='';
    if(!items||!items.length){ body.innerHTML='<div class="cj-empty">Sem registros.</div>'; return; }
    items.forEach(function(r){
      var d=el('div',{class:'cj-row'});
      d.innerHTML='<div class="cj-code">'+(r.codigo||'')+'</div><div class="cj-date">'+((r.data_criacao||"").slice(0,10))+'</div><div class="cj-client">'+(r.nomeContratante||"")+'</div>';
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
    }).catch(function(){ q('cj_list_body').innerHTML='<div class="cj-empty">Sem registros.</div>'; });
  }

  function init(){ var btn=q('searchJsonBtn'); if(!btn) return; btn.addEventListener('click', onSearch); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }

  // --- EXPORTA helpers do módulo de consulta para uso externo ---
  window.__CJFIX_API__ = {
    openList,    // abre a lista moderna
    openDecide,  // abre o card de ação
    fetchList,   // busca a listagem completa
    fetchDoc     // busca 1 documento pelo código
  };
})();
