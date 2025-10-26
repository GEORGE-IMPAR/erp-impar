
/*!
 * cj_autoretry_shim_v1.js
 * Shim NÃO intrusivo para o botão "Gerar contrato" do ERP Ímpar.
 * - Não altera o seu JS principal.
 * - Ouve somente o botão cj_btn_gerar.
 * - Limpa o #codigo na primeira tentativa para evitar reaproveitar código antigo.
 * - Mostra o loader preto (#cj_loader_back) se existir.
 * - Se surgir um alert de "não encontrado / veja o console", após o OK re-clica 1x o botão automaticamente.
 * - Restaura tudo no final. Idempotente.
 */
(function(){
  'use strict';

  // ====== CONFIGURAÇÃO (ajuste os IDs se necessário) ======
  var BTN_GERAR_ID     = 'cj_btn_gerar';
  var CODIGO_INPUT_ID  = 'codigo';
  var CHIP_ID          = 'cj_code_chip';
  var LOADER_ID        = 'cj_loader_back';

  // Regex para capturar mensagens do seu alerta de "não encontrado"
  var NOT_FOUND_REGEX = /não\s*encontr|nao\s*encontr|c[oó]digo.*n[aã]o.*exist|abra.*console|veja.*console/i;

  function q(id){ return document.getElementById(id); }

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
  var retrying = false; // guarda se já estamos no segundo clique automático

  function bind(){
    if (bound) return;
    var btn = q(BTN_GERAR_ID);
    if (!btn) return; // botão ainda não existe; tentaremos de novo após DOMContentLoaded
    bound = true;

    // Listener EM CAPTURA para executar antes do handler original, sem mudar o core
    btn.addEventListener('click', function onFirstClick(){
      if (retrying){
        // Segundo clique automático: não interferimos, só limpamos o flag.
        retrying = false;
        return;
      }

      // 1) Limpa o campo código para evitar reaproveitar valor antigo
      try {
        var inp = q(CODIGO_INPUT_ID);
        if (inp) inp.value = '';
      } catch(_) {}

      // 2) Mostra loader (se existir)
      showLoader('Processando... aguarde...');

      // 3) Patch do alert somente enquanto durar este fluxo
      var originalAlert = window.alert;
      var sawNotFound = false;
      window.alert = function(msg){
        try {
          if (typeof msg === 'string' && NOT_FOUND_REGEX.test(msg)) {
            sawNotFound = true;
            showLoader('Gerando documento...');
          }
        } catch(_) {}
        return originalAlert.call(window, msg);
      };

      // 4) Após o handler original rodar, decidimos se re-clicamos 1x
      setTimeout(function(){
        if (sawNotFound){
          try {
            // Garante que #codigo tenha o valor correto a partir do chip (se necessário)
            var chip = q(CHIP_ID);
            var code = (chip && chip.getAttribute('data-code') || '').trim();
            var inp2 = q(CODIGO_INPUT_ID);
            if (code && inp2 && !inp2.value){
              inp2.value = code.toUpperCase();
              try { inp2.dispatchEvent(new Event('input',  { bubbles:true })); } catch(_){}
              try { inp2.dispatchEvent(new Event('change', { bubbles:true })); } catch(_){}
            }
          } catch(_) {}

          // Re-dispara UMA vez
          retrying = true;
          setTimeout(function(){
            try { btn.click(); } finally {
              // Restaura alert e esconde loader um pouco depois
              setTimeout(function(){ window.alert = originalAlert; hideLoader(); }, 1200);
            }
          }, 300);
        } else {
          // Sem "não encontrado": restaura tudo normalmente
          window.alert = originalAlert;
          setTimeout(hideLoader, 800);
        }
      }, 0);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  // Fallback: caso o botão seja injetado depois, tentamos bindar novamente por alguns segundos
  var tries = 0, maxTries = 20;
  var iv = setInterval(function(){
    if (bound) return clearInterval(iv);
    tries += 1;
    if (tries > maxTries) return clearInterval(iv);
    bind();
  }, 300);
})();
