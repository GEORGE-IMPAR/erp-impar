const API='https://api.erpimpar.com.br/george-reuniao/api.php';
let sessionId=null, recognition=null, listening=false, speaking=false, wakeLock=null;
const $=id=>document.getElementById(id);
const statusEl=$('status'), transcript=$('transcript'), interim=$('interim'), georgeLog=$('georgeLog');
const btnStart=$('btnStart'), btnStop=$('btnStop'), btnOpening=$('btnOpening'), btnFinish=$('btnFinish');

function append(el,text,cls=''){const d=document.createElement('div');if(cls)d.className=cls;d.textContent=text;el.appendChild(d);el.scrollTop=el.scrollHeight}
async function api(action,payload={}) {
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  const j=await r.json().catch(()=>({ok:false,error:'Resposta inválida do backend'}));
  if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
  return j;
}
function setStatus(text,live=false){statusEl.textContent=text;statusEl.classList.toggle('live',live)}
function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function isWake(text){
  const n=normalize(text);
  return /\b(george|jorge|jod|jody|georgie|giorge|djorge|jorji)\b/.test(n);
}
function isOpening(text){
  const n=normalize(text);
  return isWake(text) && /(apresent|explica|conta).*(rafa|rafael)|(rafa|rafael).*(discuss|ideia|erp|impar)/.test(n);
}
async function acquireWakeLock(){
  try{if('wakeLock'in navigator)wakeLock=await navigator.wakeLock.request('screen')}catch(e){}
}
async function releaseWakeLock(){try{await wakeLock?.release()}catch(e){}wakeLock=null}

function stopRecognitionOnly(){
  try{recognition?.stop()}catch(e){}
}
function resumeRecognition(){
  if(listening && !speaking){try{recognition?.start()}catch(e){}}
}
function chooseVoice(){
  const voices=speechSynthesis.getVoices();
  return voices.find(v=>/^pt-BR/i.test(v.lang))||voices.find(v=>/^pt/i.test(v.lang))||voices[0];
}
function speak(text){
  return new Promise(resolve=>{
    speaking=true;
    stopRecognitionOnly();
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    const voice=chooseVoice(); if(voice)u.voice=voice;
    u.lang=voice?.lang||'pt-BR'; u.rate=.98; u.pitch=.96;
    u.onend=()=>{speaking=false;setTimeout(resumeRecognition,450);resolve()};
    u.onerror=()=>{speaking=false;setTimeout(resumeRecognition,450);resolve()};
    speechSynthesis.speak(u);
  });
}
async function presentOpening(){
  if(!sessionId)return;
  try{
    setStatus('George apresentando...',true);
    const j=await api('opening',{session_id:sessionId});
    append(georgeLog,'George: '+j.text,'george');
    await speak(j.text);
    setStatus('Escutando reunião',true);
  }catch(e){append(georgeLog,'ERRO: '+e.message,'error');setStatus('Erro')}
}
async function askGeorge(text){
  if(!sessionId||!text.trim())return;
  try{
    setStatus('George pensando...',true);
    const j=await api('ask',{session_id:sessionId,text});
    append(georgeLog,'George: '+j.text,'george');
    await speak(j.text);
    setStatus('Escutando reunião',true);
  }catch(e){append(georgeLog,'ERRO: '+e.message,'error');setStatus('Erro')}
}
async function recordNote(text){
  if(!sessionId||!text.trim())return;
  append(transcript,'Participante: '+text,'participant');
  try{await api('note',{session_id:sessionId,speaker:'Participante',text})}catch(e){append(transcript,'[falha ao salvar trecho: '+e.message+']','error')}
}

function createRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return null;
  const r=new SR(); r.lang='pt-BR'; r.continuous=true; r.interimResults=true; r.maxAlternatives=1;
  r.onresult=async ev=>{
    let finalText='', temp='';
    for(let i=ev.resultIndex;i<ev.results.length;i++){
      const t=ev.results[i][0].transcript;
      if(ev.results[i].isFinal)finalText+=t+' '; else temp+=t+' ';
    }
    interim.textContent=temp.trim();
    finalText=finalText.trim();
    if(!finalText||speaking)return;
    interim.textContent='';
    await recordNote(finalText);
    if(isOpening(finalText)){await presentOpening();return}
    if(isWake(finalText)){await askGeorge(finalText);return}
  };
  r.onerror=e=>{if(e.error!=='no-speech'&&e.error!=='aborted')append(transcript,'[microfone: '+e.error+']','error')};
  r.onend=()=>{if(listening&&!speaking)setTimeout(resumeRecognition,350)};
  return r;
}

async function startMeeting(){
  if(listening)return;
  try{
    const j=await api('start');
    sessionId=j.session_id;
    recognition=createRecognition();
    if(!recognition)throw new Error('Este navegador não oferece SpeechRecognition. Use Chrome/Edge no Android para o piloto.');
    await acquireWakeLock();
    listening=true; recognition.start();
    setStatus('Escutando reunião',true);
    btnStart.disabled=true;btnStop.disabled=false;btnOpening.disabled=false;btnFinish.disabled=false;
    append(transcript,'[Reunião iniciada: '+sessionId+']','george');
  }catch(e){append(transcript,'ERRO: '+e.message,'error');setStatus('Erro')}
}
async function stopMeeting(){
  listening=false; stopRecognitionOnly(); speechSynthesis.cancel(); speaking=false; await releaseWakeLock();
  setStatus('Pausado'); btnStart.disabled=false;btnStop.disabled=true;
}
async function finishMeeting(){
  if(!sessionId)return;
  listening=false;stopRecognitionOnly();speechSynthesis.cancel();await releaseWakeLock();
  try{
    setStatus('Gerando ata...',true);
    const j=await api('finish',{session_id:sessionId});
    append(georgeLog,'\nATA / FECHAMENTO\n'+j.text,'george');
    setStatus('Reunião encerrada');
  }catch(e){append(georgeLog,'ERRO: '+e.message,'error');setStatus('Erro')}
}
btnStart.onclick=startMeeting;btnStop.onclick=stopMeeting;btnOpening.onclick=presentOpening;btnFinish.onclick=finishMeeting;
$('btnAsk').onclick=()=>{const t=$('manual').value.trim();if(t){$('manual').value='';askGeorge(t)}};
$('manual').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('btnAsk').click()}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&listening)acquireWakeLock()});
window.addEventListener('beforeunload',releaseWakeLock);
