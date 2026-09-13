/* George V0.9 — approved UI + authenticated, source-grounded conversation and durable media.
   Agenda operations use the existing authenticated pilot adapter. No browser storage for conversations, files or operational records. */
(() => {
'use strict';
const BASE='https://api.erpimpar.com.br/george-reuniao/v09/';
const API=BASE+'api.php';
const $=id=>document.getElementById(id);
const state={csrf:'',user:null,record:null,mode:'text',busy:false,recording:null,auth:false,upload:false,jobRunning:new Set(),logQueue:Promise.resolve(),chatQueue:Promise.resolve(),caps:null,activeModule:'geral',lastDocument:null,lastAnalytics:null,lastOutput:null};
const chat=$('chat'),input=$('manual'),anchor=$('typingAnchor');
const now=()=>new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const eventId=()=>crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class ApiError extends Error{constructor(message,status,http){super(message);this.status=status;this.http=http;}}
function connectionError(e,stage='concluir esta etapa'){
 if(e?.name==='AbortError'||e?.name==='TimeoutError')return new ApiError('Demorou para '+stage+'. Tente novamente para continuar.','TIMEOUT',0);
 if(e?.name==='TypeError'&&/fetch|network|load failed/i.test(e.message))return new ApiError('A conexão falhou ao '+stage+'. Confira a internet e tente novamente.','CONEXAO',0);
 return e;
}
const temporaryError=e=>['CONEXAO','TIMEOUT'].includes(e?.status)||[502,503,504].includes(e?.http);
async function retryConfirmed(action,payload,timeout=60000){
 // Only use for reads and the backend's idempotent upload/derived confirmations.
 for(let attempt=0;;attempt++){try{return await request(action,payload,timeout);}catch(e){if(attempt>=1||!temporaryError(e))throw e;await wait(700);}}
}
async function request(action,payload={},timeout=180000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{
  const r=await fetch(API,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-George-CSRF':state.csrf},body:JSON.stringify({action,...payload}),signal:c.signal});
  const raw=await r.text();let j;try{j=JSON.parse(raw);}catch{throw new ApiError(`O servidor retornou uma resposta inválida (HTTP ${r.status}).`,'JSON_INVALIDO',r.status);}
  if(!r.ok||j.ok===false)throw new ApiError(j.error||j.status||`HTTP ${r.status}`,j.status,r.status);return j;
 }catch(e){throw connectionError(e,({upload_finish:'confirmar a gravação',derived_finish:'confirmar o áudio',job:'consultar o documento',step:'preparar a ata',document_create:'solicitar o documento'})[action]||'concluir o pedido');}finally{clearTimeout(t);}
}
function showStatus(text,kind='text'){$('modeStatus').className='mode-status show '+kind;$('modeStatusText').textContent=text;}
function setActive(mode){document.querySelectorAll('.action').forEach(b=>{const selected=b.dataset.mode===mode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}
function normalStatus(){
 const meeting=$('btnMeeting'),label=meeting?.querySelector('.label');
 if(label)label.textContent=state.finalizing?'Finalizando':state.recording?.mode==='meeting'?'Encerrar':state.pendingCapture?'Retomar':'Reunião';
 if(meeting){meeting.disabled=!!state.finalizing;meeting.setAttribute('aria-label',state.recording?.mode==='meeting'?'Encerrar reunião e abrir a ata em PDF':state.pendingCapture?'Retomar encerramento da gravação':'Iniciar reunião');}
 if(state.finalizing){showStatus('Concluindo reunião • preparando sua ata…','warning');return;}
 if(state.recording?.error||state.recording?.rec?.state==='paused'){showStatus('Gravação pausada • confira o envio dos blocos','warning');return;}
 if(state.recording?.mode==='film'){showStatus('Filmagem em andamento • áudio e imagens amostradas','meeting');return;}
 if(state.recording){showStatus(!voice.live?'Reunião gravando • toque em Áudio para reconectar a voz':document.visibilityState!=='visible'?'Reunião: página oculta • captura pode ser interrompida':'Reunião gravando • diga Jorge, encerrar reunião',!voice.live||document.visibilityState!=='visible'?'warning':'meeting');return;}
 if(state.mode==='audio')showStatus(voice.live?'Áudio ligado • George está ouvindo':'Áudio selecionado • toque em Áudio para conversar',voice.live?'audio':'warning');
 else showStatus(state.activeModule==='agenda_dia'?'Módulo: Agenda do Dia • modo escrita':'Áudio desligado • modo escrita','text');
}
let followChat=true;chat.addEventListener('scroll',()=>{followChat=chat.scrollHeight-chat.scrollTop-chat.clientHeight<100;},{passive:true});
function scroll(force=false){if(force||followChat)requestAnimationFrame(()=>{chat.scrollTop=chat.scrollHeight;});}
function avatar(side){const a=document.createElement('div');a.className='msg-avatar';if(side==='me')a.textContent=(state.user?.nome||'GE').split(/\s/)[0].slice(0,2).toUpperCase();else{const im=document.createElement('img');im.src='assets/v09/logo_george.png';im.alt='George';a.append(im);}return a;}
function message(side,text,label='GEORGE',at=now()){
 const row=document.createElement('div');row.className='msg '+side;const a=avatar(side);const b=document.createElement('div');b.className='bubble';
 if(side!=='me'){const w=document.createElement('div');w.className='who';w.textContent=label;b.append(w);}
 const d=document.createElement('div');d.className='message-text';d.textContent=text;b.append(d);const tm=document.createElement('div');tm.className='time';tm.textContent=at;b.append(tm);
 addBubbleMenu(b,d);row.append(a,b);chat.insertBefore(row,anchor);scroll();return {row,bubble:b,text:d,avatar:a};
}
function notice(text){const n=document.createElement('div');n.className='system';n.textContent=text;chat.insertBefore(n,anchor);scroll();return n;}
function error(e){e=connectionError(e);notice(e.message||String(e));showStatus(e.message||String(e),'warning');if(e.http===401)showLogin();}
function showLogin(){state.auth=false;voice.pause();const dlg=$('loginDialog');if(!dlg.open)dlg.showModal();$('loginInfo').textContent='Use o mesmo e-mail e a mesma senha do ERP ÍMPAR. A senha é validada no servidor e não fica salva neste aplicativo.';}
async function authenticate(){
 const s=await request('session');state.csrf=s.csrf;
 if(!s.authenticated){showLogin();return false;}
 state.user=s.user;state.auth=true;return true;
}
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('loginSubmit');btn.disabled=true;
 try{const j=await request('login',{email:$('loginEmail').value,password:$('loginPassword').value});$('loginPassword').value='';state.csrf=j.csrf;state.user=j.user;state.auth=true;$('loginDialog').close();await initialize();}
 catch(e){$('loginInfo').textContent=e.message;}finally{btn.disabled=false;}
});
$('loginClose').onclick=()=>{location.replace('/menu_novo.html');};
$('exitApp').onclick=async()=>{
 if(state.recording||state.pendingCapture||state.finalizing||state.upload||state.busy||state.preparing){notice('Conclua a gravação, o envio ou o processamento antes de sair do aplicativo.');return;}
 try{await state.chatQueue;await state.logQueue;await saveDraft();}catch(e){error(e);return;}
 voice.close();location.replace('/menu_novo.html');
};
function requireAuth(){if(state.auth)return true;showLogin();return false;}
let draftTimer;
function saveDraft(){if(state.record&&state.auth)return request('draft',{record_id:state.record,text:input.value}).catch(error);return Promise.resolve();}
input.addEventListener('input',()=>{autosize();clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,500);});
function autosize(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,116)+'px';}
input.addEventListener('focus',()=>{
 if(!state.recording){state.mode='text';setActive('');voice.pause();normalStatus();}
});
function agendaReportButtons(result,bubble){
 const row=document.createElement('div');row.className='pdf-actions';bubble.append(row);
 const file=new File([result.blob],result.filename,{type:'application/pdf'});
 const share=smallButton('Compartilhar PDF',async()=>{
   try{
     if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
       await navigator.share({title:'ERP ÍMPAR — Agenda do Dia',text:'Relatório oficial da Agenda do Dia de '+result.date_br+'.',files:[file]});
     }else saveBlob(result.blob,result.filename);
   }catch(e){if(e.name!=='AbortError')error(e);}
 });
 const open=smallButton('Abrir / imprimir',()=>{
   try{
     window.GeorgePdf.open(result.blob,'Agenda do Dia').catch(error);
   }catch(e){error(e);}
 });
 const download=smallButton('Baixar PDF',()=>saveBlob(result.blob,result.filename));
 row.append(share,open,download);
}
function analyticsNumber(value){return Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2});}
function analyticsEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function analyticsLabel(group){return Object.values(group?.grupo||{}).filter(Boolean).join(' · ')||'Sem classificação';}
function analyticsCsv(payload){
 const header=['Data','Mês','Colaborador','Função','Obra','Atividade','Veículo','Status','Horas'];
 const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
 const rows=(payload.rows||[]).map(row=>[row.data,row.mes,row.colaborador,row.funcao,row.obra,row.atividade,row.veiculo,row.status,String(Number(row.horas||0).toFixed(4)).replace('.',',')]);
 return '\ufeff'+[header,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
}
function analyticsHtml(payload){
 const summary=payload.summary||{},period=summary.periodo||{},groups=(payload.groups||[]).slice(0,100),max=Math.max(1,...groups.map(row=>Number(row.horas||0)));
 const cards=[['Horas',analyticsNumber(summary.horas)+'h'],['Colaboradores',summary.colaboradores||0],['Obras',summary.obras||0],['Atividades',summary.atividades||0]];
 const bars=groups.slice(0,12).map(row=>`<div class="bar-row"><span>${analyticsEscape(analyticsLabel(row))}</span><i><b style="width:${Math.max(2,Number(row.horas||0)/max*100)}%"></b></i><strong>${analyticsNumber(row.horas)}h</strong></div>`).join('');
 const table=groups.map(row=>`<tr><td>${analyticsEscape(analyticsLabel(row))}</td><td>${analyticsEscape((row.colaboradores||[]).join(', '))}</td><td>${row.atividades||0}</td><td>${analyticsNumber(row.horas)}h</td></tr>`).join('');
 const missing=(summary.datas_uteis_sem_agenda||[]).length?`<p class="warning">Dias úteis sem Agenda disponível: ${analyticsEscape(summary.datas_uteis_sem_agenda.join(', '))}.</p>`:'';
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${analyticsEscape(payload.title||'Análise da Agenda do Dia')}</title><style>*{box-sizing:border-box}body{margin:0;background:#e8edf3;color:#16354d;font:14px Arial,sans-serif}.page{max-width:1100px;margin:24px auto;background:#fff;border-radius:20px;padding:28px;box-shadow:0 14px 40px #1e2f4433}header{background:linear-gradient(135deg,#394a5b,#1d66bd);color:#fff;padding:24px;border-radius:16px}h1{margin:0 0 8px;font-size:28px}header p{margin:0;color:#e7f2ff}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.card{padding:16px;border:1px solid #d4dee8;border-radius:14px;background:#f4f6f8}.card span{display:block;color:#60758a;font-size:12px}.card strong{display:block;margin-top:6px;font-size:24px;color:#195ca8}.panel{margin-top:18px;border:1px solid #d6dfe8;border-radius:14px;padding:18px}h2{margin:0 0 14px;font-size:18px}.bar-row{display:grid;grid-template-columns:230px 1fr 75px;gap:10px;align-items:center;margin:9px 0}.bar-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar-row i{height:14px;background:#dde4eb;border-radius:99px;overflow:hidden}.bar-row b{display:block;height:100%;background:linear-gradient(90deg,#607385,#247be0);border-radius:99px}.bar-row strong{text-align:right}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #e1e7ed;text-align:left}th{color:#195ca8}.warning{padding:10px;background:#fff4d6;border-radius:10px;color:#7a5410}.rule{font-size:12px;color:#627986}@media(max-width:700px){.cards{grid-template-columns:repeat(2,1fr)}.bar-row{grid-template-columns:110px 1fr 60px}.page{margin:0;border-radius:0;padding:14px}}@media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:none}.panel{break-inside:avoid}}</style></head><body><main class="page"><header><h1>${analyticsEscape(payload.title||'Análise da Agenda do Dia')}</h1><p>${analyticsEscape(period.inicio||'')} a ${analyticsEscape(period.fim||'')}</p></header><section class="cards">${cards.map(card=>`<div class="card"><span>${card[0]}</span><strong>${card[1]}</strong></div>`).join('')}</section>${missing}<section class="panel"><h2>Principais alocações</h2>${bars||'<p>Não há dados para o período.</p>'}</section><section class="panel"><h2>Consolidação</h2><table><thead><tr><th>Grupo</th><th>Colaboradores</th><th>Atividades</th><th>Horas</th></tr></thead><tbody>${table||'<tr><td colspan="4">Não há dados.</td></tr>'}</tbody></table></section><p class="rule">${analyticsEscape(summary.regra||'')}</p></main></body></html>`;
}
function ensureAnalyticsDialog(){
 let dlg=$('analyticsDialog');if(dlg)return dlg;
 dlg=document.createElement('dialog');dlg.id='analyticsDialog';dlg.style.cssText='width:min(1180px,96vw);height:min(900px,94vh);padding:0;border:0;border-radius:18px;overflow:hidden';
 const tools=document.createElement('div');tools.style.cssText='display:flex;gap:8px;align-items:center;padding:10px;background:#eaf3f6;border-bottom:1px solid #cddfe6';
 const frame=document.createElement('iframe');frame.title='Análise da Agenda do Dia';frame.style.cssText='width:100%;height:calc(100% - 56px);border:0;background:#fff';
 tools.append(smallButton('Imprimir / salvar PDF',()=>frame.contentWindow?.print()),smallButton('Baixar planilha',()=>downloadAnalyticsCsv(state.lastAnalytics)),smallButton('Fechar',()=>dlg.close()));dlg.append(tools,frame);document.body.append(dlg);return dlg;
}
function openAnalytics(payload){const dlg=ensureAnalyticsDialog();dlg.querySelector('iframe').srcdoc=analyticsHtml(payload);if(!dlg.open)dlg.showModal();}
function downloadAnalyticsCsv(payload){const name=(payload.filename||'agenda_do_dia')+'.csv';saveBlob(new Blob([analyticsCsv(payload)],{type:'text/csv;charset=utf-8'}),name);}
async function shareAnalytics(payload){
 const html=new File([analyticsHtml(payload)],(payload.filename||'agenda_do_dia')+'.html',{type:'text/html'});const csv=new File([analyticsCsv(payload)],(payload.filename||'agenda_do_dia')+'.csv',{type:'text/csv'});
 if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[html,csv]})))await navigator.share({title:'ERP ÍMPAR — Análise da Agenda do Dia',text:`Análise da Agenda do Dia: ${analyticsNumber(payload.summary?.horas)} horas.`,files:[html,csv]});else downloadAnalyticsCsv(payload);
}
function analyticsButtons(payload,bubble){
 state.lastAnalytics=payload;state.lastOutput='analytics';const row=document.createElement('div');row.className='pdf-actions';
 row.append(smallButton('Ver dashboard / PDF',()=>openAnalytics(payload)),smallButton('Baixar planilha',()=>downloadAnalyticsCsv(payload)),smallButton('Compartilhar',()=>shareAnalytics(payload).catch(e=>{if(e.name!=='AbortError')error(e);})));bubble.append(row);
}
function analyticsLocalIntent(n){return /^(?:(?:pode|quero|agora|por favor) )?(?:exporta(?:r)?|exporte|baixa(?:r)?|baixe|gere|gera(?:r)?|faz(?:er)?|faca|monta(?:r)?|monte|abre?|abra|abrir|imprime?|imprima|imprimir|compartilha(?:r)?|compartilhe|envia(?:r)?|envie)(?: (?:isso|esse|essa|o|a|um|uma|ultimo|ultima|relatorio|resultado|dashboard|grafico|pdf|planilha|excel|csv))*[.!? ]*$/.test(n);}
function runAnalyticsLocal(text,source,id,n){
 const payload=state.lastAnalytics;message('me',text);state.chatQueue=state.chatQueue.catch(()=>{}).then(async()=>{try{await logDirectTurn(state.record,'user',text,id);
  let reply='Resultado disponível.';
  if(/compartilh|envia/.test(n)){await shareAnalytics(payload);reply='Abri o compartilhamento da última análise.';}
  else if(/export|baix|planilha|excel|csv/.test(n)){downloadAnalyticsCsv(payload);reply='Exportei a última análise em uma planilha compatível com Excel.';}
  else{openAnalytics(payload);reply=/pdf|imprim/.test(n)?'Abri o relatório para imprimir ou salvar em PDF.':'Abri o dashboard da última análise.';}
  message('george',reply,'ANÁLISE DA AGENDA');await logDirectTurn(state.record,'assistant',reply,eventId());if((state.mode==='audio'||source==='audio')&&!state.recording?.stopping)await voice.speak(reply);
 }catch(e){if(e.name!=='AbortError')error(e);}});return true;
}
function manualLocalIntent(text){
 const n=normalized(text)
   .replace(/^(?:(?:ei|oi|ola|por favor|ta|ok|entao)[, .!]* )?(?:george|jorge|giorge|georgie|djorge|jordi)[, :.!]*/,'')
   .replace(/[.!?]+$/,'').trim();
 const subject=/(?:agenda|atividade) do dia/;
 const help=/(?:manual|manuais|documentacao|ajuda|auxilio|guias?(?: operacional)?|tutorial|instrucao|instrucoes|orientacao|duvidas?|faq|passo a passo|raio[ -]?x|detalhes? das atividades|como (?:usar|funciona))/;
 const action=/(?:abre|abrir|abra|mostra|mostrar|mostre|gera|gerar|gere|consulta|consultar|consulte|quero|preciso|acessa|acessar|acesse|tem acesso|cade|onde esta|procura|procurar|encontra|encontrar|veja|ver|leia|ler|baixa|baixar|imprime|imprimir|compartilha|compartilhar)/;
 const explicit=help.test(n)&&subject.test(n);
 const contextual=state.activeModule==='agenda_dia'&&help.test(n)&&(action.test(n)||/^(?:manual|manuais|documentacao|ajuda|auxilio|guias?|tutorial|instrucao|instrucoes|orientacao|duvidas?|faq|passo a passo|raio[ -]?x)$/.test(n));
 return explicit||contextual;
}
function ensureManualDialog(){
 let dlg=$('agendaManualDialog');if(dlg)return dlg;
 dlg=document.createElement('dialog');dlg.id='agendaManualDialog';dlg.style.cssText='width:min(1180px,98vw);height:min(900px,96vh);padding:0;border:0;border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 30px 100px #0006';
 const frame=document.createElement('iframe');frame.title='Manual da Agenda do Dia';frame.src='/cronograma/manual_agenda_do_dia.html?v=1.3';frame.style.cssText='width:100%;height:100%;border:0;background:#fff';dlg.append(frame);document.body.append(dlg);
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='ERP_IMPAR_MANUAL_CLOSE'&&dlg.open)dlg.close();});
 return dlg;
}
function openAgendaManual(){const dlg=ensureManualDialog();if(!dlg.open)dlg.showModal();}
function runManualLocalIntent(text,source,id){
 if(!manualLocalIntent(text))return false;
 message('me',text);state.chatQueue=state.chatQueue.catch(()=>{}).then(async()=>{
   const reply='Abri a documentação da Agenda do Dia. Você pode consultar o manual, imprimir, baixar o PDF ou compartilhar.';
   try{await logDirectTurn(state.record,'user',text,id);openAgendaManual();message('george',reply,'MANUAL DA AGENDA');await logDirectTurn(state.record,'assistant',reply,eventId());if((state.mode==='audio'||source==='audio')&&!state.recording?.stopping)await voice.speak(reply);}
   catch(e){if(e.name!=='AbortError')error(e);}
 });return true;
}
async function logDirectTurn(record,role,text,id){
 try{await request('log_turn',{record_id:record,role,text,event_id:id});}
 catch(e){throw new Error('Não foi possível confirmar esta mensagem no servidor. '+e.message);}
}
function moduleActivationIntent(text){
 const n=normalized(text).replace(/^(?:(?:ei|oi|ola|por favor|ta|ok|entao)[, .!]* )?(?:george|jorge|giorge|georgie|djorge|jordi)[, :.!]*/,'').replace(/[.!?]+$/,'').trim();
 return /^(?:agenda|atividade) do dia$/.test(n);
}
function activateAgendaDay(text,source,id){
 if(!moduleActivationIntent(text))return false;
 message('me',text);state.activeModule='agenda_dia';normalStatus();
 state.chatQueue=state.chatQueue.catch(()=>{}).then(async()=>{const reply='Ok, Agenda do Dia.';try{const j=await request('chat',{record_id:state.record,text,event_id:id});state.activeModule=j.module||'agenda_dia';message('george',reply,'AGENDA DO DIA');if((state.mode==='audio'||source==='audio')&&!state.recording?.stopping)await voice.speak(reply);}catch(e){error(e);}});
 return true;
}
function queueQuestion(text,source='text',id=eventId(),retryRecord=null){
 if(!text.trim()||!requireAuth())return;
 if(handleLocalIntent(text,source,id))return;
 if(activateAgendaDay(text,source,id))return;
 if(runManualLocalIntent(text,source,id))return;
 const record=retryRecord||state.recording?.id||state.record;const speak=state.mode==='audio'||state.recording?.mode==='meeting';
 message('me',text);scroll(true);

 // Capability oficial de relatório: não passa pela IA e não recria template.
 if(window.GeorgeAgendaReport?.matches?.(text)){
   state.chatQueue=state.chatQueue.catch(()=>{}).then(async()=>{
     const indicator=notice('Gerando o relatório pela Agenda do Dia oficial…');
     const operation=window.GeorgeAgendaExperience?.operation('Relatório da Agenda do Dia','Abrindo a fonte oficial…');
     state.busy=true;voice.pauseTransmit();
     await logDirectTurn(record,'user',text,id);
     try{
       const result=await window.GeorgeAgendaReport.build(text,{onStage:stage=>{indicator.textContent=stage;operation?.update('Relatório da Agenda do Dia',stage,null);}});
       indicator.remove();
       const reply=result.wants_share
         ? `PDF oficial da Agenda do Dia de ${result.date_br} gerado e aberto. Use Compartilhar no visualizador para escolher o aplicativo.`
         : result.wants_print
         ? `PDF oficial da Agenda do Dia de ${result.date_br} gerado e aberto. Use Imprimir no visualizador.`
         : `PDF oficial da Agenda do Dia de ${result.date_br} gerado e aberto pelo próprio módulo da Agenda.`;
       const m=message('george',reply,'RELATÓRIO DA AGENDA');
       m.row.dataset.sources=result.source;
       agendaReportButtons(result,m.bubble);
       await logDirectTurn(record,'assistant',reply,eventId());
       try{await window.GeorgePdf.open(result.blob,'Agenda do Dia');}catch(e){error(e);}
       if(speak&&!state.recording?.stopping)await voice.speak(reply);
     }catch(e){
       indicator.remove();
       const reply=e.message||String(e);
       const m=message('george',reply,'RELATÓRIO DA AGENDA');
       m.row.dataset.sources='agenda_do_dia_novo.html';
       await logDirectTurn(record,'assistant',reply,eventId());
       showStatus(reply,'warning');
     }finally{
       operation?.close();state.busy=false;voice.resumeTransmit();normalStatus();
     }
   });
   return;
 }

 state.chatQueue=state.chatQueue.catch(()=>{}).then(async()=>{
   const indicator=notice('Consultando o contexto e as fontes do ERP…');state.busy=true;voice.pauseTransmit();
   try{await state.logQueue;const j=await request('chat',{record_id:record,text,event_id:id});indicator.remove();if(j.module)state.activeModule=j.module;const m=message('george',j.text);
      if(j.sources?.length)m.row.dataset.sources=j.sources.join(' | ');
      if(j.analytics){analyticsButtons(j.analytics,m.bubble);if(j.analytics.format==='planilha')downloadAnalyticsCsv(j.analytics);else if(['pdf','grafico','dashboard','tabela'].includes(j.analytics.format))openAnalytics(j.analytics);}
      if(speak&&!state.recording?.stopping)await voice.speak(j.text);
   }catch(e){indicator.remove();error(e);const m=message('george','Você pode retomar este pedido para conferir como ficou.');m.bubble.append(smallButton('Retomar pedido',()=>{m.row.remove();queueQuestion(text,source,id,record);}));}finally{state.busy=false;voice.resumeTransmit();normalStatus();}
 });
}
function sendText(){const text=input.value.trim();if(!text||!requireAuth())return;if(state.recording&&state.recording.mode!=='meeting'){notice('Encerre a gravação para conversar. Seu texto foi mantido.');return;}input.value='';autosize();saveDraft();queueQuestion(text);}
$('btnSend').onclick=sendText;
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendText();}});
const normalized=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const stopSpeechIntent=s=>{
 const n=normalized(s);
 const name='(?:george|jorge|giorge|georgie|djorge|jordi)';
 const pause='(?:so (?:um |uma )?(?:minuto|minutinho|momento)|segura(?: ai)?|para(?: de falar)?|pare(?: de falar)?|espera(?: ai)?|aguarda(?: ai)?|nao e isso)';
 return new RegExp('^(?:(?:ei|oi|por favor)[, .!]* )?(?:'+name+'[, :.!]*'+pause+'|'+pause+'[, :.!]*'+name+')(?:[, .!]*(?:por favor|um minutinho))?[, .!]*$').test(n);
};
const called=s=>/^(?:(?:ei|oi|ola|por favor|ta|ok|entao)[, .!]* )?(?:george|jorge|giorge|georgie|djorge|jordi)\b/.test(normalized(s));
function meetingEndIntent(text){
 const n=normalized(text).replace(/^(?:(?:ei|oi|ola|por favor|ta|ok|entao)[, .!]* )?(?:george|jorge|giorge|georgie|djorge|jordi)[, :.!]*/,'').replace(/[.!?]+$/,'').trim();
 // Match a complete explicit request, never an ambient mention, negation or agenda command.
 return /^(?:(?:por favor|agora)[, ]+)?(?:(?:pode|poderia|vamos|quero que voce|eu quero que voce|preciso que voce) )?(?:encerrar|encerra|encerre|finalizar|finaliza|finalize|terminar|termina|termine|parar|para|pare)(?: (?:a|essa|esta|nossa|a nossa|a atual))? (?:reuniao|gravacao)(?:(?:[, ]+)(?:agora|por favor))?(?:[, ]*(?:e |para |pra )(?:(?:depois |ja )?(?:abrir|abra|abre|gerar|gere|gera|baixar|baixe|compartilhar|compartilhe) (?:o |a )?(?:pdf|ata)(?: em pdf)?(?: (?:para|pra) (?:download|baixar|compartilhar))?(?: e (?:abrir|abra|abre|baixar|baixe|compartilhar|compartilhe)(?: (?:o |a )?(?:pdf|ata))?)*|(?:ir|va) direto (?:na|para a) abertura do pdf(?: para download)?))?(?:[, ]+por favor)?$/.test(n);
}

// The WebRTC connection transcribes and voices validated server answers only.
// No automatic LLM replies to ambient conversation; the server chat owns context/tools.
const voice={pc:null,dc:null,stream:null,sender:null,audio:null,live:false,connecting:null,speaking:false,speakDone:null,seen:new Set(),wanted:false,
 async connect(){
   if(this.connecting)return this.connecting;
   if(this.live&&this.dc?.readyState==='open'&&this.stream?.getAudioTracks().some(t=>t.readyState==='live')&&!['failed','closed','disconnected'].includes(this.pc?.connectionState)){this.wanted=true;await this.resumeTransmit();return;}
   const retained=state.recording?.stream?.active?state.recording.stream:null;
   if(retained){this.dc&&(this.dc.onclose=null);this.dc?.close();this.pc?.close();this.audio?.pause();this.live=false;this.speaking=false;this.speakDone?.();}else if(this.pc||this.stream)this.close();
   if(this.connecting)return this.connecting;
   this.connecting=(async()=>{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Microfone requer acesso HTTPS em um navegador compatível.');
    this.stream=retained||await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    this.pc=new RTCPeerConnection();this.audio=new Audio();this.audio.muted=true;this.audio.autoplay=true;this.audio.playsInline=true;
    this.pc.ontrack=e=>{this.audio.srcObject=e.streams[0];this.audio.play().catch(()=>showStatus('Toque em Áudio para liberar a reprodução.','warning'));};
    this.sender=this.pc.addTrack(this.stream.getAudioTracks()[0],this.stream);this.dc=this.pc.createDataChannel('oai-events');
    let resolveOpen,rejectOpen;const open=new Promise((a,b)=>{resolveOpen=a;rejectOpen=b;});open.catch(()=>{});const timer=setTimeout(()=>rejectOpen(new Error('A conexão de voz não foi estabelecida.')),70000);
    this.dc.onopen=()=>{this.live=true;clearTimeout(timer);resolveOpen();};this.dc.onclose=()=>{this.live=false;this.speaking=false;this.speakDone?.();this.speakDone=null;clearTimeout(timer);rejectOpen(new Error('A sessão de voz foi encerrada. Toque em Áudio para reconectar.'));normalStatus();};
    this.dc.onmessage=e=>{try{this.event(JSON.parse(e.data));}catch(err){console.warn('Evento de voz inválido');}};
    this.pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(this.pc?.connectionState)){this.live=false;normalStatus();}};
    const offer=await this.pc.createOffer();await this.pc.setLocalDescription(offer);
    const c=new AbortController(),tt=setTimeout(()=>c.abort(),70000);
    try{const r=await fetch(BASE+'realtime.php',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/sdp','X-George-CSRF':state.csrf},body:offer.sdp,signal:c.signal});const raw=await r.text();if(!r.ok){let msg='Não foi possível ligar a voz.';try{msg=JSON.parse(raw).error||msg;}catch{}throw new Error(msg);}await this.pc.setRemoteDescription({type:'answer',sdp:raw});await open;}
    catch(e){clearTimeout(timer);if(retained){if(this.dc)this.dc.onclose=null;this.dc?.close();this.pc?.close();this.live=false;this.sender=null;this.stream=retained;}else this.close();throw e;}finally{clearTimeout(tt);}
    this.wanted=true;this.resumeTransmit();normalStatus();
   })();
   try{return await this.connecting;}finally{this.connecting=null;}
 },
partialTranscripts:new Map(),interruptedItems:new Set(),interruptionOnly:new Set(),tts:null,ttsAbort:null,speechTicket:0,pausedSpeech:null,
transcriptOrder:[],transcriptFinals:new Map(),transcriptTimer:null,
 drainTranscripts(){while(this.transcriptOrder.length&&this.transcriptFinals.has(this.transcriptOrder[0])){const id=this.transcriptOrder.shift(),e=this.transcriptFinals.get(id);this.transcriptFinals.delete(id);this.acceptTranscript(e);}if(this.transcriptOrder.length){clearTimeout(this.transcriptTimer);this.transcriptTimer=setTimeout(()=>notice('Há uma fala aguardando transcrição. Aguarde antes de repetir um comando para evitar duplicação.'),20000);}},
 event(e){
  const t=e.type||'';
  if(t==='input_audio_buffer.speech_started'&&this.speaking)this.interruptionOnly.add(e.item_id);
  if(t==='conversation.item.input_audio_transcription.delta'){const part=(this.partialTranscripts.get(e.item_id)||'')+(e.delta||'');this.partialTranscripts.set(e.item_id,part);if(this.speaking&&stopSpeechIntent(part)){this.interruptedItems.add(e.item_id);this.stopSpeaking();}}
  if(t==='input_audio_buffer.committed'){if(!this.seen.has(e.item_id)&&!this.transcriptOrder.includes(e.item_id))this.transcriptOrder.push(e.item_id);this.drainTranscripts();}
  if(t==='conversation.item.input_audio_transcription.completed'){if(this.seen.has(e.item_id))return;this.transcriptFinals.set(e.item_id,e);if(!this.transcriptOrder.includes(e.item_id))this.transcriptOrder.push(e.item_id);this.drainTranscripts();return;}
  if(t==='conversation.item.input_audio_transcription.failed'){this.transcriptOrder=this.transcriptOrder.filter(id=>id!==e.item_id);notice('Uma fala não foi transcrita. Repita apenas esse pedido.');this.drainTranscripts();}

  if(t==='output_audio_buffer.stopped'||t==='output_audio_buffer.cleared'){this.speaking=false;this.speakDone?.();this.speakDone=null;this.resumeTransmit();this.markSpeaking(false);}
  if(t==='response.done'&&e.response?.status==='failed'){this.speaking=false;this.speakDone?.();this.speakDone=null;this.resumeTransmit();notice('A resposta em texto está salva; a reprodução por voz não terminou.');this.markSpeaking(false);}
  if(t==='error'){this.speaking=false;notice('Áudio: '+(e.error?.message||'erro na sessão'));this.speakDone?.();this.speakDone=null;this.resumeTransmit();this.markSpeaking(false);}
 },
 acceptTranscript(e){
    const text=String(e.transcript||'').trim(),id=e.item_id||eventId();
    if(!text||this.seen.has(id))return;this.seen.add(id);this.partialTranscripts.delete(id);
    if((state.recording?.mode==='meeting'||state.pendingCapture)&&called(text)&&meetingEndIntent(text)){queueQuestion(text,'audio',id);return;}
    if(this.interruptedItems.delete(id)||stopSpeechIntent(text)){this.stopSpeaking();message('me',text);const rid=state.recording?.id||state.record;state.logQueue=state.logQueue.catch(()=>{}).then(()=>request('log',{record_id:rid,text,event_id:id})).catch(error);return;}
    const startedDuringSpeech=this.interruptionOnly.delete(id);const duringSpeech=this.speaking||startedDuringSpeech;
    if(duringSpeech){if(state.recording?.mode==='meeting'&&!called(text)){const rid=state.recording.id;message('me',text);state.logQueue=state.logQueue.catch(()=>{}).then(()=>request('log',{record_id:rid,text,event_id:id})).catch(error);}return;}
    if(state.recording?.mode==='meeting'){
      if(called(text))queueQuestion(text,'audio',id);
      else{message('me',text);const rid=state.recording.id;state.logQueue=state.logQueue.catch(()=>{}).then(()=>request('log',{record_id:rid,text,event_id:id})).then(()=>reviewMeeting()).catch(error);}
    }else if(state.mode==='audio'&&!state.recording)queueQuestion(text,'audio',id);
 },
 send(e){if(this.dc?.readyState!=='open')throw new Error('Áudio ainda não está conectado.');this.dc.send(JSON.stringify(e));},
 async speak(text,full=false){
   if(state.mode==='text'&&!state.recording)return;
   await this.connect();this.stopSpeaking(false);this.pausedSpeech=null;
   const plain=String(text).replace(/[*#`]/g,'').trim();
   const sentences=plain.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[plain];
   let spoken=full?plain:sentences.slice(0,2).join(' ').trim();
   let remainder='';const limit=full?2800:480;if(spoken.length>limit){const prefix=spoken.slice(0,limit-30),cut=prefix.lastIndexOf(' ');remainder=full?spoken.slice(cut).trim():'';spoken=prefix.slice(0,cut)+'.';}
   if(spoken.length<plain.length&&!full)spoken+=' Se quiser, eu leio os detalhes.';
   this.lastSpeech=plain;this.speaking=true;this.markSpeaking(true);this.audio&&(this.audio.muted=true);
   const ticket=++this.speechTicket;this.ttsAbort=new AbortController();await this.resumeTransmit();showStatus('George está falando • diga “George, só um minuto” para pausar','audio');
   try{
     const response=await fetch(BASE+'speech.php',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-George-CSRF':state.csrf},body:JSON.stringify({text:spoken}),signal:this.ttsAbort.signal});
     if(!response.ok){let j;try{j=await response.json();}catch{}throw new Error(j?.error||'Não consegui falar agora. Minha resposta está na conversa.');}
     const blob=await response.blob();if(ticket!==this.speechTicket)return;
     const url=URL.createObjectURL(blob),a=new Audio(url);this.tts=a;a.playsInline=true;
     try{await new Promise((resolve,reject)=>{const watchdog=setTimeout(()=>reject(new Error('A reprodução não terminou. A resposta está na conversa.')),120000);this.speakDone=()=>{clearTimeout(watchdog);resolve();};a.onended=this.speakDone;a.onerror=()=>{clearTimeout(watchdog);reject(new Error('Não consegui reproduzir a voz. Minha resposta está na conversa.'));};a.play().catch(reject);});}
     finally{a.pause();URL.revokeObjectURL(url);}
     if(remainder&&ticket===this.speechTicket)await this.speak(remainder,true);
   }catch(e){if(e.name!=='AbortError')notice(e.message);}
   finally{if(ticket===this.speechTicket){this.speaking=false;this.tts=null;this.ttsAbort=null;this.speakDone=null;this.markSpeaking(false);this.resumeTransmit();normalStatus();}}
 },
 stopSpeaking(keep=true){
   const was=this.speaking;if(keep&&was)this.pausedSpeech=this.lastSpeech;this.speechTicket++;this.ttsAbort?.abort();this.tts?.pause();if(this.audio)this.audio.muted=true;
   try{if(this.remoteSpeaking&&this.dc?.readyState==='open'){this.send({type:'response.cancel'});this.send({type:'output_audio_buffer.clear'});}}catch{}
   this.speakDone?.();this.speakDone=null;this.tts=null;this.speaking=false;this.markSpeaking(false);this.resumeTransmit();if(keep&&was)showStatus(state.recording?'Fala pausada • reunião continua gravando':'Fala pausada • pode falar','audio');
 },
 markSpeaking(on){document.querySelectorAll('.msg-avatar.speaking').forEach(x=>x.classList.remove('speaking'));if(on){const av=[...document.querySelectorAll('.msg.george .msg-avatar')].pop();av?.classList.add('speaking');}},
 trackQueue:Promise.resolve(),
 pauseTransmit(force=false){if(!force&&this.wanted&&(this.speaking||state.recording&&!state.recording.stopping))return this.resumeTransmit();this.trackQueue=this.trackQueue.catch(()=>{}).then(()=>this.sender?.replaceTrack(null));return this.trackQueue.catch(()=>{});},
 resumeTransmit(){this.trackQueue=this.trackQueue.catch(()=>{}).then(async()=>{if(this.wanted&&(this.speaking||state.recording&&!state.recording.stopping||!state.busy&&!state.upload)&&this.stream?.active){const t=this.stream.getAudioTracks()[0];if(t&&t.readyState==='live'){t.enabled=true;await this.sender?.replaceTrack(t);}}});return this.trackQueue.catch(()=>{});},
 pause(){this.wanted=false;this.stopSpeaking(false);this.pauseTransmit(true);if(!state.recording)this.stream?.getAudioTracks().forEach(t=>{t.enabled=false;});if(this.speaking){try{this.send({type:'response.cancel'});this.send({type:'output_audio_buffer.clear'});}catch{}this.speakDone?.();this.speaking=false;}},
 close(){this.pause();clearTimeout(this.transcriptTimer);this.transcriptOrder=[];this.transcriptFinals.clear();this.dc?.close();this.pc?.close();this.stream?.getTracks().forEach(t=>t.stop());this.audio?.pause();this.dc=null;this.pc=null;this.stream=null;this.sender=null;this.live=false;},
};
$('btnAudio').onclick=async()=>{
 if(!requireAuth())return;
 if(state.finalizing){showStatus('Concluindo reunião • aguarde a ata…','warning');return;}
 if(state.recording){
  if(state.recording.mode!=='meeting'){notice('Use Parar para concluir a filmagem.');return;}
  try{await voice.connect();voice.audio?.play().catch(()=>{});normalStatus();}
  catch(e){error(connectionError(e,'reconectar a voz'));}return;
 }
 if(state.mode==='audio'&&voice.live&&voice.wanted){state.mode='text';setActive('');voice.pause();normalStatus();return;}
 state.mode='audio';setActive('audio');$('btnAudio').focus({preventScroll:true});
 try{await voice.connect();voice.audio?.play().catch(()=>{});state.mode='audio';setActive('audio');normalStatus();}catch(e){error(e);showStatus('Áudio selecionado • permita o microfone e toque novamente','warning');}
};

// Uploads are persisted on the server in ordered, hash-checked chunks.
async function uploadChunk(id,index,blob,signal){
 if(blob.size>1024*1024)throw new Error('Bloco de upload acima do limite.');
 const fd=new FormData();fd.append('action','upload_chunk');fd.append('record_id',id);fd.append('index',String(index));fd.append('chunk',blob,'chunk.part');
 const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,60000);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 try{const r=await fetch(API,{method:'POST',credentials:'include',headers:{'X-George-CSRF':state.csrf},body:fd,signal:controller.signal});let j;try{j=await r.json();}catch{throw new ApiError(`O trecho não foi confirmado (HTTP ${r.status}).`,'JSON_INVALIDO',r.status);}if(!r.ok||!j.ok)throw new ApiError(j.error||'Upload não confirmado',j.status,r.status);return j;}
 catch(e){if(signal?.aborted)throw e;throw connectionError(e,'enviar o trecho da gravação');}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
async function uploadFile(file,mediaCard=null){
 const operation=window.GeorgeAgendaExperience?.operation('Enviando arquivo',file.name,0);let j;try{j=await request('media_start',{name:file.name,mime:file.type,size:file.size,kind:'media',parent_record_id:state.recording?.id||state.record});}catch(e){operation?.close();throw e;}const id=j.record_id;state.uploadId=id;let i=0;const c=new AbortController();state.uploadAbort=c;state.upload=true;voice.pauseTransmit();
 mediaCard?.setId(id);mediaCard?.update('Enviando',0);
 try{for(let pos=0;pos<file.size;pos+=j.chunk_bytes){const chunk=file.slice(pos,pos+j.chunk_bytes);let sent=false;
   for(let attempt=0;attempt<3&&!sent;attempt++){try{await uploadChunk(id,i,chunk,c.signal);sent=true;}catch(e){if(c.signal.aborted||attempt===2)throw e;await wait(700*(attempt+1));}}
   i++;const pct=Math.min(100,Math.round((pos+chunk.size)/file.size*100));$('attachStatus').textContent='Enviando '+pct+'% • o chat continua preservado.';mediaCard?.update('Enviando',pct);operation?.update('Enviando arquivo',file.name,pct);
 }await request('upload_finish',{record_id:id,chunks:i});mediaCard?.update('Enviado • aguardando processamento',100);return id;}
 finally{operation?.close();state.upload=false;state.uploadId=null;state.uploadAbort=null;voice.resumeTransmit();}
}
let chosen=null;
function openAttach(){if(!requireAuth())return;saveDraft();chosen=null;$('filePicker').value='';$('attachName').textContent='Nenhum arquivo selecionado.';$('attachStatus').textContent='Para exportações do WhatsApp, o George lê primeiro o texto, depois os áudios e por último os vídeos. Imagens e documentos do ZIP são ignorados.';$('attachSend').disabled=true;$('attachDialog').showModal();}
$('btnAttach').onclick=openAttach;
$('attachChoose').onclick=()=>{$('filePicker').click();};
$('filePicker').addEventListener('cancel',()=>{$('attachStatus').textContent='Seleção cancelada. Você continua no George.';});
$('filePicker').onchange=()=>{chosen=$('filePicker').files?.[0]||null;$('attachName').textContent=chosen?`${chosen.name} • ${(chosen.size/1024/1024).toFixed(1)} MB`:'Nenhum arquivo selecionado.';$('attachSend').disabled=!chosen;};
function closeAttach(){if(state.upload){state.uploadAbort?.abort();notice('Envio interrompido. Os blocos já recebidos permanecem no servidor; a conversa não foi encerrada.');}$('attachDialog').close();$('btnAttach').focus({preventScroll:true});}
$('attachBack').onclick=closeAttach;
$('attachDialog').addEventListener('cancel',e=>{e.preventDefault();closeAttach();});
$('attachSend').onclick=async()=>{
 if(!chosen||state.upload)return;const file=chosen;$('attachSend').disabled=true;$('attachChoose').disabled=true;
 const mediaCard=window.GeorgeAgendaExperience?.create(file);
 try{const id=await uploadFile(file,mediaCard);$('attachDialog').close();await prepareOrProcess(id,file,mediaCard);}
 catch(e){$('attachStatus').textContent=e.name==='AbortError'?'Envio interrompido.':e.message;mediaCard?.error(e.message,()=>{$('attachSend').click();});}
 finally{$('attachSend').disabled=!chosen;$('attachChoose').disabled=false;}
};
function taskText(j){const map={derived_processing:'Interpretando os trechos de áudio e imagens amostradas…',uploaded:'Arquivo salvo • verificando o conteúdo…',whatsapp_extracting:'Abrindo a conversa do WhatsApp…',whatsapp_processing:'Processando conversa do WhatsApp…',transcription_ready:'Transcrição salva • preparando a ata…',summarizing:`Gerando ata • ${j.report_parts_done}/${j.report_parts_total} partes`,consolidating:'Consolidando todas as partes da ata…',rendering:'Aplicando o template executivo oficial…',ready:'Ata e transcrição prontas.'};if(j.state==='whatsapp_processing'){const stage={texto:'texto',audio:'áudios',video:'vídeos'}[j.batch_stage]||'arquivos';return `Lendo ${stage} • ${j.batch_done}/${j.batch_total}${j.batch_current?' • '+j.batch_current:''}${j.batch_failed?' • '+j.batch_failed+' não lido(s)':''}`;}return j.state==='transcribing'?`Transcrevendo áudio • ${j.segments_done}/${j.segments_total} trechos`:map[j.state]||j.state;}
async function processJob(id,options={autoOpen:true,mediaCard:null}){
 if(state.jobRunning.has(id))return false;state.jobRunning.add(id);const card=options.mediaCard||window.GeorgeAgendaExperience?.get(id);const n=message('george','Verificando arquivo recebido…','ARQUIVO / ATA');const operation=window.GeorgeAgendaExperience?.operation('Processando arquivo','Verificando o original recebido…');
 try{let j=await retryConfirmed('job',{record_id:id});let recoveries=0;
  while(j.state!=='ready'){
   if(['cancelled','deleted'].includes(j.state)){n.text.textContent=j.state==='deleted'?'Arquivo excluído.':'Arquivo retirado da fila.';return false;}
   if(j.state==='uploading')throw new Error('O envio ainda precisa ser concluído. Use Retomar encerramento na reunião; para anexos, reenvie o original.');
   n.text.textContent=taskText(j);card?.job(j);operation?.update('Processando arquivo',taskText(j),null);
   try{j=await request('step',{record_id:id},195000);recoveries=0;}
   catch(e){if(!temporaryError(e)||recoveries++>=1)throw e;n.text.textContent='A conexão oscilou. Conferindo a etapa já concluída…';await wait(900);j=await retryConfirmed('job',{record_id:id});}
  }
  n.text.textContent='Documento gerado. Carregando o PDF…';card?.job(j);operation?.update('Documento concluído','Carregando o PDF validado…',null);
  const ready=await reportActions(id,n.bubble,{...options,onReady:()=>{n.text.textContent='Seu PDF está pronto.';}});
  let transcript='';try{transcript=await (await downloadBlob(id,'text')).text();}catch(_){transcript='';}
  card?.done(transcript||'Processamento concluído. O documento está pronto.');
  n.text.textContent=ready?'Seu PDF está pronto.':'A ata foi gerada, mas o PDF ainda não carregou. Use Tentar carregar novamente.';return ready;
 }catch(e){n.text.textContent=connectionError(e,'preparar a ata').message+' Os dados já confirmados estão preservados.';
  card?.error(e.message,()=>processJob(id,{...options,mediaCard:card}));
  const b=smallButton('Retomar processamento',()=>{n.row.remove();processJob(id,options);});
  n.bubble.append(b,smallButton('Preparar neste aparelho',async()=>{try{const original=await downloadBlob(id,'source');const j=await request('job',{record_id:id});await prepareInBrowser(id,new File([original],j.name),n.text);await processJob(id,options);}catch(e){error(e);}}),smallButton('Baixar original',async()=>{try{saveBlob(await downloadBlob(id,'source'),'Original_George');}catch(e){error(e);}}));return false;
 }finally{operation?.close();state.jobRunning.delete(id);normalStatus();}
}
function smallButton(text,fn){const b=document.createElement('button');b.type='button';b.className='g09-button';b.textContent=text;b.onclick=fn;return b;}
async function downloadBlob(id,kind,attempt=0){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{
 const url=new URL('download.php',BASE);url.searchParams.set('record_id',id);url.searchParams.set('kind',kind);
 const r=await fetch(url.href,{credentials:'include',cache:'no-store',redirect:'error',signal:controller.signal});
 if(!r.ok){let j;try{j=await r.json();}catch{}throw new ApiError(j?.error||'Arquivo ainda não disponível.',j?.status,r.status);}
 const blob=await r.blob();
 if(kind==='pdf'){
  const record=r.headers.get('X-George-Record');
  // Older production PHP binds downloads to the authenticated record but sends no X-George metadata.
  // Missing metadata is different from an explicitly mismatched record or digest.
  if(record!==null&&record!==id)throw new Error('Este PDF não corresponde ao documento solicitado.');
  if(r.url){const received=new URL(r.url);if(received.origin!==url.origin||received.pathname!==url.pathname||received.searchParams.get('record_id')!==id||received.searchParams.get('kind')!=='pdf')throw new Error('O servidor não retornou o PDF solicitado.');}
  await window.GeorgePdf.validate(blob,{sha256:r.headers.get('X-George-SHA256'),bytes:Number(r.headers.get('X-George-Bytes'))||0});
  if(record===null){
   const job=await request('job',{record_id:id});
   if(job.record_id!==id)throw new Error('Este PDF não corresponde ao documento solicitado.');
   if(job.state!=='ready'||job.pdf_ready!==true)throw new Error('O PDF ainda está sendo preparado. Tente carregar novamente em instantes.');
  }
 }
 return blob;
 }catch(err){const e=connectionError(err,'carregar o arquivo');if(attempt<1&&temporaryError(e)){clearTimeout(timer);await wait(700);return downloadBlob(id,kind,attempt+1);}throw e;}finally{clearTimeout(timer);}
}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function reportActions(id,bubble,config={}){
 const row=document.createElement('div');row.className='pdf-actions';bubble.append(row);
 const main=document.createElement('div');main.className='pdf-primary-actions';
 const status=document.createElement('p');status.className='pdf-action-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 let pdfFile=null,loading=null;
 const fail=e=>{status.textContent=e.message||'Não consegui carregar o PDF. Tente novamente.';status.classList.add('is-error');if(e.http===401)showLogin();};
 const loadPdf=()=>{
  if(pdfFile)return Promise.resolve(pdfFile);if(loading)return loading;
  status.textContent='Carregando PDF…';status.classList.remove('is-error');retry.hidden=true;
  loading=(async()=>{try{
   const b=await downloadBlob(id,'pdf');pdfFile=new File([b],'Documento_ERP_IMPAR_George.pdf',{type:'application/pdf'});
   share.textContent=navigator.share&&navigator.canShare?.({files:[pdfFile]})?'Compartilhar PDF':'Baixar PDF';share.disabled=false;status.textContent='';if(config.autoOpen)state.lastDocument={id,file:pdfFile,parent:state.record};config.onReady?.();return pdfFile;
  }catch(e){fail(e);retry.hidden=false;throw e;}finally{loading=null;}})();return loading;
 };
 const open=smallButton('Abrir PDF',async()=>{if(open.disabled)return;open.disabled=true;try{await window.GeorgePdf.open(await loadPdf());}catch(e){fail(e);}finally{open.disabled=false;}});open.classList.add('primary');
 const share=smallButton('Compartilhar PDF',async()=>{if(!pdfFile)return;try{
  if(navigator.share&&navigator.canShare?.({files:[pdfFile]}))await navigator.share({title:'Documento — ERP ÍMPAR',files:[pdfFile]});else saveBlob(pdfFile,pdfFile.name);
 }catch(e){if(e.name!=='AbortError')fail(e);}});share.disabled=true;
 const retry=smallButton('Tentar carregar novamente',async()=>{try{const file=await loadPdf();if(config.autoOpen)await window.GeorgePdf.open(file);}catch(e){fail(e);}});retry.hidden=true;
 main.append(open,share);
 const more=document.createElement('details');more.className='pdf-more-options';const label=document.createElement('summary');label.textContent='Outras opções';const options=document.createElement('div');
 const regenerate=smallButton('Gerar nova versão',async()=>{if(regenerate.disabled)return;regenerate.disabled=true;try{const j=await request('document_create',{record_id:state.record,source_ids:[id],title:'Nova versão do documento',event_id:eventId()});await processJob(j.record_id);}catch(e){fail(e);}finally{regenerate.disabled=false;}});
 options.append(smallButton('Obras relacionadas',async()=>{try{const j=await request('document_works',{record_id:id});message('george',j.obras.length?'Encontrei estas referências no cadastro atual:\n'+j.obras.map(w=>w.nome+' — '+(w.responsavel||'responsável não informado')).join('\n'):'Não encontrei uma correspondência exata entre este documento e as obras cadastradas.');}catch(e){fail(e);}}),regenerate,smallButton('Baixar transcrição',async()=>{try{saveBlob(await downloadBlob(id,'text'),'Transcricao_George.txt');}catch(e){fail(e);}}));
 more.append(label,options);row.append(main,status,retry,more);
 try{const file=await loadPdf();if(config.autoOpen)await window.GeorgePdf.open(file);return true;}catch{return false;}
}
$('reportDialog').addEventListener('cancel',()=>window.GeorgePdf.close());
$('reportBack').onclick=()=>{$('reportDialog').close();window.GeorgePdf.close();};

// Recording uses the same durable upload path. Fragments are reassembled before decoding.
function recorderMime(video=false){const types=video?['video/webm;codecs=vp8,opus','video/mp4','video/webm']:['audio/webm;codecs=opus','audio/mp4','audio/webm'];return types.find(t=>window.MediaRecorder?.isTypeSupported(t))||'';}
async function beginCapture(stream,mode,isVideo=false){
 if(!window.MediaRecorder)throw new Error('Este navegador não oferece gravação. Anexe um arquivo gravado no celular.');
 if(!stream?.active||!stream.getAudioTracks().some(t=>t.readyState==='live')||isVideo&&!stream.getVideoTracks().some(t=>t.readyState==='live'))throw new Error('Câmera ou microfone não estão prontos. Reabra Mídias e tente novamente.');
 const preferred=recorderMime(isVideo);let rec;try{rec=new MediaRecorder(stream,{...(preferred?{mimeType:preferred}:{}),audioBitsPerSecond:64000,...(isVideo?{videoBitsPerSecond:1400000}:{})});}catch{rec=new MediaRecorder(stream);}
 const mime=rec.mimeType||preferred;if(!mime)throw new Error('Este navegador não informou o formato da gravação. Use a câmera do celular e anexe o vídeo.');const ext=mime.includes('mp4')?'mp4':'webm';const name=`${mode}_${new Date().toISOString().slice(0,10)}.${ext}`;
 const start=await request('media_start',{name,mime,live:true,parent_record_id:state.record,kind:mode==='meeting'?'meeting':'media'});
 const r={id:start.record_id,mode,rec,stream,index:0,queue:Promise.resolve(),started:Date.now(),pending:0,error:null,stopping:false,ownStream:isVideo,derivedError:null,sidecar:null,frameCount:0,frameQueue:Promise.resolve(),frameTimer:null,mediaCard:isVideo?window.GeorgeAgendaExperience?.create(null,'video'):null};r.mediaCard?.setId(r.id);r.mediaCard?.update('Gravando vídeo',null);state.recording=r;meetingProposal=null;lastReview=0;
 r.pendingChunks=[];r.chunkBytes=start.chunk_bytes;
 rec.ondataavailable=e=>{
  if(!e.data?.size)return;
  for(let p=0;p<e.data.size;p+=r.chunkBytes){const blob=e.data.slice(p,p+r.chunkBytes);r.pendingChunks.push(blob);r.pending+=blob.size;}
  if(r.pending>16*1024*1024&&rec.state==='recording'){r.captureGap=true;rec.pause();notice('Rede lenta: gravação pausada. Há uma pausa no registro; mantenha esta página aberta para recuperar o envio.');}
  r.queue=r.queue.then(()=>r.uploadError?undefined:drainCaptureChunks(r)).catch(e=>{
   r.uploadError=e;if(rec.state==='recording'){r.captureGap=true;rec.pause();}
   notice('O envio da gravação parou. Os trechos aguardam nesta página. Toque em Encerrar para tentar enviar novamente.');normalStatus();
  });
 };
 rec.onerror=e=>{r.error=e.error||new Error('Falha de gravação.');error(r.error);};
 try{r.sidecar=await GeorgeMedia.fromStream(stream,(blob,index,at)=>uploadDerived(r.id,blob,'audio',index,at),e=>{if(!r.derivedError)notice('A preparação do áudio oscilou. Continuo gravando o original.');r.derivedError=e;});}
 catch(e){notice('Preparação paralela indisponível: '+e.message+' O original será gravado e poderá exigir preparação após encerrar.');}
 if(isVideo){r.frameCount=1;r.frameQueue=GeorgeMedia.frame($('cameraVideo')).then(blob=>uploadDerived(r.id,blob,'frame',0,0)).catch(e=>{r.derivedError=e;error(e);});r.frameTimer=setInterval(()=>{if(r.stopping||rec.state!=='recording'||r.frameCount>=96)return;const i=r.frameCount++,at=(Date.now()-r.started)/1000;r.frameQueue=r.frameQueue.then(()=>GeorgeMedia.frame($('cameraVideo'))).then(blob=>uploadDerived(r.id,blob,'frame',i,at)).catch(e=>{r.derivedError=e;error(e);});},15000);}
 for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(!r.stopping){r.error=new Error('A captura foi interrompida pelo aparelho. Os blocos confirmados estão preservados.');error(r.error);normalStatus();}});
 try{rec.start(4000);}catch(e){state.recording=null;clearInterval(r.frameTimer);await r.sidecar?.stop().catch(()=>{});throw new Error('Não consegui iniciar a filmagem neste navegador. Use a câmera do celular e anexe o vídeo.');}await keepAwake.acquire();normalStatus();return r;
}
async function drainCaptureChunks(r){
 while(r.pendingChunks?.length){
  const blob=r.pendingChunks[0];
  for(let attempt=0;;attempt++){try{await uploadChunk(r.id,r.index,blob);break;}catch(e){if(attempt>=2||!temporaryError(e))throw e;await wait(700*(attempt+1));}}
  r.index++;r.pending-=blob.size;r.pendingChunks.shift();
 }
 r.uploadError=null;
 if(!r.stopping&&r.rec.state==='paused'&&!r.error&&r.pending<2*1024*1024)r.rec.resume();
}
async function finishCapture(r){
 await drainCaptureChunks(r);
 await retryConfirmed('upload_finish',{record_id:r.id,chunks:r.index});
 // Complete the upload even after a device interruption; do not advertise a complete meeting.
 if(r.captureGap||r.error){
  if(state.pendingCapture===r)state.pendingCapture=null;
  const m=message('george','A gravação foi encerrada e o original está salvo, mas houve uma interrupção. Baixe e confira o áudio; não foi gerada uma ata completa.','REUNIÃO');
  m.bubble.append(smallButton('Baixar gravação',async()=>{try{saveBlob(await downloadBlob(r.id,'source'),'Gravacao_George.'+(r.rec.mimeType?.includes('mp4')?'mp4':'webm'));}catch(e){error(e);}}));return false;
 }
 if(r.prepared?.audio_count&&!r.derivedError)await retryConfirmed('derived_finish',{record_id:r.id,audio_count:r.prepared.audio_count,frame_count:r.frameCount});
 if(state.pendingCapture===r)state.pendingCapture=null;
 notice('Reunião encerrada. Estou preparando sua ata…');
 return processJob(r.id,{autoOpen:true,mediaCard:r.mediaCard});
}
function endCapture(){
 if(state.finalizing)return state.finalizing;
 const r=state.recording||state.pendingCapture;if(!r)return Promise.resolve(false);
 const run=async()=>{
  r.stopping=true;state.pendingCapture=r;voice.stopSpeaking(false);voice.wanted=false;voice.pauseTransmit(true);clearInterval(r.frameTimer);
  normalStatus();
  if(!r.captureStopped){
   await new Promise((resolve,reject)=>{
    if(r.rec.state==='inactive'){resolve();return;}
    const done=()=>{clearTimeout(timer);resolve();};
    const timer=setTimeout(()=>{r.rec.removeEventListener('stop',done);reject(new Error('A gravação não confirmou a parada. Tente encerrar novamente.'));},10000);
    r.rec.addEventListener('stop',done,{once:true});try{r.rec.stop();}catch(e){clearTimeout(timer);reject(e);}
   });r.captureStopped=true;
   try{if(r.sidecar)r.prepared=await r.sidecar.stop();await r.frameQueue;}catch(e){r.derivedError=e;}
   await r.queue;await state.logQueue;await state.chatQueue;await keepAwake.release();
   if(r.ownStream)r.stream.getTracks().forEach(t=>t.stop());
   if(state.recording===r)state.recording=null;state.mode='text';setActive('');voice.pause();
  }
  return await finishCapture(r);
 };
 state.finalizing=Promise.resolve().then(run).catch(e=>{
  const n=message('george',connectionError(e,'concluir a reunião').message+' Mantenha esta página aberta para retomar.','REUNIÃO');
  const retry=smallButton('Retomar encerramento',async()=>{if(retry.disabled)return;retry.disabled=true;const ok=await endCapture();if(ok)n.row.remove();else retry.disabled=false;});n.bubble.append(retry);error(e);return false;
 }).finally(()=>{state.finalizing=null;normalStatus();});normalStatus();return state.finalizing;
}
async function recordingButton(mode){
 if(!requireAuth())return;if(state.finalizing)return state.finalizing;if(state.pendingCapture&&!state.recording){await endCapture();return;}if(state.recording){if(state.recording.mode===mode)await endCapture();else notice('Encerre a gravação atual antes de iniciar outra.');return;}
 try{state.mode='audio';await voice.connect();setActive('meeting');await beginCapture(voice.stream,'meeting');notice('Reunião iniciada. Avise os participantes. Diga Jorge no início de um pedido. Para terminar, diga Jorge, encerrar reunião.');}
 catch(e){if(!state.recording)voice.pause();error(e);}
}
$('btnMeeting').onclick=()=>recordingButton('meeting').catch(error);
let camera=null;
$('chooseFilm').onclick=async()=>{
 $('mediaDialog').close();
 if(!requireAuth())return;if(state.recording){notice('Encerre a gravação atual antes de filmar.');return;}
 try{voice.pause();camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:true});$('cameraVideo').srcObject=camera;$('cameraModal').classList.remove('hidden');await $('cameraVideo').play();$('cameraInfo').textContent='Pronto para gravar. Serão interpretados o áudio e imagens amostradas.';}
 catch(e){error(e);}
};
$('btnStartFilm').onclick=async()=>{$('btnStartFilm').disabled=true;try{await beginCapture(camera,'film',true);$('btnStopFilm').disabled=false;$('cameraInfo').textContent='Gravando…';}catch(e){$('btnStartFilm').disabled=false;$('cameraInfo').textContent=e.message;error(e);}};
$('btnStopFilm').onclick=async()=>{$('btnStopFilm').disabled=true;try{await endCapture();}catch(e){error(e);}finally{camera?.getTracks().forEach(t=>t.stop());camera=null;$('cameraModal').classList.add('hidden');$('btnStartFilm').disabled=false;}};
$('nativeFilm').onclick=()=>{$('btnCloseCamera').click();$('nativeVideoPicker').click();};
$('nativeVideoPicker').onchange=async()=>{const file=$('nativeVideoPicker').files?.[0];if(!file)return;const mediaCard=window.GeorgeAgendaExperience?.create(file,'video');try{const id=await uploadFile(file,mediaCard);await prepareOrProcess(id,file,mediaCard);}catch(e){mediaCard?.error(e.message,()=>$('nativeFilm').click());error(e);}finally{$('nativeVideoPicker').value='';}};
$('btnCloseCamera').onclick=()=>{if(state.recording?.mode==='film'){$('cameraInfo').textContent='Use Parar para finalizar e preservar a gravação.';return;}camera?.getTracks().forEach(t=>t.stop());camera=null;$('cameraModal').classList.add('hidden');};
window.addEventListener('beforeunload',e=>{if(state.recording||state.pendingCapture||state.finalizing||state.upload||state.busy||state.preparing){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{voice.close();camera?.getTracks().forEach(t=>t.stop());});
function addBubbleMenu(bubble,textNode){
 const wrap=document.createElement('div');wrap.className='bubble-tools';const trigger=document.createElement('button');trigger.type='button';trigger.textContent='⋯';trigger.setAttribute('aria-label','Opções desta mensagem');trigger.setAttribute('aria-expanded','false');
 const menu=document.createElement('div');menu.className='bubble-menu';menu.hidden=true;
 const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
 const copy=smallButton('Copiar mensagem',async()=>{try{await navigator.clipboard.writeText(textNode.textContent);close();notice('Mensagem copiada.');}catch(e){error(new Error('Não foi possível copiar. Selecione o texto da mensagem.'));}});
 const share=smallButton('Compartilhar mensagem',async()=>{try{if(navigator.share)await navigator.share({text:textNode.textContent});else saveBlob(new Blob([textNode.textContent],{type:'text/plain;charset=utf-8'}),'Mensagem_George.txt');close();}catch(e){if(e.name!=='AbortError')error(e);}});
 menu.append(copy,share);trigger.onclick=()=>{const open=menu.hidden;document.querySelectorAll('.bubble-menu').forEach(n=>{n.hidden=true;n.previousElementSibling?.setAttribute('aria-expanded','false');});menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open)copy.focus();};wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){close();trigger.focus();}});wrap.append(trigger,menu);bubble.append(wrap);
}
const keepAwake={lock:null,pending:null,
 async acquire(){if(this.lock||this.pending||document.visibilityState!=='visible')return;this.pending=(async()=>{try{if(!navigator.wakeLock)throw new Error();this.lock=await navigator.wakeLock.request('screen');this.lock.addEventListener('release',()=>{this.lock=null;if(state.recording||state.preparing)showStatus('Proteção da tela liberada pelo aparelho • mantenha esta página visível','warning');});}catch{showStatus('Este aparelho não garantiu a tela ligada • mantenha a página visível durante a captura','warning');}})();try{await this.pending;}finally{this.pending=null;}},
 async release(){const l=this.lock;this.lock=null;try{await l?.release();}catch{}}
};
document.addEventListener('visibilitychange',()=>{if(state.recording){if(document.visibilityState==='visible'){keepAwake.acquire();const tracks=state.recording.stream.getTracks();if(tracks.some(t=>t.readyState!=='live')){state.recording.error=new Error('O aparelho interrompeu a captura. Há uma lacuna na reunião.');error(state.recording.error);}else notice('Página visível novamente. Confira a continuidade da gravação; o sistema pode suspender a captura em segundo plano.');}else{showStatus('Página oculta • a captura pode ser suspensa pelo aparelho','warning');const rid=state.recording.id;state.logQueue=state.logQueue.catch(()=>{}).then(()=>request('log_turn',{record_id:rid,role:'assistant',text:'[Registro técnico] Página ficou oculta; pode haver uma lacuna de captura a partir deste instante.',event_id:eventId()})).catch(error);}}});
let meetingProposal=null,lastReview=0,reviewBusy=false;
function meetingIntent(text){
 const n=normalized(text).replace(/^(?:(?:ei|oi|ola|por favor)[, .!]* )?(?:george|jorge|giorge|georgie|djorge|jordi)[, :.!]*/,'').trim();
 if(/^(?:agora nao|nao agora|depois|aguarda|aguarde|espera|espere|segura a pergunta|nao pode falar|nao pode perguntar)\b/.test(n))return 'defer';
 if(/^(?:(?:agora |ja |sim,? )?(?:pode (?:falar|perguntar|participar)|esta (?:liberado|autorizado))|libero (?:voce|a pergunta)|autorizado)[.! ]*(?:por favor)?[.! ]*$/.test(n))return 'grant';
 if(/^(?:dispensa|dispense|cancela|cancele) (?:essa |a )?pergunta[.! ]*$/.test(n))return 'dismiss';
 return null;
}
async function reviewMeeting(){
 if(!state.recording||state.recording.mode!=='meeting'||state.recording.stopping||state.busy||meetingProposal||reviewBusy||Date.now()-lastReview<90000)return;
 lastReview=Date.now();reviewBusy=true;
 try{const r=state.recording,j=await request('meeting_review',{record_id:r.id},45000);if(state.recording!==r||r.stopping)return;meetingProposal=j.question&&['offered','deferred'].includes(j.question.state)?j.question:null;if(!j.proposal)return;
  const m=message('george','Tenho uma pergunta sobre o que foi discutido. Posso falar?','REUNIÃO');
  m.bubble.append(smallButton('Pode falar',()=>controlProposal('grant','Pode falar').catch(error)),smallButton('Agora não',()=>controlProposal('defer','Agora não').catch(error)));
  if(!voice.speaking&&!state.busy)await voice.speak('Tenho uma pergunta sobre o que foi discutido. Posso falar?');
 }catch(e){notice('A revisão da reunião não ficou disponível agora. A gravação segue ativa.');}finally{reviewBusy=false;}
}
async function controlProposal(control,text,id=eventId()){
 const r=state.recording;if(!r||r.mode!=='meeting')return;
 const j=await request('meeting_control',{record_id:r.id,control,text,event_id:id});
 if(state.recording!==r)return;meetingProposal=j.question&&['offered','deferred'].includes(j.question.state)?j.question:null;
 message('george',j.text,'REUNIÃO');if(!j.cached&&!r.stopping)await voice.speak(j.text);
}
async function grantProposal(){return controlProposal('grant','Pode falar');}
function handleLocalIntent(text,source,id){
 if(stopSpeechIntent(text)){voice.stopSpeaking();message('me',text);return true;}
 if((voice.pausedSpeech||voice.lastSpeech)&&called(text)&&/\b(pode continuar|continua|leia os detalhes|le os detalhes)\b/.test(normalized(text))){const pending=voice.pausedSpeech||voice.lastSpeech;voice.pausedSpeech=null;voice.speak(pending,true);return true;}
 const n=normalized(text).replace(/^(?:(?:ei|oi|ola|por favor)[, .!]* )?(?:george|jorge|giorge|georgie|djorge|jordi)[, :.!]*/,'').trim();
 if((state.recording?.mode==='meeting'||state.pendingCapture||state.finalizing)&&meetingEndIntent(text)){
  if(!state.finalizing){message('me',text);voice.stopSpeaking(false);endCapture().catch(error);}return true;
 }
 if(!state.recording&&state.lastOutput==='analytics'&&state.lastAnalytics&&analyticsLocalIntent(n))return runAnalyticsLocal(text,source,id,n);
 if(!state.recording&&state.lastDocument?.parent===state.record&&/^(?:(?:pode|quero) )?(?:abrir|abre|abra|baixar|baixa|baixe|compartilhar|compartilha|compartilhe|enviar|envia|envie)(?: (?:o|a|essa|esta|esse|este|ultima|ultimo))? (?:pdf|ata|documento)(?: em pdf)?(?: por favor)?[.!? ]*$/.test(n)){
  message('me',text);window.GeorgePdf.open(state.lastDocument.file).catch(error);return true;
 }
 const control=state.recording?.mode==='meeting'?meetingIntent(text):null;
 if(control){message('me',text);state.chatQueue=state.chatQueue.catch(()=>{}).then(()=>controlProposal(control,text,id)).catch(error);return true;}
 if(/^(?:copi[ae]|compartilh[ae]) (?:a |essa |esta )?(?:ultima |essa |esta )?(?:mensagem|resposta|balao)/.test(n)){const row=[...chat.querySelectorAll('.msg.george')].pop();row?.querySelector('.bubble-tools>button')?.click();notice('Use Copiar ou Compartilhar na mensagem selecionada.');return true;}
 const isDoc=/\b(pdf|documento|ata|conversas)\b/.test(n)&&/\b(ger[ae]\w*|refa[cz]\w*|regen\w*|unific\w*|junt\w*|compartilh\w*|export\w*)\b/.test(n);
 if(isDoc&&!window.GeorgeAgendaReport?.matches?.(text)){
  if(/agenda semanal|visao cliente|cronograma/.test(n)){return false;}
  message('me',text);const record=state.recording?.id||state.record;
  state.chatQueue=state.chatQueue.catch(()=>{}).then(async()=>{try{await state.logQueue;
    let ids=[record],last=0;
    if(/ultim[ao]s? (tres|3) conversas/.test(n)){const list=await request('conversation_list',{kind:'conversation',limit:3});ids=list.records.filter(x=>x.turn_count>0).map(x=>x.id);if(ids.length<3)throw new Error('Encontrei '+ids.length+' conversa(s) salva(s). Selecione as conversas pelo botão Conversas e documentos.');}else if(/ultim[ao]s? (tres|3) (mensagens|respostas)/.test(n))last=3;
    if(/unific|junt/.test(n)){const current=await request('record',{record_id:record});const docs=(current.documents||[]).slice(-2);const attachments=docs.length===2?docs:(current.attachments||[]).slice(-2);if(attachments.length<2)throw new Error('Preciso de duas partes vinculadas à conversa para unificar. Anexe as partes ou indique os registros.');ids=attachments.map(x=>x.id);}
    const result=await request('document_create',{record_id:record,source_ids:ids,last_turns:last,title:state.recording?'Ata parcial da reunião':'Documento George',format:/\bata\b/.test(n)?'minutes':'document',event_id:id});
    const ready=await processJob(result.record_id);
    if(state.recording)notice(ready?'PDF parcial pronto. A reunião continua gravando.':'A reunião continua gravando. Retome o documento pelo botão da mensagem.');
   }catch(e){error(e);}});return true;
 }
 return false;
}
async function uploadDerived(source,blob,kind,index,at){
 const s=await request('derived_start',{source_record_id:source,derived_kind:kind,derived_index:index,at_seconds:at,size:blob.size});if(s.complete)return;
 let i=0;for(let p=0;p<blob.size;p+=s.chunk_bytes){let sent=false;for(let n=0;n<3&&!sent;n++){try{await uploadChunk(s.record_id,i,blob.slice(p,p+s.chunk_bytes));sent=true;}catch(e){if(n===2)throw e;await wait(700*(n+1));}}i++;}
 await request('upload_finish',{record_id:s.record_id,chunks:i});
}
async function prepareInBrowser(id,file,statusNode){
 if(state.recording)throw new Error('Encerre a gravação antes de preparar um vídeo neste aparelho. O original está salvo.');
 if(state.preparing)throw new Error('Já há um arquivo sendo preparado.');state.preparing=true;await keepAwake.acquire();
 try{await request('derived_reset',{record_id:id});const result=await GeorgeMedia.prepare(file,{audio:(b,i,t)=>uploadDerived(id,b,'audio',i,t),frame:(b,i,t)=>uploadDerived(id,b,'frame',i,t),startPlayback:start=>{const button=smallButton('Iniciar leitura do arquivo',()=>{button.remove();start();});statusNode.parentNode.append(button);statusNode.textContent='Toque em Iniciar leitura do arquivo para liberar a reprodução no aparelho.';},status:t=>{statusNode.textContent=t;}});await request('derived_finish',{record_id:id,...result});}
 finally{state.preparing=false;if(!state.recording)await keepAwake.release();}
}
async function prepareOrProcess(id,file,mediaCard=null){
 const ext=file.name.split('.').pop().toLowerCase();const video=file.type.startsWith('video/')||['mp4','mov','mkv','webm','mpeg'].includes(ext);
 const audio=file.type.startsWith('audio/')||['mp3','mpga','m4a','wav','ogg','aac'].includes(ext);
 if(ext==='zip'){await processJob(id,{mediaCard});return;}
 if(video||(audio&&!(state.caps?.ffmpeg&&state.caps?.ffprobe)&&(file.size>24*1024*1024||!['mp3','mpga','m4a','wav','webm','mp4','mpeg'].includes(ext)))){
  const m=message('george','Original salvo. Preparando o áudio e imagens amostradas neste aparelho…','MÍDIAS');
  try{mediaCard?.update('Preparando áudio e imagens',null);await prepareInBrowser(id,file,m.text);}catch(e){m.text.textContent=e.message;mediaCard?.error(e.message,()=>prepareOrProcess(id,file,mediaCard));m.bubble.append(smallButton('Retomar preparação',async()=>{try{await prepareInBrowser(id,file,m.text);await processJob(id,{mediaCard});}catch(e){error(e);}}),smallButton('Tentar processar no servidor',()=>processJob(id,{mediaCard})));return;}
 }
 await processJob(id,{mediaCard});
}
$('btnMedia').onclick=()=>{if(requireAuth())$('mediaDialog').showModal();};$('closeMedia').onclick=()=>$('mediaDialog').close();
let photoStream=null,photoBlob=null,photoUrl=null;
function clearPhoto(){photoStream?.getTracks().forEach(t=>t.stop());photoStream=null;if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;photoBlob=null;}
$('choosePhoto').onclick=async()=>{if(state.recording){notice('Encerre a captura atual antes de abrir a câmera.');return;}$('mediaDialog').close();try{voice.pause();photoStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920}},audio:false});$('photoVideo').srcObject=photoStream;$('photoVideo').hidden=false;$('photoPreview').hidden=true;$('takePhoto').hidden=false;$('retakePhoto').hidden=true;$('usePhoto').hidden=true;$('photoStatus').textContent='Enquadre e fotografe.';$('photoDialog').showModal();await $('photoVideo').play();}catch(e){clearPhoto();error(e);}};
$('takePhoto').onclick=async()=>{try{photoBlob=await GeorgeMedia.frame($('photoVideo'));if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=URL.createObjectURL(photoBlob);$('photoPreview').src=photoUrl;$('photoPreview').hidden=false;$('photoVideo').hidden=true;$('takePhoto').hidden=true;$('retakePhoto').hidden=false;$('usePhoto').hidden=false;}catch(e){error(e);}};
$('retakePhoto').onclick=()=>{photoBlob=null;$('photoPreview').hidden=true;$('photoVideo').hidden=false;$('takePhoto').hidden=false;$('retakePhoto').hidden=true;$('usePhoto').hidden=true;};
$('usePhoto').onclick=async()=>{if(!photoBlob||state.upload)return;$('usePhoto').disabled=true;const file=new File([photoBlob],`Foto_${Date.now()}.jpg`,{type:'image/jpeg'}),mediaCard=window.GeorgeAgendaExperience?.create(file,'image');try{const id=await uploadFile(file,mediaCard);$('photoDialog').close();clearPhoto();await processJob(id,{mediaCard});}catch(e){$('photoStatus').textContent=e.message;mediaCard?.error(e.message,()=>$('usePhoto').click());}finally{$('usePhoto').disabled=false;}};
$('closePhoto').onclick=()=>{if(state.upload)return;clearPhoto();$('photoDialog').close();};$('photoDialog').addEventListener('cancel',e=>{if(state.upload){e.preventDefault();return;}clearPhoto();});

// Presentation only: requests, permissions and operational actions remain unchanged.
function toolIcon(kind){
 const paths={documents:'M8 3h8l4 4v14H8z M16 3v5h4 M4 7v14 M11 12h6 M11 16h6',new:'M12 5v14 M5 12h14',pause:'M9 5v14 M15 5v14',files:'M3 7h7l2-3h9v16H3z'};
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[kind]||paths.documents);svg.append(path);return svg;
}
function setupConversationTools(){
 const header=document.querySelector('.topbar'),tray=$('toolsTray'),panel=$('toolsPanel'),toggle=$('toolsToggle'),tools=$('conversationTools');
 if(!header||!tray||!panel||!toggle)return;
 let open=false,gesture=null,suppressClickUntil=0;
 const setOpen=value=>{
  open=Boolean(value);tray.classList.toggle('is-open',open);panel.inert=!open;panel.toggleAttribute('inert',!open);panel.setAttribute('aria-hidden',String(!open));
  toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Esconder opções do George':'Mostrar opções do George');
  toggle.title=open?'Arraste para cima ou toque para esconder':'Arraste para baixo ou toque para abrir';
  if(!open&&panel.contains(document.activeElement))toggle.focus({preventScroll:true});
 };
 toggle.onclick=()=>setOpen(!open);
 header.addEventListener('pointerdown',e=>{
  if(e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0)||e.target.closest('select'))return;
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false};
 });
 header.addEventListener('pointermove',e=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  const dy=e.clientY-gesture.y,dx=e.clientX-gesture.x;
  if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.2){
   gesture.dragged=true;if(e.cancelable)e.preventDefault();
   try{header.setPointerCapture(e.pointerId);}catch(_){}
  }
 });
 header.addEventListener('pointerup',e=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  const dy=e.clientY-gesture.y,dx=e.clientX-gesture.x;
  if(gesture.dragged){suppressClickUntil=Date.now()+350;if(Math.abs(dy)>=32&&Math.abs(dy)>Math.abs(dx)*1.2)setOpen(dy>0);}
  try{if(header.hasPointerCapture?.(e.pointerId))header.releasePointerCapture(e.pointerId);}catch(_){}
  gesture=null;
 });
 header.addEventListener('pointercancel',()=>{gesture=null;});
 header.addEventListener('click',e=>{if(e.detail!==0&&Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 tools.addEventListener('click',e=>{if(e.target.closest('button')&&!e.defaultPrevented)setOpen(false);});
 tools.addEventListener('change',e=>{if(e.target.matches('select'))setOpen(false);});
 document.addEventListener('pointerdown',e=>{if(open&&!header.contains(e.target))setOpen(false);},{passive:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open&&!document.querySelector('dialog[open]')){e.preventDefault();setOpen(false);toggle.focus({preventScroll:true});}});
 setOpen(false);
}
function decorateConversationTools(){
 for(const [id,kind] of [['documentSources','documents'],['newConversation','new'],['stopGeorge','pause'],['mediaQueueButton','files']]){
  const button=$(id);if(!button||button.dataset.toolStyled)return;
  const label=document.createElement('span');label.textContent=button.textContent;button.replaceChildren(toolIcon(kind),label);button.classList.add('tool-option');button.dataset.toolStyled='true';
 }
}
function createToolsSheet(kind,title,description){
 const dlg=document.createElement('dialog');dlg.className='g09-dialog g09-tools-sheet '+kind;dlg.setAttribute('aria-labelledby',kind+'Title');
 const head=document.createElement('header');head.className='tools-sheet-head';
 const heading=document.createElement('div');const eyebrow=document.createElement('span');eyebrow.className='tools-sheet-eyebrow';eyebrow.textContent='GEORGE';
 const h=document.createElement('h2');h.id=kind+'Title';h.textContent=title;const help=document.createElement('p');help.textContent=description;heading.append(eyebrow,h,help);
 let removed=false;const cleanup=()=>{if(removed)return;removed=true;dlg.remove();if(!document.querySelector('dialog[open]'))$('toolsToggle')?.focus({preventScroll:true});};
 const close=()=>{dlg.close();cleanup();};
 const x=smallButton('×',close);x.className='tools-sheet-close';x.setAttribute('aria-label','Fechar '+title.toLowerCase());head.append(heading,x);
 const status=document.createElement('p');status.className='tools-sheet-status';status.setAttribute('role','status');status.hidden=true;
 const list=document.createElement('div');list.className='tools-sheet-list';list.setAttribute('aria-label',title);list.tabIndex=0;
 const loading=document.createElement('p');loading.className='tools-sheet-empty';loading.textContent='Carregando…';list.append(loading);
 const footer=document.createElement('footer');footer.className='tools-sheet-footer';footer.hidden=true;
 dlg.append(head,status,list,footer);document.body.append(dlg);dlg.addEventListener('close',cleanup,{once:true});dlg.showModal();
 return {dlg,list,footer,close,showError(e){status.textContent=e.message||String(e);status.hidden=false;status.setAttribute('role','alert');if(e.http===401)showLogin();},clearError(){status.hidden=true;}};
}
async function chooseDocuments(){
 if(!requireAuth()||document.querySelector('.source-picker[open]'))return;
 const sheet=createToolsSheet('source-picker','Conversas e documentos','Escolha o que você quer reunir em um PDF.');const {dlg,list,footer}=sheet;
 try{
  const j=await request('conversation_list',{limit:100});if(!dlg.open)return;if(!Array.isArray(j.records))throw new Error('Não consegui carregar suas conversas. Feche esta janela e tente novamente.');list.replaceChildren();
  for(const r of j.records){
   const label=document.createElement('label');label.className='source-option';const box=document.createElement('input');box.type='checkbox';box.value=r.id;
   const copy=document.createElement('span');copy.className='source-copy';const name=document.createElement('strong');name.textContent=r.title;
   const meta=document.createElement('span');meta.className='source-meta';const badge=document.createElement('span');badge.className='source-kind';badge.textContent=({conversation:'Conversa',meeting:'Reunião',kickoff:'Kickoff',media:'Arquivo',text:'Documento'})[r.kind]||'Documento';
   const date=new Date(r.updated_at);const details=document.createElement('span');details.textContent=Number.isNaN(date.getTime())?'Data não informada':date.toLocaleDateString('pt-BR')+' · '+date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
   meta.append(badge,details);
   if(r.kind==='conversation'){const count=document.createElement('span');count.textContent=r.turn_count>0?r.turn_count+' '+(r.turn_count===1?'mensagem':'mensagens'):'Sem mensagens';meta.append(count);}
   copy.append(name,meta);label.append(box,copy);list.append(label);
  }
  if(!j.records.length){const empty=document.createElement('p');empty.className='tools-sheet-empty';empty.textContent='Suas conversas e documentos aparecerão aqui.';list.append(empty);}
  const options=document.createElement('div');options.className='source-format-row';const formatLabel=document.createElement('label');formatLabel.className='source-format-label';formatLabel.textContent='Formato';
  const fmt=document.createElement('select');fmt.setAttribute('aria-label','Formato do PDF');for(const [value,label] of [['document','Documento'],['minutes','Ata']]){const o=document.createElement('option');o.value=value;o.textContent=label;fmt.append(o);}formatLabel.append(fmt);
  const selected=document.createElement('span');selected.className='source-selection-count';selected.setAttribute('role','status');selected.setAttribute('aria-live','polite');options.append(formatLabel,selected);
  let busy=false;const generate=smallButton('Gerar PDF',async()=>{
   const ids=[...list.querySelectorAll('input:checked')].map(x=>x.value);if(busy||!ids.length)return;busy=true;generate.disabled=true;generate.textContent='Preparando PDF…';sheet.clearError();
   try{const r=await request('document_create',{record_id:state.recording?.id||state.record,source_ids:ids,format:fmt.value,title:'Documento George',event_id:eventId()});sheet.close();await processJob(r.record_id);}
   catch(e){if(dlg.open)sheet.showError(e);else error(e);}
   finally{busy=false;generate.textContent='Gerar PDF';updateSelection();}
  });generate.classList.add('primary');generate.id='generateSourcesPdf';
  function updateSelection(){const boxes=[...list.querySelectorAll('input')];const total=boxes.filter(x=>x.checked).length;for(const box of boxes)box.closest('label').classList.toggle('selected',box.checked);selected.textContent=total?total+' '+(total===1?'selecionado':'selecionados'):'Nenhum selecionado';generate.disabled=busy||total===0;}
  list.addEventListener('change',updateSelection);updateSelection();footer.append(options,generate);footer.hidden=false;
 }catch(e){list.replaceChildren();sheet.showError(e);}
}
async function showMediaQueue(){
 if(!requireAuth()||document.querySelector('.queue-picker[open]'))return;
 const sheet=createToolsSheet('queue-picker','Fila de arquivos','Acompanhe os arquivos que você enviou ao George.');const {dlg,list,footer}=sheet;
 try{
  const j=await request('media_queue',{include_removed:true});if(!dlg.open)return;if(!Array.isArray(j.jobs))throw new Error('Não consegui carregar seus arquivos. Feche esta janela e tente novamente.');list.replaceChildren();
  const refresh=async()=>{sheet.close();await showMediaQueue();};let changing=false;
  const change=async(ids,operation)=>{
   if(changing)return;if(ids.includes(state.recording?.id)||ids.includes(state.pendingCapture?.id))throw new Error('Encerre a gravação antes de retirar este arquivo.');changing=true;sheet.clearError();
   const buttons=[...list.querySelectorAll('button'),...footer.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
   try{if(ids.includes(state.uploadId))state.uploadAbort?.abort();await request('media_queue_change',{record_ids:ids,operation});await refresh();}
   finally{changing=false;buttons.forEach(b=>b.disabled=false);}
  };
  if(!j.jobs.length){const p=document.createElement('p');p.className='tools-sheet-empty';p.textContent='Sua fila está vazia.';list.append(p);}
  for(const job of j.jobs){const row=document.createElement('div');row.className='media-queue-row';const name=document.createElement('strong');name.textContent=job.name;const status=document.createElement('p');status.className='queue-status';status.textContent=job.state==='uploading'?'Envio incompleto':job.state==='cancelled'?'Retirado da fila · original preservado':taskText(job);row.append(name,status);
   const actions=document.createElement('div');actions.className='queue-row-actions';
   if(job.record_id!==state.recording?.id&&!['uploading','cancelled','deleted'].includes(job.state))actions.append(smallButton(job.state==='ready'?'Abrir PDF':'Retomar processamento',()=>{sheet.close();processJob(job.record_id);}));
   if(job.state!=='cancelled')actions.append(smallButton('Retirar da fila',()=>change([job.record_id],'cancel').catch(sheet.showError)));
   const remove=smallButton('Excluir arquivo',async()=>{if(!confirm('Excluir “'+job.name+'” e seus arquivos de processamento?'))return;try{await change([job.record_id],'delete');}catch(e){sheet.showError(e);}});remove.classList.add('subtle-danger');actions.append(remove);row.append(actions);list.append(row);
  }
  const pending=j.jobs.filter(x=>x.state!=='cancelled'&&x.record_id!==state.recording?.id);
  if(pending.length){const clear=smallButton('Limpar fila ('+pending.length+')',()=>change(pending.map(x=>x.record_id),'cancel').catch(sheet.showError));footer.append(clear);footer.hidden=false;}
 }catch(e){list.replaceChildren();sheet.showError(e);}
}
async function initialize(){
 try{const j=await request('resume');state.record=j.record_id;state.activeModule='geral';state.lastDocument=null;state.lastAnalytics=null;state.lastOutput=null;input.value=j.draft||'';autosize();
  [...chat.querySelectorAll('.msg,.system')].forEach(n=>n.remove());
  if(j.turns.length)j.turns.forEach(t=>message(t.role==='user'?'me':'george',t.text,'GEORGE',t.at?new Date(t.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):now()));
  else message('george','Oi! Eu sou o George. Como posso te ajudar hoje?');
  if(!$('documentSources')){const sources=smallButton('Conversas e documentos',()=>chooseDocuments().catch(error));sources.id='documentSources';$('conversationTools').append(sources);}
  if(!$('stopGeorge')){const b=smallButton('Pausar fala',()=>voice.stopSpeaking());b.id='stopGeorge';b.setAttribute('aria-label','Pausar somente a fala do George');$('documentSources').after(b);}
  if(!$('mediaQueueButton')){const b=smallButton('Fila de arquivos',()=>showMediaQueue().catch(error));b.id='mediaQueueButton';$('conversationTools').append(b);}
  if(!$('newConversation')){const b=smallButton('Nova conversa',async()=>{try{if(state.recording||state.pendingCapture||state.finalizing||state.upload)throw new Error('Conclua a captura ou envio antes de iniciar outra conversa.');await state.chatQueue;await state.logQueue;await saveDraft();voice.pause();await request('conversation_new');await initialize();}catch(e){error(e);}});b.id='newConversation';$('documentSources').after(b);}
  try{const companies=await request('companies');let chooser=$('companyChooser');if(!chooser){chooser=document.createElement('select');chooser.id='companyChooser';chooser.setAttribute('aria-label','Empresa ativa');$('documentSources').after(chooser);}chooser.replaceChildren();for(const c of companies.companies){const option=document.createElement('option');option.value=c.empresa_id;option.textContent=c.empresa_nome;chooser.append(option);}chooser.value=String(companies.current);chooser.hidden=companies.companies.length<2;chooser.onchange=async()=>{try{if(state.recording||state.pendingCapture||state.finalizing||state.upload)throw new Error('Conclua a captura ou o envio antes de trocar de empresa.');await state.chatQueue;await state.logQueue;await saveDraft();voice.pause();const j=await request('company_select',{company_id:Number(chooser.value)});state.user=j.user;await initialize();}catch(e){chooser.value=String(state.user.company_id);error(e);}};}catch(e){}
  decorateConversationTools();
  const h=await request('health');state.caps=h.media;$('onlineText').textContent='conectado';
  if(new URLSearchParams(location.search).has('diagnostico')){const n=message('george','Diagnóstico de instalação','DIAGNÓSTICO');const pre=document.createElement('pre');pre.className='diagnostic';pre.textContent=JSON.stringify({...h,frontend_version:'0.9.8-rc3-hf4-ata-direta'},null,2);n.bubble.append(pre);state.mode='text';normalStatus();return;}
  window.GeorgeAgendaExperience?.sync(j.jobs||[],(id,card)=>processJob(id,{mediaCard:card}));
  for(const item of (j.jobs||[]).filter(x=>!['cancelled','deleted'].includes(x.state)).slice(0,4)){if(item.state==='ready'){const m=message('george','Documento disponível: '+item.name,'ARQUIVO');reportActions(item.record_id,m.bubble);}else if(item.state!=='uploading'){const m=message('george','Há um processamento preservado: '+item.name,'ARQUIVO');m.bubble.append(smallButton('Retomar processamento',()=>processJob(item.record_id,{mediaCard:window.GeorgeAgendaExperience?.get(item.record_id)})));}}
  state.mode='text';setActive('');normalStatus();
 }catch(e){error(e);}
}
setupConversationTools();
(async()=>{try{setActive('');await (window.GeorgePwaSplashReady||Promise.resolve());if(await authenticate())await initialize();}catch(e){error(e);}})();
})();
