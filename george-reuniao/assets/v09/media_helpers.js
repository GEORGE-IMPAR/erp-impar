/* PCM WAV independente por minuto; memória limitada. Nenhum registro operacional no navegador. */
(() => {
'use strict';
function wav(samples,rate=16000){const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b);const put=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};put(0,'RIFF');v.setUint32(4,b.byteLength-8,true);put(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);put(36,'data');v.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++){const n=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,n<0?n*32768:n*32767,true);}return new Blob([b],{type:'audio/wav'});}
const processor=`class GeorgePCM extends AudioWorkletProcessor {
 constructor(){super();this.step=sampleRate/16000;this.phase=0;this.sum=0;this.n=0;this.out=[];this.port.onmessage=e=>{if(e.data==='flush'){this.send();this.port.postMessage({flushed:true});}};}
 send(){if(this.out.length){const samples=new Float32Array(this.out);this.port.postMessage({samples},[samples.buffer]);this.out=[];}}
 process(inputs){const channels=inputs[0];if(!channels?.length)return true;for(let i=0;i<channels[0].length;i++){let x=0;for(const c of channels)x+=c[i]||0;this.sum+=x/channels.length;this.n++;this.phase++;if(this.phase>=this.step){this.out.push(this.sum/this.n);this.phase-=this.step;this.sum=0;this.n=0;}}if(this.out.length>=16000)this.send();return true;}
}registerProcessor('george-pcm',GeorgePCM);`;
async function pcm(source,context,onSegment,onError){
 const url=URL.createObjectURL(new Blob([processor],{type:'text/javascript'}));
 try{await context.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
 const node=new AudioWorkletNode(context,'george-pcm'),gain=context.createGain();gain.gain.value=0;source.connect(node);node.connect(gain);gain.connect(context.destination);
 let chunks=[],count=0,index=0,seconds=0,queue=Promise.resolve(),pending=0,failure=null,flushed;
 const flush=()=>{if(!count)return;const all=new Float32Array(count);let at=0;for(const c of chunks){all.set(c,at);at+=c.length;}chunks=[];count=0;const blob=wav(all),i=index++,start=seconds;seconds+=all.length/16000;pending++;
   if(pending>4){failure=new Error('Rede lenta: mais de quatro trechos de áudio aguardando envio. A gravação deve ser interrompida para preservar o que foi confirmado.');onError(failure);return;}
   queue=queue.then(async()=>{if(failure)throw failure;await onSegment(blob,i,start);pending--;}).catch(e=>{failure=e;onError(e);});};
 node.port.onmessage=e=>{if(e.data.flushed){flushed?.();return;}if(failure)return;if(e.data.samples){chunks.push(e.data.samples);count+=e.data.samples.length;if(count>=960000)flush();}};
 return {get count(){return index;},get seconds(){return seconds;},async stop(){await new Promise(resolve=>{const t=setTimeout(resolve,1500);flushed=()=>{clearTimeout(t);resolve();};node.port.postMessage('flush');});source.disconnect(node);node.disconnect();gain.disconnect();flush();await queue;if(failure)throw failure;return {audio_count:index,seconds};}};
}
async function fromStream(stream,onSegment,onError){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('Este navegador não permite preparar áudio.');const context=new C();try{const capture=await pcm(context.createMediaStreamSource(stream),context,onSegment,onError);await context.resume();return {get count(){return capture.count;},async stop(){try{return await capture.stop();}finally{await context.close();}}};}catch(e){await context.close();throw e;}}
function frame(video){return new Promise((resolve,reject)=>{if(!video.videoWidth)return reject(new Error('Imagem da câmera ainda indisponível.'));const c=document.createElement('canvas');c.width=Math.min(video.videoWidth,1280);c.height=Math.round(video.videoHeight*c.width/video.videoWidth);c.getContext('2d').drawImage(video,0,0,c.width,c.height);c.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível capturar a imagem.')),'image/jpeg',.82);});}
async function prepare(file,{audio,frame:onFrame,status,signal,startPlayback,maxSeconds=14400}){
 const video=document.createElement('video');video.playsInline=true;video.preload='auto';video.style.cssText='position:fixed;width:1px;height:1px;opacity:.01;pointer-events:none';document.body.append(video);
 const url=URL.createObjectURL(file),C=window.AudioContext||window.webkitAudioContext,context=new C();let capture=null,frames=0,frameQueue=Promise.resolve(),frameError=null,nextFrame=0,hidden=false;
 const onHidden=()=>{if(document.visibilityState!=='visible'){hidden=true;video.pause();}};document.addEventListener('visibilitychange',onHidden);
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('O navegador não conseguiu abrir o arquivo. O original permanece salvo.')),20000);video.onloadedmetadata=()=>{clearTimeout(t);resolve();};video.onerror=()=>{clearTimeout(t);reject(new Error('Este navegador não reproduz o codec do arquivo. O original permanece salvo.'));};video.src=url;});
  if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>maxSeconds)throw new Error('A duração não pôde ser validada ou excede quatro horas. O original permanece salvo.');
  capture=await pcm(context.createMediaElementSource(video),context,audio,e=>{frameError=e;video.pause();});
  const spacing=Math.max(15,video.duration/48);
  await new Promise((resolve,reject)=>{
   const tick=()=>{
    if(signal?.aborted||hidden||frameError){reject(frameError||new Error(hidden?'Preparação interrompida porque a página ficou oculta. Volte e retome; o original está salvo.':'Preparação cancelada.'));return;}
    if(video.videoWidth&&video.currentTime>=nextFrame&&frames<48){const i=frames++,at=video.currentTime;nextFrame=at+spacing;frameQueue=frameQueue.then(()=>frame(video)).then(b=>onFrame(b,i,at)).catch(e=>{frameError=e;});}
    status?.(`Preparando ${Math.round(video.currentTime/video.duration*100)}% • mantenha esta tela aberta. A leitura acompanha a duração do arquivo.`);
   };
   const timer=setInterval(tick,500);const finish=(fn,value)=>{clearInterval(timer);fn(value);};video.onended=()=>finish(resolve);video.onerror=()=>finish(reject,new Error('A leitura do arquivo foi interrompida.'));
   const monitor=setInterval(()=>{if(signal?.aborted||hidden||frameError){clearInterval(monitor);video.pause();finish(reject,frameError||new Error('Preparação interrompida. O original está salvo; retome com a tela aberta.'));}},500);
   video.addEventListener('ended',()=>clearInterval(monitor),{once:true});
   const start=()=>{context.resume().catch(e=>{clearInterval(monitor);finish(reject,e);});video.play().catch(e=>{clearInterval(monitor);finish(reject,e);});};
   if(startPlayback)startPlayback(start);else start();
  });
  const result=await capture.stop();capture=null;await frameQueue;if(frameError)throw frameError;return {...result,frame_count:frames};
 }finally{video.pause();if(capture)await capture.stop().catch(()=>{});await context.close();video.removeAttribute('src');video.load();video.remove();URL.revokeObjectURL(url);document.removeEventListener('visibilitychange',onHidden);}
}
window.GeorgeMedia={wav,fromStream,frame,prepare};
})();
