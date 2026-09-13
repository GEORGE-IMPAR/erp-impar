/* ERP ÍMPAR — camada visual isolada para Agenda do Dia, mídia e operações longas.
   Não chama PHP, não altera regras e não grava dados operacionais. */
(() => {
'use strict';
const cards=new Map();
const $=id=>document.getElementById(id);
let shield=null;

function ensureShield(){
 if(shield)return shield;
 shield=document.createElement('section');shield.className='operation-shield indeterminate';shield.hidden=true;shield.setAttribute('role','status');shield.setAttribute('aria-live','polite');
 shield.innerHTML='<div class="operation-card"><strong>Processando</strong><p>Aguarde a conclusão desta etapa.</p><div class="operation-track"><div class="operation-fill"></div></div><div class="operation-value"></div></div>';
 document.body.append(shield);return shield;
}
function operation(label,detail='',percent=null){
 const el=ensureShield();el.hidden=false;el.querySelector('strong').textContent=label||'Processando';el.querySelector('p').textContent=detail||'Aguarde a conclusão desta etapa.';
 const numeric=Number.isFinite(percent);el.classList.toggle('indeterminate',!numeric);
 if(numeric){const value=Math.max(0,Math.min(100,Math.round(percent)));el.querySelector('.operation-fill').style.width=value+'%';el.querySelector('.operation-value').textContent=value+'%';}
 document.querySelector('.app')?.setAttribute('aria-busy','true');return {update:(next,more,pct)=>operation(next,more,pct),close:closeOperation};
}
function closeOperation(){if(shield)shield.hidden=true;document.querySelector('.app')?.removeAttribute('aria-busy');}
function kindOf(file){if(file?.type?.startsWith('image/'))return 'image';if(file?.type?.startsWith('video/'))return 'video';return 'file';}
function labelOf(kind){return kind==='image'?'Foto':kind==='video'?'Vídeo':'Arquivo';}
function makePreview(host,file,kind){
 if(file&&(kind==='image'||kind==='video')){const url=URL.createObjectURL(file),node=document.createElement(kind==='image'?'img':'video');node.src=url;if(kind==='image'){node.alt='Foto anexada';node.tabIndex=0;node.onclick=()=>window.open(url,'_blank','noopener');}else{node.controls=true;node.playsInline=true;node.preload='metadata';}host.append(node);return url;}
 const empty=document.createElement('div');empty.className='media-card-placeholder';empty.textContent=labelOf(kind)+' preservado no George';host.append(empty);return null;
}
function create(file,forcedKind){
 const kind=forcedKind||kindOf(file),chat=$('chat'),anchor=$('typingAnchor');if(!chat||!anchor)return null;
 const row=document.createElement('div');row.className='msg me media-card-row';const bubble=document.createElement('div');bubble.className='bubble';const card=document.createElement('article');card.className='media-card';
 const preview=document.createElement('div');preview.className='media-card-preview';const badge=document.createElement('span');badge.className='media-card-kind';badge.textContent=labelOf(kind);preview.append(badge);const mediaHost=document.createElement('div');preview.append(mediaHost);const url=makePreview(mediaHost,file,kind);
 const status=document.createElement('div');status.className='media-card-status';status.innerHTML='<strong>Preparando envio</strong><span></span>';const progress=document.createElement('div');progress.className='media-card-progress indeterminate';progress.innerHTML='<b></b>';const analysis=document.createElement('div');analysis.className='media-card-analysis';analysis.hidden=true;const actions=document.createElement('div');actions.className='media-card-actions';
 card.append(preview,status,progress,analysis,actions);bubble.append(card);row.append(bubble);chat.insertBefore(row,anchor);chat.scrollTop=chat.scrollHeight;
 const api={row,kind,file,url,id:null,setId(id){this.id=id;row.dataset.recordId=id;cards.set(id,this);return this;},update(label,percent=null){status.querySelector('strong').textContent=label;const numeric=Number.isFinite(percent);progress.classList.toggle('indeterminate',!numeric);status.querySelector('span').textContent=numeric?Math.round(percent)+'%':'';if(numeric)progress.querySelector('b').style.width=Math.max(0,Math.min(100,percent))+'%';row.classList.remove('media-card-error');},job(job){
   const measurable=job.state==='transcribing'&&job.segments_total?100*job.segments_done/job.segments_total:job.state==='whatsapp_processing'&&job.batch_total?100*job.batch_done/job.batch_total:job.state==='summarizing'&&job.report_parts_total?100*job.report_parts_done/job.report_parts_total:null;
   const labels={uploading:'Enviando',uploaded:'Enviado • verificando conteúdo',derived_processing:'Preparando áudio e imagens',transcribing:'Transcrevendo/analisando',transcription_ready:'Transcrição concluída',summarizing:'Gerando documento',consolidating:'Consolidando documento',rendering:'Renderizando PDF',ready:'Concluído',cancelled:'Retirado da fila',deleted:'Excluído'};this.update(labels[job.state]||'Processando',measurable);if(job.state==='ready'){progress.hidden=true;}
 },analysis(text){if(text){analysis.textContent=text;analysis.hidden=false;}},error(text,retry){row.classList.add('media-card-error');status.querySelector('strong').textContent='Erro';status.querySelector('span').textContent='';analysis.textContent=text||'Não foi possível concluir.';analysis.hidden=false;progress.hidden=true;actions.replaceChildren();if(retry){const b=document.createElement('button');b.type='button';b.className='g09-button';b.textContent='Tentar novamente';b.onclick=retry;actions.append(b);}},done(text){this.update('Concluído',100);progress.hidden=true;this.analysis(text);}};
 return api;
}
function get(id){return cards.get(id)||null;}
function sync(jobs,onResume){for(const job of jobs||[]){let card=get(job.record_id);if(!card&&!['deleted'].includes(job.state)){card=create(null,/\.(?:jpe?g|png|webp|gif)$/i.test(job.name)?'image':/\.(?:mp4|mov|webm|mkv)$/i.test(job.name)?'video':'file');card?.setId(job.record_id);}card?.job(job);if(card&&onResume&&!['ready','cancelled','deleted','uploading'].includes(job.state)){const actions=card.row.querySelector('.media-card-actions');if(!actions.children.length){const b=document.createElement('button');b.type='button';b.className='g09-button';b.textContent='Retomar processamento';b.onclick=()=>onResume(job.record_id,card);actions.append(b);}}}}
function decorateLogin(){const dlg=$('loginDialog');if(!dlg||dlg.classList.contains('erp-login'))return;dlg.classList.add('erp-login');const form=dlg.querySelector('form'),brand=document.createElement('div');brand.className='erp-login-brand';brand.innerHTML='<img src="assets/v09/logo_george.png" alt=""><div><strong>ERP ÍMPAR</strong><span>GEORGE • INTELIGÊNCIA OPERACIONAL</span></div>';form.prepend(brand);}
window.GeorgeAgendaExperience=Object.freeze({operation,closeOperation,create,get,sync,decorateLogin});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorateLogin,{once:true});else decorateLogin();
})();
