// ERP IMPAR — Patch de salvamento (flat-file) v1.1
// Incluir NO FINAL do <body> do documentos/index.html:
//   <script src="/documentos/erp_save_patch_flatfile.js?v=6"></script>

(function () {
  'use strict';

  // ====== CONFIG DO BACKEND ======
  const SAVE_URL   = 'https://api.erpimpar.com.br/gerador/save.php';
  const LIST_URL   = 'https://api.erpimpar.com.br/gerador/list.php';
  const SAVE_TOKEN = '8cce9abb2fd53b1cceaa93b9cecfd5384b2ea6fb931e8882c543cbd7d3663b77';
  // =================================

  // (opcional) ligar logs do patch
  const DEBUG = false;
  const log  = (...a) => DEBUG && console.log('[PATCH]', ...a);
  const warn = (...a) => console.warn('[PATCH]', ...a);
  const err  = (...a) => console.error('[PATCH]', ...a);

  function blobToFile(blob, name) {
    return new File([blob], name, { type: 'application/pdf' });
  }

  // Coleta padrão dos dados do formulário (caso o app não forneça window.collectFormData)
  function defaultCollectFormData() {
    const get = (id) => (document.getElementById(id)?.value || '').trim();
    const u = JSON.parse(localStorage.getItem('impar_user') || 'null');
    const end = (p) => {
      const lograd = get('logradouro' + p),
        num = get('numero' + p),
        comp = get('complemento' + p),
        bai = get('bairro' + p),
        cid = get('cidade' + p),
        uf = get('uf' + p),
        cep = get('cep' + p);
      return `${lograd}, ${num}${comp ? ' - ' + comp : ''} — ${bai} — ${cid}/${uf} — CEP ${cep}`;
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
        email: get('emailContratante'),
      },
      contratada: {
        nome: get('nomeContratada'),
        cpfCnpj: get('docContratada'),
        endereco: end('Contratada'),
        contato: get('contatoContratada'),
        telefone: get('telefoneContratada'),
        email: get('emailContratada'),
      },
      valor: get('valor'),
      valorExtenso: get('valorExtenso'),
      prazo: get('prazo'),
      dataExtenso: get('dataExtenso'),
      operador: u ? { nome: u.Nome, email: u.Email } : {},
    };
  }

  const collectFormData =
    typeof window.collectFormData === 'function'
      ? window.collectFormData
      : defaultCollectFormData;

  async function saveToServer(pdfBlob, pdfName) {
    const fd = new FormData();
    fd.append('pdf', blobToFile(pdfBlob, pdfName));
    fd.append('dados', JSON.stringify(collectFormData()));
    fd.append('token', SAVE_TOKEN);

    const resp = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + SAVE_TOKEN },
      body: fd,
    });

    let out;
    try {
      out = await resp.json();
    } catch (e) {
      out = { ok: false, error: 'invalid_json', httpStatus: resp.status };
    }
    return out;
  }

  // Exponho utilidades (ex.: para consulta / testes no console)
  window.__ERP_SAVE_PATCH__ = { SAVE_URL, LIST_URL, SAVE_TOKEN, saveToServer };

  // Utilitário para nome único do PDF
  function uniquePdfName() {
    const code =
      (document.getElementById('codigo')?.value || 'DOC').replace(/\W+/g, '') ||
      'DOC';
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14); // yyyymmddhhmmss
    return `${code}_${ts}.pdf`;
  }

  (function(){
  // helpers locais (sem depender de parseJsonSafe global)
  async function parseResponseSafe(res){
    const raw = await res.text();
    let json = null;
    try { json = JSON.parse(raw); } catch(_) {}
    return { ok: res.ok, status: res.status, json, raw };
  }
  function uniquePdfName(prefix){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${(prefix||'DOC').replace(/[^a-zA-Z0-9-_]/g,'_')}_${y}${m}${day}.pdf`;
  }
  function currentCode(){
    try { return (document.getElementById('codigo').value || '').trim() || 'DOC'; } catch { return 'DOC'; }
  }

  function installHook(attempt = 0){
    // já instalado?
    if (typeof window.finalizeStep5 === 'function' &&
        (window.finalizeStep5 + '').includes('__ERP_PATCH_INSTALLED__')) {
      return;
    }

    if (typeof window.finalizeStep5 !== 'function'){
      if (attempt > 50) { console.warn('[PATCH] finalizeStep5 não apareceu'); return; }
      return setTimeout(()=>installHook(attempt+1), 200);
    }

    const orig = window.finalizeStep5;

    window.finalizeStep5 = async function __ERP_PATCH_INSTALLED__(){
      // evita duplo clique
      if (window.__ERP_PATCH_SAVING) {
        return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      }
      window.__ERP_PATCH_SAVING = true;

      try {
        // 1) Gera PDF (usa seu gerador já existente)
        if (typeof window.createPdfBlob !== 'function') {
          console.warn('[PATCH] createPdfBlob não disponível');
          return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
        }

        const pdfBlob = await window.createPdfBlob();
        const pdfName = window.__pdfName || uniquePdfName(currentCode());

        // cache na UI
        window.__pdfBlob = pdfBlob;
        if (window.__pdfUrl) try { URL.revokeObjectURL(window.__pdfUrl); } catch(_) {}
        window.__pdfUrl = URL.createObjectURL(pdfBlob);
        window.__pdfName = pdfName;

        // 2) Dados do formulário
        const dados =
          (typeof window.collectFormData === 'function')
            ? window.collectFormData()
            : { codigo: currentCode() };

        // 3) Monta FormData (inclui logo se houver)
        const fd = new FormData();
        fd.append('pdf', new File([pdfBlob], pdfName, { type:'application/pdf' }));
        fd.append('dados', new Blob([JSON.stringify(dados)], { type:'application/json' }));
        const logoFile = document.getElementById('logo')?.files?.[0];
        if (logoFile) fd.append('logo', logoFile, logoFile.name);

        // 4) Envia para o backend
        // Usa as suas constantes já existentes no arquivo:
        //   const SAVE_URL, const SAVE_TOKEN
        const resp = await fetch(SAVE_URL, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + SAVE_TOKEN },
          body: fd
        });
        const { ok, status, json, raw } = await parseResponseSafe(resp);

        if (!ok || !json || (json.ok !== true && json.success !== true)) {
          const msg = (json && (json.error || json.message)) ||
                      `Falha (${status}). Resposta: ${String(raw).slice(0,160)}...`;
          console.error('[PATCH] erro ao salvar', msg);
          if (typeof window.showToast === 'function') window.showToast('Gerado localmente. Falha ao salvar no ERP ❗');
        } else {
          // sucesso
          if (json.pdfUrl) window.__pdfSavedUrl = json.pdfUrl;
          if (typeof window.showToast === 'function') window.showToast('Registro salvo no ERP ✅');
        }

        // 5) Abre modal de sucesso (mesmo comportamento do original)
        const modal = document.getElementById('successModal');
        if (modal) modal.style.display = 'flex';

      } catch (e) {
        console.error('[PATCH] erro inesperado no finalizeStep5', e);
        if (typeof window.showToast === 'function') window.showToast('Gerado localmente. Falha ao salvar no ERP ❗');
        const modal = document.getElementById('successModal');
        if (modal) modal.style.display = 'flex';
      } finally {
        window.__ERP_PATCH_SAVING = false;
      }

      // mantém o que o finalizeStep5 original faria (se preciso)
      return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
    };

    console.log('[PATCH] finalizeStep5 hook instalado');
  }

  installHook();
})();