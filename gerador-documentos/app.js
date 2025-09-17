// Utilidades isoladas do módulo "Gerador de documentos"
const GD = (() => {
  const LS_KEY_USER = "gd_usuarioLogado";
  const LS_PREFIX   = "gd_contrato:"; // + codigo

  const qs  = (sel,root=document)=>root.querySelector(sel);
  const qsa = (sel,root=document)=>[...root.querySelectorAll(sel)];

  const saveUser = (u)=> localStorage.setItem(LS_KEY_USER, JSON.stringify(u));
  const getUser  = ()=> {
    try{ return JSON.parse(localStorage.getItem(LS_KEY_USER) || "null"); }
    catch{ return null }
  };
  const logout = ()=> localStorage.removeItem(LS_KEY_USER);

  const readContrato = (codigo) => {
    try{ return JSON.parse(localStorage.getItem(LS_PREFIX+codigo) || "null"); }
    catch{ return null }
  };
  const writeContrato = (codigo, data) => {
    localStorage.setItem(LS_PREFIX+codigo, JSON.stringify(data));
  };

  const ensureUserOnPage = () => {
    const u = getUser();
    const tag = qs("#user-info");
    if(u && tag){ tag.textContent = `${u.Nome} — ${u.Email}`; }
    if(!u){
      // volta para login do módulo
      const here = location.pathname.split("/").pop();
      if(here !== "login.html"){ location.href = "login.html"; }
    }
  };

  const showModal = (id)=> {
    const el = qs(id);
    if(!el) return;
    el.style.display = "flex";
  };
  const hideModals = ()=> qsa(".modal-backdrop").forEach(m => m.style.display = "none");

  return {
    qs,qsa, saveUser, getUser, logout,
    readContrato, writeContrato, ensureUserOnPage,
    showModal, hideModals
  };
})();

// ------ LOGIN PAGE ------
async function gdHandleLoginPage(){
  const form = GD.qs("#loginForm");
  if(!form) return;

  // carrega usuários do módulo
  let users=[];
  try{
    const resp = await fetch("usuarios.json",{cache:"no-cache"});
    users = await resp.json();
  }catch(e){
    alert("Falha ao carregar usuários do módulo.");
    return;
  }

  // popular select
  const sel = GD.qs("#usuario");
  users.forEach(u=>{
    const opt = document.createElement("option");
    opt.value = u.Email; opt.textContent = u.Nome;
    sel.appendChild(opt);
  });

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const email = GD.qs("#usuario").value.trim().toLowerCase();
    const senha = GD.qs("#senha").value;

    const ok = users.find(u => u.Email.toLowerCase()===email && u.Senha===senha);
    if(ok){
      GD.saveUser(ok);
      GD.qs("#msg").textContent = "";
      location.href = "menu.html";
    }else{
      GD.qs("#msg").textContent = "Usuário ou senha inválidos.";
    }
  });
}

// ------ MENU PAGE ------
function gdHandleMenuPage(){
  if(!GD.qs("#menuPage")) return;
  GD.ensureUserOnPage();

  GD.qs("#btnSair")?.addEventListener("click", ()=>{
    GD.logout(); location.href = "login.html";
  });
}

// ------ WIZARD COMUM (Proposta/Contrato/OS) ------
function gdHandleWizard(kind){ // "proposta" | "contrato" | "ordem"
  const page = GD.qs("#wizardPage");
  if(!page) return;
  GD.ensureUserOnPage();

  const codigoInput = GD.qs("#codigo");
  const stepWraps   = GD.qsa(".step-wrap");
  const btnPrev     = GD.qs("#btnPrev");
  const btnNext     = GD.qs("#btnNext");
  const btnFinish   = GD.qs("#btnFinish");
  const stepLabel   = GD.qs("#stepLabel");

  let current = 0;
  let codigo  = "";

  // troca de passo
  const goto = (i)=>{
    current = Math.max(0, Math.min(stepWraps.length-1, i));
    stepWraps.forEach((w,idx)=> w.style.display = (idx===current?"block":"none"));
    stepLabel.textContent = `${current+1} / ${stepWraps.length}`;
    btnPrev.style.visibility   = current===0 ? "hidden" : "visible";
    btnNext.style.display      = current===stepWraps.length-1 ? "none" : "inline-flex";
    btnFinish.style.display    = current===stepWraps.length-1 ? "inline-flex" : "none";
  };

  // carrega contrato quando digita código e sai do campo
  codigoInput.addEventListener("change", ()=>{
    codigo = codigoInput.value.trim().toUpperCase();
    if(!codigo) return;

    const data = GD.readContrato(codigo);
    if(!data){
      // perguntar se deseja cadastrar
      GD.showModal("#modalNovo");
      GD.qs("#optNao").onclick = ()=>{ GD.hideModals(); codigoInput.focus(); };
      GD.qs("#optSim").onclick = ()=>{
        GD.hideModals();
        const novo = { codigo, etapa:0, status:"incompleto", [kind]:{} };
        GD.writeContrato(codigo, novo);
        alert("Contrato criado. Preencha as etapas.");
      };
      return;
    }
    // pré-carregar campos
    fillFieldsFrom(data[kind] || {});
    goto(data.etapa || 0);
  });

  // salvar quando avança
  btnNext.addEventListener("click", ()=>{
    if(!codigoInput.value.trim()){
      alert("Informe o código do contrato.");
      codigoInput.focus(); return;
    }
    const data = GD.readContrato(codigoInput.value.trim().toUpperCase()) || {codigo:codigoInput.value.trim().toUpperCase()};
    data[kind] = collectFields();
    data.etapa = Math.min((data.etapa||0)+1, stepWraps.length-1);
    data.status = "incompleto";
    GD.writeContrato(data.codigo, data);
    goto(current+1);
  });
  btnPrev.addEventListener("click", ()=> goto(current-1));

  // concluir
  btnFinish.addEventListener("click", ()=>{
    if(!codigoInput.value.trim()){
      alert("Informe o código do contrato.");
      return;
    }
    const data = GD.readContrato(codigoInput.value.trim().toUpperCase()) || {codigo:codigoInput.value.trim().toUpperCase()};
    data[kind] = collectFields();
    data.etapa = stepWraps.length-1;
    data.status = "concluido";
    GD.writeContrato(data.codigo, data);

    GD.showModal("#modalOk");
    GD.qs("#okMenu").onclick = ()=> location.href = "menu.html";
    GD.qs("#okContinuar").onclick = ()=> GD.hideModals();
  });

  // helpers para coletar/preencher campos da etapa atual
  function collectFields(){
    const fields = {};
    GD.qsa("[data-field]").forEach(el=>{
      fields[el.dataset.field] = el.value;
    });
    return fields;
  }
  function fillFieldsFrom(obj){
    GD.qsa("[data-field]").forEach(el=>{
      if(obj[el.dataset.field] != null) el.value = obj[el.dataset.field];
    });
  }

  // iniciar
  goto(0);
}

/* bootstrap por página */
document.addEventListener("DOMContentLoaded", ()=>{
  gdHandleLoginPage();
  gdHandleMenuPage();

  if(GD.qs("#wizardProposta")) gdHandleWizard("proposta");
  if(GD.qs("#wizardContrato")) gdHandleWizard("contrato");
  if(GD.qs("#wizardOrdem"))    gdHandleWizard("ordem");
});
