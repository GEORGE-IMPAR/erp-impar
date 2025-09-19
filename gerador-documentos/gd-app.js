const $ = (s, r=document)=>r.querySelector(s);

const stateKeys = [
  'docType','cliente','cnpj','contato','emailCom','fone','obra',
  'escopo','valor','validade','prazo','pagto','obs'
];

function readState(){
  const o={};
  stateKeys.forEach(k => o[k] = $(`#${k}`)?.value?.trim() || '');
  return o;
}

function saveDraft(){
  localStorage.setItem('gdDraft', JSON.stringify(readState()));
}

function loadDraft(){
  const raw = localStorage.getItem('gdDraft');
  if(!raw) return;
  try{
    const d = JSON.parse(raw);
    stateKeys.forEach(k=>{
      const el = $(`#${k}`);
      if(el && d[k] !== undefined) el.value = d[k];
    });
  }catch{}
}

function ensureLogged(){
  const raw = localStorage.getItem('gdUsuarioLogado');
  if(!raw){
    Swal.fire('Sessão expirada','Faça login novamente.','info').then(()=>location.href='login.html');
    return null;
  }
  try{
    return JSON.parse(raw);
  }catch{
    localStorage.removeItem('gdUsuarioLogado');
    location.href='login.html';
    return null;
  }
}

function formatBRL(v){
  if(!v) return '';
  const num = Number(v);
  if(Number.isNaN(num)) return v;
  return num.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

function renderPreview(user){
  const s = readState();
  const hoje = new Date().toLocaleDateString('pt-BR');
  const titulo = s.docType === 'contrato' ? 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS'
                : s.docType === 'os' ? 'ORDEM DE SERVIÇO'
                : 'PROPOSTA COMERCIAL';

  $('#preview').innerHTML = `
    <h1 style="color:#c7d2fe">${titulo}</h1>
    <p><strong>Data:</strong> ${hoje}</p>

    <h2 style="margin-top:14px;color:#93c5fd">Dados do Cliente</h2>
    <table>
      <tr><th>Cliente</th><td>${s.cliente || '-'}</td></tr>
      <tr><th>CNPJ/CPF</th><td>${s.cnpj || '-'}</td></tr>
      <tr><th>Contato</th><td>${s.contato || '-'}</td></tr>
      <tr><th>E-mail</th><td>${s.emailCom || '-'}</td></tr>
      <tr><th>Telefone</th><td>${s.fone || '-'}</td></tr>
      <tr><th>Obra/Projeto</th><td>${s.obra || '-'}</td></tr>
    </table>

    <h2 style="margin-top:14px;color:#93c5fd">Escopo</h2>
    <div>${(s.escopo || '-').replace(/\n/g,'<br>')}</div>

    <h2 style="margin-top:14px;color:#93c5fd">Condições Comerciais</h2>
    <table>
      <tr><th>Valor</th><td>${formatBRL(s.valor) || '-'}</td></tr>
      <tr><th>Validade</th><td>${s.validade || '-'}</td></tr>
      <tr><th>Prazo Execução</th><td>${s.prazo || '-'}</td></tr>
      <tr><th>Pagamento</th><td>${s.pagto || '-'}</td></tr>
    </table>

    <h2 style="margin-top:14px;color:#93c5fd">Observações</h2>
    <div>${(s.obs || '-').replace(/\n/g,'<br>')}</div>

    <hr style="border-color:#1b254a; margin:18px 0">
    <div style="font-size:13px;opacity:.9">
      <strong>Responsável Ímpar:</strong> ${user?.Nome || '-'} &lt;${user?.Email || '-'}&gt;
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', ()=>{
  const user = ensureLogged();
  if(!user) return;

  // header user
  $('#gdUserPill').textContent = `${user.Nome} • ${user.Email}`;

  // load draft
  loadDraft();

  // autosave ao sair dos campos
  stateKeys.forEach(k => {
    const el = $(`#${k}`);
    if(el) el.addEventListener('change', saveDraft);
  });

  // ações
  $('#btnPreview').addEventListener('click', ()=>{
    renderPreview(user);
    Swal.fire({icon:'success', title:'Preview atualizado', timer:1200, showConfirmButton:false});
  });

  $('#btnPrint').addEventListener('click', ()=>{
    // Renderiza antes, garante que o preview existe no print
    renderPreview(user);
    setTimeout(()=>window.print(), 60);
  });

  $('#btnCopy').addEventListener('click', ()=>{
    renderPreview(user);
    const html = $('#preview').innerHTML;
    navigator.clipboard.writeText(html).then(()=>{
      Swal.fire({icon:'success', title:'HTML copiado!', timer:1200, showConfirmButton:false});
    }).catch(()=>{
      Swal.fire('Erro','Não foi possível copiar.','error');
    });
  });

  $('#btnClear').addEventListener('click', ()=>{
    if(!confirm('Limpar todos os campos?')) return;
    stateKeys.forEach(k=>{ const el=$(`#${k}`); if(el) el.value='';});
    localStorage.removeItem('gdDraft');
    $('#preview').innerHTML = `<h2>Preencha os dados e clique em <em>Atualizar Preview</em>.</h2>`;
  });

  $('#btnLogout').addEventListener('click', ()=>{
    localStorage.removeItem('gdUsuarioLogado');
    location.href='login.html';
  });

  // render inicial
  renderPreview(user);
});
