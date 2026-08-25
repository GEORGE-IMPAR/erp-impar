window.ERPAssistantBridge=(()=>{
 const SESSION_KEY="ERPIMPAR_USER"; let cfg=null;
 const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 const noAccentUpper=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
 function getUser(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY)||"null")}catch(_){return null}}
 async function init(){cfg=await fetch("./capabilities.json?_="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("capabilities HTTP "+r.status);return r.json()});return {cfg,user:getUser()}}
 function hasAccess(name){const u=getUser();if(!u)return false;const mods=(u.modulos||[]).map(norm);if(!mods.length)return true;return (cfg.modules[name]?.perm||[]).some(p=>mods.includes(norm(p)))}
 function allowedModules(){return Object.keys(cfg.modules||{}).filter(hasAccess)}
 function findModule(text){
   const q=norm(text), aliases={
    "agenda semanal":"Agenda Semanal","agenda do dia":"Agenda do Dia",
    "dashboard executivo":"Dashboard Executivo de Obras","resumo executivo":"Dashboard Executivo de Obras","relatorio executivo":"Dashboard Executivo de Obras",
    "cronograma":"Cronograma","gestao de obras":"Gestão de Obras","vida da obra":"Gestão de Obras","medicao":"Medição Empreiteiro",
    "documentos":"Documentos","gestao documental":"Documentos","orcamento":"Orçamentos","solicitacao":"Solicitações","material":"Solicitações",
    "viagem":"Agenda de Viagens","administracao":"Administração","mesa de projetos":"Mesa de Projetos","dashboard de projetos":"Dashboard de Projetos"
   };
   for(const [a,m] of Object.entries(aliases))if(q.includes(norm(a)))return m;
   return Object.keys(cfg.modules||{}).find(m=>q.includes(norm(m)))||null;
 }
 async function getJson(url,opts={}){
   const r=await fetch(url+(url.includes("?")?"&":"?")+"_="+Date.now(),{cache:"no-store",...opts});
   const t=await r.text(); let j={};
   try{j=t.trim()?JSON.parse(t):{}}catch(_){throw Error("A fonte retornou JSON inválido.")}
   if(!r.ok||j?.ok===false)throw Error(j?.error||j?.mensagem||("HTTP "+r.status));
   return j;
 }
 function listFrom(j){return Array.isArray(j)?j:(Array.isArray(j?.data)?j.data:(Array.isArray(j?.obras)?j.obras:[]))}
 function parseDateLoose(v){if(!v)return null;const s=String(v).trim();let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1],12);const d=new Date(s.replace(" ","T"));return Number.isNaN(d.getTime())?null:d}
 function daysAgo(v){const d=parseDateLoose(v);if(!d)return Infinity;const n=new Date();n.setHours(12,0,0,0);d.setHours(12,0,0,0);return Math.round((n-d)/86400000)}
 function coord(raw){const v=String(raw?.coordenador||raw?.Coordenador||raw?.responsavel||raw?.usuario||raw?.owner||"");const n=noAccentUpper(v);if(n.includes("PABLO"))return "PABLO";if(n.includes("FABIO"))return "FABIO";if(n.includes("NICOLAS"))return "NICOLAS";return v.trim()}
 function dataAtualizacao(o){const d=o?.data||o||{};const keys=["ultimaAtualizacao","ultima_atualizacao","updated_at","updatedAt","baselineAt","dataAtualizacao","data_atualizacao","atualizado_em","modificado_em","modified_at","dt_atualizacao","last_update","lastModified"];for(const k of keys)if(d[k])return d[k];for(const box of ["meta","cabecalho"])for(const k of keys)if(d?.[box]?.[k])return d[box][k];return ""}
 function real(raw){for(const v of [raw?.percentual_realizado,raw?.realizado,raw?.pct_real,raw?.progresso_real,raw?.perc_real,raw?.percentual_real,raw?.real,raw?.percentualRealizado,raw?.["%real"],raw?.resumo?.percentual_realizado,raw?.resumo?.real]){const n=Number(String(v??"").replace("%","").replace(",","."));if(Number.isFinite(n))return n}return 0}
 function directDays(o){for(const v of [o?.diasSemAtualizacao,o?.dias_sem_atualizacao,o?.dias_ultima_atualizacao,o?.dias_sem_update,o?.dias,o?.qpi4?.diasSemAtualizacao,o?.resumo?.diasSemAtualizacao]){const n=Number(String(v??"").replace(",","."));if(Number.isFinite(n))return n}return null}
 function pickPerson(q){for(const n of ["NICOLAS","FABIO","PABLO","CRISTIANO","GEORGE","ROGERS","RAFAEL","GOMES"])if(noAccentUpper(q).includes(n))return n;return null}
 function todayIso(){const d=new Date();const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}

 async function queryDirect(text){
   const q=norm(text), u=getUser();

   // OBRAS — mesma fonte usada pelo menu novo
   if(q.includes("obra")||q.includes("obras")||q.includes("coordenador")||q.includes("atrasad")){
     if(!hasAccess("Dashboard Executivo de Obras")&&!hasAccess("Gestão de Obras")&&!hasAccess("Cronograma")) return {ok:false,error:"Seu usuário não possui acesso às informações de obras."};
     if(q.includes("atrasad")||q.includes("desatualiz")||q.includes("mais de 7")||q.includes("atencao")){
       const j=await getJson("https://api.erpimpar.com.br/cronograma/listar_kpi.php");
       const p=pickPerson(q);
       const rows=listFrom(j).map((o,i)=>{const last=dataAtualizacao(o);const dd=directDays(o);return {nome:String(o.nome||o.Nome||o.obra||o.Obra||o.projeto||o.titulo||o.arquivo||o.filename||"").replace(/\.json$/i,"").trim(),coord:coord(o),dias:dd!==null?dd:daysAgo(last),real:real(o)}}).filter(x=>x.nome&&x.real<100&&Number.isFinite(x.dias)&&x.dias>7&&(!p||noAccentUpper(x.coord).includes(p))).sort((a,b)=>b.dias-a.dias);
       return {ok:true,answer:`${rows.length} obra(s) com cronograma desatualizado há mais de 7 dias${p?" para "+p:""}.`,items:rows.map(x=>`${x.nome} — ${x.dias} dias${x.coord?" — "+x.coord:""}`)};
     }
     const j=await getJson("https://api.erpimpar.com.br/cronograma/listar_obras.php");
     const p=pickPerson(q);
     const rows=listFrom(j).map((o,i)=>({nome:String(o.nome||o.obra||o.titulo||"").trim(),coord:coord(o)})).filter(x=>x.nome);
     if(p){
       // listar_obras pode não trazer coordenador; usa KPI como fonte complementar
       let merged=rows;
       try{
         const jk=await getJson("https://api.erpimpar.com.br/cronograma/listar_kpi.php");
         const kp=listFrom(jk).map(o=>({nome:String(o.nome||o.Nome||o.obra||o.Obra||o.projeto||o.titulo||"").trim(),coord:coord(o)})).filter(x=>x.nome&&noAccentUpper(x.coord).includes(p));
         if(kp.length) merged=kp;
       }catch(_){}
       const f=merged.filter(x=>noAccentUpper(x.coord).includes(p));
       return {ok:true,answer:`${p} está com ${f.length} obra(s) identificada(s) na fonte oficial.`,items:f.map(x=>x.nome)};
     }
     if(q.includes("quantas")||q.includes("quantos")||q.includes("total")) return {ok:true,answer:`Temos ${rows.length} obra(s) ativa(s) na fonte oficial.`};
     return {ok:true,answer:`Obras ativas: ${rows.length}.`,items:rows.map(x=>x.nome)};
   }

   // ADMIN
   if(q.includes("usuario")||q.includes("usuarios")||q.includes("coordenadores")||q.includes("quem tem acesso")){
     if(!hasAccess("Administração")) return {ok:false,error:"Seu usuário não possui acesso à Administração."};
     const j=await getJson("https://api.erpimpar.com.br/admin/api.php?acao=listar");
     const users=Array.isArray(j.usuarios)?j.usuarios:[], ativos=users.filter(x=>x.ativo!==false);
     if(q.includes("coordenador")){const c=ativos.filter(x=>norm(`${x.funcao||""} ${x.cargo||""} ${x.perfil||""}`).includes("coorden"));return {ok:true,answer:`Encontrei ${c.length} coordenador(es) ativo(s).`,items:c.map(x=>x.nome||x.email)}}
     return {ok:true,answer:`Há ${ativos.length} usuário(s) ativo(s) no sistema.`,items:ativos.map(x=>(x.nome||x.email)+(x.funcao||x.cargo?` — ${x.funcao||x.cargo}`:""))};
   }

   // DOCUMENTAL
   if(q.includes("empresa")||q.includes("empreiteiro")||q.includes("contrato")||q.includes("documento")){
     if(!hasAccess("Documentos")) return {ok:false,error:"Seu usuário não possui acesso à Gestão Documental."};
     if(q.includes("empresa")||q.includes("empreiteiro")){
       const j=await getJson("https://api.erpimpar.com.br/documentos/api.php",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({action:"company_list"})});
       let cs=Array.isArray(j.companies)?j.companies:[];
       if(q.includes("empreiteiro"))cs=cs.filter(c=>(c.papeis||[]).map(norm).includes("empreiteiro"));
       if(q.includes("quantas")||q.includes("quantos")||q.includes("total"))return {ok:true,answer:`Há ${cs.length} empresa(s)${q.includes("empreiteiro")?" cadastrada(s) como empreiteiro": " cadastrada(s)"}.`};
       return {ok:true,answer:`Encontrei ${cs.length} empresa(s).`,items:cs.map(c=>(c.fantasia||c.nome||"Empresa")+(c.cnpj?` — ${c.cnpj}`:""))};
     }
     const j=await getJson("https://api.erpimpar.com.br/documentos/api.php",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({action:"document_list"})});
     const ds=Array.isArray(j.documents)?j.documents:[];
     if(q.includes("quantos")||q.includes("quantas")||q.includes("total"))return {ok:true,answer:`Há ${ds.length} documento(s)/contrato(s) cadastrado(s).`};
     return {ok:true,answer:`Encontrei ${ds.length} documento(s)/contrato(s).`,items:ds.map(d=>(d.codigo||"Documento")+(d.obra||d.titulo?` — ${d.obra||d.titulo}`:""))};
   }

   // AGENDA DO DIA
   if(q.includes("agenda do dia")||q.includes("agenda de hoje")||q.includes("atividade de hoje")||q.includes("atividades de hoje")||q.includes("viajando hoje")){
     if(!hasAccess("Agenda do Dia")) return {ok:false,error:"Seu usuário não possui acesso à Agenda do Dia."};
     const date=todayIso();
     const j=await getJson("https://api.erpimpar.com.br/agenda/atividade_dia_estado_novo.php?data="+encodeURIComponent(date));
     const rec=j.historico||j.record||j.data||j, content=rec.conteudo||rec, acts=Array.isArray(content.atividades)?content.atividades:(Array.isArray(content.schedule)?content.schedule:[]);
     const status=rec.status||content.status||(rec.finalizado?"finalized":"open");
     if(q.includes("fech")||q.includes("finaliz")||q.includes("status"))return {ok:true,answer:`A Agenda do Dia de ${date} está com status: ${status}.`};
     const people=new Set(),works=new Set(); const travels=[];
     acts.forEach(a=>{const n=a.colaborador||a.nome||a.personName||"",w=a.obra||a.project||a.nomeObra||"";if(n)people.add(n);if(w)works.add(w);if(a.viagem===true||norm(a.viagem)==="sim")travels.push(`${n}${w?" — "+w:""}`)});
     if(q.includes("viaj"))return {ok:true,answer:`Há ${travels.length} registro(s) de viagem hoje.`,items:travels};
     return {ok:true,answer:`Agenda do Dia ${date}: ${acts.length} atividade(s), ${people.size} colaborador(es), ${works.size} obra(s). Status: ${status}.`,items:[...works]};
   }

   return null;
 }

 async function query(text){
   const direct=await queryDirect(text);
   if(direct) return direct;
   // fallback opcional para adapters futuros; 6s, não trava 15s
   const u=getUser(), controller=new AbortController(), timer=setTimeout(()=>controller.abort(),6000);
   try{
     const res=await fetch(cfg.queryApi,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,user:{nome:u?.nome||"",email:u?.email||"",cargo:u?.cargo||"",modulos:u?.modulos||[]}}),cache:"no-store",signal:controller.signal});
     const raw=await res.text();let j={};try{j=raw?JSON.parse(raw):{}}catch(_){throw Error("Resposta inválida da API de consultas.")}if(!res.ok||j.ok===false)throw Error(j.error||"Falha na consulta.");return j;
   }catch(e){
     if(e?.name==="AbortError") return {ok:true,answer:"Reconheci a pergunta, mas essa fonte ainda não está conectada diretamente na V1.3. As consultas principais de Obras, Usuários, Agenda do Dia e Gestão Documental já funcionam sem passar pelo PHP intermediário."};
     throw e;
   }finally{clearTimeout(timer)}
 }
 return {init,getUser,hasAccess,allowedModules,findModule,query,norm};
})();
