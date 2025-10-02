/*! UI HOTFIX — sem alterar a estrutura do seu index.html */
(function(){
  function stepperOnLoad(){
    try{ if(typeof updateStepper==='function') updateStepper(1); }catch(e){}
    try{ if(typeof validate1==='function') validate1(); }catch(e){}
  }
  function setUserFallback(){
    try{
      const hasUser = document.querySelector('.user');
      if(!hasUser) return;
      const text = hasUser.textContent||'';
      if(/Usuário/i.test(text)){
        const u = JSON.parse(localStorage.getItem('impar_user')||'null');
        if(u){
          document.querySelectorAll('.user').forEach(el=>{
            el.innerHTML = (u.Nome||'Usuário') + '<br>' + (u.Email||'usuario@empresa.com');
          });
        }
      }
    }catch(_){}
  }
  function dedupeBars(){
    const cards = Array.from(document.querySelectorAll('.card'));
    if(!cards.length) return;
    const current = cards.find(c => c.offsetParent !== null) || cards[0];
    const bars = document.querySelectorAll('#bar1,#bar2,#bar3,#bar4,#bar5,.bar');
    const backs= document.querySelectorAll('#back2,#back3,#back4,#back5,.back');
    bars.forEach(el=>{ el.style.display='none'; });
    backs.forEach(el=>{ el.style.display='none'; });
    const i = cards.indexOf(current)+1;
    const bar  = document.getElementById('bar'+i);
    const back = document.getElementById('back'+i);
    if(bar)  bar.style.display='';
    if(back) back.style.display='';
  }
  function fixFechar(){
    const closeBtns = Array.from(document.querySelectorAll('button, a'))
      .filter(b=>/fechar/i.test((b.textContent||'').trim()));
    if(!closeBtns.length) return;
    closeBtns.forEach(btn=>{
      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        const cards = Array.from(document.querySelectorAll('.card'));
        const firstVisible = cards.find(c => c.offsetParent !== null) || cards[0];
        if(firstVisible === cards[0]){
          window.location.href = '/login_doc.html';
        }else{
          if(typeof goTo==='function') goTo(1);
          else cards.forEach((c,idx)=> c.style.display = (idx===0)?'':'none');
        }
      }, {once:true});
    });
  }
  function ensurePdfResolver(){
    if(window._resolvePdfHref) return;
    window._resolvePdfHref = function(row){
      try{
        const base = (window.__ERP_SAVE_PATCH__ && window.__ERP_SAVE_PATCH__.SAVE_URL || '').replace('/save.php','/');
        const url = row && (row.pdfUrl || row.url);
        if(url) return url;
        const f = row && (row.file || row.PDF || row.pdf || row.pdf_file);
        return f ? (base + 'pdf.php?f=' + encodeURIComponent(f)) : '';
      }catch(e){ return ''; }
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    stepperOnLoad();
    setUserFallback();
    dedupeBars();
    fixFechar();
    ensurePdfResolver();
  });
})();
