// /gerador-documentos/script_contratos.js
const $ = sel => document.querySelector(sel);

function openModal(html, { showCancel = true, onOk = null } = {}) {
  const dlg = $('#modal');
  $('#modalBody').innerHTML = html;
  $('#modalCancel').style.display = showCancel ? 'inline-flex' : 'none';

  return new Promise(resolve => {
    dlg.showModal();
    $('#modalCancel').onclick = () => { dlg.close(); resolve(false); };
    $('#modalOk').onclick = () => { dlg.close(); resolve(true); onOk && onOk(); };
  });
}

// Salva/recupera rascunho no localStorage por código
const draftKey = code => `GD_CONTRATO_${(code||'').trim().toUpperCase()}`;

function collectForm() {
  return {
    codigo: $('#codigo').value.trim(),
    cliente_nome: $('#cliente_nome').value.trim(),
    cliente_cnpj: $('#cliente_cnpj').value.trim(),
    cliente_endereco: $('#cliente_endereco').value.trim(),
    cliente_contato: $('#cliente_contato').value.trim(),
    servico: $('#servico').value.trim(),
    local_execucao: $('#local_execucao').value.trim(),
    cond_pagamento: $('#cond_pagamento').value.trim(),
    valor: $('#valor').value.trim(),
    prazo: $('#prazo').value.trim(),
    gerado_em: new Date().toISOString()
  };
}

function fillForm(data) {
  for (const k in data) {
    const el = document.getElementById(k);
    if (el) el.value = data[k];
  }
}

async function fetchTemplate(path) {
  const r = await fetch(path + `?t=` + Date.now(), { cache: 'no-store' });
  return r.text();
}

function renderTemplate(tpl, data) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => (data[key] ?? ''));
}

function abrirEmNovaAba(html) {
  const win = window.open('', '_blank');
  win.document.open();
  win.document.write(html);
  win.document.close();
}

document.addEventListener('DOMContentLoaded', () => {
  const btnConsultar = $('#btnConsultar');
  const btnSalvar = $('#btnSalvar');
  const btnGerar = $('#btnGerar');

  btnConsultar?.addEventListener('click', async () => {
    const codigo = $('#codigo').value.trim();
    if (!codigo) {
      alert('Informe o código do contrato para consultar.');
      return;
    }
    const draft = localStorage.getItem(draftKey(codigo));
    if (draft) {
      const data = JSON.parse(draft);
      fillForm(data);
      await openModal(`Rascunho encontrado para o código <b>${codigo}</b> e carregado no formulário.`, { showCancel:false });
    } else {
      const ok = await openModal(`
        <div style="text-align:center">
          <div style="font-size:42px">⚠️</div>
          <h3>Contrato não encontrado</h3>
          <p>Deseja iniciar um novo cadastro com este código?</p>
        </div>
      `);
      if (!ok) return;
      // apenas segue; usuário vai preencher e salvar
    }
  });

  btnSalvar?.addEventListener('click', async () => {
    const data = collectForm();
    if (!data.codigo) return alert('Informe um código para salvar o rascunho.');
    localStorage.setItem(draftKey(data.codigo), JSON.stringify(data));
    await openModal(`Rascunho salvo com sucesso para o código <b>${data.codigo}</b>.`, { showCancel:false });
  });

  btnGerar?.addEventListener('click', async () => {
    const data = collectForm();
    // Validação mínima
    if (!data.codigo || !data.cliente_nome || !data.servico) {
      alert('Preencha ao menos: Código, Cliente e Serviço.');
      return;
    }
    // salva rascunho rápido
    localStorage.setItem(draftKey(data.codigo), JSON.stringify(data));

    // carrega template e renderiza
    const tpl = await fetchTemplate('modelos/contrato-servico.html');
    const doc = renderTemplate(tpl, data);

    // abre nova aba (usuário pode imprimir em PDF ou salvar como .html / abrir no Word)
    abrirEmNovaAba(doc);
  });
});
