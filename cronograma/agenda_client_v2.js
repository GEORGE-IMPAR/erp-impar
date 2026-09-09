/* Shared authenticated Agenda capability. Loaded before the legacy page scripts. */
(() => {
'use strict';
const endpoint='https://api.erpimpar.com.br/george-reuniao/v09/api.php';
const nativeFetch=window.fetch.bind(window);let csrf='',session=null,companyId=null,revision=null,queue=Promise.resolve(),lastDraft=null;
const clone=x=>JSON.parse(JSON.stringify(x));const event=()=>crypto.randomUUID();
// HF1: file:// has an opaque origin and cannot use the authenticated API directly.
// A user-opened page on the official ERP origin holds the login and a private port.
// No cookies, password, CSRF token or API key are transferred to the local file.
const localFile=location.protocol==='file:';
const localConnection=localFile?createLocalConnection():null;
function createLocalConnection(){
 const origin='https://www.erpimpar.com.br';
 const page=origin+'/cronograma/agenda_conexao_local.html?v=098rc3hf1';
 let popup=null,port=null,candidatePort=null,nonce='',connecting=null,resolveConnection=null;
 let dialog=null,message=null,button=null,handshakeTimer=null,closedTimer=null;
 const pending=new Map();
 const failure=text=>Object.assign(new Error(text),{status:'CONEXAO_LOCAL_INTERROMPIDA'});
 function disconnect(text){
  clearTimeout(handshakeTimer);clearInterval(closedTimer);
  if(port){port.close();port=null;}
  if(candidatePort){candidatePort.close();candidatePort=null;}
  session=null;
  for(const task of pending.values()){clearTimeout(task.timer);task.reject(failure(text));}
  pending.clear();
  if(message)message.textContent=text;
  if(button)button.textContent='Conectar à Agenda';
 }
 async function showConnection(){
  if(document.readyState==='loading')await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
  if(!dialog){
   dialog=document.createElement('dialog');dialog.id='agendaLocalConnection';
   dialog.setAttribute('aria-labelledby','agendaLocalConnectionTitle');
   dialog.style.cssText='width:min(440px,90vw);box-sizing:border-box;padding:24px;border:1px solid #b9d4f5;border-radius:16px;background:#fff;color:#174d83;font:15px system-ui;box-shadow:0 20px 60px #17324744';
   const title=document.createElement('h2');title.id='agendaLocalConnectionTitle';title.textContent='Conectar à Agenda do Dia';title.style.cssText='margin:0 0 12px;color:#0b3f91;font-size:21px';
   const description=document.createElement('p');description.textContent='Você abriu a Agenda pelo computador. Continue na janela do ERP para acessar suas atividades.';
   message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
   button=document.createElement('button');button.type='button';button.textContent='Conectar à Agenda';button.className='toolbar-btn primary';button.style.cssText='min-height:44px;width:100%;white-space:normal';
   button.onclick=()=>{
    if(popup&&!popup.closed&&nonce){popup.focus();return;}
    nonce=event();popup=window.open(page+'#'+nonce,'_blank','popup,width=520,height=650');
    if(!popup){nonce='';message.textContent='O navegador bloqueou a janela. Permita a abertura e clique novamente.';return;}
    message.textContent='Conclua a conexão na janela que foi aberta. Depois, volte para esta Agenda.';
    button.textContent='Voltar à janela de conexão';
    handshakeTimer=setTimeout(()=>{
     if(!port){message.textContent='A página de conexão não respondeu. Confira se os arquivos desta correção já foram publicados no ERP.';button.textContent='Abrir conexão novamente';popup=null;nonce='';}
    },45000);
    closedTimer=setInterval(()=>{
     if(popup?.closed){popup=null;nonce='';disconnect('A janela de conexão foi fechada. Conecte novamente para continuar.');}
    },1000);
   };
   dialog.append(title,description,message,button);document.body.append(dialog);
   dialog.addEventListener('cancel',e=>e.preventDefault());
  }
  if(!dialog.open)dialog.showModal();
 }
 function ensure(){
  if(port&&popup&&!popup.closed)return Promise.resolve();
  if(!connecting){
   connecting=new Promise(resolve=>{resolveConnection=resolve;});
   showConnection().catch(e=>{disconnect(e.message);});
  }
  return connecting;
 }
 window.addEventListener('message',e=>{
  if(e.origin!==origin||e.source!==popup||!nonce||e.data?.type!=='AGENDA_LOCAL_READY'||e.data.nonce!==nonce||port||candidatePort)return;
  clearTimeout(handshakeTimer);
  const channel=new MessageChannel();const candidate=channel.port1;candidatePort=candidate;
  const expectedPopup=popup,expectedNonce=nonce;
  candidate.onmessage=({data})=>{
   if(popup!==expectedPopup||nonce!==expectedNonce)return;
   if(data?.type==='AGENDA_LOCAL_CONNECTED'){
    port=candidate;candidatePort=null;dialog?.close();const ready=resolveConnection;resolveConnection=null;connecting=null;ready?.();return;
   }
   if(data?.type==='AGENDA_LOCAL_DISCONNECTED'){
    candidate.close();popup=null;nonce='';disconnect(data.message||'A conexão foi encerrada. Conecte novamente.');return;
   }
   if(data?.type!=='AGENDA_LOCAL_RESULT')return;
   const task=pending.get(data.id);if(!task)return;
   pending.delete(data.id);clearTimeout(task.timer);
   if(data.error){
    const err=new Error(data.error.message||'Não recebi a confirmação da Agenda.');Object.assign(err,{status:data.error.status,http:data.error.http});
    if(err.http===401||['CSRF_INVALIDO','EMPRESA_ALTERADA'].includes(err.status)){popup=null;nonce='';disconnect(err.message);}
    task.reject(err);
   }
   else task.resolve(data.result);
  };
  candidate.start();popup.postMessage({type:'AGENDA_LOCAL_CONNECT',nonce},origin,[channel.port2]);
 });
 window.addEventListener('pagehide',()=>{
  try{port?.postMessage({type:'AGENDA_LOCAL_DISCONNECT'});}catch(_){}
  disconnect('A Agenda foi fechada.');
 });
 return {async request(action,args){
  await ensure();
  return new Promise((resolve,reject)=>{
   const id=event();const timer=setTimeout(()=>{
    pending.delete(id);reject(failure('Não recebi a confirmação. Confira a Agenda antes de repetir a alteração.'));
   },45000);
   pending.set(id,{resolve,reject,timer});
   try{port.postMessage({type:'AGENDA_LOCAL_REQUEST',id,action,args});}
   catch(e){clearTimeout(timer);pending.delete(id);reject(e);disconnect('Reconecte a Agenda para continuar.');}
  });
 }};
}
async function raw(action,args={}){
 if(localConnection)return localConnection.request(action,args);
 const r=await nativeFetch(endpoint,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-George-CSRF':csrf},body:JSON.stringify({action,...args})});
 let j;try{j=await r.json();}catch{throw new Error('Resposta inválida da Agenda integrada.');}
 if(!r.ok||j.ok===false){const e=new Error(j.error||j.message||j.status||'Não foi possível confirmar a operação.');e.status=j.status;e.http=r.status;throw e;}return j;
}
async function authenticate(){
 if(session)return session;
 session=(async()=>{const s=await raw('session');csrf=s.csrf||'';if(s.authenticated)return s.user;
  if(localFile)throw new Error('Entre na janela de conexão do ERP para continuar.');
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
   if(revision===null)accept(await request('agenda_read'));
   const payload={...args,company_id:companyId,event_id:id,expected_revision:revision,source:'UI'};
   let j;
   try{j=await request('agenda_execute',payload);}catch(e){
    // Exact same request safely completes a committed transaction with a pending projection.
    if(e.status==='PROJECAO_PENDENTE')j=await request('agenda_execute',payload);else throw e;
   }
   if(j.verified!==true)throw new Error(j.message||'A operação não foi confirmada.');return accept(j);
 });queue=task.catch(()=>{});return task;
}
async function apply(j){
 window.__AGENDA_CAP_APPLYING__=true;try{
 if(j.draft&&typeof window.AgendaDiaV315?.applyServerRecord==='function')await window.AgendaDiaV315.applyServerRecord(clone(j.draft));
 return j;
 }finally{window.__AGENDA_CAP_APPLYING__=false;}
}
const client={read,request,mutate,apply,flush:()=>queue,revision:()=>revision,
 plan:steps=>mutate({operation:'plan',steps}).then(apply),
 saveVisible:(draft,checkpoint=false)=>mutate({operation:'replace_visible',draft:clone(draft),checkpoint}),
 checkpoint:()=>mutate({operation:'checkpoint'}),undo:all=>mutate({operation:all?'undo_all':'undo'}).then(apply),
 close:async history=>{const j=await mutate({operation:'plan',data:history.data,steps:[{operacao:'finalizar',excecoes:history.atividades.map(a=>({atividade_id:String(a.id),percentual:a.percentualExecutado,motivo:a.motivoExecucao||'',motivo_cancelamento:a.motivoCancelamento||''}))}]});return j;},
 catalog:()=>request('agenda_catalog'),lastDraft:()=>clone(lastDraft),
 reportReady:async()=>{await queue;return read();}
};window.AgendaDiaClient=client;

// Exact legacy routes are translated to the shared service; unrelated requests are untouched.
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);const file=url.pathname.split('/').pop();
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
