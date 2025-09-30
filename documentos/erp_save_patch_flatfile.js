// /documentos/erp_save_patch_flatfile.js
(function(){
  // ===== Configs do seu ambiente =====
  const SAVE_URL   = 'https://api.erpimpar.com.br/gerador/save.php';
  const LIST_URL   = 'https://api.erpimpar.com.br/gerador/list.php';
  const SAVE_TOKEN = '8cce9abb2fd53b1cceaa93b9cecfd5384b2ea6fb931e8882c543cbd7d3663b77';

  // Exponho para outros scripts (index.html usa isso)
  window.__ERP_SAVE_PATCH__ = { SAVE_URL, LIST_URL, SAVE_TOKEN };

  // ------- Helpers -------
  function normalizeDados(d){
    // Garante que tenhamos sempre as 2 chaves:
    // - clausulas
    // - condicoes e condicoesPagamento (espelhadas)
    const out = Object.assign({}, d || {});
    const clausulas = (out.clausulas ?? '').toString();
    const cond = (out.condicoes ?? out.condicoesPagamento ?? '').toString();

    out.clausulas = clausulas;
    out.condicoes = cond;
    out.condicoesPagamento = cond;

    // reforça metacampos esperados
    out.codigo        = (out.codigo || '').toString().trim();
    out.servico       = (out.servico || '').toString();
    out.enderecoObra  = (out.enderecoObra || out.endereco || '').toString();
    out.valor         = (out.valor || '').toString();
    out.valorExtenso  = (out.valorExtenso || '').toString();
    out.prazo         = (out.prazo || '').toString();
    out.dataExtenso   = (out.dataExtenso || '').toString();

    // garante operador
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

  // ------- API pública: checar duplicado (opcional) -------
  async function checkCodigoDuplicado(codigo){
    const url = LIST_URL + '?token=' + encodeURIComponent(SAVE_TOKEN) + '&codigo=' + encodeURIComponent(codigo||'');
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json().catch(()=>null);
    return (j && j.rows) ? j.rows : [];
  }

  // ------- API pública: salvar (usada pelo index.html) -------
  async function saveWithLogo(pdfBlob, pdfName){
    const raw = (typeof window.collectFormData === 'function') ? window.collectFormData() : {};
    const dados = normalizeDados(raw);

    // nome do PDF
    const safeName = pdfName || uniquePdfName(dados.codigo || 'DOC');

    const fd = new FormData();
    fd.append('pdf', new File([pdfBlob], safeName, {type:'application/pdf'}));
    // IMPORTANTE: aqui vão clausulas + condicoes + condicoesPagamento
    fd.append('dados', new Blob([JSON.stringify(dados)], {type:'application/json'}));
    fd.append('token', SAVE_TOKEN);

    const logo = document.getElementById('logo')?.files?.[0];
    if(logo) fd.append('logo', logo, logo.name);

    const resp = await fetch(SAVE_URL, {
      method:'POST',
      headers:{ 'Authorization': 'Bearer ' + SAVE_TOKEN },
      body: fd
    });
    const js = await parseJsonSafe(resp);
    return js;
  }

  // Exponho globais usadas no index.html
  window.saveWithLogo = saveWithLogo;
  window.checkCodigoDuplicado = checkCodigoDuplicado;
})();


// ===== Integração com o index.html (FINALIZAR/Salvar) =====
// Define finalizeStep5 no escopo global, usando as funções já expostas acima.
(function(){
  if (typeof window.finalizeStep5 === "function") return; // evita duplicar

  function todayYMD() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth()+1).padStart(2,'0');
    var day = String(d.getDate()).padStart(2,'0');
    return y + m + day;
  }
  function currentCode(){
    var el = document.getElementById("codigo");
    var v = (el && el.value ? el.value : "").trim();
    return v || "DOC";
  }

  window.finalizeStep5 = async function finalizeStep5(){
    try{
      if (typeof window.createPdfBlob !== "function") {
        console.error("createPdfBlob() não encontrada");
        if (typeof window.showToast === "function") showToast("Erro: função de PDF ausente.");
        return;
      }
      const blob = await window.createPdfBlob();
      const name = currentCode() + "_" + todayYMD() + ".pdf";

      let resp;
      if (typeof window.saveWithLogo === "function") {
        resp = await window.saveWithLogo(blob, name);
      } else if (typeof window.saveToServerWithFallback === "function") {
        resp = await window.saveToServerWithFallback(blob, name, false);
      } else {
        console.error("Nenhuma função de salvar encontrada.");
        if (typeof window.showToast === "function") showToast("Erro: função de salvar ausente.");
        return;
      }

      const ok = !!(resp && (resp.ok === true || resp.success === true));
      if (!ok) {
        console.error("Falha no save.php:", resp);
        if (typeof window.showToast === "function") showToast("Erro ao salvar.");
        return;
      }

      // Modal de sucesso (se existir)
      const modal = document.getElementById("successModal");
      if (modal) { modal.style.display = "flex"; return; }

      // Fallback: abrir o viewer direto
      if (typeof window.openViewerWithBlob === "function") window.openViewerWithBlob(blob);
    }catch(e){
      console.error("finalizeStep5() error:", e);
      if (typeof window.showToast === "function") showToast("Erro inesperado ao finalizar.");
    }
  };
})();
