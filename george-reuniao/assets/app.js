
const CFG=window.GEORGE_CONFIG||{};
const API=CFG.API_URL;
const CHUNK_MS=Number(CFG.AUDIO_CHUNK_MS||6000);

let sessionId=null;
let stream=null;
let recorder=null;
let voiceActive=false;
let speaking=false;
let transcribeQueue=Promise.resolve();
let rollingText='';
let lastTrigger='';
let typingEl=null;

const $=id=>document.getElementById(id);
const chat=$('chat'), anchor=$('systemAnchor'), manual=$('manual');
const btnMic=$('btnMic'), btnVoiceTop=$('btnVoiceTop'), listenStrip=$('listenStrip');
const meetingText=$('meetingText'), btnFinish=$('btnFinish');

function scrollDown(){requestAnimationFrame(()=>chat.scrollTop=chat.scrollHeight)}
function addMessage(side,text,label){
  const wrap=document.createElement('div');wrap.className='msg '+(side==='me'?'me':'george');
  const b=document.createElement('div');b.className='bubble';
  if(side==='george'){const w=document.createElement('div');w.className='who';w.textContent=label||'GEORGE';b.appendChild(w)}
  const d=document.createElement('div');d.textContent=text;b.appendChild(d);wrap.appendChild(b);
  chat.insertBefore(wrap,anchor);scrollDown();return wrap;
}
function system(text){
  const d=document.createElement('div');d.className='system';d.textContent=text;chat.insertBefore(d,anchor);scrollDown();
}
function showTyping(){
  hideTyping();
  const w=document.createElement('div');w.className='msg george';w.innerHTML='<div class="bubble"><div class="who">GEORGE</div><div class="typing"><i></i><i></i><i></i></div></div>';
  chat.insertBefore(w,anchor);typingEl=w;scrollDown();
}
function hideTyping(){if(typingEl){typingEl.remove();typingEl=null}}
function setVoiceUi(){
  btnMic.classList.toggle('live',voiceActive);
  btnVoiceTop.classList.toggle('off',!voiceActive);
  listenStrip.classList.toggle('live',voiceActive);
  meetingText.textContent=!sessionId?'Reunião ainda não iniciada':(voiceActive?'Modo voz ativo • escutando a reunião':'Reunião ativa • escuta pausada');
  btnFinish.classList.toggle('hidden',!sessionId);
}
async function apiJson(action,payload={}){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),cache:'no-store'});
  const j=await r.json().catch(()=>({ok:false,error:'Resposta inválida do backend'}));
  if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));return j;
}
async function health(){
  const j=await apiJson('health');
  if(!j.key_configured)throw new Error('A chave da OpenAI ainda não foi configurada no backend.');
  return j;
}
async function startSession(){
  if(sessionId)return;
  await health();
  const j=await apiJson('start');sessionId=j.session_id;system('Reunião iniciada');setVoiceUi();
}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function isWake(s){return /\b(george|jorge|jod|jody|georgie|giorge|djorge|jorji)\b/.test(norm(s))}
function isOpening(s){
  const n=norm(s);
  return isWake(n)&&(
    /(apresent|explica|conta).*(rafa|rafael)/.test(n)||
    /(rafa|rafael).*(discuss|ideia|erp|impar)/.test(n)||
    /(apresent|explica).*(discuss|erp|impar)/.test(n)
  );
}
function pickMime(){
  const opts=['audio/webm;codecs=opus','audio/webm','audio/mp4'];
  return opts.find(x=>window.MediaRecorder&&MediaRecorder.isTypeSupported(x))||'';
}
async function transcribeBlob(blob){
  if(!sessionId||blob.size<1000)return '';
  const fd=new FormData();
  fd.append('action','transcribe');
  fd.append('session_id',sessionId);
  fd.append('audio',blob,'meeting.'+(blob.type.includes('mp4')?'mp4':'webm'));
  const r=await fetch(API,{method:'POST',body:fd,cache:'no-store'});
  const j=await r.json().catch(()=>({ok:false,error:'Resposta inválida na transcrição'}));
  if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
  return String(j.text||'').trim();
}
async function processTranscript(text){
  if(!text)return;
  addMessage('me',text);
  rollingText=(rollingText+' '+text).slice(-1200);
  const candidate=rollingText.trim();

  if(isOpening(candidate) && lastTrigger!==candidate){
    lastTrigger=candidate;rollingText='';
    await presentOpening();
    return;
  }
  if(isWake(text) && lastTrigger!==text){
    lastTrigger=text;rollingText='';
    await askGeorge(text,false);
  }
}
async function requestMic(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Este navegador não oferece captura de microfone.');
  try{
    return await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
      video:false
    });
  }catch(e){
    if(e?.name==='NotAllowedError'||e?.name==='SecurityError'){
      throw new Error('Microfone bloqueado. No Chrome, abra as permissões deste site e marque Microfone = Permitir.');
    }
    throw new Error('Não consegui abrir o microfone: '+(e?.message||e?.name||'erro'));
  }
}
async function startVoice(){
  if(voiceActive)return;
  try{
    await startSession();
    stream=await requestMic();
    const mime=pickMime();
    recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
    recorder.ondataavailable=e=>{
      if(!voiceActive||speaking||!e.data||e.data.size<1000)return;
      const blob=e.data;
      transcribeQueue=transcribeQueue.then(async()=>{
        try{
          const text=await transcribeBlob(blob);
          await processTranscript(text);
        }catch(err){
          system('Áudio: '+err.message);
        }
      });
    };
    recorder.onerror=e=>system('Gravação: '+(e.error?.message||'erro'));
    recorder.start(CHUNK_MS);
    voiceActive=true;setVoiceUi();
  }catch(e){
    system(e.message);
    voiceActive=false;setVoiceUi();
  }
}
function stopTracks(){try{stream?.getTracks().forEach(t=>t.stop())}catch(e){}stream=null}
async function pauseVoice(){
  voiceActive=false;
  try{if(recorder&&recorder.state!=='inactive')recorder.stop()}catch(e){}
  recorder=null;stopTracks();setVoiceUi();
}
async function resumeVoice(){await startVoice()}
function chooseVoice(){
  const voices=speechSynthesis.getVoices();
  return voices.find(v=>/^pt-BR/i.test(v.lang))||voices.find(v=>/^pt/i.test(v.lang))||voices[0];
}
async function speak(text){
  const restart=voiceActive;
  if(restart){
    voiceActive=false;
    try{recorder?.pause()}catch(e){}
    setVoiceUi();
  }
  speaking=true;speechSynthesis.cancel();
  await new Promise(resolve=>{
    const u=new SpeechSynthesisUtterance(text),v=chooseVoice();
    if(v)u.voice=v;u.lang=v?.lang||'pt-BR';u.rate=.98;u.pitch=.96;
    u.onend=resolve;u.onerror=resolve;speechSynthesis.speak(u);
  });
  speaking=false;
  if(restart&&recorder&&recorder.state==='paused'){
    try{recorder.resume()}catch(e){}
    voiceActive=true;setVoiceUi();
  }
}
async function presentOpening(){
  try{
    if(!sessionId)await startSession();
    showTyping();
    const j=await apiJson('opening',{session_id:sessionId});
    hideTyping();addMessage('george',j.text);await speak(j.text);
  }catch(e){hideTyping();addMessage('george','Não consegui apresentar: '+e.message,'SISTEMA')}
}
async function askGeorge(text,addUser=true){
  try{
    if(!sessionId)await startSession();
    if(addUser)addMessage('me',text);
    showTyping();
    const j=await apiJson('ask',{session_id:sessionId,text});
    hideTyping();addMessage('george',j.text);await speak(j.text);
  }catch(e){hideTyping();addMessage('george','Não consegui responder: '+e.message,'SISTEMA')}
}
async function finishMeeting(){
  if(!sessionId)return;
  await pauseVoice();
  try{
    system('Organizando a ata da reunião...');
    showTyping();
    const j=await apiJson('finish',{session_id:sessionId});
    hideTyping();addMessage('george',j.text,'ATA DA REUNIÃO');system('Reunião encerrada');
  }catch(e){hideTyping();addMessage('george','Não consegui gerar a ata: '+e.message,'SISTEMA')}
}
async function sendManual(){
  const t=manual.value.trim();if(!t)return;
  manual.value='';autosize();await askGeorge(t,true);
}
function autosize(){manual.style.height='auto';manual.style.height=Math.min(manual.scrollHeight,102)+'px'}
manual.addEventListener('input',autosize);
manual.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendManual()}});
$('btnSend').onclick=sendManual;
btnMic.onclick=()=>voiceActive?pauseVoice():startVoice();
btnVoiceTop.onclick=()=>voiceActive?pauseVoice():startVoice();
btnFinish.onclick=finishMeeting;

const sheet=$('sheet'),backdrop=$('sheetBackdrop');
function openSheet(){sheet.classList.remove('hidden');backdrop.classList.remove('hidden')}
function closeSheet(){sheet.classList.add('hidden');backdrop.classList.add('hidden')}
btnVoiceTop.addEventListener('contextmenu',e=>{e.preventDefault();openSheet()});
$('btnOpening').onclick=()=>{closeSheet();presentOpening()};
$('btnPause').onclick=()=>{closeSheet();pauseVoice()};
$('btnResume').onclick=()=>{closeSheet();resumeVoice()};
$('btnFinishSheet').onclick=()=>{closeSheet();finishMeeting()};
$('btnCloseSheet').onclick=closeSheet;backdrop.onclick=closeSheet;

// Long press the voice pill opens options
let pressTimer=null;
btnVoiceTop.addEventListener('pointerdown',()=>pressTimer=setTimeout(openSheet,650));
btnVoiceTop.addEventListener('pointerup',()=>{clearTimeout(pressTimer);pressTimer=null});
btnVoiceTop.addEventListener('pointercancel',()=>{clearTimeout(pressTimer);pressTimer=null});

setVoiceUi();
