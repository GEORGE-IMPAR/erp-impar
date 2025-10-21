
// consulta_json_v3_beauty_final.js
// - "Gerar contrato" usa o código do chip e faz o download direto (não toca no campo #codigo)
// - Ao digitar um código existente no #codigo, abre a mesma decisão (openDecide)
// Requer que as funções fetchDoc(code), openDecide(code), hideAll(), updateStepper(step), showOnly(screen) já existam no escopo.

(function(){
  // ====== A) Handler: GERAR CONTRATO (no card de decisão) ======
  function setupGerarContrato(){
    var btn = document.getElementById('cj_btn_gerar');
    if (!btn) return;
    btn.onclick = function(){
      var chip = document.getElementById('cj_code_chip');
      var code = (chip && chip.getAttribute('data-code') || '').trim();
      if (!code){ if (typeof hideAll === 'function') hideAll(); return; }

      // Loader (opcional)
      var lback = document.getElementById('cj_loader_back');
      if (lback) lback.style.display = 'flex';

      // Gera contrato diretamente via backend
      fetch('/api/gerador/make_contract.php?codigo=' + encodeURIComponent(code))
        .then(function(r){ return r.json(); })
        .then(function(j){
          if (lback) lback.style.display = 'none';
          if (!j || !j.ok || !j.url){ if (typeof hideAll === 'function') hideAll(); return; }

          // Abre/baixa o arquivo gerado
          try { window.open(j.url, '_blank'); } catch(_){}

          // Mostra o mesmo modal de sucesso do index
          try {
            var sm = document.getElementById('successModal');
            if (sm){
              sm.style.display   = 'flex';
              sm.style.visibility= 'visible';
              sm.style.opacity   = '1';
            }
          } catch(_){}

          // Reset leve e volta para Etapa 1
          try {
            // limpa campos gerais (sem depender do #codigo)
            var nodes = document.querySelectorAll('input[type="text"], input[type="file"], input[type="number"], textarea, select');
            for (var i=0;i<nodes.length;i++){
              var el = nodes[i];
              if (el.tagName === 'SELECT') el.selectedIndex = 0;
              else if (el.type === 'file') el.value = '';
              else el.value = '';
            }

            // memórias locais
            try { window.__savingNow = false; } catch(_){}
            try { window.__lastSave  = { sig:null, at:0 }; } catch(_){}
            try { localStorage.clear(); } catch(_){}

            // volta para etapa 1 e fecha UI de consulta
            try { if (typeof updateStepper === 'function') updateStepper(1); } catch(_){}
            try { if (typeof showOnly === 'function') showOnly('screen1'); } catch(_){}
            try { if (typeof hideAll === 'function') hideAll(); } catch(_){}

            var b1 = document.getElementById('bar1');
            if (b1){ b1.classList.add('disabled'); b1.classList.remove('enabled'); }

            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch(_){}
        })
        .catch(function(){
          if (lback) lback.style.display = 'none';
          if (typeof hideAll === 'function') hideAll();
        });
    };
  }

  // ====== B) Digitar código em #codigo → se existir, abrir decisão ======
  function setupTypeToDecide(){
    var AC_RE = /\b[A-Z]{2}\d{5,}\b/;
    var timer = null, last = '';

    function check(){
      var inp = document.getElementById('codigo');
      if (!inp) return;
      var v = (inp.value || '').toUpperCase().trim();
      if (!AC_RE.test(v) || v === 'AC00025' || v === last) return;
      last = v;

      if (typeof fetchDoc === 'function'){
        fetchDoc(v).then(function(item){
          if (item && typeof openDecide === 'function') openDecide(v);
        }).catch(function(){ /* não existe → ignora */ });
      }
    }

    function onInput(){
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, 400);
    }

    var inpNow = document.getElementById('codigo');
    if (inpNow) inpNow.addEventListener('input', onInput);

    document.addEventListener('DOMContentLoaded', function(){
      var inp = document.getElementById('codigo');
      if (inp) inp.addEventListener('input', onInput);
    });
  }

  // Boot
  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    setupGerarContrato();
    setupTypeToDecide();
  });
})();
