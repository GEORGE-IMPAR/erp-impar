/* ERP ÍMPAR — George V0.9.3
   Bridge SOMENTE de relatório da Agenda do Dia.
   Reutiliza o módulo oficial /cronograma/agenda_do_dia_novo.html:
     AgendaDiaV315.openDate()      -> carrega draft/histórico da fonte oficial
     AgendaDiaPackage77.buildPdf() -> gera o MESMO PDF do relatório oficial
   Não cria regra de relatório paralela e não escreve na Agenda.
*/
(() => {
'use strict';

const OFFICIAL_URL='/cronograma/agenda_do_dia_novo.html';
let frame=null;
let loading=null;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function todayISO(){
  const d=new Date(), p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function shiftISO(days){
  const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+days);
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function dateFromText(text){
  const s=String(text||'');
  let m=s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  const n=norm(s);
  if(/\bontem\b/.test(n))return shiftISO(-1);
  return null; // Sem histórico/data explícita, usar o único draft ativo.
}
function br(iso){
  const [y,m,d]=String(iso).split('-');
  return `${d}/${m}/${y}`;
}
function matches(text){
  const n=norm(text);
  const agenda=/\bagenda do dia\b|\batividade do dia\b/.test(n);
  const report=/\brelatorio\b|\bpdf\b|\bcompartilh|\bexport|\bimprim/.test(n);
  return agenda && report;
}
function wantsShare(text){
  return /\bcompartilh|\benvi(a|e|ar)\b/.test(norm(text));
}
function wantsPrint(text){
  return /\bimprim|\bimpress/.test(norm(text));
}

function ensureFrame(){
  if(frame?.isConnected)return Promise.resolve(frame);
  if(loading)return loading;

  loading=new Promise((resolve,reject)=>{
    const f=document.createElement('iframe');
    f.id='georgeAgendaOfficialReportFrame';
    f.title='Motor oficial do relatório da Agenda do Dia';
    // A Agenda pode executar scripts e usar a mesma sessão, mas não pode
    // redirecionar a janela principal do George para login ou para o ERP.
    f.setAttribute('sandbox','allow-scripts allow-same-origin allow-downloads allow-modals');
    f.referrerPolicy='same-origin';
    // Precisa renderizar para html2canvas, mas fica totalmente fora da área visível.
    f.style.cssText=[
      'position:fixed',
      'left:-20000px',
      'top:0',
      'width:1280px',
      'height:960px',
      'opacity:0.001',
      'pointer-events:none',
      'border:0',
      'z-index:-9999',
      'background:#fff'
    ].join(';');
    const timer=setTimeout(()=>{
      try{f.remove();}catch(_){}
      frame=null; loading=null;
      reject(new Error('O módulo oficial da Agenda do Dia demorou demais para carregar.'));
    },90000);
    f.onload=()=>{
      clearTimeout(timer);
      frame=f; loading=null; resolve(f);
    };
    f.onerror=()=>{
      clearTimeout(timer);
      try{f.remove();}catch(_){}
      frame=null; loading=null;
      reject(new Error('Não foi possível carregar o módulo oficial da Agenda do Dia.'));
    };
    f.src=OFFICIAL_URL+'?george_report_bridge=093&_='+Date.now();
    document.body.appendChild(f);
  });
  return loading;
}
async function waitApi(win){
  const end=Date.now()+90000;
  while(Date.now()<end){
    if(
      win?.AgendaDiaV315?.openDate &&
      win?.AgendaDiaV315?.openDraft &&
      win?.AgendaDiaPackage77?.buildPdf
    ) return true;
    await sleep(250);
  }
  throw new Error('O motor oficial de relatório da Agenda ainda não ficou disponível.');
}
async function waitDate(win,date){
  const end=Date.now()+45000;
  while(Date.now()<end){
    if(String(win.__AGENDA_DIA_CURRENT_DATE__||'')===date)return true;
    await sleep(200);
  }
  return false;
}

async function build(text){
  let date=dateFromText(text);
  const f=await ensureFrame();
  const win=f.contentWindow;
  await waitApi(win);

  let restored=false;
  try{
    // V315 consulta o draft/histórico pelo atividade_dia_estado_novo.php.
    // Para histórico, abre somente leitura. Para data futura, bloqueia.
    if(date)await win.AgendaDiaV315.openDate(date);else{await win.AgendaDiaV315.openDraft();date=String(win.__AGENDA_DIA_CURRENT_DATE__||'');if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))throw new Error('O módulo oficial não confirmou a data do draft ativo.');}
    const exact=await waitDate(win,date);
    if(!exact){
      const current=String(win.__AGENDA_DIA_CURRENT_DATE__||'');
      throw new Error(
        current && current!==date
          ? `A Agenda oficial de ${br(date)} não foi carregada; o módulo permaneceu em ${br(current)}. Nenhum PDF foi gerado.`
          : `A Agenda oficial de ${br(date)} não foi encontrada. Nenhum PDF foi gerado.`
      );
    }

    const foreignBlob=await win.AgendaDiaPackage77.buildPdf();
    if(!foreignBlob || foreignBlob.size<500){
      throw new Error('O gerador oficial retornou um PDF vazio.');
    }

    // Clona o Blob para o realm do George.
    const bytes=await foreignBlob.arrayBuffer();
    const blob=new Blob([bytes],{type:'application/pdf'});
    return {
      ok:true,
      date,
      date_br:br(date),
      blob,
      filename:`agenda_do_dia_${date}.pdf`,
      wants_share:wantsShare(text),
      wants_print:wantsPrint(text),
      source:'agenda_do_dia_novo.html > AgendaDiaV315.openDate > AgendaDiaPackage77.buildPdf'
    };
  } finally {
    // O relatório oficial abre estado visual dentro do iframe.
    // Sempre restaura o draft corrente do servidor ao terminar, evitando
    // deixar a instância oculta posicionada em um histórico.
    try{
      await win.AgendaDiaV315.openDraft();
      restored=true;
    }catch(_){}
  }
}

window.GeorgeAgendaReport=Object.freeze({
  matches,
  dateFromText,
  build,
  source:OFFICIAL_URL,
  version:'0.9.7-rc1'
});
})();
