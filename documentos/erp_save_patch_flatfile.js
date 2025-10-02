// /documentos/erp_save_patch_flatfile.js
(function(){
  const SAVE_URL   = 'https://api.erpimpar.com.br/gerador/save.php';
  const LIST_URL   = 'https://api.erpimpar.com.br/gerador/list.php';
  const SAVE_TOKEN = '8cce9abb2fd53b1cceaa93b9cecfd5384b2ea6fb931e8882c543cbd7d3663b77';

  window.__ERP_SAVE_PATCH__ = { SAVE_URL, LIST_URL, SAVE_TOKEN };

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
      try{
        const u = JSON.parse(localStorage.getItem('impar_user')||'null');
        if(u) out.operador = { nome: u.Nome, email: u.Email };
      }catch(_){}
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
    const url = LIST_URL + '?token=' + encodeURIComponent(SAVE_TOKEN) + '&codigo=' + encodeURIComponent(codigo||'');
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json().catch(()=>null);
    return (j && (j.rows || j.items)) ? (j.rows || j.items) : [];
  }

  async function saveWithLogo(pdfBlob, pdfName){
    const dados = normalizeDados(typeof window.collectFormData==='function'?window.collectFormData():{});
    const safeName = pdfName || uniquePdfName(dados.codigo || 'DOC');
    const fd = new FormData();
    fd.append('pdf', new File([pdfBlob], safeName, {type:'application/pdf'}));
    fd.append('dados', new Blob([JSON.stringify(dados)], {type:'application/json'}));
    fd.append('token', SAVE_TOKEN);
    const logo = document.getElementById('logo')?.files?.[0];
    if(logo) fd.append('logo', logo, logo.name);
    const resp = await fetch(SAVE_URL, { method:'POST', headers:{ 'Authorization': 'Bearer ' + SAVE_TOKEN }, body: fd });
    return parseJsonSafe(resp);
  }

  function resolvePdfHref(row){
    const endpoint = SAVE_URL.replace('/save.php','/');
    const url = row.pdfUrl || row.url;
    if(url) return url;
    const file = row.file || row.pdf_file || row.PDF || row.pdf;
    return file ? (endpoint + 'pdf.php?f=' + encodeURIComponent(file)) : '';
  }

  window.saveWithLogo = saveWithLogo;
  window.checkCodigoDuplicado = checkCodigoDuplicado;
  window._resolvePdfHref = resolvePdfHref;
})();
