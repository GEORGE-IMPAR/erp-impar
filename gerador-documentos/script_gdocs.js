console.log("🧩 Gerador GDOCs carregado");

// sessão
const usrSpan = document.getElementById("usr");
const usr = JSON.parse(localStorage.getItem("gdocs_usuario") || "null");
if(!usr){
  Swal.fire("Sessão expirada","Faça login novamente.","warning").then(()=>location.href="./login.html");
} else {
  usrSpan.textContent = `${usr.Nome} — ${usr.Email}`;
}

// helpers
const $ = sel => document.querySelector(sel);
const stepper = $("#stepper");
const chips = [...stepper.querySelectorAll(".chip")];
const showStep = (n) => {
  chips.forEach(c => c.classList.toggle("active", +c.dataset.step===n));
  document.querySelectorAll(".form-step").forEach(fs => {
    fs.hidden = +fs.dataset.step!==n;
  });
};

let step = 1;
showStep(step);

// campos
const fields = {
  codigo: $("#codigo"),
  servico: $("#servico"),
  endereco: $("#endereco"),
  nomeContratante: $("#nomeContratante"),
  cnpjContratante: $("#cnpjContratante"),
  contatoContratante: $("#contatoContratante"),
  dadosContratante: $("#dadosContratante"),
  nomeContratada: $("#nomeContratada"),
  cnpjContratada: $("#cnpjContratada"),
  contatoContratada: $("#contatoContratada"),
  dadosContratada: $("#dadosContratada"),
  clausulas: $("#clausulas"),
  prazo: $("#prazo"),
  valor: $("#valor"),
  valorExtenso: $("#valorExtenso"),
  condicoesPagamento: $("#condicoesPagamento"),
  logoEmpresa: $("#logoEmpresa"),
};

// armazenamento local (simples)
const key = code => `gdocs:${code.toUpperCase().trim()}`;
const save = code => {
  if(!code) return;
  const data = {};
  for(const k in fields){ if(k!=="codigo") data[k]=fields[k].value||""; }
  localStorage.setItem(key(code), JSON.stringify(data));
};
const load = code => {
  const raw = localStorage.getItem(key(code));
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch{ return null; }
};
const fill = data => {
  for(const k in fields){
    if(k==="codigo") continue;
    if(k in data) fields[k].value = data[k] || "";
  }
};

// navegação steps
$("#avancar1").onclick = () => {
  if(!fields.servico.value.trim() || !fields.endereco.value.trim()){
    return Swal.fire("Atenção","Preencha Serviço e Endereço.","warning");
  }
  save(fields.codigo.value);
  showStep(++step);
};

$("#avancar2").onclick = () => {
  if(!fields.nomeContratante.value.trim()){
    return Swal.fire("Atenção","Informe o Nome do Contratante.","warning");
  }
  save(fields.codigo.value);
  showStep(++step);
};

$("#avancar3").onclick = () => {
  if(!fields.nomeContratada.value.trim()){
    return Swal.fire("Atenção","Informe o Nome da Contratada.","warning");
  }
  save(fields.codigo.value);
  showStep(++step);
};

$("#avancar4").onclick = () => { save(fields.codigo.value); showStep(++step); };

document.querySelectorAll("[data-back]").forEach(b=>{
  b.addEventListener("click", e => {
    const to = +e.currentTarget.dataset.back;
    step = to; showStep(step);
  });
});

// ações topo
$("#btnNovo").onclick = () => {
  const gen = `AC${Date.now().toString().slice(-6)}`;
  fields.codigo.value = gen;
  for(const k in fields){ if(k!=="codigo") fields[k].value=""; }
  step = 1; showStep(step);
  Swal.fire("Novo","Código gerado: <b>"+gen+"</b>","success");
};

$("#btnBuscar").onclick = () => {
  const code = fields.codigo.value.trim();
  if(!code) return Swal.fire("Atenção","Informe um código.","warning");

  const data = load(code);
  if(!data){
    Swal.fire({
      icon:"question",
      title:"Documento não encontrado",
      text:"Deseja cadastrar um novo com este código?",
      showCancelButton:true,
      confirmButtonText:"Sim",
      cancelButtonText:"Não"
    }).then(res=>{
      if(res.isConfirmed){
        for(const k in fields){ if(k!=="codigo") fields[k].value=""; }
        step=1; showStep(step);
        save(code);
      }
    });
    return;
  }
  fill(data);
  step=1; showStep(step);
  Swal.fire("OK","Dados carregados para o código <b>"+code+"</b>.","success");
};

// concluir & gerar (placeholders — aguardam templates)
$("#concluir").onclick = () => {
  if(!fields.codigo.value.trim()) return Swal.fire("Atenção","Informe o código.","warning");
  save(fields.codigo.value);
  Swal.fire("Concluído","Dados salvos. Agora você pode gerar os documentos.","success");
};
$("#btnEditar").onclick = ()=> Swal.fire("Editar","Você pode alterar qualquer campo e clicar em Concluir.","info");
$("#btnPPT").onclick = ()=> Swal.fire("Em breve","Geração do PPT conforme template.","info");
$("#btnWORD").onclick = ()=> Swal.fire("Em breve","Geração do Contrato (Word).","info");
$("#btnXLSX").onclick = ()=> Swal.fire("Em breve","Geração da Ordem de Serviço (Excel).","info");
