/* HF1: authenticated transport for the user-approved local Agenda window only. */
(() => {
 'use strict';
 const endpoint='https://api.erpimpar.com.br/george-reuniao/v09/api.php';
 const officialOrigins=['https://www.erpimpar.com.br','https://erpimpar.com.br'];
 const nonce=location.hash.slice(1);
 const owner=window.opener;
 const el=id=>document.getElementById(id);
 let port=null,csrf='',user=null,connected=false,stopped=false,fetchQueue=Promise.resolve();
 let boundCompany=null,ownerTimer=null,outstanding=0;
 const allowed=new Set(['session','agenda_read','agenda_catalog','agenda_execute']);
 const operations=new Set(['plan','replace_visible','checkpoint','undo','undo_all']);
 const status=(text,error=false)=>{el('status').textContent=text;el('status').classList.toggle('error',error);};
 const fail=(message,http=400,code='CONEXAO_LOCAL_INVALIDA')=>Object.assign(new Error(message),{http,status:code});
 const publicUser=u=>({id:u.id,nome:u.nome,email:u.email,company_id:u.company_id,company_name:u.company_name});
 async function api(action,args={}){
  const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),35000);
  try{
   const response=await fetch(endpoint,{method:'POST',credentials:'include',cache:'no-store',signal:abort.signal,
    headers:{'Content-Type':'application/json','X-George-CSRF':csrf},body:JSON.stringify({...args,action})});
   let value;try{value=await response.json();}catch(_){throw fail('O ERP não respondeu como esperado. Confira a instalação do pacote RC3.',502);}
   if(!response.ok||value.ok===false)throw fail(value.message||value.error||'Não foi possível concluir o pedido.',response.status,value.status);
   if(value.csrf)csrf=value.csrf;
   return value;
  }catch(e){
   if(e.name==='AbortError')throw fail('Não recebi a confirmação a tempo. Confira a Agenda antes de repetir.',504,'CONFIRMACAO_PENDENTE');
   throw e;
  }finally{clearTimeout(timeout);}
 }
 function post(value){if(port&&!stopped)port.postMessage(value);}
 function stop(message){
  if(stopped)return;
  post({type:'AGENDA_LOCAL_DISCONNECTED',message});
  stopped=true;connected=false;clearInterval(ownerTimer);
  port?.close();port=null;csrf='';user=null;
  el('password').value='';el('connected').hidden=true;el('existingSession').hidden=true;el('loginForm').hidden=true;el('retry').hidden=true;
  status(message);
 }
 async function prepareLogin(){
  if(stopped)return;
  el('retry').hidden=true;el('existingSession').hidden=true;el('loginForm').hidden=true;status('Conectando ao ERP…');
  try{
   const session=await api('session');
   if(stopped)return;
   if(session.authenticated){user=session.user;el('identity').textContent='Conectar como '+user.nome+' ('+user.email+')';el('existingSession').hidden=false;status('Confirme a conexão com a Agenda que você abriu.');}
   else{user=null;el('loginForm').hidden=false;status('Entre com seu usuário e senha do ERP.');el('email').focus();}
  }catch(e){if(!stopped){status(e.message,true);el('retry').hidden=false;}}
 }
 function grant(){
  if(stopped||!port||!user)return;
  boundCompany=Number(user.company_id);connected=true;
  el('existingSession').hidden=true;el('loginForm').hidden=true;el('connected').hidden=false;
  status('Agenda conectada.');post({type:'AGENDA_LOCAL_CONNECTED'});
 }
 el('connect').onclick=async()=>{
  const button=el('connect');button.disabled=true;
  try{
   // Refresh the identity immediately before the explicit user grant.
   const session=await api('session');
   if(!session.authenticated||!user||session.user.id!==user.id||Number(session.user.company_id)!==Number(user.company_id)){await prepareLogin();return;}
   user=session.user;grant();
  }catch(e){status(e.message,true);}finally{button.disabled=false;}
 };
 el('loginForm').onsubmit=async e=>{
  e.preventDefault();const button=el('login');button.disabled=true;
  try{
   const result=await api('login',{email:el('email').value,password:el('password').value});
   el('password').value='';user=result.user;grant();
  }catch(e){status(e.message,true);}finally{el('password').value='';button.disabled=false;}
 };
 el('retry').onclick=prepareLogin;
 el('back').onclick=()=>{try{owner.focus();}catch(_){}};
 el('disconnect').onclick=()=>stop('Conexão encerrada. Você pode conectar novamente pela Agenda.');
 async function execute(data){
  if(!connected||stopped)throw fail('Conecte a Agenda nesta janela antes de continuar.',403);
  if(!allowed.has(data.action))throw fail('Esta conexão atende somente à Agenda do Dia.',403);
  const args=data.args;
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.hasOwn(args,'action'))throw fail('Pedido inválido.');
  if(JSON.stringify(args).length>8*1024*1024)throw fail('Este pedido é muito grande.',413);
  if(data.action==='agenda_execute'&&!operations.has(args.operation))throw fail('Operação não disponível nesta conexão.',403);
  if(data.action==='agenda_execute'&&Number(args.company_id)!==boundCompany)throw fail('A empresa da Agenda mudou. Conecte novamente.',409,'EMPRESA_ALTERADA');
  if(data.action==='session'){
   const value=await api('session');
   if(!value.authenticated)throw fail('Sua sessão terminou. Conecte a Agenda novamente.',401,'LOGIN_NECESSARIO');
   if(Number(value.user.company_id)!==boundCompany)throw fail('A empresa mudou. Conecte novamente.',409,'EMPRESA_ALTERADA');
   return {ok:true,authenticated:true,user:publicUser(value.user)};
  }
  // API still validates CSRF, permissions, current company and revision for every request.
  return api(data.action,{...args,company_id:boundCompany});
 }
 function receive({data}){
  if(data?.type==='AGENDA_LOCAL_DISCONNECT'){stop('A Agenda foi fechada.');return;}
  if(data?.type!=='AGENDA_LOCAL_REQUEST'||typeof data.id!=='string'||!/^[a-f0-9-]{36}$/.test(data.id))return;
  if(outstanding>=32){post({type:'AGENDA_LOCAL_RESULT',id:data.id,error:{message:'Aguarde a conclusão do pedido anterior.',http:429}});return;}
  outstanding++;
  fetchQueue=fetchQueue.then(async()=>{
   try{const result=await execute(data);post({type:'AGENDA_LOCAL_RESULT',id:data.id,result});}
   catch(e){
    post({type:'AGENDA_LOCAL_RESULT',id:data.id,error:{message:e.message,http:e.http,status:e.status}});
    if(e.http===401||['CSRF_INVALIDO','EMPRESA_ALTERADA'].includes(e.status))stop(e.message);
   }finally{outstanding--;}
  }).catch(()=>{});
 }
 function handshake(e){
  // "null" alone is not trusted: require the exact opener, random nonce, private port,
  // and an explicit confirmation on this trusted page before processing any action.
  if(port||stopped||e.source!==owner||e.origin!=='null'||e.data?.type!=='AGENDA_LOCAL_CONNECT'||e.data.nonce!==nonce||e.ports.length!==1)return;
  port=e.ports[0];port.onmessage=receive;port.start();window.removeEventListener('message',handshake);
  clearInterval(readyTimer);prepareLogin();
 }
 if(!officialOrigins.includes(location.origin)||!owner||window.top!==window.self||!/^[a-f0-9-]{36}$/.test(nonce)){
  status('Abra esta conexão pelo botão da Agenda do Dia no seu computador.',true);el('intro').hidden=true;return;
 }
 window.addEventListener('message',handshake);
 // Only a public handshake is sent with '*'. All user data uses the transferred port.
 const ready=()=>owner.postMessage({type:'AGENDA_LOCAL_READY',nonce},'*');
 const readyTimer=setInterval(ready,750);ready();
 ownerTimer=setInterval(()=>{if(owner.closed){clearInterval(readyTimer);stop('A Agenda foi fechada.');}},1000);
 window.addEventListener('pagehide',()=>{clearInterval(readyTimer);stop('A janela de conexão foi fechada. Conecte novamente pela Agenda.');});
})();
