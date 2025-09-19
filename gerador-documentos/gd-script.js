// gd-script.js — isolado do ERP de Materiais

(function(){
  const userP = document.getElementById('gdUser');
  const gdUser = JSON.parse(localStorage.getItem('gd_usuario') || 'null');
  if(userP && gdUser){
    userP.textContent = `${gdUser.nome} — ${gdUser.email}`;
  }

  // Helpers de máscara simples
  const onlyDigits = (s)=> (s||'').replace(/\D+/g,'');
  function maskCNPJ(v){
    v = onlyDigits(v).slice(0,14);
    return v
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  function maskPhone(v){
    v = onlyDigits(v).slice(0,11);
    if(v.length<=10){
      return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    }
    return v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
  }
  function maskMoneyBR(v){
    // digitos → reais com vírgula
    const d = onlyDigits(v);
    if(!d) return '';
    const int = d.slice(0, d.length-2) || '0';
    const dec = d.slice(-2).padStart(2,'0');
    return (parseInt(int,10)).toLocaleString('pt-BR') + ',' + dec;
  }

  // Liga máscaras nos campos
  const cnpjCli = document.getElementById('gdClienteCNPJ');
  const cnpjCon = document.getElementById('gdContratadaCNPJ');
  const telCli  = document.getElementById('gdClienteTel');
  const valor   = document.getElementById('gdValor');
  [cnpjCli, cnpjCon].forEach(el => el && el.addEventListener('input', e => e.target.value = maskCNPJ(e.target.value)));
  telCli && telCli.addEventListener('input', e => e.target.value = maskPhone(e.target.value));
  if(valor){
    valor.addEventListener('input', e => e.target.value = maskMoneyBR(e.target.value));
    valor.addEventListener('blur', e => { if(!e.target.value) e.target.value = '0,00'; });
  }

  // Preview
  const modal = document.getElementById('gdModal');
  const prevArea = document.getElementById('gdPreviewArea');
  const openPrev = document.getElementById('gdPreview');
  const closePrev = document.getElementById('gdClose');
  const exportBtn = document.getElementById('gdExport');
  function openModal(){ modal.removeAttribute('hidden'); }
  function closeModal(){ modal.setAttribute('hidden',''); }

  closePrev && closePrev.addEventListener('click', closeModal);
  modal && modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });

  function getForm(){
    const pick = id => (document.getElementById(id)?.value||'').trim();
    return {
      codigo: pick('gdCodigo'),
      cliente: pick('gdCliente'),
      clienteCNPJ: pick('gdClienteCNPJ'),
      clienteEnd: pick('gdClienteEnd'),
      clienteContato: pick('gdClienteContato'),
      clienteTel: pick('gdClienteTel'),
      contratada: pick('gdContratada'),
      contratadaCNPJ: pick('gdContratadaCNPJ'),
      contratadaEnd: pick('gdContratadaEnd'),
      escopo: pick('gdEscopo'),
      valor: pick('gdValor'),
      condPag: pick('gdCondPag'),
      prazoExec: pick('gdPrazoExec'),
      garantia: pick('gdGarantia'),
    };
  }

  function validate(f){
    const req = [
      ['codigo','Código do Projeto/Obra'],
      ['cliente','Razão Social do Cliente'],
      ['clienteCNPJ','CNPJ do Cliente'],
      ['clienteEnd','Endereço do Cliente'],
      ['clienteContato','Contato do Cliente'],
      ['clienteTel','Telefone do Cliente'],
      ['contratada','Razão Social da Contratada'],
      ['contratadaCNPJ','CNPJ da Contratada'],
      ['contratadaEnd','Endereço da Contratada'],
      ['escopo','Escopo/Descrição'],
      ['valor','Valor'],
      ['condPag','Condição de Pagamento'],
      ['prazoExec','Prazo de Execução']
    ];
    for(const [k,label] of req){
      if(!f[k]) return `${label} é obrigatório.`;
    }
    if(onlyDigits(f.clienteCNPJ).length!==14) return 'CNPJ do Cliente inválido.';
    if(onlyDigits(f.contratadaCNPJ).length!==14) return 'CNPJ da Contratada inválido.';
    const tel = onlyDigits(f.clienteTel);
    if(!(tel.length===10 || tel.length===11)) return 'Telefone do Cliente inválido.';
    return null;
  }

  function buildPreviewHTML(f){
    return `
      <h3>Contrato — ${f.codigo}</h3>
      <table>
        <tr><th style="width:240px">Código do Projeto/Obra</th><td>${f.codigo}</td></tr>
        <tr><th>Cliente</th><td>${f.cliente} — CNPJ ${f.clienteCNPJ}</td></tr>
        <tr><th>Endereço (Cliente)</th><td>${f.clienteEnd}</td></tr>
        <tr><th>Contato / Telefone</th><td>${f.clienteContato} — ${f.clienteTel}</td></tr>
        <tr><th>Contratada</th><td>${f.contratada} — CNPJ ${f.contratadaCNPJ}</td></tr>
        <tr><th>Endereço (Contratada)</th><td>${f.contratadaEnd}</td></tr>
        <tr><th>Escopo</th><td>${f.escopo.replace(/\n/g,'<br/>')}</td></tr>
        <tr><th>Valor</th><td>R$ ${f.valor}</td></tr>
        <tr><th>Condição de Pagamento</th><td>${f.condPag}</td></tr>
        <tr><th>Prazo de Execução</th><td>${f.prazoExec}</td></tr>
        <tr><th>Garantia</th><td>${f.garantia || '—'}</td></tr>
      </table>
    `;
  }

  // Abrir preview
  openPrev && openPrev.addEventListener('click', ()=>{
    const f = getForm();
    const err = validate(f);
    if(err){ Swal.fire("Atenção", err, "warning"); return; }
    prevArea.innerHTML = buildPreviewHTML(f);
    openModal();
  });

  // Gerar contrato (por enquanto só valida + mostra preview; export/assinatura podemos plugar depois)
  const form = document.getElementById('gdForm');
  form && form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const f = getForm();
    const err = validate(f);
    if(err){ Swal.fire("Atenção", err, "warning"); return; }
    prevArea.innerHTML = buildPreviewHTML(f);
    openModal();
    Swal.fire({icon:"success", title:"Contrato pronto para exportar!", timer:1800, showConfirmButton:false});
  });

  // Exportar PDF (placeholder para próxima etapa)
  exportBtn && exportBtn.addEventListener('click', ()=>{
    Swal.fire("Exportação","Vamos plugar jsPDF/html2canvas na próxima etapa para sair em PDF no padrão da empresa.","info");
  });
})();
