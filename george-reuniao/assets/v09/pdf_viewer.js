/* Bundled PDF.js renders real pages on mobile; a verified download remains available if rendering fails. */
(() => {
'use strict';
const base=new URL('./pdfjs/',document.currentScript.src);
let libPromise=null,importAttempt=0,current=null,generation=0;
// The prebuilt modules use .js so hosts that do not map .mjs to JavaScript can serve them.
const library=()=>libPromise||(libPromise=import(new URL('pdf.js?v=5.6.205-visual1'+(importAttempt?'&retry='+importAttempt:''),base).href).then(lib=>{
 lib.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.js?v=5.6.205-visual1',base).href;return lib;
}).catch(e=>{libPromise=null;importAttempt++;throw e;}));
async function validate(blob,expected={}){
 const bytes=new Uint8Array(await blob.arrayBuffer());
 if(bytes.length<100||String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')throw new Error('O arquivo recebido não é um PDF válido. Tente carregar novamente.');
 if(expected.bytes&&bytes.length!==expected.bytes)throw new Error('O PDF não chegou completo. Tente abrir novamente.');
 if(expected.sha256){const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected.sha256)throw new Error('O PDF recebido não corresponde à versão solicitada. Tente carregar novamente.');}
 return bytes;
}
async function dispose(session){
 if(!session)return;
 try{session.task?.cancel();if(session.loading)await session.loading.destroy();else await session.doc?.destroy();}catch(_){}
}
async function close(){
 generation++;const previous=current;current=null;const host=document.getElementById('reportFrame');host?.replaceChildren();
 if(host){delete host.dataset.pdfPages;delete host.dataset.pdfLoaded;}await dispose(previous);
}
function button(text,fn){const b=document.createElement('button');b.type='button';b.className='g09-button';b.textContent=text;b.onclick=fn;return b;}
function download(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Documento_ERP_IMPAR.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function open(blob,title='Documento ERP ÍMPAR'){
 const ticket=++generation,previous=current;current=null;
 const host=document.getElementById('reportFrame'),dialog=document.getElementById('reportDialog');host.replaceChildren();delete host.dataset.pdfPages;delete host.dataset.pdfLoaded;
 if(!dialog.open)dialog.showModal();
 const status=document.createElement('p');status.className='pdf-viewer-status';status.textContent='Abrindo o documento…';status.setAttribute('role','status');host.append(status);
 await dispose(previous);if(ticket!==generation)return;
 let verified=false;
 const fallback=async error=>{
  if(ticket!==generation)return;const failed=current;current=null;await dispose(failed);if(ticket!==generation)return;
  console.warn('[George PDF] Falha na visualização:',error);
  host.dataset.pdfLoaded='false';host.replaceChildren();
  const card=document.createElement('div');card.className='pdf-viewer-fallback';
  const heading=document.createElement('h2');heading.textContent='Não consegui exibir o PDF aqui';
  const help=document.createElement('p');help.textContent='Você pode baixar o arquivo para abrir no leitor do aparelho ou tentar novamente.';
  const actions=document.createElement('div');actions.className='pdf-primary-actions';const save=button('Baixar PDF',()=>download(blob));save.classList.add('primary');actions.append(save,button('Tentar abrir novamente',()=>open(blob,title).catch(()=>{})));
  card.append(heading,help,actions);host.append(card);
 };
 try{
  const bytes=await validate(blob);verified=true;const lib=await library();if(ticket!==generation)return;
  const loading=lib.getDocument({data:bytes,isEvalSupported:false,standardFontDataUrl:new URL('standard_fonts/',base).href,cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,wasmUrl:new URL('wasm/',base).href});
  const session={loading,doc:null,page:1,task:null};current=session;
  const doc=await loading.promise;if(ticket!==generation){await dispose(session);return;}session.doc=doc;
  if(!doc.numPages)throw new Error('Documento sem páginas.');
  const bar=document.createElement('div');bar.className='pdf-page-tools';const label=document.createElement('span');label.setAttribute('aria-live','polite');
  const previousPage=button('Anterior',()=>render(session.page-1)),next=button('Próxima',()=>render(session.page+1));bar.append(previousPage,label,next,button('Baixar PDF',()=>download(blob)));
  const viewport=document.createElement('div');viewport.className='pdf-page-scroll';const canvas=document.createElement('canvas');canvas.setAttribute('role','img');viewport.append(canvas);
  const details=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('div');summary.textContent='Ler texto desta página';text.className='pdf-page-text';details.append(summary,text);host.replaceChildren(bar,viewport,details);host.dataset.pdfPages=String(doc.numPages);
  let rendering=false;
  async function render(n){
   if(rendering||current!==session||ticket!==generation||n<1||n>doc.numPages)return;
   rendering=true;previousPage.disabled=next.disabled=true;
   try{
    session.page=n;label.textContent=`Página ${n} de ${doc.numPages}`;
    const page=await doc.getPage(n),natural=page.getViewport({scale:1}),width=Math.max(240,Math.min(960,host.clientWidth||window.innerWidth-48)),scale=width/natural.width,dpr=Math.min(2,window.devicePixelRatio||1),v=page.getViewport({scale:scale*dpr});if(ticket!==generation)return;
    canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);canvas.style.width='100%';canvas.style.height='auto';canvas.setAttribute('aria-label',`${title}, página ${n} de ${doc.numPages}`);
    session.task=page.render({canvasContext:canvas.getContext('2d'),viewport:v});await session.task.promise;if(ticket!==generation)return;
    host.dataset.pdfLoaded='true';viewport.scrollTop=0;
    try{const content=await page.getTextContent();if(ticket!==generation)return;text.textContent=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('');}catch(_){text.textContent='O texto desta página não está disponível para seleção.';}
   }catch(e){if(e.name!=='RenderingCancelledException')await fallback(e);}
   finally{rendering=false;previousPage.disabled=n<=1;next.disabled=n>=doc.numPages;}
  }
  await render(1);
 }catch(e){
  if(ticket!==generation)return;
  if(verified)await fallback(e);
  else{status.textContent=e.message||'O arquivo recebido não é um PDF válido.';host.dataset.pdfLoaded='false';throw e;}
 }
}
window.GeorgePdf={open,close,validate};
})();
