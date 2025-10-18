
/* consulta_json_v3.js — Pesquisa + decisão (UI moderna) — RISCO ZERO */
(function(){
  var JSON_URL = 'https://api.erpimpar.com.br/gerador/json_table_cors.php';
  var SAVE_TOKEN = '8ce29ab4b2d531b0eca93b9f3a8882e543cbad73663b77';

  function el(tag, attrs, html){ var e=document.createElement(tag); if(attrs){for(var k in attrs){ if(attrs.hasOwnProperty(k)) e.setAttribute(k,attrs[k]);}} if(html!=null)e.innerHTML=html; return e; }

  function onceCSS(){
    if(document.getElementById('cjv3_css')) return;
    var css = [
      '.cjv3-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;z-index:100000;}',
      '.cjv3-box{background:#fff;border-radius:16px;width:92%;max-width:960px;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden;}',
      '.cjv3-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#0f172a;color:#fff;}',
      '.cjv3-title{font-weight:800;letter-spacing:.3px;}',
      '.cjv3-close{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:.9;}',
      '.cjv3-close:hover{opacity:1;}',
      '.cjv3-body{padding:8px 0;max-height:65vh;overflow:auto;background:#fafafa;}',
      '.cjv3-row{display:grid;grid-template-columns:180px 160px 1fr;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid #eee;cursor:pointer;transition:background .15s ease;}',
      '.cjv3-row:hover{background:#eef2ff;}',
      '.cjv3-row .code{font-weight:700;color:#0f172a;}',
      '.cjv3-row .date{color:#475569;font-size:13px;}',
      '.cjv3-row .client{color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.cjv3-empty{padding:18px 16px;color:#64748b;}',
      '.cjv3-card{background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.25);width:92%;max-width:480px;overflow:hidden;}',
      '.cjv3-card-head{display:flex;align-items:center;justify-content:space-between;background:#0f172a;color:#fff;padding:14px 16px;}',
      '.cjv3-chip{display:inline-block;background:#1e293b;color:#cbd5e1;border:1px solid #334155;padding:4px 10px;border-radius:999px;font-size:12px;margin-left:8px;}',
      '.cjv3-card-body{padding:18px 16px;color:#0f172a;}',
      '.cjv3-actions{display:flex;gap:10px;justify-content:flex-end;padding:14px 16px;border-top:1px solid #eee;background:#f8fafc;}',
      '.btn{border:none;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:700;}',
      '.btn.ghost{background:#e2e8f0;color:#0f172a;}',
      '.btn.primary{background:#0f172a;color:#fff;}'
    ].join('');
    document.head.appendChild(el('style',{id:'cjv3_css'},css));
  }

  function buildDOM(){
    if(document.getElementById('cjv3_list')) return;
    onceCSS();
    var bd1 = el('div',{id:'cjv3_list',class:'cjv3-backdrop'});
    var box1 = el('div',{class:'cjv3-box'});
    box1.innerHTML = '<div class="cjv3-head"><div class="cjv3-title">Consulta de documentos (Excel)</div><button class="cjv3-close" id="cjv3_close1">×</button></div>'+
                     '<div class="cjv3-body" id="cjv3_list_body"><div class="cjv3-empty">Carregando...</div></div>';
    bd1.appendChild(box1);
    document.body.appendChild(bd1);

    var bd2 = el('div',{id:'cjv3_decide',class:'cjv3-backdrop'});
    var card = el('div',{class:'cjv3-card'});
    card.innerHTML = '<div class="cjv3-card-head"><div class="cjv3-title">Documento <span id="cjv3_doc_code_chip" class="cjv3-chip">—</span></div><button class="cjv3-close" id="cjv3_close2">×</button></div>'+
                     '<div class="cjv3-card-body">O que você deseja fazer com este documento?</div>'+
                     '<div class="cjv3-actions">'+
                       '<button class="btn ghost" id="cjv3_btn_close">Fechar</button>'+
                       '<button class="btn ghost" id="cjv3_btn_gerar">Gerar contrato</button>'+
                       '<button class="btn primary" id="cjv3_btn_atualizar">Atualizar documento</button>'+
                     '</div>';
    bd2.appendChild(card);
    document.body.appendChild(bd2);

    function hideAll(){ bd1.style.display='none'; bd2.style.display='none'; }
    document.getElementById('cjv3_close1').onclick = hideAll;
    document.getElementById('cjv3_close2').onclick = hideAll;
    document.getElementById('cjv3_btn_close').onclick = hideAll;
    document.getElementById('cjv3_btn_gerar').onclick = function(){ bd2.style.display='none'; };

    document.getElementById('cjv3_btn_atualizar').onclick = function(){
      var codigo = (document.getElementById('cjv3_doc_code_chip').getAttribute('data-code')||'').trim();
      if(!codigo){ bd2.style.display='none'; return; }
      var codigoInput = document.getElementById('codigo');
      if(codigoInput){
        codigoInput.value = codigo;
        try{
          codigoInput.dispatchEvent(new Event('input',{bubbles:true}));
          codigoInput.dispatchEvent(new Event('change',{bubbles:true}));
        }catch(e){}
      }
      fetchDoc(codigo).then(function(item){
        fillForm(item);
        hideAll();
        window.scrollTo({top:0,behavior:'smooth'});
      }).catch(function(){ hideAll(); });
    };

    window.__CJv3__ = {bd1:bd1, bd2:bd2};
  }

  function openList(){ buildDOM(); window.__CJv3__.bd1.style.display='flex'; }
  function openDecide(code){ buildDOM(); var chip=document.getElementById('cjv3_doc_code_chip'); chip.textContent = code; chip.setAttribute('data-code', code); window.__CJv3__.bd1.style.display='none'; window.__CJv3__.bd2.style.display='flex'; }

  function renderList(items){
    var body = document.getElementById('cjv3_list_body'); body.innerHTML='';
    if(!items || !items.length){ body.innerHTML = '<div class="cjv3-empty">Sem registros.</div>'; return; }
    items.forEach(function(row){
      var r = el('div',{class:'cjv3-row'});
      r.innerHTML = '<div class="code">'+(row.codigo||'')+'</div><div class="date">'+((row.data_criacao||"").slice(0,10))+'</div><div class="client">'+(row.nomeContratante||"")+'</div>';
      r.onclick = function(){ openDecide(row.codigo||''); };
      body.appendChild(r);
    });
  }

  function fetchList(){
    var url = JSON_URL + '?op=list' + (SAVE_TOKEN ? '&token='+encodeURIComponent(SAVE_TOKEN) : '');
    return fetch(url).then(function(r){ return r.json(); });
  }
  function fetchDoc(codigo){
    var url = JSON_URL + '?op=get&codigo='+encodeURIComponent(codigo) + (SAVE_TOKEN ? '&token='+encodeURIComponent(SAVE_TOKEN) : '');
    return fetch(url).then(function(r){ return r.json(); }).then(function(j){ if(!j || !j.ok) throw 0; return j.item; });
  }
  function fillForm(data){
    if(!data) return;
    for(var k in data){ if(!data.hasOwnProperty(k)) continue; var elx=document.getElementById(k); if(elx && 'value' in elx){ elx.value = data[k]; } }
  }

  function onClickSearch(){
    openList();
    fetchList().then(function(j){
      if(!j || !j.ok){ document.getElementById('cjv3_list_body').innerHTML='<div class="cjv3-empty" style="color:#b91c1c;">Erro ao carregar a lista.</div>'; return; }
      renderList(j.items||[]);
    }).catch(function(){
      document.getElementById('cjv3_list_body').innerHTML='<div class="cjv3-empty" style="color:#b91c1c;">Erro ao carregar a lista.</div>';
    });
  }

  function init(){
    var btn = document.getElementById('searchJsonBtn');
    if(!btn) return;
    btn.addEventListener('click', function(ev){ ev.preventDefault(); onClickSearch(); });
  }

  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
