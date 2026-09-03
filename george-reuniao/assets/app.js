
const CFG=window.GEORGE_CONFIG||{};
const REALTIME_URL=CFG.REALTIME_SESSION_URL;
const API=CFG.API_URL;
const PDF_URL=CFG.PDF_URL;

let pc=null, dc=null, micStream=null, remoteAudio=null;
let voiceActive=false, sessionId=null, typingEl=null;
let georgeSpeaking=false;
let assistantBuffer="", assistantShown="";
let inputDeltaByItem=new Map();

const $=id=>document.getElementById(id);
const chat=$("chat"), anchor=$("typingAnchor"), manual=$("manual");
const btnVoice=$("btnVoice"), btnMic=$("btnMic"), strip=$("meetingStrip"),
      meetingStatus=$("meetingStatus"), btnFinish=$("btnFinish");

function scrollDown(){requestAnimationFrame(()=>chat.scrollTop=chat.scrollHeight)}
function cleanDisplay(text){
  return String(text||"")
    .replace(/^\s{0,3}#{1,6}\s*/gm,"")
    .replace(/\*\*/g,"")
    .replace(/__/g,"")
    .replace(/`/g,"");
}
function addMessage(side,text,label){
  if(!text||!String(text).trim())return;
  const w=document.createElement("div"); w.className="msg "+(side==="me"?"me":"george");
  const b=document.createElement("div"); b.className="bubble";
  if(side!=="me"){const who=document.createElement("div");who.className="who";who.textContent=label||"GEORGE";b.appendChild(who)}
  const d=document.createElement("div"); d.textContent=cleanDisplay(String(text).trim()); b.appendChild(d); w.appendChild(b);
  chat.insertBefore(w,anchor); scrollDown();
}
function system(text){const d=document.createElement("div");d.className="system";d.textContent=text;chat.insertBefore(d,anchor);scrollDown()}
function showTyping(){
  hideTyping();
  const w=document.createElement("div");w.className="msg george";
  w.innerHTML='<div class="bubble"><div class="who">GEORGE</div><div class="typing"><i></i><i></i><i></i></div></div>';
  chat.insertBefore(w,anchor);typingEl=w;scrollDown();
}
function hideTyping(){if(typingEl){typingEl.remove();typingEl=null}}
function setUi(){
  btnVoice.classList.toggle("off",!voiceActive);
  btnMic.classList.toggle("live",voiceActive);
  strip.classList.toggle("live",voiceActive);
  meetingStatus.textContent=!sessionId?"Modo voz desligado":(voiceActive?"Modo reunião ativo • George está escutando":"Reunião ativa • microfone pausado");
  btnFinish.classList.toggle("hidden",!sessionId);
}
function normalize(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function calledGeorge(s){
  const n=normalize(s);
  return /\b(george|jorge|jod|jody|georgie|giorge|djorge|jorji)\b/.test(n);
}
async function api(action,payload={}){
  const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload}),cache:"no-store"});
  const j=await r.json().catch(()=>({ok:false,error:"Resposta inválida do backend"}));
  if(!r.ok||!j.ok)throw new Error(j.error||("HTTP "+r.status)); return j;
}
async function logTurn(role,text){
  if(!sessionId||!text)return;
  try{await api("log",{session_id:sessionId,role,text})}catch(e){console.warn("log",e)}
}
function sendEvent(event){
  if(dc?.readyState==="open")dc.send(JSON.stringify(event));
}
function setMicTransmission(enabled){
  try{micStream?.getAudioTracks().forEach(t=>t.enabled=!!enabled)}catch(e){}
}
function requestResponse(){
  showTyping();
  assistantBuffer="";
  sendEvent({type:"response.create",response:{max_output_tokens:"inf"}});
}
function sendTextToRealtime(text){
  sendEvent({
    type:"conversation.item.create",
    item:{type:"message",role:"user",content:[{type:"input_text",text}]}
  });
  sendEvent({type:"response.create",response:{max_output_tokens:"inf"}});
}

function extractResponseText(evt){
  try{
    const parts=[];
    const output=evt?.response?.output||[];
    for(const item of output){
      for(const c of (item?.content||[])){
        if(typeof c?.transcript==="string")parts.push(c.transcript);
        else if(typeof c?.text==="string")parts.push(c.text);
      }
    }
    return parts.join("\n").trim();
  }catch(e){return ""}
}

function handleEvent(evt){
  const t=evt?.type||"";

  if(t==="response.created" || t==="response.output_audio.delta" || t==="response.audio.delta"){
    georgeSpeaking=true;
    setMicTransmission(false);
    meetingStatus.textContent="George está falando...";
  }

  if(t==="input_audio_buffer.speech_started"){
    meetingStatus.textContent="Escutando...";
  }
  if(t==="input_audio_buffer.speech_stopped"){
    meetingStatus.textContent="Entendendo...";
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
      if(calledGeorge(text))requestResponse();
    }
  }

  // Compatibilidade com nomes de eventos de transcript de saída.
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
    georgeSpeaking=false;
    setMicTransmission(true);
    hideTyping();
    const text=extractResponseText(evt)||assistantBuffer.trim();
    if(text && text!==assistantShown){
      addMessage("george",text);assistantShown=text;logTurn("assistant",text);
    }
    assistantBuffer="";
    meetingStatus.textContent="Modo reunião ativo • George está escutando";
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
  system("Reunião iniciada");
}

async function connectRealtime(){
  if(voiceActive)return;
  await startAppSession();

  micStream=await navigator.mediaDevices.getUserMedia({
    audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false
  });

  pc=new RTCPeerConnection();
  remoteAudio=document.createElement("audio");
  remoteAudio.autoplay=true;
  remoteAudio.playsInline=true;
  pc.ontrack=e=>{
    remoteAudio.srcObject=e.streams[0];
    remoteAudio.play().catch(()=>{});
  };

  const track=micStream.getAudioTracks()[0];
  pc.addTrack(track,micStream);

  dc=pc.createDataChannel("oai-events");
  dc.addEventListener("message",e=>{
    try{handleEvent(JSON.parse(e.data))}catch(err){console.warn(err)}
  });
  dc.addEventListener("open",()=>{
    voiceActive=true;setUi();
    system("George conectado em voz contínua");
  });
  dc.addEventListener("close",()=>{
    voiceActive=false;setUi();
  });

  const offer=await pc.createOffer();
  await pc.setLocalDescription(offer);

  const r=await fetch(REALTIME_URL,{
    method:"POST",
    headers:{"Content-Type":"application/sdp"},
    body:offer.sdp,
    cache:"no-store"
  });
  const answerSdp=await r.text();
  if(!r.ok)throw new Error(answerSdp||("Falha Realtime HTTP "+r.status));

  await pc.setRemoteDescription({type:"answer",sdp:answerSdp});
}

function disconnectRealtime(){
  try{dc?.close()}catch(e){}
  try{pc?.close()}catch(e){}
  try{micStream?.getTracks().forEach(t=>t.stop())}catch(e){}
  dc=null;pc=null;micStream=null;voiceActive=false;setUi();
}

async function toggleVoice(){
  try{
    if(voiceActive){disconnectRealtime();system("Microfone pausado")}
    else await connectRealtime();
  }catch(e){
    disconnectRealtime();
    system(e?.name==="NotAllowedError"?
      "Microfone bloqueado. Permita o microfone nas configurações deste site.":
      "Não consegui iniciar a voz: "+(e.message||e));
  }
}

async function sendManual(){
  const text=manual.value.trim(); if(!text)return;
  manual.value="";autosize();addMessage("me",text);await logTurn("user",text);
  try{
    if(!voiceActive)await connectRealtime();
    showTyping();assistantBuffer="";sendTextToRealtime(text);
  }catch(e){hideTyping();system("Não consegui enviar: "+e.message)}
}
function autosize(){manual.style.height="auto";manual.style.height=Math.min(manual.scrollHeight,120)+"px"}
manual.addEventListener("input",autosize);
manual.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendManual()}});

async function presentOpening(){
  const text="George, apresenta pro Rafa a discussão que a gente teve e o que estamos imaginando pro ERP ÍMPAR.";
  addMessage("me",text);await logTurn("user",text);
  try{
    if(!voiceActive)await connectRealtime();
    showTyping();assistantBuffer="";sendTextToRealtime(text);
  }catch(e){hideTyping();system("Não consegui iniciar a apresentação: "+e.message)}
}


function addPdfActions(file,url){
  const w=document.createElement("div");w.className="msg george";
  const b=document.createElement("div");b.className="bubble";
  const who=document.createElement("div");who.className="who";who.textContent="ATA EM PDF";b.appendChild(who);
  const txt=document.createElement("div");txt.textContent="PDF pronto para compartilhar.";b.appendChild(txt);
  const row=document.createElement("div");row.style.cssText="display:flex;gap:9px;flex-wrap:wrap;margin-top:12px";
  const share=document.createElement("button");
  share.textContent="Compartilhar PDF";
  share.style.cssText="border:0;border-radius:12px;padding:12px 14px;background:#18b978;color:#fff;font-size:16px;font-weight:900";
  share.onclick=()=>sharePdfFile(file,url);
  const open=document.createElement("a");
  open.textContent="Abrir / baixar";
  open.href=url;open.target="_blank";open.rel="noopener";
  open.style.cssText="text-decoration:none;border-radius:12px;padding:12px 14px;background:#edf3f5;color:#173a4b;font-size:16px;font-weight:900";
  row.appendChild(share);row.appendChild(open);b.appendChild(row);w.appendChild(b);chat.insertBefore(w,anchor);scrollDown();
}

async function buildPdfFile(preferredUrl=null){
  if(!sessionId||!PDF_URL)throw new Error("PDF não configurado.");
  const url=(preferredUrl||PDF_URL+"?session_id="+encodeURIComponent(sessionId))+"&_="+Date.now();
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok)throw new Error((await r.text())||("PDF HTTP "+r.status));
  const blob=await r.blob();
  if(blob.type!=="application/pdf" && blob.size<100)throw new Error("PDF inválido.");
  const file=new File([blob],"Ata_ERP_IMPAR.pdf",{type:"application/pdf"});
  return {file,url};
}

async function sharePdfFile(file,url){
  try{
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({
        title:"Ata da reunião - ERP ÍMPAR",
        text:"Ata gerada pelo George.",
        files:[file]
      });
      return true;
    }
  }catch(e){
    if(e?.name==="AbortError")return false;
    console.warn("share",e);
  }
  window.open(url,"_blank","noopener");
  return false;
}

async function generateAndSharePdf(preferredUrl=null){
  try{
    system("Gerando PDF da ata...");
    const {file,url}=await buildPdfFile(preferredUrl);
    addPdfActions(file,url);
    const shared=await sharePdfFile(file,url);
    if(shared)system("Compartilhamento da ata aberto");
  }catch(e){
    system("Não consegui gerar/compartilhar o PDF: "+e.message);
  }
}

async function finishMeeting(){
  disconnectRealtime();
  if(!sessionId)return;
  system("Organizando a ata...");
  showTyping();
  try{
    const j=await api("finish",{session_id:sessionId});
    hideTyping();addMessage("george",j.text,"ATA DA REUNIÃO");system("Reunião encerrada");
    await generateAndSharePdf(j.pdf_url||null);
  }catch(e){hideTyping();system("Não consegui gerar a ata: "+e.message)}
}

btnMic.onclick=toggleVoice;
btnVoice.onclick=toggleVoice;
$("btnSend").onclick=sendManual;
btnFinish.onclick=finishMeeting;

// Opções por toque longo no botão VOZ
const sheet=$("sheet"),backdrop=$("backdrop");
function openSheet(){sheet.classList.remove("hidden");backdrop.classList.remove("hidden")}
function closeSheet(){sheet.classList.add("hidden");backdrop.classList.add("hidden")}
let hold=null;
btnVoice.addEventListener("pointerdown",()=>hold=setTimeout(openSheet,650));
btnVoice.addEventListener("pointerup",()=>{clearTimeout(hold);hold=null});
btnVoice.addEventListener("pointercancel",()=>{clearTimeout(hold);hold=null});
$("btnOpening").onclick=()=>{closeSheet();presentOpening()};
$("btnPause").onclick=()=>{closeSheet();disconnectRealtime()};
$("btnResume").onclick=()=>{closeSheet();connectRealtime()};
$("btnFinishSheet").onclick=()=>{closeSheet();finishMeeting()};
$("btnCloseSheet").onclick=closeSheet;
backdrop.onclick=closeSheet;

setUi();
