window.ERPAssistantBridge = (() => {
  const SESSION_KEY = "ERPIMPAR_USER";
  let cfg = null;

  const norm = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

  async function init(){
    cfg = await fetch("./capabilities.json?_="+Date.now(),{cache:"no-store"}).then(r=>{
      if(!r.ok) throw new Error("capabilities.json HTTP "+r.status);
      return r.json();
    });
    return {user:getUser(),cfg};
  }

  function getUser(){
    try{
      return JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||"null");
    }catch(_){ return null; }
  }

  function hasAccess(modName){
    const user=getUser();
    if(!user) return false;
    const mods=(user.modulos||[]).map(x=>String(x).toLowerCase());
    if(!mods.length) return true;
    const req=cfg?.modules?.[modName]?.perm||[];
    return req.some(x=>mods.includes(String(x).toLowerCase()));
  }

  function allowedModules(){
    return Object.keys(cfg?.modules||{}).filter(hasAccess);
  }

  function findModule(text){
    const q=norm(text);
    const aliases={
      "agenda semanal":"Agenda Semanal",
      "agenda do dia":"Agenda do Dia",
      "dashboard executivo":"Dashboard Executivo de Obras",
      "cronograma":"Cronograma",
      "gestao de obras":"Gestão de Obras",
      "vida da obra":"Gestão de Obras",
      "medicao":"Medição Empreiteiro",
      "documentos":"Documentos",
      "gestao documental":"Documentos",
      "orcamento":"Orçamentos",
      "solicitacao":"Solicitações",
      "material":"Solicitações",
      "viagem":"Agenda de Viagens",
      "administracao":"Administração"
    };
    for(const [a,m] of Object.entries(aliases)) if(q.includes(norm(a))) return m;
    return Object.keys(cfg?.modules||{}).find(m=>q.includes(norm(m)))||null;
  }

  function openModule(name){
    if(!cfg?.modules?.[name]) return {ok:false,message:"Não reconheci essa funcionalidade."};
    if(!hasAccess(name)) return {ok:false,message:"Essa funcionalidade não está liberada para o seu usuário."};
    location.href=cfg.modules[name].url;
    return {ok:true,message:`Abrindo ${name}.`};
  }

  async function shellQuery(text){
    const q=norm(text);
    if(/funcional|modul|tenho acesso|posso usar|o que eu posso/.test(q)){
      return {handled:true,type:"list",items:allowedModules(),message:"Estas são as funcionalidades liberadas para o seu usuário."};
    }
    if(/abr|abre|abrir|entrar|acessar|acessa/.test(q)){
      const m=findModule(text);
      if(m) return {handled:true,type:"open",...openModule(m)};
    }
    if(/quem sou|meu usuario|meu perfil/.test(q)){
      const u=getUser();
      return {handled:true,type:"text",message:u?`Você está conectado como ${u.nome||u.email}${u.cargo?" • "+u.cargo:""}.`:"Não há sessão ativa."};
    }
    return {handled:false};
  }

  return {init,getUser,hasAccess,allowedModules,findModule,openModule,shellQuery};
})();
