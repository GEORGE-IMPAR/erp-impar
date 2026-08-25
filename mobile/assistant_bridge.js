window.ERPAssistantBridge=(()=>{
 const SESSION_KEY="ERPIMPAR_USER"; let cfg=null;
 const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 function getUser(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||"null")}catch(_){return null}}
 async function init(){cfg=await fetch("./capabilities.json?_="+Date.now(),{cache:"no-store"}).then(r=>r.json());return {cfg,user:getUser()}}
 function hasAccess(name){const u=getUser();if(!u)return false;const mods=(u.modulos||[]).map(x=>norm(x));if(!mods.length)return true;return (cfg.modules[name]?.perm||[]).some(p=>mods.includes(norm(p)))}
 function allowedModules(){return Object.keys(cfg.modules||{}).filter(hasAccess)}
 function findModule(text){
   const q=norm(text), aliases={"agenda semanal":"Agenda Semanal","agenda do dia":"Agenda do Dia","dashboard executivo":"Dashboard Executivo de Obras","cronograma":"Cronograma","gestao de obras":"Gestão de Obras","vida da obra":"Gestão de Obras","medicao":"Medição Empreiteiro","documentos":"Documentos","gestao documental":"Documentos","orcamento":"Orçamentos","solicitacao":"Solicitações","material":"Solicitações","viagem":"Agenda de Viagens","administracao":"Administração","mesa de projetos":"Mesa de Projetos","dashboard de projetos":"Dashboard de Projetos"};
   for(const [a,m] of Object.entries(aliases))if(q.includes(norm(a)))return m;
   return Object.keys(cfg.modules||{}).find(m=>q.includes(norm(m)))||null;
 }
 async function query(text){
   const u=getUser(); const res=await fetch(cfg.queryApi,{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({text,user:{nome:u?.nome||"",email:u?.email||"",cargo:u?.cargo||"",modulos:u?.modulos||[]}}),
     cache:"no-store"
   });
   const raw=await res.text(); let j={};
   try{j=raw?JSON.parse(raw):{}}catch(_){throw new Error("Resposta inválida da API de consultas.")}
   if(!res.ok||j.ok===false)throw new Error(j.error||"Falha na consulta.");
   return j;
 }
 return {init,getUser,hasAccess,allowedModules,findModule,query,norm};
})();
