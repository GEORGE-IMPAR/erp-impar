/*! user-fill.js — preenche o nome/email do usuário logado sem alterar sua lógica */
(function(){
  function setUser(nome, email){
    var label = (nome || 'Usuário') + '<br>' + (email || 'usuario@empresa.com');
    var nodes = document.querySelectorAll('.user');
    nodes.forEach(function(el){
      var txt = (el.textContent || '').trim();
      // só altera se estiver vazio ou com o placeholder "Usuário"
      if (!txt || /usuário/i.test(txt)) el.innerHTML = label;
    });
  }

  async function tryJson(){
    try{
      var r = await fetch('/assets/usuario_doc.json', {cache: 'no-store'});
      if(!r.ok) return false;
      var j = await r.json();
      if(!j) return false;
      setUser(j.nome || j.Nome, j.email || j.Email);
      return true;
    }catch(_){ return false; }
  }

  function tryLocalStorage(){
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

  document.addEventListener('DOMContentLoaded', function(){
    // Tenta em cascata, sem quebrar nada do seu fluxo
    tryJson().then(function(ok){
      if(ok) return;
      if(tryLocalStorage()) return;
      tryGlobal();
    });
  });
})();
