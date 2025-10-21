
// consulta_json_v3_beauty_unificado.js
(function(){
  "use strict";
  function $(sel, ctx){ return (ctx||document).querySelector(sel); }
  function $all(sel, ctx){ return (ctx||document).querySelectorAll(sel); }
  function onReady(fn){ if(document.readyState!=='loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }

  // ---- API mínima ----
  function fetchDoc(code){
    return fetch('/api/get_doc.php?code=' + encodeURIComponent(code))
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (j && (j.ok || j.OK || j.success) && (j.item || j.data)) return j.item || j.data;
        return Promise.reject(new Error('not_found'));
      });
  }

  // ---- UI util ----
  function hideAll(){
    try {
      var modals = $all('#actionModal, #consultaModal, .modal.show, .modal[style*=\"display: block\"]');
      modals.forEach(function(m){ m.style.display='none'; });
      var back = $('.modal-backdrop, .backdrop');
      if (back && back.parentNode) back.parentNode.removeChild(back);
    } catch(_){}
  }

  function ensureDecisionCard(){
    if ($('#cj_decision_card')) return $('#cj_decision_card');
    var wrap = document.createElement('div');
    wrap.id = 'cj_decision_card';
    wrap.style.position = 'fixed';
    wrap.style.left = '50%';
    wrap.style.top = '20%';
    wrap.style.transform = 'translateX(-50%)';
    wrap.style.zIndex = 10000;
    wrap.style.background = '#fff';
    wrap.style.borderRadius = '12px';
    wrap.style.boxShadow = '0 10px 30px rgba(0,0,0,.2)';
    wrap.style.padding = '16px 20px';
    wrap.style.minWidth = '360px';
    wrap.innerHTML = ''
      + '<div style=\"display:flex;align-items:center;gap:10px;margin-bottom:12px;\">'
      + '  <span id=\"cj_code_chip\" data-code=\"\" style=\"display:inline-block;padding:4px 10px;border-radius:999px;background:#eef;color:#223;font-weight:600;font-family:ui-sans-serif,system-ui;\">—</span>'
      + '</div>'
      + '<div style=\"display:flex;gap:10px;justify-content:flex-end\">'
      + '  <button id=\"cj_btn_atualizar\" class=\"btn\" type=\"button\">Atualizar documento</button>'
      + '  <button id=\"cj_btn_gerar\" class=\"btn\" type=\"button\" style=\"background:#1363df;color:#fff;\">Gerar contrato</button>'
      + '  <button id=\"cj_btn_fechar\" class=\"btn\" type=\"button\">Fechar</button>'
      + '</div>';
    document.body.appendChild(wrap);
    $('#cj_btn_fechar', wrap).addEventListener('click', hideAll);
    return wrap;
  }

  function openDecide(code){
    var card = ensureDecisionCard();
    var chip = $('#cj_code_chip', card);
    if (chip){ chip.textContent = code; chip.setAttribute('data-code', code); }
    var bUp = $('#cj_btn_atualizar', card);
    if (bUp){
      bUp.onclick = function(){
        var inp = document.getElementById('codigo');
        if (inp){
          inp.value = code;
          try { inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true})); } catch(_){}
        }
        hideAll();
        window.scrollTo({top:0,behavior:'smooth'});
      };
    }
    var bGen = $('#cj_btn_gerar', card);
    if (bGen){
      bGen.onclick = function(){ gerarContratoComCodigo(code); };
    }
    card.style.display = 'block';
  }

  function gerarContratoComCodigo(code){
    if (!code) { hideAll(); return; }
    var lback = document.getElementById('cj_loader_back');
    if (lback) lback.style.display = 'flex';
    fetch('/api/gerador/make_contract.php?codigo=' + encodeURIComponent(code))
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (lback) lback.style.display = 'none';
        if (!j || !j.ok || !j.url){ hideAll(); return; }
        try { window.open(j.url, '_blank'); } catch(_){}
        var sm = document.getElementById('successModal');
        if (sm){ sm.style.display='flex'; sm.style.visibility='visible'; sm.style.opacity='1'; }
        try {
          var nodes = document.querySelectorAll('input[type=\"text\"], input[type=\"file\"], input[type=\"number\"], textarea, select');
          for (var i=0;i<nodes.length;i++){
            var el = nodes[i];
            if (el.tagName === 'SELECT') el.selectedIndex = 0;
            else if (el.type === 'file') el.value = '';
            else el.value = '';
          }
          try { window.__savingNow = false; } catch(_){}
          try { window.__lastSave  = { sig:null, at:0 }; } catch(_){}
          try { localStorage.clear(); } catch(_){}
          try { if (typeof updateStepper==='function') updateStepper(1); } catch(_){}
          try { if (typeof showOnly==='function') showOnly('screen1'); } catch(_){}
          hideAll();
          var b1 = document.getElementById('bar1');
          if (b1){ b1.classList.add('disabled'); b1.classList.remove('enabled'); }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch(_){}
      })
      .catch(function(){
        if (lback) lback.style.display = 'none';
        hideAll();
      });
  }

  function setupTypeToDecide(){
    var AC_RE = /\b[A-Z]{2}\d{5,}\b/;
    var timer = null, last = '';
    function check(){
      var inp = document.getElementById('codigo');
      if (!inp) return;
      var v = (inp.value || '').toUpperCase().trim();
      if (!AC_RE.test(v) || v === 'AC00025' || v === last) return;
      last = v;
      fetchDoc(v).then(function(item){
        if (item) openDecide(v);
      }).catch(function(){});
    }
    function onInput(){ if (timer) clearTimeout(timer); timer = setTimeout(check, 400); }
    var inpNow = document.getElementById('codigo');
    if (inpNow) inpNow.addEventListener('input', onInput);
    document.addEventListener('DOMContentLoaded', function(){
      var inp = document.getElementById('codigo');
      if (inp) inp.addEventListener('input', onInput);
    });
  }

  // Expor para compatibilidade
  window.fetchDoc   = window.fetchDoc   || fetchDoc;
  window.openDecide = window.openDecide || openDecide;
  window.hideAll    = window.hideAll    || hideAll;

  onReady(function(){
    var btn = document.getElementById('cj_btn_gerar');
    if (btn){
      btn.onclick = function(){
        var chip = document.getElementById('cj_code_chip');
        var code = (chip && chip.getAttribute('data-code') || '').trim();
        gerarContratoComCodigo(code);
      };
    }
    setupTypeToDecide();
  });
})();
