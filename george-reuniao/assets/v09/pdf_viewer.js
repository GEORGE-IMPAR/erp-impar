/* Local PDF.js renders real pages on mobile without an embedded browser PDF plug-in. */
(() => {
'use strict';
const base=new URL('./pdfjs/',document.currentScript.src);let libPromise=null,current=null,generation=0;
const library=()=>libPromise||(libPromise=import(new URL('pdf.mjs',base).href).then(lib=>{lib.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.mjs',base).href;return lib;}));
async function validate(blob,expected={}){
 const bytes=new Uint8Array(await blob.arrayBuffer());if(bytes.length<100||String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')throw new Error('O arquivo recebido não é um PDF válido. Gere o documento novamente.');
 if(expected.bytes&&bytes.length!==expected.bytes)throw new Error('O PDF não chegou completo. Tente abrir novamente.');
 if(expected.sha256){const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected.sha256)throw new Error('O PDF recebido não corresponde à versão solicitada. Gere uma nova versão.');}
 return bytes;
}
async function close(){generation++;if(current){current.task?.cancel();await current.doc?.destroy();current=null;}const host=document.getElementById('reportFrame');host?.replaceChildren();if(host){delete host.dataset.pdfPages;delete host.dataset.pdfLoaded;}}
async function open(blob,title='Documento ERP ÍMPAR'){
 await close();const ticket=++generation,host=document.getElementById('reportFrame'),dialog=document.getElementById('reportDialog');host.replaceChildren();dialog.showModal();
 const status=document.createElement('p');status.textContent='Abrindo o documento…';status.setAttribute('role','status');host.append(status);
 try{const bytes=await validate(blob),lib=await library();if(ticket!==generation)return;
 const doc=await lib.getDocument({data:bytes,isEvalSupported:false,standardFontDataUrl:new URL('standard_fonts/',base).href,cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,wasmUrl:new URL('wasm/',base).href}).promise;
 if(ticket!==generation){await doc.destroy();return;}if(!doc.numPages)throw new Error('O documento não tem páginas.');current={doc,page:1,task:null};
 const bar=document.createElement('div');bar.className='pdf-page-tools';const label=document.createElement('span');label.setAttribute('aria-live','polite');
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='g09-button';b.textContent=text;b.onclick=fn;return b;};
 const previous=button('Anterior',()=>render(current.page-1)),next=button('Próxima',()=>render(current.page+1));
 const download=button('Baixar PDF',()=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Documento_ERP_IMPAR.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);});bar.append(previous,label,next,download);
 const viewport=document.createElement('div');viewport.className='pdf-page-scroll';const canvas=document.createElement('canvas');canvas.setAttribute('role','img');viewport.append(canvas);
 const details=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('div');summary.textContent='Ler texto desta página';text.className='pdf-page-text';details.append(summary,text);host.replaceChildren(bar,viewport,details);host.dataset.pdfPages=String(doc.numPages);
 let rendering=false;
 async function render(n){if(rendering||!current||ticket!==generation||n<1||n>doc.numPages)return;rendering=true;previous.disabled=next.disabled=true;
   try{current.page=n;label.textContent=`Página ${n} de ${doc.numPages}`;const page=await doc.getPage(n),natural=page.getViewport({scale:1}),width=Math.max(240,Math.min(960,host.clientWidth||window.innerWidth-48)),scale=width/natural.width,dpr=Math.min(2,window.devicePixelRatio||1),v=page.getViewport({scale:scale*dpr});if(ticket!==generation)return;
   canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);canvas.style.width='100%';canvas.style.height='auto';canvas.setAttribute('aria-label',`${title}, página ${n} de ${doc.numPages}`);const task=page.render({canvasContext:canvas.getContext('2d'),viewport:v});current.task=task;await task.promise;const content=await page.getTextContent();if(ticket!==generation)return;text.textContent=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('');viewport.scrollTop=0;host.dataset.pdfLoaded='true';}
   catch(e){if(e.name!=='RenderingCancelledException'){text.textContent='Não consegui exibir esta página. Use Baixar PDF para abrir no leitor do aparelho.';host.dataset.pdfLoaded='false';}}
   finally{rendering=false;previous.disabled=n<=1;next.disabled=n>=doc.numPages;}
 }
 await render(1);
 }catch(e){status.textContent=e.message||'Não consegui abrir o PDF. Gere uma nova versão.';throw e;}
}
window.GeorgePdf={open,close,validate};
})();
