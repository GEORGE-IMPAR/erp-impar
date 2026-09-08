const CFG=window.GEORGE_CONFIG||{};
const REALTIME_URL=CFG.REALTIME_SESSION_URL;
const API=CFG.API_URL;
const PDF_URL=CFG.PDF_URL;

const $=id=>document.getElementById(id);
const chat=$("chat"), anchor=$("typingAnchor"), manual=$("manual");
const modeStatus=$("modeStatus"), modeStatusText=$("modeStatusText");
const btnAudio=$("btnAudio"), btnMeeting=$("btnMeeting"), btnKickoff=$("btnKickoff");
const btnAttach=$("btnAttach"), btnFilm=$("btnFilm"), filePicker=$("filePicker");

let pc=null, dc=null, micStream=null, remoteAudio=null, audioSender=null;
let voiceActive=false, sessionId=null, typingEl=null, georgeSpeaking=false;
let assistantBuffer="", assistantShown="";
let inputDeltaByItem=new Map();
let currentMode="audio"; // DEFAULT OFICIAL DE EXPERIÊNCIA
let autoAttempted=false;
let suppressResponses=false;

/* vídeo */
let cameraStream=null, mediaRecorder=null, recordedChunks=[];

function now(){
  const d=new Date();
  return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
}
$("firstTime").textContent=now();

function scrollDown(){requestAnimationFrame(()=>chat.scrollTop=chat.scrollHeight)}

function cleanDisplay(text){
  return String(text||"")
    .replace(/^\s{0,3}#{1,6}\s*/gm,"")
    .replace(/\*\*/g,"").replace(/__/g,"").replace(/`/g,"");
}

function userInitials(){
  try{
    const u=JSON.parse(localStorage.getItem("ERPIMPAR_USER")||sessionStorage.getItem("ERPIMPAR_USER")||"null")||{};
    const n=String(u.nome||u.Nome||"GE").trim().split(/\s+/)[0]||"GE";
    return n.slice(0,2).toUpperCase();
  }catch(e){return "GE"}
}

function makeAvatar(side){
  const a=document.createElement("div");
  a.className="msg-avatar";
  if(side==="george"){
    const img=document.createElement("img");
    img.src="assets/logo_george.png";
    img.alt="George";
    a.appendChild(img);
  }else{
    a.textContent=userInitials();
  }
  return a;
}

function addMessage(side,text,label){
  if(!text||!String(text).trim())return null;
  const w=document.createElement("div");
  w.className="msg "+(side==="me"?"me":"george");
  const av=makeAvatar(side==="me"?"me":"george");
  const b=document.createElement("div");
  b.className="bubble";
  if(side!=="me"){
    const who=document.createElement("div");
    who.className="who";who.textContent=label||"GEORGE";b.appendChild(who);
  }
  const d=document.createElement("div");
  d.textContent=cleanDisplay(String(text).trim()); b.appendChild(d);
  const tm=document.createElement("div");
  tm.className="time";tm.textContent=now();b.appendChild(tm);
  w.appendChild(av);w.appendChild(b);
  chat.insertBefore(w,anchor);scrollDown();
  return {row:w,avatar:av,bubble:b};
}
function system(text){
  const d=document.createElement("div");
  d.className="system";d.textContent=text;chat.insertBefore(d,anchor);scrollDown();
}
function showTyping(){
  hideTyping();
  const w=document.createElement("div");w.className="msg george";
  const av=makeAvatar("george");
  const b=document.createElement("div");b.className="bubble";
  const who=document.createElement("div");who.className="who";who.textContent="GEORGE";
  const dots=document.createElement("div");dots.className="typing";dots.innerHTML="<i></i><i></i><i></i>";
  b.appendChild(who);b.appendChild(dots);w.appendChild(av);w.appendChild(b);
  chat.insertBefore(w,anchor);typingEl=w;scrollDown();
}
function hideTyping(){if(typingEl){typingEl.remove();typingEl=null}}

function normalize(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function calledGeorge(s){
  const n=normalize(s);
  return /\b(george|jorge|jod|jody|georgie|giorge|djorge|jorji)\b/.test(n);
}

async function api(action,payload={}){
  const r=await fetch(API,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,...payload}),cache:"no-store"
  });
  const j=await r.json().catch(()=>({ok:false,error:"Resposta inválida do backend"}));
  if(!r.ok||!j.ok)throw new Error(j.error||("HTTP "+r.status));
  return j;
}
async function logTurn(role,text){
  if(!sessionId||!text)return;
  try{await api("log",{session_id:sessionId,role,text})}
  catch(e){console.warn("log",e)}
}
function sendEvent(event){if(dc?.readyState==="open")dc.send(JSON.stringify(event))}
function setMicTransmission(enabled){
  try{micStream?.getAudioTracks().forEach(t=>t.enabled=!!enabled)}catch(e){}
}
function requestResponse(){
  if(suppressResponses||currentMode==="kickoff")return;
  showTyping();assistantBuffer="";
  sendEvent({type:"response.create",response:{max_output_tokens:"inf"}});
}
function sendTextToRealtime(text){
  sendEvent({
    type:"conversation.item.create",
    item:{type:"message",role:"user",content:[{type:"input_text",text}]}
  });
  requestResponse();
}

function extractResponseText(evt){
  try{
    const parts=[];
    for(const item of (evt?.response?.output||[])){
      for(const c of (item?.content||[])){
        if(typeof c?.transcript==="string")parts.push(c.transcript);
        else if(typeof c?.text==="string")parts.push(c.text);
      }
    }
    return parts.join("\n").trim();
  }catch(e){return ""}
}

function setStatus(text,kind){
  modeStatusText.textContent=text;
  modeStatus.className="mode-status show "+(kind||"");
}
function markActive(mode){
  document.querySelectorAll(".action").forEach(b=>b.classList.remove("active"));
  if(mode==="audio")btnAudio.classList.add("active");
  if(mode==="meeting")btnMeeting.classList.add("active");
  if(mode==="kickoff")btnKickoff.classList.add("active");
}

function applyModeStatus(){
  if(currentMode==="audio"){
    setStatus(voiceActive?"Áudio ligado • George está ouvindo":"Áudio selecionado • toque para ativar o microfone",voiceActive?"audio":"warning");
  }else if(currentMode==="meeting"){
    setStatus(voiceActive?"Reunião ativa • George escuta e responde quando chamado":"Reunião selecionada • toque novamente para ativar","meeting");
  }else if(currentMode==="kickoff"){
    setStatus(voiceActive?"Kickoff gravando • George só ouve • toque novamente para encerrar e gerar relatório":"Kickoff selecionado • toque para iniciar","kickoff");
  }else{
    setStatus("Áudio desligado • modo escrita","text");
  }
}

function syncSpeaking(){
  document.querySelectorAll(".msg-avatar.speaking").forEach(x=>x.classList.remove("speaking"));
  if(!georgeSpeaking)return;
  const av=[...document.querySelectorAll(".msg.george .msg-avatar")].pop();
  if(av)av.classList.add("speaking");
}

function handleEvent(evt){
  const t=evt?.type||"";

  if(t==="response.created" || t==="response.output_audio.delta" || t==="response.audio.delta"){
    georgeSpeaking=true;setMicTransmission(false);syncSpeaking();
    setStatus("George está falando...","audio");
  }
  if(t==="input_audio_buffer.speech_started"){
    applyModeStatus();
  }
  if(t==="conversation.item.input_audio_transcription.delta"){
    const id=evt.item_id||"current";
    inputDeltaByItem.set(id,(inputDeltaByItem.get(id)||"")+(evt.delta||""));
  }
  if(t==="conversation.item.input_audio_transcription.completed"){
    const id=evt.item_id||"current";
    const text=String(evt.transcript||inputDeltaByItem.get(id)||"").trim();
    inputDeltaByItem.delete(id);
    if(text && !georgeSpeaking){
      addMessage("me",text);
      logTurn("user",text);

      if(currentMode==="kickoff"){
        /* KICKOFF: somente ouve/transcreve/loga */
      }else if(currentMode==="meeting"){
        if(calledGeorge(text))requestResponse();
      }else if(currentMode==="audio"){
        requestResponse();
      }
    }
  }
  if(["response.output_audio_transcript.delta","response.audio_transcript.delta","response.output_text.delta","response.text.delta"].includes(t)){
    assistantBuffer += evt.delta||"";
  }
  if(["response.output_audio_transcript.done","response.audio_transcript.done","response.output_text.done","response.text.done"].includes(t)){
    const text=String(evt.transcript||evt.text||assistantBuffer||"").trim();
    if(text && text!==assistantShown){
      hideTyping();addMessage("george",text);assistantShown=text;logTurn("assistant",text);
    }
    assistantBuffer="";
  }
  if(t==="response.done"){
    georgeSpeaking=false;syncSpeaking();setMicTransmission(true);hideTyping();
    const text=extractResponseText(evt)||assistantBuffer.trim();
    if(text && text!==assistantShown){
      addMessage("george",text);assistantShown=text;logTurn("assistant",text);
    }
    assistantBuffer="";applyModeStatus();
  }
  if(t==="error"){
    hideTyping();
    const msg=evt?.error?.message||"Erro na sessão de voz";
    system("George: "+msg);
  }
}

async function startAppSession(){
  if(sessionId)return;
  const h=await api("health");
  if(!h.key_configured)throw new Error("A chave da OpenAI não está configurada.");
  const s=await api("start");
  sessionId=s.session_id;
}

async function connectRealtime(){
  if(voiceActive)return;
  await startAppSession();

  micStream=await navigator.mediaDevices.getUserMedia({
    audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false
  });

  pc=new RTCPeerConnection();
  remoteAudio=document.createElement("audio");
  remoteAudio.autoplay=true;remoteAudio.playsInline=true;
  pc.ontrack=e=>{
    remoteAudio.srcObject=e.streams[0];
    remoteAudio.play().catch(()=>{});
  };

  const track=micStream.getAudioTracks()[0];
  audioSender=pc.addTrack(track,micStream);

  dc=pc.createDataChannel("oai-events");
  dc.addEventListener("message",e=>{
    try{handleEvent(JSON.parse(e.data))}catch(err){console.warn(err)}
  });
  dc.addEventListener("open",()=>{
    voiceActive=true;applyModeStatus();
  });
  dc.addEventListener("close",()=>{
    voiceActive=false;applyModeStatus();
  });

  const offer=await pc.createOffer();
  await pc.setLocalDescription(offer);

  const r=await fetch(REALTIME_URL,{
    method:"POST",headers:{"Content-Type":"application/sdp"},
    body:offer.sdp,cache:"no-store"
  });
  const answerSdp=await r.text();
  if(!r.ok)throw new Error(answerSdp||("Falha Realtime HTTP "+r.status));
  await pc.setRemoteDescription({type:"answer",sdp:answerSdp});
}

function disconnectRealtime(){
  try{dc?.close()}catch(e){}
  try{pc?.close()}catch(e){}
  try{micStream?.getTracks().forEach(t=>t.stop())}catch(e){}
  dc=null;pc=null;micStream=null;audioSender=null;voiceActive=false;georgeSpeaking=false;syncSpeaking();applyModeStatus();
}

async function ensureVoice(){
  try{
    await connectRealtime();return true;
  }catch(e){
    disconnectRealtime();
    const denied=e?.name==="NotAllowedError";
    setStatus(denied?
      "Áudio selecionado • permita o microfone ou toque novamente":
      "Não consegui ligar o áudio: "+(e.message||e),
      "warning");
    return false;
  }
}

async function selectAudio(fromUser=true){
  currentMode="audio";suppressResponses=false;markActive("audio");
  if(fromUser && voiceActive){
    disconnectRealtime();
    setStatus("Áudio desligado • toque novamente para ligar","text");
    return;
  }
  await ensureVoice();
}

async function selectMeeting(){
  if(currentMode==="meeting" && voiceActive){
    disconnectRealtime();currentMode="text";markActive("");applyModeStatus();return;
  }
  currentMode="meeting";suppressResponses=false;markActive("meeting");
  await ensureVoice();
}

async function selectKickoff(){
  if(currentMode==="kickoff" && voiceActive){
    disconnectRealtime();
    await finishAndReport("Kickoff");
    currentMode="audio";markActive("audio");
    await ensureVoice();
    return;
  }
  currentMode="kickoff";suppressResponses=true;markActive("kickoff");
  const ok=await ensureVoice();
  if(ok)system("Kickoff iniciado • George está apenas ouvindo e registrando.");
}

/* Modo escrita: tocar no campo desliga o áudio, sem perder a sessão */
manual.addEventListener("focus",()=>{
  if(voiceActive)disconnectRealtime();
  currentMode="text";suppressResponses=false;markActive("");applyModeStatus();
});

async function sendManual(){
  const text=manual.value.trim();if(!text)return;
  manual.value="";autosize();addMessage("me",text);
  await startAppSession().catch(()=>{});
  await logTurn("user",text);
  try{
    if(!voiceActive){
      currentMode="audio";markActive("audio");
      if(!await ensureVoice())return;
    }
    showTyping();assistantBuffer="";sendTextToRealtime(text);
  }catch(e){hideTyping();system("Não consegui enviar: "+e.message)}
}
function autosize(){
  manual.style.height="auto";
  manual.style.height=Math.min(manual.scrollHeight,116)+"px";
}
manual.addEventListener("input",autosize);
manual.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendManual()}
});
$("btnSend").onclick=sendManual;

/* ANEXAR: já operacional para texto e áudio usando a sessão atual */
btnAttach.onclick=()=>filePicker.click();

filePicker.addEventListener("change",async()=>{
  const file=filePicker.files?.[0];
  filePicker.value="";
  if(!file)return;

  const type=file.type||"";
  const name=file.name||"arquivo";

  if(type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(name)){
    const txt=await file.text();
    addMessage("me","Arquivo anexado: "+name);
    const prompt=`Analise o arquivo anexado abaixo e me diga os pontos relevantes. Arquivo: ${name}\n\n${txt.slice(0,50000)}`;
    currentMode="audio";markActive("audio");
    if(await ensureVoice()){
      await logTurn("user",prompt);
      showTyping();sendTextToRealtime(prompt);
    }
    return;
  }

  if(type.startsWith("audio/")){
    addMessage("me","Áudio anexado: "+name);
    await analyzeAudioFile(file,name);
    return;
  }

  system("Anexar: o backend atual já processa texto e áudio. Este formato ("+(type||"desconhecido")+") ainda precisa do endpoint de análise documental/visual.");
});

/* Alimenta um arquivo de áudio na sessão Realtime atual para transcrição/análise */
async function analyzeAudioFile(file,name){
  currentMode="audio";markActive("audio");
  if(!await ensureVoice())return;

  try{
    setStatus("Processando áudio anexado: "+name,"audio");
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const buf=await file.arrayBuffer();
    const audioBuffer=await ctx.decodeAudioData(buf.slice(0));
    const dest=ctx.createMediaStreamDestination();
    const src=ctx.createBufferSource();
    src.buffer=audioBuffer;src.connect(dest);

    const originalTrack=micStream?.getAudioTracks?.()[0]||null;
    await audioSender.replaceTrack(dest.stream.getAudioTracks()[0]);

    src.onended=async()=>{
      try{
        if(originalTrack)await audioSender.replaceTrack(originalTrack);
        await ctx.close();
        setStatus("Áudio anexado enviado ao George para análise","audio");
      }catch(e){}
    };

    src.start();
  }catch(e){
    system("Não consegui processar o áudio anexado: "+(e.message||e));
  }
}

/* FILMAR: captura operacional de vídeo. A análise visual exige endpoint multimodal específico. */
btnFilm.onclick=openCamera;
$("btnCloseCamera").onclick=closeCamera;
$("btnStartFilm").onclick=startFilm;
$("btnStopFilm").onclick=stopFilm;

async function openCamera(){
  try{
    cameraStream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},
      audio:true
    });
    $("cameraVideo").srcObject=cameraStream;
    await $("cameraVideo").play().catch(()=>{});
    $("cameraModal").classList.remove("hidden");
    $("cameraInfo").textContent="Câmera ativa • pronto para gravar.";
  }catch(e){
    system("Não consegui abrir a câmera: "+(e.message||e));
  }
}
function closeCamera(){
  try{cameraStream?.getTracks().forEach(t=>t.stop())}catch(e){}
  cameraStream=null;$("cameraVideo").srcObject=null;
  $("cameraModal").classList.add("hidden");
}
function startFilm(){
  if(!cameraStream)return;
  recordedChunks=[];
  const options={};
  if(MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus"))options.mimeType="video/webm;codecs=vp8,opus";
  mediaRecorder=new MediaRecorder(cameraStream,options);
  mediaRecorder.ondataavailable=e=>{if(e.data?.size)recordedChunks.push(e.data)};
  mediaRecorder.onstop=()=>{
    const blob=new Blob(recordedChunks,{type:mediaRecorder.mimeType||"video/webm"});
    addMessage("me","Vídeo registrado para análise operacional ("+Math.max(1,Math.round(blob.size/1024/1024))+" MB).");
    system("Vídeo capturado. O backend atual ainda não possui análise visual de vídeo; a gravação está ativa no front, mas a interpretação visual da evolução da obra precisa da próxima extensão multimodal.");
    $("cameraInfo").textContent="Vídeo capturado.";
  };
  mediaRecorder.start(1000);
  $("btnStartFilm").disabled=true;$("btnStopFilm").disabled=false;
  $("cameraInfo").textContent="Gravando...";
}
function stopFilm(){
  if(mediaRecorder?.state==="recording")mediaRecorder.stop();
  $("btnStartFilm").disabled=false;$("btnStopFilm").disabled=true;
}

/* relatório / ata já existente no backend */
function addPdfActions(file,url,title="Relatório"){
  const msg=addMessage("george",title+" pronto para compartilhar.",title.toUpperCase());
  if(!msg)return;
  const row=document.createElement("div");row.className="pdf-actions";
  const share=document.createElement("button");share.className="share";share.textContent="Compartilhar PDF";
  share.onclick=()=>sharePdfFile(file,url);
  const open=document.createElement("a");open.className="open";open.textContent="Abrir / baixar";open.href=url;open.target="_blank";open.rel="noopener";
  row.appendChild(share);row.appendChild(open);msg.bubble.appendChild(row);
}
async function buildPdfFile(preferredUrl=null){
  if(!sessionId||!PDF_URL)throw new Error("PDF não configurado.");
  const base=preferredUrl||PDF_URL+"?session_id="+encodeURIComponent(sessionId);
  const url=base+(base.includes("?")?"&":"?")+"_="+Date.now();
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok)throw new Error((await r.text())||("PDF HTTP "+r.status));
  const blob=await r.blob();
  if(blob.type!=="application/pdf" && blob.size<100)throw new Error("PDF inválido.");
  return {file:new File([blob],"Relatorio_George_ERP_IMPAR.pdf",{type:"application/pdf"}),url};
}
async function sharePdfFile(file,url){
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({title:"George - ERP ÍMPAR",text:"Documento gerado pelo George.",files:[file]});
      return true;
    }
  }catch(e){if(e?.name==="AbortError")return false}
  window.open(url,"_blank","noopener");return false;
}
async function finishAndReport(kind="Reunião"){
  if(!sessionId)return;
  system("Organizando "+kind.toLowerCase()+"...");
  showTyping();
  try{
    const j=await api("finish",{session_id:sessionId});
    hideTyping();
    addMessage("george",j.text,kind==="Kickoff"?"RELATÓRIO DO KICKOFF":"ATA DA REUNIÃO");
    const {file,url}=await buildPdfFile(j.pdf_url||null);
    addPdfActions(file,url,kind==="Kickoff"?"Relatório do Kickoff":"Ata da reunião");
  }catch(e){
    hideTyping();system("Não consegui gerar o documento: "+e.message);
  }
}

/* botões */
btnAudio.onclick=()=>selectAudio(true);
btnMeeting.onclick=selectMeeting;
btnKickoff.onclick=selectKickoff;

/* ÁUDIO É DEFAULT.
   Tentamos ligar automaticamente; se o navegador exigir gesto,
   o primeiro toque em qualquer área ativa o áudio. */
async function autoStartAudio(){
  if(autoAttempted)return;
  autoAttempted=true;
  currentMode="audio";markActive("audio");
  const ok=await ensureVoice();
  if(!ok){
    const firstGesture=async()=>{
      document.removeEventListener("pointerdown",firstGesture,true);
      if(currentMode==="audio"&&!voiceActive)await ensureVoice();
    };
    document.addEventListener("pointerdown",firstGesture,true);
  }
}

applyModeStatus();
setTimeout(autoStartAudio,250);
