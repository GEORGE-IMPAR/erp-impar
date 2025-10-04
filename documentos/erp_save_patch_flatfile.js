// /documentos/erp_save_patch_flatfile.js
(function(){
  const SAVE_URL   = 'https://api.erpimpar.com.br/gerador/save.php';
  const LIST_URL   = 'https://api.erpimpar.com.br/gerador/list.php';
  const SAVE_TOKEN = '8cce9abb2fd53b1cceaa93b9cecfd5384b2ea6fb931e8882c543cbd7d3663b77';
  window.__ERP_SAVE_PATCH__ = { SAVE_URL, LIST_URL, SAVE_TOKEN };

  (function () {
    function findSteps() {
      const steps = [];
      document.querySelectorAll('[data-step], #dot1, #dot2, #dot3, #dot4, #dot5').forEach(el => {
        const ds = el.getAttribute('data-step') || (el.id||'').replace('dot','');
        const n = parseInt(ds, 10);
        if (!isNaN(n)) steps.push({ el, n });
      });
      return steps.sort((a,b)=>a.n-b.n);
    }
    window.updateStepper = window.updateStepper || function(step){
      const steps = findSteps();
      steps.forEach(({el,n})=>{
        el.classList.remove('active','current','done','is-active','completed');
        if(n < step) el.classList.add('done','completed');
        else if(n === step) el.classList.add('active','current','is-active');
      });
      [['line12',2],['line23',3],['line34',4],['line45',5]].forEach(([id,to])=>{
        const el=document.getElementById(id);
        if(!el) return;
        if(step>=to) el.classList.add('done'); else el.classList.remove('done');
      });
    };
    document.addEventListener('DOMContentLoaded', ()=>{ try{ window.updateStepper(1); }catch(_){} });
  })();

  function normalizeDados(d){
    const out = Object.assign({}, d || {});
    const clausulas = (out.clausulas ?? '').toString();
    const cond = (out.condicoes ?? out.condicoesPagamento ?? '').toString();
    out.clausulas = clausulas;
    out.condicoes = cond;
    out.condicoesPagamento = cond;
    out.codigo        = (out.codigo || '').toString().trim();
    out.servico       = (out.servico || '').toString();
    out.enderecoObra  = (out.enderecoObra || out.endereco || '').toString();
    out.valor         = (out.valor || '').toString();
    out.valorExtenso  = (out.valorExtenso || '').toString();
    out.prazo         = (out.prazo || '').toString();
    out.dataExtenso   = (out.dataExtenso || '').toString();
    if(!out.operador || !out.operador.nome){
      try{ const u = JSON.parse(localStorage.getItem('impar_user')||'null'); if(u) out.operador = { nome: u.Nome, email: u.Email }; }catch(_){}
    }
    return out;
  }

  async function parseJsonSafe(resp){
    const raw = await resp.text();
    try{ return JSON.parse(raw); }catch(_){ return { ok:false, raw, status: resp.status }; }
  }

  function uniquePdfName(prefix){
    const d = new Date();
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${(prefix||'DOC').replace(/[^a-zA-Z0-9-_]/g,'_')}_${y}${m}${day}.pdf`;
  }

  async function checkCodigoDuplicado(codigo){
    const params = new URLSearchParams({ token: SAVE_TOKEN, limit: '500' });
    if (codigo) params.set('codigo', codigo);
    const url = `${LIST_URL}?${params.toString()}`;
    const r = await fetch(url, { cache: 'no-store', headers: { Authorization: 'Bearer ' + SAVE_TOKEN } });
    const j = await r.json().catch(() => null);
    return (j && (j.items || j.rows || j.itens || j.linhas)) || [];
  }

  let __savingNowPatch = false;

// === Anti-duplicação (cliente) ===
const DEDUPE_WINDOW_MS = 15000; // 15s
let __patchSaving = false;

function makeSignature(dados, pdfName){
  const d = dados || {};
  return [
    (d.codigo || '').trim(),
    (pdfName || '').trim(),
    (d.valor || '').trim(),
    (d.prazo || '').toString().trim(),
  ].join('|');
}
function shouldSkipDuplicate(signature){
  try{
    const lastSig = localStorage.getItem('impar_last_save_sig') || '';
    const lastTs  = parseInt(localStorage.getItem('impar_last_save_ts')||'0',10) || 0;
    const now     = Date.now();
    if (signature && lastSig === signature && (now - lastTs) < DEDUPE_WINDOW_MS){
      console.warn('[patch] requisição repetida (<15s) — ignorada');
      return true;
    }
    localStorage.setItem('impar_last_save_sig', signature || '');
    localStorage.setItem('impar_last_save_ts', String(now));
  }catch(_){}
  return false;
}

  window.saveWithLogo = saveWithLogo;
  window.checkCodigoDuplicado = checkCodigoDuplicado;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.topbar .btn, #btnFecharTopo')
      .forEach(btn => {
        if (/fechar/i.test(btn.textContent || '') || btn.id === 'btnFecharTopo') {
          btn.addEventListener('click', (e) => {
            if (typeof window.__currentStep !== 'number' || window.__currentStep === 1) {
              e.preventDefault();
              location.href = location.origin + '/login_doc.html';
            }
          });
        }
      });

    const btnBusca = document.querySelector('#btnPesquisarDocs') ||
      Array.from(document.querySelectorAll('button')).find(b => /pesquisar\s+documentos\s+cadastrados/i.test(b.textContent||''));
    if (btnBusca && typeof window.abrirConsulta === 'function') {
      btnBusca.addEventListener('click', (e)=>{ e.preventDefault(); window.abrirConsulta(); });
    }
  });
})();