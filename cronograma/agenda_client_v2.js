/* Shared authenticated Agenda capability - RC3 HF6. Loaded before the legacy page scripts. */
(() => {
'use strict';
const endpoint='https://api.erpimpar.com.br/george-reuniao/v09/api.php';
const nativeFetch=window.fetch.bind(window);let csrf='',session=null,companyId=null,revision=null,queue=Promise.resolve(),lastDraft=null;
const clone=x=>JSON.parse(JSON.stringify(x));const event=()=>crypto.randomUUID();
async function raw(action,args={}){
 if(location.protocol==='file:')throw new Error('Abra a Agenda pelo endereço oficial do ERP ÍMPAR. A conexão por arquivo local foi desativada.');
 const r=await nativeFetch(endpoint,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-George-CSRF':csrf},body:JSON.stringify({action,...args})});
 let j;try{j=await r.json();}catch{throw new Error('Resposta inválida da Agenda integrada.');}
 if(!r.ok||j.ok===false){const e=new Error(j.error||j.message||j.status||'Não foi possível confirmar a operação.');e.status=j.status;e.http=r.status;throw e;}return j;
}
async function authenticate(){
 if(session)return session;
 session=(async()=>{const s=await raw('session');csrf=s.csrf;if(s.authenticated)return s.user;
  return new Promise((resolve,reject)=>{const dlg=document.createElement('dialog');dlg.innerHTML='<form><h3>Entrar na Agenda do Dia</h3><p>Use seu usuário e senha do ERP.</p><label>E-mail <input type="email" autocomplete="username" required></label><label>Senha <input type="password" autocomplete="current-password" required></label><p role="status"></p><button type="submit">Entrar</button></form>';
   dlg.style.cssText='max-width:440px;padding:24px;border-radius:14px';document.body.append(dlg);const form=dlg.querySelector('form');form.style.cssText='display:grid;gap:14px';
   form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{const j=await raw('login',{email:form.querySelector('[type=email]').value,password:form.querySelector('[type=password]').value});form.querySelector('[type=password]').value='';csrf=j.csrf;dlg.close();dlg.remove();resolve(j.user);}catch(e){form.querySelector('[role=status]').textContent=e.message;}finally{b.disabled=false;}};
   dlg.addEventListener('cancel',()=>{dlg.remove();session=null;reject(new Error('Entre para consultar a Agenda do Dia.'));});dlg.showModal();
  });
 })().then(user=>{companyId=Number(user.company_id);document.title='Agenda do Dia · '+(user.company_name||'ERP ÍMPAR');return user;}).catch(e=>{session=null;throw e;});return session;
}
async function request(action,args={}){await authenticate();try{return await raw(action,{company_id:companyId,...args});}catch(e){if(e.http===401||e.status==='CSRF_INVALIDO'||e.status==='EMPRESA_ALTERADA')session=null;throw e;}}
function accept(j){if(j.revision!=null)revision=j.revision;if(j.draft)lastDraft=clone(j.draft);return j;}
async function read(data){await queue;return accept(await request('agenda_read',data?{data}:{}));}
function mutate(args){
 const id=event();const task=queue.then(async()=>{
   const payload={...args,company_id:companyId,event_id:id,source:'UI'};
   let j;
   try{j=await request('agenda_execute',payload);}catch(e){
    // Exact same request safely completes a committed transaction with a pending projection.
    if(e.status==='PROJECAO_PENDENTE')j=await request('agenda_execute',payload);else throw e;
   }
   if(j.verified!==true)throw new Error(j.message||'A operação não foi confirmada.');
   if(j.draft&&['replace_visible','undo','undo_all'].includes(args.operation))await window.ERPIMPAR_SYNC_VEHICLE_LINKS?.(clone(j.draft));
   return accept(j);
 });queue=task.catch(()=>{});return task;
}
async function apply(j){
 window.__AGENDA_CAP_APPLYING__=true;try{
 if(j.draft&&typeof window.AgendaDiaV315?.applyServerRecord==='function')await window.AgendaDiaV315.applyServerRecord(clone(j.draft));
 return j;
 }finally{window.__AGENDA_CAP_APPLYING__=false;}
}
const client={read,request,mutate,apply,flush:()=>queue,revision:()=>revision,
 // Infraestrutura existente de leitura/gravação do vínculo. A regra fica no HTML.
 vehicleCatalog:async payload=>{
   await authenticate();
   const options={cache:'no-store'};
   if(payload!==undefined)Object.assign(options,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)});
   const r=await nativeFetch('https://api.erpimpar.com.br/agenda/cadastros_agenda_novo.php',options);
   const j=await r.json();if(!r.ok||j.ok===false)throw new Error(j.error||'Não foi possível consultar ou salvar o vínculo dos veículos.');return j;
 },
 plan:steps=>mutate({operation:'plan',steps}).then(apply),
 saveVisible:(draft,checkpoint=false)=>mutate({operation:'replace_visible',draft:clone(draft),checkpoint}),
 checkpoint:()=>mutate({operation:'checkpoint'}),undo:()=>mutate({operation:'undo_all'}).then(apply),
 close:async history=>{const j=await mutate({operation:'plan',data:history.data,steps:[{operacao:'finalizar',excecoes:history.atividades.map(a=>({atividade_id:String(a.id),percentual:a.percentualExecutado,motivo:a.motivoExecucao||'',motivo_cancelamento:a.motivoCancelamento||''}))}]});return j;},
 catalog:()=>request('agenda_catalog'),lastDraft:()=>clone(lastDraft),
 reportReady:async()=>{await queue;return read();}
};window.AgendaDiaClient=client;

// Exact legacy routes are translated to the shared service; unrelated requests are untouched.
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);const file=url.pathname.split('/').pop();
 if(location.protocol==='file:'&&url.origin==='https://api.erpimpar.com.br')throw new Error('Acesso local desativado. Abra a Agenda pelo endereço oficial do ERP ÍMPAR.');
 if(url.origin==='https://api.erpimpar.com.br'&&url.pathname.startsWith('/agenda/')){
  let j=null;const method=(init.method||'GET').toUpperCase();
  if(['atividade_dia_estado_novo.php','atividade_dia_get.php','carregar_atividade_dia.php'].includes(file)){
   const r=await read(url.searchParams.get('data')||null);j={ok:true,data:r.data,conteudo:r.draft,draft:{data:r.data,conteudo:r.draft},historicos:r.historicos,revision:r.revision};
  }else if(file==='salvar_atividade_dia.php'&&method==='POST'){
   const body=JSON.parse(init.body||'{}');const r=await client.saveVisible(body.draft||body.conteudo,true);j={ok:true,...r};
  }else if(file==='cadastros_agenda_novo.php'){
   if(method==='POST')throw new Error('Atualize os colaboradores pelo cadastro global integrado.');j=await client.catalog();
  }else if(file==='finalizar_atividade_dia.php'&&method==='POST')throw new Error('Use a finalização integrada da Agenda do Dia.');
  if(j)return new Response(JSON.stringify(j),{status:200,headers:{'Content-Type':'application/json'}});
 }
 return nativeFetch(input,init);
};
})();
