/* ERP ÍMPAR — Agenda do Dia sem autenticação paralela.
   Usa o usuário já autenticado no menu e os endpoints oficiais da Agenda. */
(() => {
'use strict';
const API='https://api.erpimpar.com.br/agenda/';
const nativeFetch=window.fetch.bind(window);let queue=Promise.resolve(),lastDraft=null,savedDraft=null,revision=0;
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');
function erpUser(){
 for(const store of [sessionStorage,localStorage])for(const key of ['ERPIMPAR_USER','erpimpar_user','ERP_USER','usuarioERP']){
  try{const raw=store.getItem(key);if(raw){const user=JSON.parse(raw);if(user?.email)return user;}}catch(_){ }
 }
 try{window.top.location.href='/login_novo.html';}catch(_){location.href='/login_novo.html';}
 throw new Error('Sua sessão do ERP terminou. Entre novamente pelo login principal.');
}
async function json(url,options={}){
 if(location.protocol==='file:')throw new Error('Abra a Agenda pelo endereço oficial do ERP ÍMPAR.');
 erpUser();const next={cache:'no-store',...options};
 if(String(next.method||'GET').toUpperCase()==='POST'){const headers=new Headers(next.headers||{});headers.set('Content-Type','text/plain;charset=UTF-8');next.headers=headers;}
 const response=await nativeFetch(url,next);const text=await response.text();let body;
 try{body=text.trim()?JSON.parse(text):{};}catch{throw new Error('O servidor retornou uma resposta inválida.');}
 if(!response.ok||body?.ok===false)throw new Error(body?.error||body?.mensagem||`HTTP ${response.status}`);return body;
}
function draftOf(body){return clone(body?.draft?.conteudo??body?.conteudo??body?.draft??body?.data?.conteudo??body?.data??null);}
function accept(body,draft=null){const value=draft??draftOf(body);if(value){lastDraft=clone(value);if(!savedDraft)savedDraft=clone(value);}revision++;return {...body,ok:true,verified:true,revision,draft:value??clone(lastDraft)};}
async function read(date){await queue;const suffix=date?'?data='+encodeURIComponent(date)+'&t='+Date.now():'?t='+Date.now();return accept(await json(API+'atividade_dia_estado_novo.php'+suffix));}
async function apply(body){if(body?.draft&&typeof window.AgendaDiaV315?.applyServerRecord==='function'){window.__AGENDA_CAP_APPLYING__=true;try{await window.AgendaDiaV315.applyServerRecord(clone(body.draft));}finally{window.__AGENDA_CAP_APPLYING__=false;}}return body;}
function visibleDraft(fallback=null){if(typeof window.AgendaDiaRefatoracaoV1?.buildDraft==='function')return clone(window.AgendaDiaRefatoracaoV1.buildDraft());return clone(fallback??lastDraft??window.__AGENDA_DIA_ACTIVE_RECORD__);}
function saveVisible(draft,checkpoint=false){
 const task=queue.then(async()=>{const next=clone(draft),date=String(next?.data??next?.date??'');if(!date)throw new Error('Nenhum dia foi carregado para salvar.');
  await json(API+'salvar_atividade_dia.php',{method:'POST',body:JSON.stringify({data:date,draft:next,usuario:erpUser()})});if(checkpoint)savedDraft=clone(next);return accept({},next);});
 queue=task.catch(()=>{});return task;
}
async function vehicleCatalog(payload){return json(API+'cadastros_agenda_novo.php',payload===undefined?{}:{method:'POST',body:JSON.stringify(payload)});}
async function catalog(){return vehicleCatalog();}
function peopleNow(){try{return Array.isArray(people)?people:(window.people||[]);}catch(_){return window.people||[];}}
function scheduleNow(){try{return schedule&&typeof schedule==='object'?schedule:(window.schedule||{});}catch(_){return window.schedule||{};}}
function setPeople(value){try{people=value;}catch(_){ }window.people=value;}
function setSchedule(value){try{schedule=value;}catch(_){ }window.schedule=value;}
function personByName(value){return peopleNow().find(person=>norm(person.name??person.nome)===norm(value));}
const keyOf=person=>String(person.id)+'_0';
async function plan(steps=[]){
 const nextSchedule=clone(scheduleNow()),nextPeople=clone(peopleNow());setPeople(nextPeople);setSchedule(nextSchedule);
 for(const step of steps){const operation=String(step.operacao||'').toLowerCase();
  if(operation==='mover'||operation==='copiar'){
   const origin=personByName(step.origem_colaborador);if(!origin)throw new Error('Colaborador de origem não encontrado.');
   const sourceKey=keyOf(origin),ids=(step.atividade_ids||[]).map(String),source=nextSchedule[sourceKey]||[],chosen=source.filter(item=>ids.includes(String(item.id)));if(chosen.length!==ids.length)throw new Error('Uma atividade selecionada não foi encontrada.');
   for(const targetName of step.destinos||[]){const target=personByName(targetName);if(!target)throw new Error('Colaborador de destino não encontrado.');const targetKey=keyOf(target),copies=chosen.map(item=>({...clone(item),id:crypto.randomUUID?.()||Date.now()+'_'+Math.random(),originalItemId:item.originalItemId??item.id,operacaoOrigem:operation.toUpperCase()}));nextSchedule[targetKey]=[...(nextSchedule[targetKey]||[]),...copies];}
   if(operation==='mover')nextSchedule[sourceKey]=source.filter(item=>!ids.includes(String(item.id)));
  }else if(operation==='remover_colaborador'){
   const ref=String(step.colaborador||''),target=ref.startsWith('id:')?nextPeople.find(p=>String(p.colaborador_id??p.id)===ref.slice(3)):nextPeople.find(p=>norm(p.name??p.nome)===norm(ref));if(target){const index=nextPeople.indexOf(target);if(index>=0)nextPeople.splice(index,1);delete nextSchedule[keyOf(target)];}
  }else if(operation==='vincular_colaborador'){
   const ref=String(step.colaborador||'');let target;if(ref.startsWith('id:')){const rows=(await catalog())?.data?.colaboradores||[];target=rows.find(p=>String(p.id)===ref.slice(3));}else target={id:Math.max(0,...nextPeople.map(p=>Number(p.id)||0))+1,name:ref,role:'execucao',active:true,car:null};
   if(target&&!nextPeople.some(p=>norm(p.name??p.nome)===norm(target.name??target.nome)))nextPeople.push({id:target.id,name:target.name??target.nome,role:target.role??target.funcao??'execucao',active:true,car:target.car??target.placa??null,colaborador_id:target.id});
  }
 }
 if(typeof window.renderAll==='function')window.renderAll();return apply(await saveVisible(visibleDraft(lastDraft),false));
}
async function undo(){if(!savedDraft)throw new Error('Ainda não existe uma versão salva para restaurar.');return apply(await saveVisible(clone(savedDraft),false));}
const parseDate=value=>{const [y,m,d]=String(value).split('-').map(Number);return new Date(y,m-1,d,12);};
const iso=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
function nextBusiness(value){const date=parseDate(value);do{date.setDate(date.getDate()+1);}while([0,6].includes(date.getDay()));return iso(date);}
function monday(value){const date=parseDate(value),day=date.getDay();date.setDate(date.getDate()+(day===0?-6:1-day));return iso(date);}
async function nextDraft(currentDate){
 const date=nextBusiness(currentDate),week=monday(date),day=parseDate(date).getDay()-1,isFriday=parseDate(currentDate).getDay()===5,strict=isFriday?'&historico_obrigatorio=1':'';let source={encontrada:false},activities=[];
 try{source=await json(API+'finalizar_atividade_dia.php?fonte_semana='+encodeURIComponent(week)+strict+'&t='+Date.now());const raw=source.conteudo||{},payload=raw.payload&&typeof raw.payload==='object'?raw.payload:(raw.data&&typeof raw.data==='object'?raw.data:raw),agenda=payload.agenda&&typeof payload.agenda==='object'?payload.agenda:payload,names=Array.isArray(payload.colaboradores)&&payload.colaboradores.length?payload.colaboradores:Object.keys(agenda||{});
  for(const name of names){const person=agenda[name]||agenda[String(name).toUpperCase()]||{},days=Array.isArray(person.dias)?person.dias:[],slot=days[day],items=Array.isArray(slot)?slot:(slot?.alocacoes||slot?.atividades||[]);
   for(const item of items){const obra=String(item.obra||item.obraNome||item.nomeObra||'').trim();if(!obra)continue;const atividade=String(item.atividade||item.descricao||item.servico||'').trim(),travel=item.viagem===true||item.viagem===1||['sim','true','1'].includes(String(item.viagem??'').toLowerCase());activities.push({id:item.id||crypto.randomUUID(),colaborador:String(name).trim(),funcao:person.funcao||person.role||'execucao',obra,atividade,horas:Number(item.horas||8)||8,viagem:travel,carro:item.carro||item.car||item.veiculo||null,cancelado:false,planejado:{obra,atividade,viagem:travel},executado:{obra,atividade,viagem:travel},importedFromFrozenWeek:true,origemSemanal:true});}
  }
 }catch(error){if(isFriday)throw error;source={encontrada:false,motivo:error.message};}
 if(isFriday&&(!source.encontrada||!activities.length))throw new Error('Finalize primeiro a Agenda Semanal da próxima semana.');
 const now=new Date().toISOString();return {data:date,semana:week,diaSemana:parseDate(date).toLocaleDateString('pt-BR',{weekday:'long'}),atividades:activities,aplicarCronograma:false,finalizado:false,tipo:'draft',status:'draft',agendaSemanalEncontrada:source.encontrada===true,agendaSemanalCongelada:source.encontrada===true,fonteAgendaSemanalValida:source.encontrada===true,fonteAgendaSemanal:source.fonte||'nenhuma',arquivoFonteAgendaSemanal:source.arquivo||null,motivoFonteAgendaSemanal:source.motivo||'',abertoSemAgendaSemanal:source.encontrada!==true,createdAt:now,updatedAt:now,usuario:erpUser()};
}
async function close(history){const proximoDraft=await nextDraft(history.data);const response=await json(API+'finalizar_atividade_dia.php',{method:'POST',body:JSON.stringify({historico:history,proximoDraft,dataAtual:history.data,fonteAgendaSemanal:proximoDraft.fonteAgendaSemanal,arquivoFonteAgendaSemanal:proximoDraft.arquivoFonteAgendaSemanal,fonteAgendaSemanalValida:Boolean(proximoDraft.fonteAgendaSemanalValida),usuario:erpUser()})});return {...response,draft:proximoDraft,verified:true};}
const client={read,apply,flush:()=>queue,vehicleCatalog,catalog,plan,saveVisible,checkpoint:()=>{savedDraft=clone(lastDraft);return Promise.resolve({ok:true});},undo,close,lastDraft:()=>clone(lastDraft),revision:()=>revision,reportReady:async()=>{await queue;return read();}};
window.AgendaDiaClient=client;
})();
