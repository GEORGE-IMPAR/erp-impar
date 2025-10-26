
/*!
 * cj_autoretry_shim_v3.js
 * 100% automático (sem pop-up/OK). Não altera o JS principal.
 * Fluxo:
 *  - Ao clicar em "Gerar contrato":
 *    1) Mostra loader preto (se existir).
 *    2) Limpa #codigo e sobrescreve com o código do chip (#cj_code_chip).
 *    3) Deixa o handler original rodar (1ª tentativa).
 *    4) Intercepta window.alert durante este ciclo (NÃO exibe pop-up).
 *    5) Faz 2º clique automático após ~320ms, garantindo o #codigo.
 *    6) Restaura alert/loader ao final (ou antes se contrato for gerado).
 *
 * Observações:
 *  - Não usa stopPropagation: o handler original é preservado.
 *  - Usa flags para evitar loop/reentrância.
 *  - Se existir window.contratoSucesso, o shim intercepta para esconder o loader cedo.
 */
(function(){
  'use strict';

  // ===== Config =====
  var BTN_GERAR_ID     = 'cj_btn_gerar';
  var CODIGO_INPUT_ID  = 'codigo';
  var CHIP_ID          = 'cj_code_chip';
  var LOADER_ID        = 'cj_loader_back';

  function q(id){ return document.getElementById(id); }

  // Loader helpers
  function showLoader(msg){
    var l = q(LOADER_ID);
    if (!l) return;
    l.style.display = 'flex';
    try {
      var t = l.querySelector('.cj-loader-text');
      if (t && msg) t.textContent = msg;
    } catch(_) {}
  }
  function hideLoader(){
    var l = q(LOADER_ID);
    if (l) l.style.display = 'none';
  }

  var bound = false;
  var inProgress = false;
  var retrying = false;

  // Intercepta contratoSucesso (se existir) para esconder loader cedo
  (function wrapContratoSucesso(){
    if (!('contratoSucesso' in window)) return;
    try{
      var original = window.contratoSucesso;
      if (typeof original === 'function' && !original.__wrappedByShimV3){
        window.contratoSucesso = function(){
          try { hideLoader(); } catch(_) {}
          try { return original.apply(this, arguments); }
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
      if (retrying) { // segundo clique automático: deixa o core agir e sai
        retrying = false;
        return;
      }
      if (inProgress) { // se usuário clicar várias vezes rápido, ignora extras
        return;
      }
      inProgress = true;

      // 1) Mostra loader
      showLoader('Processando... aguarde...');

      // 2) Preparar campo #codigo com o valor do chip
      try {
        var chip = q(CHIP_ID);
        var code = (chip && chip.getAttribute('data-code') || '').trim();
        var inp = q(CODIGO_INPUT_ID);
        if (inp){
          // limpa e sobrescreve SEMPRE para evitar código antigo
          inp.value = '';
          if (code){
            inp.value = code.toUpperCase();
            try { inp.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_){}
            try { inp.dispatchEvent(new Event('change', { bubbles:true })); } catch(_){}
          }
        }
      } catch(_){}

      // 3) Monkey-patch do alert DURANTE este ciclo (sem exibir pop-up)
      var originalAlert = window.alert;
      window.alert = function(msg){ /* suprime pop-up */ return; };

      // 4) Agenda 2º clique automático (garante retry)
      setTimeout(function(){
        retrying = true;
        try {
          // reforça o #codigo antes do segundo clique
          var chip2 = q(CHIP_ID);
          var code2 = (chip2 && chip2.getAttribute('data-code') || '').trim();
          var inp2 = q(CODIGO_INPUT_ID);
          if (inp2){
            inp2.value = (code2 || '').toUpperCase();
            try { inp2.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_){}
            try { inp2.dispatchEvent(new Event('change', { bubbles:true })); } catch(_){}
          }
          btn.click();
        } finally {
          // Restaura alert e arma timeout de segurança para esconder loader
          setTimeout(function(){
            try { window.alert = originalAlert; } catch(_) {}
            // Timeout de segurança (se não houver callback de sucesso)
            setTimeout(function(){ hideLoader(); inProgress = false; }, 4000);
          }, 50);
        }
      }, 320);
    }, true);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  // Fallback: se o botão não existir ainda, tenta bindar por alguns ciclos
  var tries = 0, maxTries = 24;
  var iv = setInterval(function(){
    if (bound) return clearInterval(iv);
    tries++; if (tries > maxTries) return clearInterval(iv);
    bind();
  }, 250);
})();
