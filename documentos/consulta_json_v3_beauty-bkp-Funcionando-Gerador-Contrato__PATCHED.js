429: Too Many Requests
For more on scraping GitHub and how it may affect your rights, please review our Terms of Service (https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).


/*! -------------------------------------------------------------------------
 * [APPEND] cj_autoretry_shim_v3 (inline)
 * 100% automático (sem pop-up/OK). Não altera o core do arquivo acima.
 * Executa depois do conteúdo original, no MESMO arquivo.
 * ------------------------------------------------------------------------- */
(function(){
  'use strict';
  var BTN_GERAR_ID     = 'cj_btn_gerar';
  var CODIGO_INPUT_ID  = 'codigo';
  var CHIP_ID          = 'cj_code_chip';
  var LOADER_ID        = 'cj_loader_back';

  function q(id){ return document.getElementById(id); }
  function showLoader(msg){
    var l = q(LOADER_ID);
    if (!l) return;
    l.style.display = 'flex';
    try {
      var t = l.querySelector('.cj-loader-text'); if (t && msg) t.textContent = msg;
    } catch(_) {}
  }
  function hideLoader(){ var l = q(LOADER_ID); if (l) l.style.display = 'none'; }

  var bound = false, inProgress = false, retrying = false;

  // se existir callback global de sucesso, envolvemos para esconder o loader cedo
  (function wrapContratoSucesso(){
    try{
      var fn = window.contratoSucesso;
      if (typeof fn === 'function' && !fn.__wrappedByShimV3){
        window.contratoSucesso = function(){
          try { hideLoader(); } catch(_) {}
          try { return fn.apply(this, arguments); }
          finally { inProgress = false; retrying = false; }
        };
        window.contratoSucesso.__wrappedByShimV3 = true;
      }
    }catch(_){}
  })();

  function bind(){
    if (bound) return;
    var btn = q(BTN_GERAR_ID);
    if (!btn) return;
    bound = true;

    btn.addEventListener('click', function onClick(){
      if (retrying){ retrying = false; return; }
      if (inProgress){ return; } // ignora cliques múltiplos
      inProgress = true;

      // Mostra loader
      showLoader('Processando... aguarde...');

      // Prepara #codigo com o valor do chip SEMPRE (limpa e sobrescreve)
      try {
        var chip = q(CHIP_ID);
        var code = (chip && chip.getAttribute('data-code') || '').trim();
        var inp  = q(CODIGO_INPUT_ID);
        if (inp){
          inp.value = '';
          if (code){
            inp.value = code.toUpperCase();
            try { inp.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_){}
            try { inp.dispatchEvent(new Event('change', { bubbles:true })); } catch(_){}
          }
        }
      } catch(_){}

      // Suprime alerts apenas durante este ciclo
      var originalAlert = window.alert;
      window.alert = function(){ /* suprimido */ };

      // 2º clique automático (retry)
      setTimeout(function(){
        retrying = true;
        try {
          var chip2 = q(CHIP_ID);
          var code2 = (chip2 && chip2.getAttribute('data-code') || '').trim();
          var inp2  = q(CODIGO_INPUT_ID);
          if (inp2){
            inp2.value = (code2 || '').toUpperCase();
            try { inp2.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_){}
            try { inp2.dispatchEvent(new Event('change', { bubbles:true })); } catch(_){}
          }
          btn.click();
        } finally {
          // Restaura alert e esconde loader por segurança após alguns segundos
          setTimeout(function(){
            try { window.alert = originalAlert; } catch(_){}
            setTimeout(function(){ hideLoader(); inProgress = false; }, 4000);
          }, 50);
        }
      }, 320);
    }, true);
  }

  function start(){
    var tryBind = function(){
      if (bound) return true;
      bind();
      return bound;
    };
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ tryBind(); });
    } else {
      tryBind();
    }
    // fallback para casos em que o botão surge depois
    var tries = 0, maxTries = 24;
    var iv = setInterval(function(){
      if (bound) return clearInterval(iv);
      tries++; if (tries > maxTries) return clearInterval(iv);
      tryBind();
    }, 250);
  }
  start();
})();
