
/*! contract_autoretry_no_popup.js
 * - Não altera seu HTML.
 * - Não mexe no backend.
 * - Intercepta o botão "Gerar contrato" e faz o fluxo na MESMA ABA, sem baixar .php.
 * - Usa o código selecionado no card (cj_code_chip) e limpa tudo no final.
 * - Mantém suas mensagens (window.contratoSucesso) e o loader existente (#cj_loader_back).
 */
(function(){
  'use strict';

  var IDs = {
    gerarBtn: ['cj_btn_gerar','btnGerarContrato','gerarContrato','btn-gerar-contrato'],
    chip: 'cj_code_chip',
    codigo: 'codigo',
    loader: 'cj_loader_back'
  };
  var CONTINUAR_IDS = ['bar1','bar2','bar3','bar4','bar5'];
  var BIND_FLAG = '__bind_contract_patch_v1__';
  var running = false;

  function q(id){ return document.getElementById(id); }
  function findBtn(){
    for (var i=0;i<IDs.gerarBtn.length;i++){ var b=q(IDs.gerarBtn[i]); if(b) return b; }
    var all = document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]');
    for (var j=0;j<all.length;j++){
      var txt=(all[j].innerText||all[j].value||'').toLowerCase();
      if(txt.includes('gerar') && txt.includes('contrato')) return all[j];
    }
    return null;
  }
  function showLoader(msg){
    var l=q(IDs.loader); if(!l) return;
    l.style.display='flex';
    try { var t=l.querySelector('.cj-loader-text'); if(t && msg) t.textContent=msg; } catch(_){}
  }
  function hideLoader(){ var l=q(IDs.loader); if(l) l.style.display='none'; }
  function showContinuar(){
    CONTINUAR_IDS.forEach(function(id){
      var b=q(id); if(!b) return;
      try{ b.classList.remove('disabled'); }catch(_){}
      b.style.display=''; b.style.visibility=''; b.style.opacity='';
    });
  }
  function cleanState(){
    try {
      if (typeof __resetAllFields === 'function') __resetAllFields();
      var i=q(IDs.codigo); if(i) i.value='';
      if (typeof showOnly === 'function') showOnly('screen1');
      if (typeof updateStepper === 'function') updateStepper(1);
      window.scrollTo({top:0, behavior:'smooth'});
    }catch(_){}
  }
  function closeConsulta(){
    try {
      if (window.__forceCloseConsultaUI) window.__forceCloseConsultaUI();
      var m1=q('cj_list_back'); if(m1) m1.style.display='none';
      var m2=q('cj_decide_back'); if(m2) m2.style.display='none';
    }catch(_){}
  }

  // Envolver o toast de sucesso para garantir UI ok
  (function wrapToast(){
    try{
      var fn = window.contratoSucesso;
      if (typeof fn==='function' && !fn.__wrappedByPatchV1){
        window.contratoSucesso = function(){
          try { hideLoader(); } catch(_){}
          try { showContinuar(); } catch(_){}
          return fn.apply(this, arguments);
        };
        window.contratoSucesso.__wrappedByPatchV1 = true;
      }
    }catch(_){}
  })();

  function bind(){
    var btn = findBtn();
    if (!btn || btn[BIND_FLAG]) return;
    btn[BIND_FLAG] = true;

    // Remove onclick antigo se for setado direto na propriedade
    try { btn.onclick = null; } catch(_){}

    btn.addEventListener('click', async function(ev){
      // Não deixa propagar pro handler antigo (evita nova aba e php download)
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (running) return;
      running = true;

      // Pega o código escolhido no chip
      var code = (q(IDs.chip)?.getAttribute('data-code') || '').trim();
      if (!code){
        // fallback: usa input #codigo se existir
        code = (q(IDs.codigo)?.value || '').trim();
      }
      if (!code){
        alert('Selecione um documento antes de gerar.');
        running=false;
        return;
      }

      // Injeta o código no input e dispara eventos (garante estado interno)
      var inp = q(IDs.codigo);
      if (inp){
        inp.value='';
        inp.value=code.toUpperCase();
        try{ inp.dispatchEvent(new Event('input',{bubbles:true})); }catch(_){}
        try{ inp.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
      }

      showLoader('Gerando contrato...');

      var originalAlert = window.alert;
      var originalOpen  = window.open;
      window.alert = function(){};               // sem pop-up do browser
      window.open  = function(url){              // mesma aba, mas evitamos abrir direto
        try{ /* bloqueado */ }catch(_){}
        return window;
      };

      try {
        // Chama o backend normalmente; não mexe no back.
        var url = '/api/gerador/make_contract.php?codigo=' + encodeURIComponent(code);
        var resp = await fetch(url, { cache:'no-store' });
        if (!resp.ok) throw new Error('Falha ao gerar');
        var blob = await resp.blob();

        // Força o download com nome amigável sem interferir no back
        var cd = resp.headers.get('Content-Disposition') || '';
        var fname = (cd.match(/filename="?([^"]+)"?/) || [])[1] || ('Contrato_'+code+'.xlsx');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        // Dispara seu toast de sucesso original
        try {
          window.contratoSucesso && window.contratoSucesso({
            titulo: 'Documento gerado com sucesso',
            codigo: code,
            nome: (document.getElementById('nomeContratante')?.value || '')
          });
        } catch(_){}

      } catch (e){
        console.error('Erro ao gerar contrato:', e);
        try { alert('Falha ao gerar contrato.'); } catch(_){}
      } finally {
        try { window.alert = originalAlert; } catch(_){}
        try { window.open  = originalOpen;  } catch(_){}
        hideLoader();
        closeConsulta();
        showContinuar();
        cleanState();
        running = false;
      }
    }, true);
  }

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  // Caso o botão apareça depois
  var tries=0, iv=setInterval(function(){
    if (findBtn() && findBtn()[BIND_FLAG]) { clearInterval(iv); return; }
    bind(); if (++tries>30) clearInterval(iv);
  }, 250);

})();
