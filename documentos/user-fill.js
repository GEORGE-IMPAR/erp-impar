/*! user-fill.js — preenche usuário (etapa 1 inclusive) sem alterar o fluxo */
(function(){
  function setUser(nome, email){
    var label = (nome || 'Usuário') + '<br>' + (email || 'usuario@empresa.com');
    document.querySelectorAll('.user').forEach(function(el){
      var html = (el.innerHTML || '').trim();
      var txt  = (el.textContent || '').trim();
      if (!txt || /usuário/i.test(txt) || /usuario@empresa\.com/i.test(html)) {
        el.innerHTML = label;
      }
    });
  }
  async function tryJson(){
    try{
      var r = await fetch('/assets/usuario_doc.json', {cache:'no-store'});
      if(!r.ok) return false;
      var j = await r.json();
      if(!j) return false;
      setUser(j.nome || j.Nome, j.email || j.Email);
      return true;
    }catch(_){ return false; }
  }
  function tryLocal(){
    try{
      var raw = localStorage.getItem('impar_user');
      if(!raw) return false;
      var u = JSON.parse(raw);
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
    tryJson().then(function(ok){
      if(ok) return;
      if(tryLocal()) return;
      tryGlobal();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
