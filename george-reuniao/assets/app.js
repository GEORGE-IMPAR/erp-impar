
const CFG=window.GEORGE_CONFIG||{};
const API=CFG.API_URL;
let sessionId=null;
let recognition=null;
let listening=false;
let speaking=false;
let wakeLock=null;

const $=id=>document.getElementById(id);
const chat=$('chat'), statusEl=$('status'), interim=$('interim'), interimWrap=$('interimWrap');
const btnMic=$('btnMic'), btnPause=$('btnPause'), btnResume=$('btnResume');
const btnOpening=$('btnOpening'), btnFinishTop=$('btnFinishTop');
const meetingState=$('meetingState'), manual=$('manual');

function nowTime(){return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
function scrollDown(){requestAnimationFrame(()=>chat.scrollTop=chat.scrollHeight)}

function addMessage(side,text,label){
  const wrap=document.createElement('div');
  wrap.className='msg '+(side==='me'?'me':'george');

  const bubble=document.createElement('div');
  bubble.className='bubble';
  if(side!=='me'){
    const b=document.createElement('b');
    b.textContent=label||'George';
    bubble.appendChild(b);
  }
  const p=document.createElement('p');
  p.textContent=text;
  bubble.appendChild(p);

  const time=document.createElement('time');
  time.textContent=nowTime();

  wrap.appendChild(bubble);
  wrap.appendChild(time);
  chat.insertBefore(wrap,interimWrap);
  scrollDown();
}

function systemMsg(text){
  const d=document.createElement('div');
  d.className='day';
  d.textContent=text;
  chat.insertBefore(d,interimWrap);
  scrollDown();
}

function setStatus(text,live=false){
  statusEl.innerHTML='<i></i>'+text;
  statusEl.classList.toggle('live',live);
}

async function api(action,payload={}){
  if(!API)throw new Error('API_URL não configurada');
  const r=await fetch(API,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,...payload}),
    cache:'no-store'
  });
  const j=await r.json().catch(()=>({ok:false,error:'Resposta inválida do backend'}));
  if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
  return j;
}

function norm(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function isWake(text){
  const n=norm(text);
  return /\b(george|jorge|jod|jody|georgie|giorge|djorge|jorji)\b/.test(n);
}
function isOpening(text){
  const n=norm(text);
  return isWake(text)&&(
    /(apresent|explica|conta).*(rafa|rafael)/.test(n)||
    /(rafa|rafael).*(discuss|ideia|erp|impar)/.test(n)||
    /(apresent|explica).*(discuss|erp|impar)/.test(n)
  );
}

async function acquireWakeLock(){
  try{if('wakeLock'in navigator)wakeLock=await navigator.wakeLock.request('screen')}catch(e){}
}
async function releaseWakeLock(){
  try{await wakeLock?.release()}catch(e){}
  wakeLock=null;
}

function stopRecognitionOnly(){
  try{recognition?.stop()}catch(e){}
}
function resumeRecognition(){
  if(listening&&!speaking){
    try{recognition?.start()}catch(e){}
  }
}
function chooseVoice(){
  const voices=speechSynthesis.getVoices();
  return voices.find(v=>/^pt-BR/i.test(v.lang))||
         voices.find(v=>/^pt/i.test(v.lang))||
         voices[0];
}
function speak(text){
  return new Promise(resolve=>{
    speaking=true;
    stopRecognitionOnly();
    speechSynthesis.cancel();

    const u=new SpeechSynthesisUtterance(text);
    const voice=chooseVoice();
    if(voice)u.voice=voice;
    u.lang=voice?.lang||'pt-BR';
    u.rate=.98;
    u.pitch=.96;

    u.onend=()=>{speaking=false;setTimeout(resumeRecognition,400);resolve()};
    u.onerror=()=>{speaking=false;setTimeout(resumeRecognition,400);resolve()};
    speechSynthesis.speak(u);
  });
}

function updateUi(){
  btnMic.classList.toggle('live',listening);
  btnPause.classList.toggle('hidden',!listening);
  btnResume.classList.toggle('hidden',listening||!sessionId);
  btnOpening.classList.toggle('hidden',!sessionId);
  btnFinishTop.classList.toggle('hidden',!sessionId);
  meetingState.textContent=!sessionId?'Reunião ainda não iniciada':
    (listening?'Reunião em andamento • microfone ativo':'Reunião iniciada • escuta pausada');
}

async function presentOpening(){
  if(!sessionId){await startMeeting(false)}
  try{
    setStatus('George está falando...',true);
    const j=await api('opening',{session_id:sessionId});
    addMessage('george',j.text,'George');
    await speak(j.text);
    setStatus('escutando',true);
  }catch(e){
    addMessage('george','Erro na apresentação: '+e.message,'Sistema');
    setStatus('erro');
  }
}

async function askGeorge(text){
  if(!text.trim())return;
  if(!sessionId)await startMeeting(false);

  addMessage('me',text);
  try{
    setStatus('George está pensando...',true);
    const j=await api('ask',{session_id:sessionId,text});
    addMessage('george',j.text,'George');
    await speak(j.text);
    setStatus(listening?'escutando':'pronto',listening);
  }catch(e){
    addMessage('george','Não consegui responder: '+e.message,'Sistema');
    setStatus('erro');
  }
}

async function saveTranscript(text){
  if(!sessionId||!text.trim())return;
  try{
    await api('note',{session_id:sessionId,speaker:'Participante',text});
  }catch(e){
    console.warn(e);
  }
}

function createRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return null;
  const r=new SR();
  r.lang='pt-BR';
  r.continuous=true;
  r.interimResults=true;
  r.maxAlternatives=1;

  r.onresult=async ev=>{
    let finalText='',temp='';
    for(let i=ev.resultIndex;i<ev.results.length;i++){
      const t=ev.results[i][0].transcript;
      if(ev.results[i].isFinal)finalText+=t+' ';
      else temp+=t+' ';
    }

    temp=temp.trim();
    interim.textContent=temp;
    interimWrap.classList.toggle('hidden',!temp);

    finalText=finalText.trim();
    if(!finalText||speaking)return;

    interim.textContent='';
    interimWrap.classList.add('hidden');

    addMessage('me',finalText);
    await saveTranscript(finalText);

    if(isOpening(finalText)){
      await presentOpening();
      return;
    }
    if(isWake(finalText)){
      // Avoid duplicating user message in askGeorge()
      try{
        setStatus('George está pensando...',true);
        const j=await api('ask',{session_id:sessionId,text:finalText});
        addMessage('george',j.text,'George');
        await speak(j.text);
        setStatus('escutando',true);
      }catch(e){
        addMessage('george','Não consegui responder: '+e.message,'Sistema');
      }
    }
  };

  r.onerror=e=>{
    if(!['no-speech','aborted'].includes(e.error)){
      systemMsg('Microfone: '+e.error);
    }
  };
  r.onend=()=>{
    if(listening&&!speaking)setTimeout(resumeRecognition,350);
  };
  return r;
}

async function startMeeting(startListening=true){
  if(!sessionId){
    try{
      setStatus('iniciando...');
      const j=await api('start');
      sessionId=j.session_id;
      systemMsg('Reunião iniciada');
      recognition=createRecognition();
      if(!recognition){
        addMessage('george','O reconhecimento de voz não está disponível neste navegador. Podemos continuar pelo campo de texto.','Sistema');
        startListening=false;
      }
    }catch(e){
      addMessage('george','Não consegui iniciar a reunião: '+e.message,'Sistema');
      setStatus('erro');
      return;
    }
  }

  if(startListening&&recognition){
    await acquireWakeLock();
    listening=true;
    try{recognition.start()}catch(e){}
    setStatus('escutando',true);
  }
  updateUi();
}

async function pauseMeeting(){
  listening=false;
  stopRecognitionOnly();
  setStatus('escuta pausada');
  updateUi();
}
async function resumeMeeting(){
  if(!sessionId)return startMeeting(true);
  if(!recognition)recognition=createRecognition();
  listening=true;
  await acquireWakeLock();
  try{recognition.start()}catch(e){}
  setStatus('escutando',true);
  updateUi();
}
async function finishMeeting(){
  if(!sessionId)return;
  listening=false;
  stopRecognitionOnly();
  speechSynthesis.cancel();
  await releaseWakeLock();
  closeSheet();

  try{
    setStatus('gerando ata...',true);
    systemMsg('Encerrando reunião e organizando a ata...');
    const j=await api('finish',{session_id:sessionId});
    addMessage('george',j.text,'Ata da reunião');
    systemMsg('Reunião encerrada');
    setStatus('reunião encerrada');
  }catch(e){
    addMessage('george','Não consegui gerar a ata: '+e.message,'Sistema');
    setStatus('erro');
  }
  updateUi();
}

function autosize(){
  manual.style.height='auto';
  manual.style.height=Math.min(manual.scrollHeight,110)+'px';
}
manual.addEventListener('input',autosize);
manual.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    sendManual();
  }
});
async function sendManual(){
  const text=manual.value.trim();
  if(!text)return;
  manual.value='';
  autosize();
  await askGeorge(text);
}

btnMic.onclick=async()=>{
  if(!sessionId)await startMeeting(true);
  else if(listening)await pauseMeeting();
  else await resumeMeeting();
};
$('btnSend').onclick=sendManual;
btnPause.onclick=pauseMeeting;
btnResume.onclick=resumeMeeting;
btnOpening.onclick=presentOpening;
$('btnOpeningCard').onclick=presentOpening;
$('btnOpeningSheet').onclick=()=>{closeSheet();presentOpening()};
btnFinishTop.onclick=finishMeeting;
$('btnFinishSheet').onclick=finishMeeting;

const backdrop=$('sheetBackdrop'), sheet=$('menuSheet');
function openSheet(){backdrop.classList.remove('hidden');sheet.classList.remove('hidden')}
function closeSheet(){backdrop.classList.add('hidden');sheet.classList.add('hidden')}
$('btnMenu').onclick=openSheet;
$('btnCloseSheet').onclick=closeSheet;
backdrop.onclick=closeSheet;

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&listening)acquireWakeLock();
});
window.addEventListener('beforeunload',releaseWakeLock);

updateUi();
