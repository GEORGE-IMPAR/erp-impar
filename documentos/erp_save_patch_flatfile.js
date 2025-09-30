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

  // ---- Gancho ROBUSTO no finalizeStep5 -------------------------------
  function installHook(attempt = 0) {
    // já instalado?
    if (
      typeof window.finalizeStep5 === 'function' &&
      (window.finalizeStep5 + '').includes('saveToServer')
    ) {
      return; // nada a fazer
    }

    if (typeof window.finalizeStep5 !== 'function') {
      // ainda não existe: espera um pouco e tenta de novo (até ~10s)
      if (attempt > 50) return warn('finalizeStep5 não apareceu (desistindo)');
      return setTimeout(() => installHook(attempt + 1), 200);
    }

    const orig = window.finalizeStep5;

    window.finalizeStep5 = async function () {
      // evita reentrância (duplo clique)
      if (window.__ERP_PATCH_SAVING) {
        return typeof orig === 'function'
          ? orig.apply(this, arguments)
          : undefined;
      }

      window.__ERP_PATCH_SAVING = true;
      try {
        if (typeof window.createPdfBlob === 'function') {
          const blob = await window.createPdfBlob();
          const name = window.__pdfName || uniquePdfName();
          const out = await parseJsonSafe(resp); // usa a função colada no index.html
          log('save result', out);
          if (out?.ok && out.pdfUrl) {
            window.__pdfSavedUrl = out.pdfUrl; // opcional: guardar para uso na UI
          }
        } else {
          warn('createPdfBlob não disponível');
        }
      } catch (e) {
        err('erro ao salvar', e);
      } finally {
        window.__ERP_PATCH_SAVING = false;
      }

      // preserva comportamento original da tela 5
      return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
    };

    log('finalizeStep5 hook instalado');
  }

  installHook();
})();
