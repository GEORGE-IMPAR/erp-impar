// ERP IMPAR — Patch de salvamento (flat-file) v1
// Incluir após os scripts do documentos/index.html:
//   <script src="documentos/erp_save_patch_flatfile.js?v=5"></script>

(function(){
  // ====== CONFIG DO BACKEND ======
  const SAVE_URL   = 'https://api.erpimpar.com.br/gerador/save.php';
  const LIST_URL   = 'https://api.erpimpar.com.br/gerador/list.php';
  const SAVE_TOKEN = '8cce9abb2fd53b1cceaa93b9cecfd5384b2ea6fb931e8882c543cbd7d3663b77';
  // =================================

  function blobToFile(blob, name){ return new File([blob], name, { type:'application/pdf' }); }

  function defaultCollectFormData(){
    const get = (id) => (document.getElementById(id)?.value || '').trim();
    const u = JSON.parse(localStorage.getItem('impar_user') || 'null');
    const end = (p) => {
      const log = get('logradouro' + p), num = get('numero' + p),
            comp = get('complemento' + p), bai = get('bairro' + p),
            cid = get('cidade' + p), uf = get('uf' + p), cep = get('cep' + p);
      return `${log}, ${num}${comp?(' - '+comp):''} — ${bai} — ${cid}/${uf} — CEP ${cep}`;
    };
    return {
      codigo: get('codigo'),
      servico: get('servico'),
      enderecoObra: get('endereco'),
      contratante: {
        nome: get('nomeContratante'),
        cpfCnpj: get('docContratante'),
        endereco: end('Contratante'),
        contato: get('contatoContratante'),
        telefone: get('telefoneContratante'),
        email: get('emailContratante')
      },
      contratada: {
        nome: get('nomeContratada'),
        cpfCnpj: get('docContratada'),
        endereco: end('Contratada'),
        contato: get('contatoContratada'),
        telefone: get('telefoneContratada'),
        email: get('emailContratada')
      },
      valor: get('valor'),
      valorExtenso: get('valorExtenso'),
      prazo: get('prazo'),
      dataExtenso: get('dataExtenso'),
      operador: u ? { nome: u.Nome, email: u.Email } : {}
    };
  }

  const collectFormData = (typeof window.collectFormData === 'function')
    ? window.collectFormData
    : defaultCollectFormData;

  async function saveToServer(pdfBlob, pdfName){
    const fd = new FormData();
    fd.append('pdf', blobToFile(pdfBlob, pdfName));
    fd.append('dados', JSON.stringify(collectFormData()));
    fd.append('token', SAVE_TOKEN);
    const resp = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SAVE_TOKEN },
      body: fd
    });
    return resp.json();
  }

  // Exponho utilidades caso queira usar em outra parte (ex.: consulta)
  window.__ERP_SAVE_PATCH__ = { SAVE_URL, LIST_URL, SAVE_TOKEN, saveToServer };

  // ---- Gancho ROBUSTO no finalizeStep5 -------------------------------
  (function installHook() {
    // já instalado?
    if (typeof window.finalizeStep5 === 'function'
        && (window.finalizeStep5 + '').includes('saveToServer')) {
      return; // nada a fazer
    }

    if (typeof window.finalizeStep5 !== 'function') {
      // ainda não existe: espera um pouco e tenta de novo
      return setTimeout(installHook, 200);
    }

    const orig = window.finalizeStep5;

    window.finalizeStep5 = async function () {
      try {
        if (typeof window.createPdfBlob === 'function') {
          const blob = await window.createPdfBlob();

          const codigo = (document.getElementById('codigo')?.value || 'DOC').replace(/\W+/g, '');
          const stamp  = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0,14); // yyyymmddhhmmss
          const name   = `${codigo || 'DOC'}_${stamp}.pdf`;

          const out = await saveToServer(blob, name);
          console.log('[PATCH] save result', out);
        } else {
          console.warn('[PATCH] createPdfBlob não disponível');
        }
      } catch (e) {
        console.error('[PATCH] erro ao salvar', e);
      }
      return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
    };

    console.log('[PATCH] finalizeStep5 hook instalado');
  })();
})();
