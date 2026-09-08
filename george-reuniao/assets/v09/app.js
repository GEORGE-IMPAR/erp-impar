/* George V0.9 — approved UI + authenticated, source-grounded conversation and durable media.
   No Agenda writes. No browser storage for conversations, files or operational records. */
(() => {
'use strict';
const BASE='https://api.erpimpar.com.br/george-reuniao/v09/';
const API=BASE+'api.php';
const $=id=>document.getElementById(id);
const state={csrf:'',user:null,record:null,mode:'audio',busy:false,recording:null,auth:false,upload:false,jobRunning:new Set(),logQueue:Promise.resolve(),chatQueue:Promise.resolve(),caps:null};
const chat=$('chat'),input=$('manual'),anchor=$('typingAnchor');
const now=()=>new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const eventId=()=>crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class ApiError extends Error{constructor(message,status,http){super(message);this.status=status;this.http=http;}}
async function request(action,payload={},timeout=180000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{
  const r=await fetch(API,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-George-CSRF':state.csrf},body:JSON.stringify({action,...payload}),signal:c.signal});
  const raw=await r.text();let j;try{j=JSON.parse(raw);}catch{throw new ApiError(`O servidor retornou uma resposta inválida (HTTP ${r.status}).`,'JSON_INVALIDO',r.status);}
  if(!r.ok||j.ok===false)throw new ApiError(j.error||j.status||`HTTP ${r.status}`,j.status,r.status);return j;
 }catch(e){if(e.name==='AbortError')throw new ApiError('A etapa demorou além do limite. Os dados já confirmados permanecem no servidor.','TIMEOUT',0);throw e;}finally{clearTimeout(t);}
}
function showStatus(text,kind='text'){$('modeStatus').className='mode-status show '+kind;$('modeStatusText').textContent=text;}
function setActive(mode){document.querySelectorAll('.action').forEach(b=>{const selected=b.dataset.mode===mode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}
function normalStatus(){
 if(state.recording?.error||state.recording?.rec?.state==='paused'){showStatus('Gravação pausada • confira o envio dos blocos','warning');return;}
 if(state.recording?.mode==='film'){showStatus('Filmagem em andamento • o áudio será transcrito','meeting');return;}
 if(state.recording){showStatus(state.recording.mode==='kickoff'?'Kickoff gravando • só ouvir • toque novamente para encerrar':'Reunião gravando • chame George para participar',state.recording.mode);return;}
 if(state.mode==='audio')showStatus(voice.live?'Áudio ligado • George está ouvindo':'Áudio selecionado • toque em Áudio para conversar',voice.live?'audio':'warning');
 else showStatus('Áudio desligado • modo escrita','text');
}
function scroll(){requestAnimationFrame(()=>{chat.scrollTop=chat.scrollHeight;});}
function avatar(side){const a=document.createElement('div');a.className='msg-avatar';if(side==='me')a.textContent=(state.user?.nome||'GE').split(/\s/)[0].slice(0,2).toUpperCase();else{const im=document.createElement('img');im.src='assets/v09/logo_george.png';im.alt='George';a.append(im);}return a;}
function message(side,text,label='GEORGE',at=now()){
 const row=document.createElement('div');row.className='msg '+side;const a=avatar(side);const b=document.createElement('div');b.className='bubble';
 if(side!=='me'){const w=document.createElement('div');w.className='who';w.textContent=label;b.append(w);}
 const d=document.createElement('div');d.className='message-text';d.textContent=text;b.append(d);const tm=document.createElement('div');tm.className='time';tm.textContent=at;b.append(tm);
 row.append(a,b);chat.insertBefore(row,anchor);scroll();return {row,bubble:b,text:d,avatar:a};
}
function notice(text){const n=document.createElement('div');n.className='system';n.textContent=text;chat.insertBefore(n,anchor);scroll();return n;}
function error(e){notice(e.message||String(e));showStatus(e.message||String(e),'warning');if(e.http===401)showLogin();}
function showLogin(){state.auth=false;voice.pause();$('loginDialog').showModal();$('loginInfo').textContent='Use o e-mail e a senha já cadastrados no ERP. A senha é verificada no servidor.';}
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
$('loginClose').onclick=()=>{$('loginDialog').close();showStatus('Entre para acessar suas conversas e o ERP.','warning');};
function requireAuth(){if(state.auth)return true;showLogin();return false;}
let draftTimer;
function saveDraft(){if(state.record&&state.auth)return request('draft',{record_id:state.record,text:input.value}).catch(error);return Promise.resolve();}
input.addEventListener('input',()=>{autosize();clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,500);});
function autosize(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,116)+'px';}
input.addEventListener('focus',()=>{
 if(state.recording?.mode==='kickoff'){showStatus('Kickoff está gravando sem responder. Encerre-o para conversar.','kickoff');return;}
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
     const url=URL.createObjectURL(result.blob);
     $('reportFrame').src=url;
     $('reportDialog').showModal();
     state.pdfUrl=url;
   }catch(e){error(e);}
 });
 const download=smallButton('Baixar PDF',()=>saveBlob(result.blob,result.filename));
 row.append(share,open,download);
}
async function logDirectTurn(record,role,text,id){
 try{await request('log_turn',{record_id:record,role,text,event_id:id});}
 catch(e){console.warn('log_turn',e);}
}
function queueQuestion(text,source='text',id=eventId()){
 if(!text.trim()||!requireAuth())return;
 if(state.recording?.mode==='kickoff'){notice('O Kickoff permanece somente ouvindo. Encerre a gravação para conversar.');return;}
 const record=state.recording?.id||state.record;const speak=state.mode==='audio'||state.recording?.mode==='meeting';
 message('me',text);

 // Capability oficial de relatório: não passa pela IA e não recria template.
 if(window.GeorgeAgendaReport?.matches?.(text)){
   state.chatQueue=state.chatQueue.catch(()=>{}).then(async()=>{
     const indicator=notice('Gerando o relatório pela Agenda do Dia oficial…');
     state.busy=true;voice.pauseTransmit();
     await logDirectTurn(record,'user',text,id);
     try{
       const result=await window.GeorgeAgendaReport.build(text);
       indicator.remove();
       const reply=result.wants_share
         ? `PDF oficial da Agenda do Dia de ${result.date_br} gerado. Toque em Compartilhar PDF para abrir o compartilhamento do aparelho.`
         : result.wants_print
         ? `PDF oficial da Agenda do Dia de ${result.date_br} gerado. Use Abrir / imprimir para visualizar e imprimir o mesmo documento.`
         : `PDF oficial da Agenda do Dia de ${result.date_br} gerado pelo próprio módulo da Agenda.`;
       const m=message('george',reply,'RELATÓRIO DA AGENDA');
       m.row.dataset.sources=result.source;
       agendaReportButtons(result,m.bubble);
       await logDirectTurn(record,'assistant',reply,eventId());
       if(speak&&!state.recording?.stopping)await voice.speak(reply);
     }catch(e){
       indicator.remove();
       const reply=e.message||String(e);
       const m=message('george',reply,'RELATÓRIO DA AGENDA');
       m.row.dataset.sources='agenda_do_dia_novo.html';
       await logDirectTurn(record,'assistant',reply,eventId());
       showStatus(reply,'warning');
     }finally{
       state.busy=false;voice.resumeTransmit();normalStatus();
     }
   });
   return;
 }

 state.chatQueue=state.chatQueue.catch(()=>{}).then(async()=>{
   const indicator=notice('Consultando o contexto e as fontes do ERP…');state.busy=true;voice.pauseTransmit();
   try{const j=await request('chat',{record_id:record,text,event_id:id});indicator.remove();const m=message('george',j.text);
      if(j.sources?.length)m.row.dataset.sources=j.sources.join(' | ');
      if(speak&&!state.recording?.stopping)await voice.speak(j.text);
   }catch(e){indicator.remove();error(e);}finally{state.busy=false;voice.resumeTransmit();normalStatus();}
 });
}
function sendText(){const text=input.value.trim();if(!text||!requireAuth())return;if(state.recording&&state.recording.mode!=='meeting'){notice('Encerre a gravação para conversar. Seu texto foi mantido.');return;}input.value='';autosize();saveDraft();queueQuestion(text);}
$('btnSend').onclick=sendText;
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendText();}});
const called=s=>/\b(george|jorge|giorge|georgie|djorge)\b/i.test(s.normalize('NFD').replace(/[\u0300-\u036f]/g,''));

// The WebRTC connection transcribes and voices validated server answers only.
// No automatic LLM replies to ambient conversation; the server chat owns context/tools.
const voice={pc:null,dc:null,stream:null,sender:null,audio:null,live:false,connecting:null,speaking:false,speakDone:null,seen:new Set(),wanted:true,
 async connect(){
   if(this.live){this.wanted=true;this.resumeTransmit();return;}
   if(this.connecting)return this.connecting;
   this.connecting=(async()=>{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Microfone requer acesso HTTPS em um navegador compatível.');
    this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    this.pc=new RTCPeerConnection();this.audio=new Audio();this.audio.autoplay=true;this.audio.playsInline=true;
    this.pc.ontrack=e=>{this.audio.srcObject=e.streams[0];this.audio.play().catch(()=>showStatus('Toque em Áudio para liberar a reprodução.','warning'));};
    this.sender=this.pc.addTrack(this.stream.getAudioTracks()[0],this.stream);this.dc=this.pc.createDataChannel('oai-events');
    let resolveOpen,rejectOpen;const open=new Promise((a,b)=>{resolveOpen=a;rejectOpen=b;});open.catch(()=>{});const timer=setTimeout(()=>rejectOpen(new Error('A conexão de voz não foi estabelecida.')),70000);
    this.dc.onopen=()=>{this.live=true;clearTimeout(timer);resolveOpen();};this.dc.onclose=()=>{this.live=false;clearTimeout(timer);if(!this.live)normalStatus();};
    this.dc.onmessage=e=>{try{this.event(JSON.parse(e.data));}catch(err){console.warn('Evento de voz inválido');}};
    this.pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(this.pc?.connectionState)){this.live=false;normalStatus();}};
    const offer=await this.pc.createOffer();await this.pc.setLocalDescription(offer);
    const c=new AbortController(),tt=setTimeout(()=>c.abort(),70000);
    try{const r=await fetch(BASE+'realtime.php',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/sdp','X-George-CSRF':state.csrf},body:offer.sdp,signal:c.signal});const raw=await r.text();if(!r.ok){let msg='Não foi possível ligar a voz.';try{msg=JSON.parse(raw).error||msg;}catch{}throw new Error(msg);}await this.pc.setRemoteDescription({type:'answer',sdp:raw});await open;}
    catch(e){clearTimeout(timer);this.close();throw e;}finally{clearTimeout(tt);}
    this.wanted=true;this.resumeTransmit();normalStatus();
   })();
   try{return await this.connecting;}finally{this.connecting=null;}
 },
 event(e){
  const t=e.type||'';
  if(t==='conversation.item.input_audio_transcription.completed'){
    const text=String(e.transcript||'').trim(),id=e.item_id||eventId();
    if(!text||this.seen.has(id))return;this.seen.add(id);
    if(state.recording?.mode==='meeting'){
      if(called(text))queueQuestion(text,'audio',id);
      else{message('me',text);const rid=state.recording.id;state.logQueue=state.logQueue.catch(()=>{}).then(()=>request('log',{record_id:rid,text,event_id:id})).catch(error);}
    }else if(state.mode==='audio'&&!state.recording&&!this.speaking)queueQuestion(text,'audio',id);
  }
  if(t==='output_audio_buffer.stopped'||t==='output_audio_buffer.cleared'){this.speaking=false;this.speakDone?.();this.speakDone=null;this.resumeTransmit();this.markSpeaking(false);}
  if(t==='response.done'&&e.response?.status==='failed'){this.speaking=false;this.speakDone?.();notice('A resposta em texto está salva; a reprodução por voz não terminou.');this.markSpeaking(false);}
  if(t==='error'){notice('Áudio: '+(e.error?.message||'erro na sessão'));this.speakDone?.();this.markSpeaking(false);}
 },
 send(e){if(this.dc?.readyState!=='open')throw new Error('Áudio ainda não está conectado.');this.dc.send(JSON.stringify(e));},
 async speak(text){
   if((state.mode==='text'&&!state.recording)||state.recording?.mode==='kickoff')return;
   await this.connect();if(state.recording?.mode==='kickoff')return;
   this.speaking=true;this.pauseTransmit();this.markSpeaking(true);showStatus('George está falando…','audio');
   await new Promise(resolve=>{const watchdog=setTimeout(()=>{this.speaking=false;this.markSpeaking(false);resolve();},Math.max(15000,Math.min(180000,text.length*85)));
      this.speakDone=()=>{clearTimeout(watchdog);this.speaking=false;resolve();};
      this.send({type:'response.create',response:{conversation:'none',instructions:'Leia em português brasileiro, fielmente e sem acrescentar dados, apenas o TEXTO_VALIDADO_PARA_LEITURA. Não responda à pergunta original.',input:[{type:'message',role:'user',content:[{type:'input_text',text:'TEXTO_VALIDADO_PARA_LEITURA:\n'+text}]}],output_modalities:['audio']}});
   });
 },
 markSpeaking(on){document.querySelectorAll('.msg-avatar.speaking').forEach(x=>x.classList.remove('speaking'));if(on){const av=[...document.querySelectorAll('.msg.george .msg-avatar')].pop();av?.classList.add('speaking');}},
 pauseTransmit(){this.sender?.replaceTrack(null).catch(()=>{});},
 resumeTransmit(){if(this.wanted&&!this.speaking&&!state.busy&&!state.upload&&this.stream?.active){const t=this.stream.getAudioTracks()[0];if(t){t.enabled=true;this.sender?.replaceTrack(t).catch(()=>{});}}},
 pause(){this.wanted=false;this.pauseTransmit();if(!state.recording)this.stream?.getAudioTracks().forEach(t=>{t.enabled=false;});if(this.speaking){try{this.send({type:'response.cancel'});this.send({type:'output_audio_buffer.clear'});}catch{}this.speakDone?.();this.speaking=false;}},
 close(){this.pause();this.dc?.close();this.pc?.close();this.stream?.getTracks().forEach(t=>t.stop());this.audio?.pause();this.dc=null;this.pc=null;this.stream=null;this.sender=null;this.live=false;},
};
$('btnAudio').onclick=async()=>{
 if(!requireAuth())return;if(state.recording){notice('Encerre a gravação atual pelo botão Reunião ou Kickoff.');return;}
 if(state.mode==='audio'&&voice.live&&voice.wanted){state.mode='text';setActive('');voice.pause();normalStatus();return;}
 state.mode='audio';setActive('audio');$('btnAudio').focus({preventScroll:true});
 try{await voice.connect();voice.audio?.play().catch(()=>{});}catch(e){error(e);showStatus('Áudio selecionado • permita o microfone e toque novamente','warning');}
};

// Uploads are persisted on the server in ordered, hash-checked chunks.
async function uploadChunk(id,index,blob,signal){
 if(blob.size>1024*1024)throw new Error('Bloco de upload acima do limite.');
 const fd=new FormData();fd.append('action','upload_chunk');fd.append('record_id',id);fd.append('index',String(index));fd.append('chunk',blob,'chunk.part');
 const r=await fetch(API,{method:'POST',credentials:'include',headers:{'X-George-CSRF':state.csrf},body:fd,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)});let j;try{j=await r.json();}catch{throw new Error(`O bloco não foi recebido corretamente (HTTP ${r.status}).`);}if(!r.ok||!j.ok)throw new ApiError(j.error||'Upload não confirmado',j.status,r.status);return j;
}
async function uploadFile(file){
 const j=await request('media_start',{name:file.name,mime:file.type,size:file.size,kind:'media',parent_record_id:state.record});const id=j.record_id;let i=0;const c=new AbortController();state.uploadAbort=c;state.upload=true;voice.pauseTransmit();
 try{for(let pos=0;pos<file.size;pos+=j.chunk_bytes){const chunk=file.slice(pos,pos+j.chunk_bytes);let sent=false;
   for(let attempt=0;attempt<3&&!sent;attempt++){try{await uploadChunk(id,i,chunk,c.signal);sent=true;}catch(e){if(c.signal.aborted||attempt===2)throw e;await wait(700*(attempt+1));}}
   i++;$('attachStatus').textContent='Enviando '+Math.min(100,Math.round((pos+chunk.size)/file.size*100))+'% • o chat continua preservado.';
 }await request('upload_finish',{record_id:id,chunks:i});return id;}
 finally{state.upload=false;state.uploadAbort=null;voice.resumeTransmit();}
}
let chosen=null;
function openAttach(){if(!requireAuth())return;saveDraft();chosen=null;$('filePicker').value='';$('attachName').textContent='Nenhum arquivo selecionado.';$('attachStatus').textContent='Vídeo: será interpretado somente o áudio. O original fica preservado.';$('attachSend').disabled=true;$('attachDialog').showModal();}
$('btnAttach').onclick=openAttach;
$('attachChoose').onclick=()=>{$('filePicker').click();};
$('filePicker').addEventListener('cancel',()=>{$('attachStatus').textContent='Seleção cancelada. Você continua no George.';});
$('filePicker').onchange=()=>{chosen=$('filePicker').files?.[0]||null;$('attachName').textContent=chosen?`${chosen.name} • ${(chosen.size/1024/1024).toFixed(1)} MB`:'Nenhum arquivo selecionado.';$('attachSend').disabled=!chosen;};
function closeAttach(){if(state.upload){state.uploadAbort?.abort();notice('Envio interrompido. Os blocos já recebidos permanecem no servidor; a conversa não foi encerrada.');}$('attachDialog').close();$('btnAttach').focus({preventScroll:true});}
$('attachBack').onclick=closeAttach;
$('attachDialog').addEventListener('cancel',e=>{e.preventDefault();closeAttach();});
$('attachSend').onclick=async()=>{
 if(!chosen||state.upload)return;const file=chosen;$('attachSend').disabled=true;$('attachChoose').disabled=true;
 try{const id=await uploadFile(file);$('attachDialog').close();message('me','Arquivo enviado e confirmado no servidor: '+file.name);await processJob(id);}
 catch(e){$('attachStatus').textContent=e.name==='AbortError'?'Envio interrompido.':e.message;}
 finally{$('attachSend').disabled=!chosen;$('attachChoose').disabled=false;}
};
function taskText(j){const map={uploaded:'Arquivo salvo • verificando faixa de áudio…',transcription_ready:'Transcrição salva • preparando a ata…',summarizing:`Gerando ata • ${j.report_parts_done}/${j.report_parts_total} partes`,consolidating:'Consolidando todas as partes da ata…',rendering:'Aplicando o template executivo oficial…',ready:'Ata e transcrição prontas.'};return j.state==='transcribing'?`Transcrevendo áudio • ${j.segments_done}/${j.segments_total} trechos`:map[j.state]||j.state;}
async function processJob(id){
 if(state.jobRunning.has(id))return;state.jobRunning.add(id);const n=message('george','Verificando arquivo recebido…','ARQUIVO / ATA');
 try{let j=await request('job',{record_id:id});while(j.state!=='ready'){if(j.state==='uploading')throw new Error('O upload não foi finalizado. Reenvie o arquivo original para concluir.');n.text.textContent=taskText(j);j=await request('step',{record_id:id},195000);}
   n.text.textContent='Ata executiva gerada a partir do áudio/texto, no padrão ERP ÍMPAR + George V1.0. O vídeo não foi analisado visualmente.';await reportActions(id,n.bubble);
 }catch(e){n.text.textContent=e.message+' O que já foi confirmado permanece no servidor.';const b=smallButton('Retomar processamento',()=>{n.row.remove();processJob(id);});n.bubble.append(b,smallButton('Baixar original',async()=>{try{saveBlob(await downloadBlob(id,'source'),'Original_George');}catch(e){error(e);}}));}
 finally{state.jobRunning.delete(id);normalStatus();}
}
function smallButton(text,fn){const b=document.createElement('button');b.type='button';b.className='g09-button';b.textContent=text;b.onclick=fn;return b;}
async function downloadBlob(id,kind){const r=await fetch(BASE+'download.php?record_id='+encodeURIComponent(id)+'&kind='+kind,{credentials:'include',cache:'no-store'});if(!r.ok){let j;try{j=await r.json();}catch{}throw new Error(j?.error||'Arquivo ainda não disponível.');}return r.blob();}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function reportActions(id,bubble){
 const row=document.createElement('div');row.className='pdf-actions';bubble.append(row);
 let pdfFile=null;
 const share=smallButton('Compartilhar PDF',async()=>{try{
   if(!pdfFile)throw new Error('Aguarde o carregamento do PDF.');
   if(navigator.canShare?.({files:[pdfFile]})&&navigator.share)await navigator.share({title:'Ata executiva — ERP ÍMPAR',files:[pdfFile]});
   else saveBlob(pdfFile,pdfFile.name);
 }catch(e){if(e.name!=='AbortError')error(e);}});share.disabled=true;
 row.append(share,smallButton('Abrir PDF',async()=>{try{const b=pdfFile||await downloadBlob(id,'pdf');const u=URL.createObjectURL(b);$('reportFrame').src=u;$('reportDialog').showModal();state.pdfUrl=u;}catch(e){error(e);}}),smallButton('Baixar transcrição',async()=>{try{saveBlob(await downloadBlob(id,'text'),'Transcricao_George.txt');}catch(e){error(e);}}));
 try{const b=await downloadBlob(id,'pdf');pdfFile=new File([b],'Ata_Executiva_ERP_IMPAR_George.pdf',{type:'application/pdf'});share.disabled=false;}catch(e){error(e);}
}
$('reportBack').onclick=()=>{$('reportDialog').close();$('reportFrame').src='about:blank';if(state.pdfUrl)URL.revokeObjectURL(state.pdfUrl);};

// Recording uses the same durable upload path. Fragments are reassembled before decoding.
function recorderMime(video=false){const types=video?['video/webm;codecs=vp8,opus','video/mp4','video/webm']:['audio/webm;codecs=opus','audio/mp4','audio/webm'];return types.find(t=>window.MediaRecorder?.isTypeSupported(t))||'';}
async function beginCapture(stream,mode,isVideo=false){
 if(!window.MediaRecorder)throw new Error('Este navegador não oferece gravação. Anexe um arquivo gravado no celular.');
 const mime=recorderMime(isVideo),ext=mime.includes('mp4')?'mp4':'webm';const name=`${mode}_${new Date().toISOString().slice(0,10)}.${ext}`;
 const start=await request('media_start',{name,mime,live:true,parent_record_id:state.record,kind:mode==='meeting'?'meeting':mode==='kickoff'?'kickoff':'media'});
 const rec=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:64000}:{});
 const r={id:start.record_id,mode,rec,stream,index:0,queue:Promise.resolve(),started:Date.now(),pending:0,error:null,stopping:false,ownStream:mode==='kickoff'||isVideo};state.recording=r;
 rec.ondataavailable=e=>{
  if(!e.data?.size)return;const data=e.data;r.pending+=data.size;
  if(r.pending>16*1024*1024&&rec.state==='recording'){rec.pause();notice('Rede lenta: gravação pausada enquanto os blocos são enviados.');}
  r.queue=r.queue.then(async()=>{if(r.error)return;for(let p=0;p<data.size;p+=start.chunk_bytes){const b=data.slice(p,p+start.chunk_bytes);let done=false;
    for(let attempt=0;attempt<3&&!done;attempt++){try{await uploadChunk(r.id,r.index,b);done=true;}catch(e){if(attempt===2)throw e;await wait(900*(attempt+1));}}
    r.index++;r.pending-=b.size;
   }if(!r.stopping&&rec.state==='paused'&&r.pending<2*1024*1024)rec.resume();}).catch(e=>{r.error=e;if(rec.state==='recording')rec.pause();notice('Gravação pausada: não foi possível confirmar o upload. Encerre a captura; ela será marcada incompleta e os blocos confirmados permanecerão no servidor. '+e.message);});
 };
 rec.onerror=e=>{r.error=e.error||new Error('Falha de gravação.');error(r.error);};rec.start(4000);normalStatus();return r;
}
async function endCapture(){
 const r=state.recording;if(!r||r.stopping)return;r.stopping=true;voice.pauseTransmit();
 showStatus('Finalizando a gravação e confirmando os blocos…','warning');
 await new Promise(resolve=>{r.rec.addEventListener('stop',resolve,{once:true});if(r.rec.state!=='inactive')r.rec.stop();else resolve();});
 await r.queue;await state.logQueue;await state.chatQueue;
 if(r.ownStream)r.stream.getTracks().forEach(t=>t.stop());state.recording=null;setActive('');state.mode='text';voice.pause();
 if(r.error){error(new Error('Gravação incompleta: '+r.error.message+' Os blocos confirmados foram mantidos; nenhum PDF foi publicado.'));return;}
 try{await request('upload_finish',{record_id:r.id,chunks:r.index});notice('Gravação confirmada no servidor. Mantenha esta página aberta durante o processamento.');await processJob(r.id);}catch(e){error(e);}
 normalStatus();
}
async function recordingButton(mode){
 if(!requireAuth())return;
 if(state.recording){if(state.recording.mode===mode)await endCapture();else notice('Encerre a gravação atual antes de iniciar outra.');return;}
 try{if(mode==='meeting'){state.mode='audio';await voice.connect();setActive('meeting');await beginCapture(voice.stream,'meeting');}
 else{voice.pause();const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});setActive('kickoff');await beginCapture(stream,'kickoff');}
 notice('Gravação iniciada. Avise os participantes. Os blocos serão enviados ao servidor; no Kickoff, George não responde.');
 }catch(e){if(!state.recording)voice.pause();error(e);}
}
$('btnMeeting').onclick=()=>recordingButton('meeting');$('btnKickoff').onclick=()=>recordingButton('kickoff');
let camera=null;
$('btnFilm').onclick=async()=>{
 if(!requireAuth())return;if(state.recording){notice('Encerre a gravação atual antes de filmar.');return;}
 try{voice.pause();camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:true});$('cameraVideo').srcObject=camera;$('cameraModal').classList.remove('hidden');await $('cameraVideo').play();$('cameraInfo').textContent='Pronto para gravar. O áudio será transcrito; as imagens não serão interpretadas.';}
 catch(e){error(e);}
};
$('btnStartFilm').onclick=async()=>{try{await beginCapture(camera,'film',true);$('btnStartFilm').disabled=true;$('btnStopFilm').disabled=false;$('cameraInfo').textContent='Gravando e enviando os blocos…';}catch(e){error(e);}};
$('btnStopFilm').onclick=async()=>{$('cameraModal').classList.add('hidden');await endCapture();camera=null;$('btnStartFilm').disabled=false;$('btnStopFilm').disabled=true;};
$('btnCloseCamera').onclick=()=>{if(state.recording?.mode==='film'){$('cameraInfo').textContent='Use Parar para finalizar e preservar a gravação.';return;}camera?.getTracks().forEach(t=>t.stop());camera=null;$('cameraModal').classList.add('hidden');};
window.addEventListener('beforeunload',e=>{if(state.recording||state.upload||state.busy){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{voice.close();camera?.getTracks().forEach(t=>t.stop());});
async function initialize(){
 try{const j=await request('resume');state.record=j.record_id;input.value=j.draft||'';autosize();
  [...chat.querySelectorAll('.msg,.system')].forEach(n=>n.remove());
  if(j.turns.length)j.turns.forEach(t=>message(t.role==='user'?'me':'george',t.text,'GEORGE',t.at?new Date(t.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):now()));
  else message('george','Oi! Eu sou o George. Como posso te ajudar hoje?');
  const h=await request('health');state.caps=h.media;$('onlineText').textContent='conectado';
  if(new URLSearchParams(location.search).has('diagnostico')){const n=message('george','Diagnóstico de instalação','DIAGNÓSTICO');const pre=document.createElement('pre');pre.className='diagnostic';pre.textContent=JSON.stringify(h,null,2);n.bubble.append(pre);state.mode='text';normalStatus();return;}
  for(const item of (j.jobs||[]).slice(0,4)){if(item.state==='ready'){const m=message('george','Documento disponível: '+item.name,'ARQUIVO');reportActions(item.record_id,m.bubble);}else if(item.state!=='uploading'){const m=message('george','Há um processamento preservado: '+item.name,'ARQUIVO');m.bubble.append(smallButton('Retomar processamento',()=>processJob(item.record_id)));}}
  state.mode='audio';setActive('audio');$('btnAudio').focus({preventScroll:true});normalStatus();
  try{const p=await navigator.permissions?.query({name:'microphone'});if(p?.state==='granted')await voice.connect();}catch{}
 }catch(e){error(e);}
}
(async()=>{try{setActive('audio');if(await authenticate())await initialize();}catch(e){error(e);}})();
})();
