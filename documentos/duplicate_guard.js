(function(){
  const codigoEl = document.getElementById('codigo');
  if(!codigoEl) return;

  function baseApi(){
    const p = window.__ERP_SAVE_PATCH__;
    if(p && p.SAVE_URL) return p.SAVE_URL.replace('/save.php','/');
    return '/api/gerador/';
  }

  async function checkExists(code){
    try{
      const r = await fetch(baseApi() + 'check_code.php?codigo=' + encodeURIComponent(code), {cache:'no-store'});
      const j = await r.json();
      return !!(j && j.exists);
    }catch(e){ return false; }
  }

  async function getDoc(code){
    const r = await fetch(baseApi() + 'get_doc.php?codigo=' + encodeURIComponent(code), {cache:'no-store'});
    return r.json();
  }

  function setVal(id,val){ const el=document.getElementById(id); if(el && val!=null){ el.value=val; el.dispatchEvent(new Event('input')); } }
  function fillAll(d){
    setVal('servico', d.servico);
    setVal('endereco', d.enderecoObra || d.endereco || '');
    setVal('valor', d.valor);
    setVal('valorExtenso', d.valorExtenso);
    setVal('prazo', d.prazo);
    setVal('dataExtenso', d.dataExtenso);
    setVal('clausulas', d.clausulas);
    setVal('condicoes', d.condicoes || d.condicoesPagamento);
    if(d.contratante){
      const c=d.contratante;
      setVal('nomeContratante', c.nome||c.razao);
      setVal('docContratante', c.cpfCnpj||c.cnpj||c.cpf);
      setVal('contatoContratante', c.contato||c.responsavel);
      setVal('telefoneContratante', c.telefone);
      setVal('emailContratante', c.email);
    }
    if(d.contratada){
      const c=d.contratada;
      setVal('nomeContratada', c.nome||c.razao);
      setVal('docContratada', c.cpfCnpj||c.cnpj||c.cpf);
      setVal('contatoContratada', c.contato||c.responsavel);
      setVal('telefoneContratada', c.telefone);
      setVal('emailContratada', c.email);
    }
  }

  async function abrirPdf(d){
    const token = (window.__ERP_SAVE_PATCH__ && window.__ERP_SAVE_PATCH__.SAVE_TOKEN) ? window.__ERP_SAVE_PATCH__.SAVE_TOKEN : '';
    const file = d && (d.arquivo_pdf || d.pdf_file || d.file);
    if(!file){ alert('PDF não encontrado para este código.'); return; }
    const href = baseApi() + 'pdf.php?f=' + encodeURIComponent(file) + (token?('&token='+encodeURIComponent(token)):'');
    window.open(href,'_blank');
  }

  codigoEl.addEventListener('blur', async function(){
    const code = (codigoEl.value || '').trim();
    if(!code) return;
    const exists = await checkExists(code);
    if(!exists) return;
    const escolhaImprimir = window.confirm('DOCUMENTO JÁ CADASTRADO.\n\nOK = IMPRIMIR PDF\nCancelar = ATUALIZAR INFORMAÇÕES');
    try{
      const j = await getDoc(code);
      if(!(j && j.success && j.dados)) throw new Error('Documento não encontrado.');
      if(escolhaImprimir){
        await abrirPdf(j.dados);
      }else{
        fillAll(j.dados);
        if(typeof window.goTo==='function'){ window.goTo(2); }
        else if(typeof window.go==='function'){ window.go(2); }
      }
    }catch(e){
      alert('Falha ao processar o documento existente.');
    }
  });
})();