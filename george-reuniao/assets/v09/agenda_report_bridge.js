/* ERP ÍMPAR — George V0.9.8 HF15
   PDF da Agenda do Dia montado no navegador a partir da leitura oficial do
   único rascunho diário aberto. Não abre o módulo do
   ERP em iframe, não navega, não escreve na Agenda e não depende do PDF oficial.
*/
(() => {
'use strict';
const scriptUrl=new URL(document.currentScript.src),LOGO_URL=new URL('logo_george.png',scriptUrl).href;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function matches(text,module=''){
 const command=norm(text)
   .replace(/^(?:(?:ei|oi|ola|por favor|ta|ok|entao)[, .!]* )?(?:george|jorge)[, :.!]*/,'')
   .replace(/[, :.!]*(?:george|jorge)[, .!?]*$/,'')
   .replace(/[.!?]+$/,'').trim();
 if(/\b(por que|porque|motivo|erro|falhou|falha|problema|nao conseguiu|nao consegue)\b/.test(command)&&/\b(pdf|relatorio)\b/.test(command))return false;
 const share='(?:compartilha|compartilhar|compartilhe|envia|enviar|envie)';
 const open='(?:gera|gerar|gere|abre|abrir|abra|baixa|baixar|baixe|imprime|imprimir|imprima)';
 const polite='(?:(?:pode|por favor|quero que voce) )?';
 const bare=new RegExp('^'+polite+'(?:'+share+'|'+open+')(?: o)? pdf(?: do dia)?$');
 const explicit=new RegExp('^'+polite+'(?:'+share+'|'+open+')(?: o)? (?:pdf|relatorio)(?: em pdf)? (?:da|do) (?:agenda|atividade) do dia$');
 const natural=new RegExp('^'+polite+'(?:'+share+'|'+open+')(?: a| o)? (?:agenda|atividade)(?: do dia)?(?: em pdf)?$');
 const contextualReport=new RegExp('^'+polite+'(?:'+share+'|'+open+')(?: o| a)? (?:pdf|relatorio)(?: do dia| em pdf)?$');
 const requestedFile=/^(?:(?:eu )?(?:quero|preciso)(?: de)? )?(?:um |o )?(?:arquivo|documento)? ?pdf(?: da agenda do dia)? para (?:compartilhar|enviar|baixar|imprimir)$/;
 return explicit.test(command)||(module==='agenda_dia'&&(bare.test(command)||natural.test(command)||contextualReport.test(command)||requestedFile.test(command)));
}
function wantsShare(text){return /\bcompartilh|\benvi(a|e|ar)\b/.test(norm(text));}
function wantsPrint(text){return /\bimprim|\bimpress/.test(norm(text));}
function br(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(iso||'');}
function number(value){return Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2});}
function clean(value){return String(value??'').replace(/\s+/g,' ').trim();}
function safeFilename(value){return clean(value||'agenda_do_dia').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'agenda_do_dia';}
function fromAgenda(response){
 const draft=response?.draft&&typeof response.draft==='object'?response.draft:response||{},date=String(response?.data||draft.data||draft.date||''),activities=Array.isArray(response?.atividades)?response.atividades:Array.isArray(draft.atividades)?draft.atividades:[];
 const rows=activities.filter(item=>item&&typeof item==='object').map((item,index)=>{
   const merged={...(item.planejado&&typeof item.planejado==='object'?item.planejado:{}),...item,...(item.executado&&typeof item.executado==='object'?item.executado:{})};
   const statusText=norm(merged.statusVisual||merged.status||''),description=clean(merged.atividade||merged.atividade_texto||merged.descricao||'Sem descrição'),work=clean(merged.obra||merged.obra_texto||merged.projeto||'Sem obra'),cancelled=!!(item.cancelado||item.cancelled)||statusText.includes('cancel'),special=/\bferias\b/.test(norm(description+' '+work))?'Férias':/\bfalta\b/.test(norm(description+' '+work))?'Falta':'';
   return {data:date,colaborador:clean(merged.colaborador||merged.colaborador_nome||merged.responsavel||'Sem colaborador'),funcao:clean(merged.funcao||merged.cargo||''),obra:work,atividade:description,veiculo:clean(merged.carro||merged.placa||'Sem veículo'),status:cancelled?'Cancelada':special||'Ativa',horas:0,atividade_id:String(item.id||`${date}_${index}`)};
 });
 const byPerson=new Map();for(const row of rows)if(row.status==='Ativa'&&row.colaborador!=='Sem colaborador'){const key=norm(row.colaborador);if(!byPerson.has(key))byPerson.set(key,[]);byPerson.get(key).push(row);}
 for(const activeRows of byPerson.values()){const share=activeRows.length?8/activeRows.length:0;for(const row of activeRows)row.horas=share;}
 const productive=rows.filter(row=>row.status==='Ativa'),people=new Set(productive.map(row=>norm(row.colaborador)).filter(Boolean)),works=new Set(productive.map(row=>norm(row.obra)).filter(Boolean));
 return {title:'Relatório da Agenda do Dia',filename:`agenda_do_dia_${date}`,format:'pdf',summary:{periodo:{inicio:date,fim:date},horas:productive.reduce((total,row)=>total+Number(row.horas||0),0),colaboradores:people.size,obras:works.size,atividades:rows.length,regra:'8 horas por colaborador/dia, divididas igualmente entre as atividades produtivas válidas'},never_allocated:[],rows,source:response?.source||'Fonte operacional da Agenda do Dia'};
}
async function loadLogo(){
 let objectUrl='';
 try{const response=await fetch(LOGO_URL,{credentials:'same-origin',cache:'force-cache'});if(!response.ok)return null;objectUrl=URL.createObjectURL(await response.blob());return await new Promise(resolve=>{const image=new Image();let done=false;const finish=value=>{if(done)return;done=true;if(objectUrl)URL.revokeObjectURL(objectUrl);resolve(value);};image.onload=()=>finish(image);image.onerror=()=>finish(null);image.src=objectUrl;setTimeout(()=>finish(null),4000);});}
 catch(e){if(objectUrl)URL.revokeObjectURL(objectUrl);return null;}
}
function wrap(ctx,text,maxWidth){const words=clean(text).split(' ').filter(Boolean),lines=[];let line='';for(const word of words){const trial=line?line+' '+word:word;if(line&&ctx.measureText(trial).width>maxWidth){lines.push(line);line=word;}else line=trial;}if(line)lines.push(line);return lines.length?lines:['—'];}
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();if(typeof ctx.roundRect==='function')ctx.roundRect(x,y,w,h,r);else{const radius=Math.min(r,w/2,h/2);ctx.moveTo(x+radius,y);ctx.lineTo(x+w-radius,y);ctx.quadraticCurveTo(x+w,y,x+w,y+radius);ctx.lineTo(x+w,y+h-radius);ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);ctx.lineTo(x+radius,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-radius);ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);}if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function drawText(ctx,text,x,y,options={}){ctx.font=options.font||'26px Arial';ctx.fillStyle=options.color||'#173550';ctx.textAlign=options.align||'left';ctx.textBaseline='top';const lines=wrap(ctx,text,options.width||900),height=options.lineHeight||34;lines.forEach((line,index)=>ctx.fillText(line,x,y+index*height));return y+lines.length*height;}
function dataUrlBytes(url){const binary=atob(url.slice(url.indexOf(',')+1)),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
function jpegPdf(images){
 const encoder=new TextEncoder(),parts=[],offsets=[0];let length=0;const add=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;parts.push(bytes);length+=bytes.length;};const object=(id,body)=>{offsets[id]=length;add(`${id} 0 obj\n${body}\nendobj\n`);};
 add('%PDF-1.4\n%ERPIMPAR\n');const pageIds=[],imageIds=[];let next=3;images.forEach(()=>{pageIds.push(next++);imageIds.push(next++);});object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,`<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`);
 images.forEach((image,index)=>{const pageId=pageIds[index],imageId=imageIds[index],contentId=next++;object(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${index+1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);offsets[imageId]=length;add(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);add(image.bytes);add('\nendstream\nendobj\n');const stream=`q\n595 0 0 842 0 0 cm\n/Im${index+1} Do\nQ\n`;object(contentId,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);});
 const xref=length;add(`xref\n0 ${next}\n0000000000 65535 f \n`);for(let id=1;id<next;id++)add(`${String(offsets[id]||0).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);return new Blob(parts,{type:'application/pdf'});
}
async function render(payload,onStage){
 const summary=payload.summary||{},period=summary.periodo||{},rows=Array.isArray(payload.rows)?payload.rows:[],neverAllocated=Array.isArray(payload.never_allocated)?payload.never_allocated:[],WIDTH=1240,HEIGHT=1754,MARGIN=72,CONTENT=WIDTH-MARGIN*2,TOP=300,BOTTOM=105,logoPromise=loadLogo();let pageNumber=0,canvas,ctx,y,logo;const pages=[];
 async function newPage(){if(canvas)pages.push({width:WIDTH,height:HEIGHT,bytes:dataUrlBytes(canvas.toDataURL('image/jpeg',0.9))});pageNumber++;canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,HEIGHT);const gradient=ctx.createLinearGradient(0,0,WIDTH,0);gradient.addColorStop(0,'#084777');gradient.addColorStop(.55,'#1769d3');gradient.addColorStop(1,'#4832ef');ctx.fillStyle=gradient;ctx.fillRect(0,0,WIDTH,225);logo=logo===undefined?await logoPromise:logo;if(logo)ctx.drawImage(logo,MARGIN,42,132,132);ctx.fillStyle='#fff';ctx.font='bold 41px Arial';ctx.fillText('ERP ÍMPAR',logo?230:MARGIN,54);ctx.font='bold 21px Arial';ctx.fillStyle='#bfe8ff';ctx.fillText('GEORGE • INTELIGÊNCIA OPERACIONAL',logo?230:MARGIN,110);ctx.font='bold 25px Arial';ctx.fillStyle='#fff';ctx.textAlign='right';ctx.fillText('AGENDA DO DIA',WIDTH-MARGIN,58);ctx.font='20px Arial';ctx.fillText(`${br(period.inicio)}${period.fim&&period.fim!==period.inicio?' a '+br(period.fim):''}`,WIDTH-MARGIN,108);ctx.textAlign='left';y=TOP;}
 function footer(){ctx.fillStyle='#6f8191';ctx.font='18px Arial';ctx.fillText('Fonte: Agenda do Dia • consulta somente leitura',MARGIN,HEIGHT-63);ctx.textAlign='right';ctx.fillText(`Página ${pageNumber}`,WIDTH-MARGIN,HEIGHT-63);ctx.textAlign='left';}
 async function ensure(space){if(y+space<=HEIGHT-BOTTOM)return;footer();await newPage();}
 await newPage();ctx.font='bold 45px Arial';ctx.fillStyle='#123e72';ctx.fillText(payload.title||'Relatório da Agenda do Dia',MARGIN,y);y+=78;
 const cards=[['HORAS',number(summary.horas)+'h'],['COLABORADORES',summary.colaboradores||0],['OBRAS',summary.obras||0],['ATIVIDADES',summary.atividades||0]],gap=18,cardWidth=(CONTENT-gap*3)/4;cards.forEach((card,index)=>{const x=MARGIN+index*(cardWidth+gap);rounded(ctx,x,y,cardWidth,132,18,'#f1f6fb','#ccdaea');ctx.fillStyle='#627c94';ctx.font='bold 17px Arial';ctx.fillText(card[0],x+20,y+22);ctx.fillStyle='#1769d3';ctx.font='bold 36px Arial';ctx.fillText(String(card[1]),x+20,y+62);});y+=170;
 if(summary.regra){rounded(ctx,MARGIN,y,CONTENT,82,15,'#eef5ff','#c7dbf6');drawText(ctx,'Critério: '+summary.regra,MARGIN+22,y+20,{font:'20px Arial',width:CONTENT-44,lineHeight:26});y+=112;}
 if(summary.datas_uteis_sem_agenda?.length){const text='Dias úteis sem Agenda disponível: '+summary.datas_uteis_sem_agenda.map(br).join(', '),lines=wrap(ctx,text,CONTENT-44),h=36+lines.length*27;rounded(ctx,MARGIN,y,CONTENT,h,15,'#fff6dd','#ead49a');drawText(ctx,'Atenção: '+text,MARGIN+22,y+18,{font:'20px Arial',color:'#765516',width:CONTENT-44,lineHeight:27});y+=h+24;}
 if(neverAllocated.length){const text='Colaboradores sem alocação no período: '+neverAllocated.join(', ');ctx.font='20px Arial';const lines=wrap(ctx,text,CONTENT-44),h=36+lines.length*27;rounded(ctx,MARGIN,y,CONTENT,h,15,'#f4f6f8','#d6dee7');drawText(ctx,text,MARGIN+22,y+18,{font:'20px Arial',color:'#425b70',width:CONTENT-44,lineHeight:27});y+=h+24;}
 ctx.fillStyle='#173550';ctx.font='bold 30px Arial';ctx.fillText('Atividades e alocações',MARGIN,y);y+=52;if(!rows.length){drawText(ctx,'Nenhuma atividade foi retornada para o período consultado.',MARGIN,y,{font:'24px Arial',width:CONTENT});y+=50;}
 for(let index=0;index<rows.length;index++){const row=rows[index]||{};ctx.font='22px Arial';const title=`${br(row.data)} • ${clean(row.colaborador)||'Sem colaborador'} • ${number(row.horas)}h`,work=`${clean(row.obra)||'Sem obra'}${clean(row.veiculo)&&clean(row.veiculo)!=='Sem veículo'?' • Veículo: '+clean(row.veiculo):''}`,activity=`${clean(row.atividade)||'Sem descrição'}${clean(row.status)?' • '+clean(row.status):''}`,titleLines=wrap(ctx,title,CONTENT-44),workLines=wrap(ctx,work,CONTENT-44),activityLines=wrap(ctx,activity,CONTENT-44),height=30+titleLines.length*31+workLines.length*28+activityLines.length*28+22;await ensure(height+18);rounded(ctx,MARGIN,y,CONTENT,height,16,index%2?'#f7f9fc':'#f1f6fb','#d7e1ec');let lineY=y+18;lineY=drawText(ctx,title,MARGIN+22,lineY,{font:'bold 22px Arial',color:'#135fb8',width:CONTENT-44,lineHeight:31});lineY=drawText(ctx,work,MARGIN+22,lineY+3,{font:'bold 20px Arial',color:'#173550',width:CONTENT-44,lineHeight:28});drawText(ctx,activity,MARGIN+22,lineY+3,{font:'20px Arial',color:'#4e657a',width:CONTENT-44,lineHeight:28});y+=height+18;if(index%10===0){onStage?.(`Montando o PDF • ${index+1} de ${rows.length} atividades…`);await sleep(0);}}
 footer();pages.push({width:WIDTH,height:HEIGHT,bytes:dataUrlBytes(canvas.toDataURL('image/jpeg',0.9))});return jpegPdf(pages);
}
async function build(text,payload,options={}){if(!payload||!payload.summary||!Array.isArray(payload.rows))throw new Error('A consulta da Agenda do Dia não retornou dados estruturados para montar o PDF. Nenhum arquivo foi anunciado como pronto.');options.onStage?.('Montando o PDF com os dados da Agenda do Dia…');const blob=await render(payload,options.onStage);if(blob.size<100||await blob.slice(0,5).text()!=='%PDF-')throw new Error('Não foi possível concluir um PDF válido. Tente novamente.');const period=payload.summary.periodo||{},date=period.inicio||'',end=period.fim||date;return {ok:true,date,date_br:date===end?br(date):`${br(date)} a ${br(end)}`,blob,filename:safeFilename(payload.filename||`agenda_do_dia_${date}`)+'.pdf',wants_share:wantsShare(text),wants_print:wantsPrint(text),source:payload.source||'Fonte operacional da Agenda do Dia — consulta somente leitura',payload};}
window.GeorgeAgendaReport=Object.freeze({matches,fromAgenda,build,version:'0.9.8-rc7-v1'});
})();
