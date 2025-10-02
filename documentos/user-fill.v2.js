/*! user-fill.v2.js — busca usuário com paths alternativos e fallback */
(function(){
  function setUser(nome, email){
    var label = (nome || 'Usuário') + '<br>' + (email || 'usuario@empresa.com');
    document.querySelectorAll('.user').forEach(function(el){
      var txt=(el.textContent||'').trim(), html=(el.innerHTML||'').trim();
      if (!txt || /usuário/i.test(txt) || /usuario@empresa\.com/i.test(html)) el.innerHTML = label;
    });
  }

  // tenta vários caminhos (raiz, /documentos/, relativo à página atual)
  function buildCandidates(){
    var pageBase = location.pathname.replace(/\/[^\/]*$/, '/'); // /documentos/
    var arr = [
      pageBase + 'assets/usuario_doc.json',
      '/documentos/assets/usuario_doc.json',
      '/assets/usuario_doc.json',
    ];
    // remove duplicatas mantendo ordem
    return arr.filter((v,i,a)=>a.indexOf(v)===i);
  }

  async function tryFetch(url){
    try{
      const r = await fetch(url, { cache:'no-store' });
      if(!r.ok) return false;
      const j = await r.json();
      if(!j) return false;
      setUser(j.nome || j.Nome, j.email || j.Email);
      return true;
    }catch(_){ return false; }
  }

  async function tryJsonCascata(){
    const candidates = buildCandidates();
    for (let i=0;i<candidates.length;i++){
      if (await tryFetch(candidates[i])) return true;
    }
    return false;
  }

  function tryLocal(){
    try{
      const raw = localStorage.getItem('impar_user');
      if(!raw) return false;
      const u = JSON.parse(raw);
      if(!u) return false;
      setUser(u.Nome || u.nome, u.Email || u.email);
      return true;
    }catch(_){ return false; }
  }

  function tryGlobal(){
    if (window.imparUser){
      setUser(window.imparUser.nome, window.imparUser.email);
      return true;
    }
    return false;
  }

  function run(){
    tryJsonCascata().then(function(ok){
      if(ok) return;
      if(tryLocal()) return;
      tryGlobal();
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
