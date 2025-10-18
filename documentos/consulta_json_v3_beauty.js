/* consulta_json_v3_beauty_brand.js — UI moderna com animações, glass/blur e paleta azul‑marinho
   RISCO ZERO: não altera código legado; usa somente #searchJsonBtn e cria seus próprios modais.
   Fluxo:
   1) Modal Lista (Consulta) -> escolhe um documento
   2) Modal Decisão -> Atualizar documento (preenche código + dispara eventos + carrega JSON) | Gerar contrato (placeholder) | X/Fechar
*/
(function(){
  // ====== THEME (ajuste as cores aqui se quiser) ======
  var BRAND = {
    primary: '#0A1A3A',     // azul-marinho
    primaryDark: '#08142E', // variação escura
    accent: '#3B82F6',      // azul ação/hover
    glass: 'rgba(255,255,255,.92)'
  };

  // ====== CONFIG BACKEND ======
  var JSON_URL   = 'https://api.erpimpar.com.br/gerador/json_table_cors.php';
  var SAVE_TOKEN = '8ce29ab4b2d531b0eca93b9cfc4538042a6b9f3a8882e543cbad73663b77';

  // ====== HELPERS ======
  function el(tag, attrs, html){
    var e = document.createElement(tag);
    if(attrs){ for(var k in attrs){ if(attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]); } }
    if(html != null) e.innerHTML = html;
    return e;
  }
  function q(id){ return document.getElementById(id); }

  // ====== CSS (glass, blur, animações, pill buttons) ======
  function injectCSS(){
    if (q('cj_brand_css')) return;
    var css = [
      '@keyframes cjfade{from{opacity:0}to{opacity:1}}',
      '@keyframes cjscale{from{transform:translate(-50%,-46%) scale(.96);opacity:.03}to{transform:translate(-50%,-50%) scale(1);opacity:1}}',
      '@keyframes cjslide{from{transform:translateY(10px);opacity:.01}to{transform:translateY(0);opacity:1}}',

      '.cj-back{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:100000;',
      ' background:rgba(2,6,23,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:cjfade .2s ease-out}',
      
      '.cj-box{position:relative;width:92%;max-width:980px;border-radius:20px;overflow:hidden;',
      ' background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.9));',
      ' border:1px solid rgba(226,232,240,.75);box-shadow:0 28px 80px rgba(2,6,23,.35)}',

      '.cj-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;',
      ' background:linear-gradient(90deg,'+BRAND.primary+','+BRAND.primaryDark+');color:#fff}',
      '.cj-title{font-weight:900;letter-spacing:.3px}',
      '.cj-x{background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;padding:6px 10px;border-radius:12px}',
      '.cj-x:hover{background:rgba(255,255,255,.12)}',

      '.cj-body{padding:6px 0 10px;max-height:66vh;overflow:auto;',
      ' background:linear-gradient(180deg,#f8fafc,#eef2f7)}',

      '.cj-row{display:grid;grid-template-columns:200px 170px 1fr;gap:12px;align-items:center;',
      ' padding:12px 20px;border-bottom:1px solid #e2e8f0;cursor:pointer;position:relative;transition:transform .12s ease}',
      '.cj-row:hover{transform:translateY(-1px)}',
      '.cj-row:before{content:"";position:absolute;inset:0;opacity:0;transition:opacity .15s ease;',
      ' background:linear-gradient(90deg,rgba(59,130,246,.06),rgba(99,102,241,.06),rgba(59,130,246,.06))}',
      '.cj-row:hover:before{opacity:1}',
      '.cj-code{font-weight:800;color:'+BRAND.primary+'}',
      '.cj-date{color:#475569;font-size:13px}',
      '.cj-client{color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',

      '.cj-empty{padding:20px;color:#64748b}',

      /* Card decisão */
      '.cj-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);',
      ' background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.9));',
      ' border:1px solid rgba(226,232,240,.75);border-radius:20px;',
      ' box-shadow:0 28px 80px rgba(2,6,23,.35);width:92%;max-width:520px;overflow:hidden;animation:cjscale .2s ease-out}',
      '.cj-card-head{display:flex;align-items:center;justify-content:space-between;',
      ' background:linear-gradient(90deg,'+BRAND.primary+','+BRAND.primaryDark+');color:#fff;padding:16px 20px}',
      '.cj-chip{display:inline-block;background:'+BRAND.primaryDark+';color:#cbd5e1;border:1px solid #334155;',
      ' padding:4px 12px;border-radius:999px;font-size:12px;margin-left:8px}',
      '.cj-card-body{padding:18px;color:#0f172a;animation:cjslide .22s ease-out}',
      '.cj-actions{display:flex;gap:12px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #e2e8f0;',
      ' background:linear-gradient(180deg,#f8fafc,#eef2f7)}',

      '.btn{border:none;border-radius:999px;padding:12px 16px;cursor:pointer;font-weight:800;letter-spacing:.2px;',
      ' transition:transform .12s ease,filter .12s ease,box-shadow .12s ease; position:relative; overflow:hidden}',
      '.btn:active{transform:translateY(1px)}',
      '.btn.ghost{background:#e2e8f0;color:'+BRAND.primary+';box-shadow:0 2px 0 rgba(2,6,23,.06)}',
      '.btn.ghost:hover{filter:brightness(1.04)}',
      '.btn.primary{background:linear-gradient(90deg,'+BRAND.primaryDark+','+BRAND.primary+');color:#fff;box-shadow:0 8px 18px rgba(10,26,58,.28)}',
      '.btn.primary:hover{filter:brightness(1.06)}',

      /* Ripple subtle */
      '.btn::after{content:"";position:absolute;inset:auto;left:50%;top:50%;width:0;height:0;',
      ' background:rgba(255,255,255,.35);border-radius:999px;transform:translate(-50%,-50%);opacity:0;pointer-events:none}',
      '.btn:focus-visible{outline:3px solid '+BRAND.accent+'55;outline-offset:2px}'
    ].join('');

    var style = el('style',{id:'cj_brand_css'}, css);
    document.head.appendChild(style);
  }

  // ====== DOM BUILD ======
  function build(){
    if (q('cj_list_back')) return;
    injectCSS();

    // Lista
    var back1 = el('div',{id:'cj_list_back',class:'cj-back'});
    var box1  = el('div',{class:'cj-box'});
    box1.innerHTML = ''
      + '<div class="cj-head"><div class="cj-title">Consulta de documentos</div><button class="cj-x" id="cj_x1">×</button></div>'
      + '<div class="cj-body" id="cj_list_body"><div class="cj-empty">Carregando...</div></div>';
    back1.appendChild(box1);
    document.body.appendChild(back1);

    // Decisão
    var back2 = el('div',{id:'cj_decide_back',class:'cj-back'});
    var card  = el('div',{class:'cj-card'});
    card.innerHTML = ''
      + '<div class="cj-card-head"><div class="cj-title">Documento <span id="cj_code_chip" class="cj-chip">—</span></div><button class="cj-x" id="cj_x2">×</button></div>'
      + '<div class="cj-card-body">O que você deseja fazer com este documento?</div>'
      + '<div class="cj-actions">'
      +   '<button class="btn ghost" id="cj_btn_close">Fechar</button>'
      +   '<button class="btn ghost" id="cj_btn_gerar">Gerar contrato</button>'
      +   '<button class="btn primary" id="cj_btn_atualizar">Atualizar documento</button>'
      + '</div>';
    back2.appendChild(card);
    document.body.appendChild(back2);

    // Fechar handlers
    function hideAll(){ back1.style.display='none'; back2.style.display='none'; }
    q('cj_x1').onclick = hideAll;
    q('cj_x2').onclick = hideAll;
    q('cj_btn_close').onclick = hideAll;
    q('cj_btn_gerar').onclick = function(){ back2.style.display='none'; }; // placeholder

    // Atualizar documento
    q('cj_btn_atualizar').onclick = function(){
      var code = (q('cj_code_chip').getAttribute('data-code')||'').trim();
      if(!code){ back2.style.display='none'; return; }
      var codigoInput = q('codigo');
      if(codigoInput){
        codigoInput.value = code;
        try{
          codigoInput.dispatchEvent(new Event('input',{bubbles:true}));
          codigoInput.dispatchEvent(new Event('change',{bubbles:true}));
        }catch(e){}
      }
      fetchDoc(code).then(function(item){
        fillForm(item);
        hideAll();
        window.scrollTo({top:0,behavior:'smooth'});
      }).catch(function(){ hideAll(); });
    };

    // Guarda refs globais
    window.__CJBR__ = {listBack:back1, decideBack:back2};
  }

  // ====== FETCHES ======
  function fetchList(){
    var url = JSON_URL + '?op=list' + (SAVE_TOKEN ? '&token='+encodeURIComponent(SAVE_TOKEN) : '');
    return fetch(url).then(function(r){ return r.json(); });
  }
  function fetchDoc(codigo){
    var url = JSON_URL + '?op=get&codigo='+encodeURIComponent(codigo) + (SAVE_TOKEN ? '&token='+encodeURIComponent(SAVE_TOKEN) : '');
    return fetch(url).then(function(r){ return r.json(); }).then(function(j){ if(!j || !j.ok) throw 0; return j.item; });
  }

  // ====== RENDER ======
  function renderList(items){
    var body = q('cj_list_body'); body.innerHTML = '';
    if(!items || !items.length){ body.innerHTML = '<div class="cj-empty">Sem registros.</div>'; return; }
    items.forEach(function(row){
      var d = el('div',{class:'cj-row'});
      d.innerHTML = '<div class="cj-code">'+(row.codigo||'')+'</div>'
                  + '<div class="cj-date">'+((row.data_criacao||"").slice(0,10))+'</div>'
                  + '<div class="cj-client">'+(row.nomeContratante||"")+'</div>';
      d.onclick = function(){ openDecide(row.codigo||''); };
      body.appendChild(d);
    });
  }

  // ====== OPEN/CLOSE ======
  function openList(){
    build();
    // Oculta quaisquer modais antigos que porventura estejam na página
    try{
      ['cj_modal','cj_actions','consultaModal'].forEach(function(id){ var e=q(id); if(e) e.style.display='none'; });
      var legacy = document.querySelectorAll('#cj_modal, #cj_actions, #consultaModal');
      legacy.forEach ? legacy.forEach(function(n){ n.style.display='none'; }) : null;
    }catch(_){}
    window.__CJBR__.decideBack.style.display='none';
    window.__CJBR__.listBack.style.display='flex';
  }
  function openDecide(code){
    build();
    q('cj_code_chip').textContent = code;
    q('cj_code_chip').setAttribute('data-code', code);
    window.__CJBR__.listBack.style.display='none';
    window.__CJBR__.decideBack.style.display='flex';
  }

  // ====== FILL FORM ======
  function fillForm(data){
    if(!data) return;
    for(var k in data){
      if(!data.hasOwnProperty(k)) continue;
      var f = q(k);
      if(f && 'value' in f){ f.value = data[k]; }
    }
  }

  // ====== INIT ======
  function onClickSearch(ev){
    ev && ev.preventDefault();
    openList();
    fetchList().then(function(j){
      if(!j || !j.ok){ q('cj_list_body').innerHTML='<div class="cj-empty" style="color:#b91c1c;">Erro ao carregar a lista.</div>'; return; }
      renderList(j.items||[]);
    }).catch(function(){
      q('cj_list_body').innerHTML='<div class="cj-empty" style="color:#b91c1c;">Erro ao carregar a lista.</div>';
    });
  }
  function init(){
    var btn = q('searchJsonBtn');
    if(!btn) return;
    btn.addEventListener('click', onClickSearch);
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();