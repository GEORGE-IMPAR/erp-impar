(() => {
  'use strict';
  let releaseSplash;
  window.GeorgePwaSplashReady=new Promise(resolve=>{releaseSplash=resolve;});
  const standalone=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;

  if('serviceWorker' in navigator&&location.protocol==='https:'){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}),{once:true});
  }

  if(!standalone){releaseSplash();return;}
  const splash=document.createElement('section');
  splash.className='george-pwa-splash';
  splash.setAttribute('aria-label','Abrindo George — ERP ÍMPAR');
  splash.innerHTML=`
    <div class="george-pwa-rays" aria-hidden="true"></div>
    <div class="george-pwa-card">
      <div class="george-pwa-logo-wrap"><img class="george-pwa-logo" src="assets/v09/pwa_logo.jpg" alt=""></div>
      <div class="george-pwa-kicker">George + ERP ÍMPAR</div>
      <h1 class="george-pwa-title">Olá, vamos começar.</h1>
      <p class="george-pwa-subtitle">Planejamento, obras, pessoas e indicadores em uma única conversa.</p>
      <div class="george-pwa-progress" aria-hidden="true"></div>
    </div>`;
  document.body.prepend(splash);

  let removed=false;
  const finish=()=>{
    if(removed)return;removed=true;splash.classList.add('is-leaving');
    window.setTimeout(()=>{splash.remove();releaseSplash();},480);
  };
  const earliest=new Promise(resolve=>window.setTimeout(resolve,2200));
  const loaded=document.readyState==='complete'?Promise.resolve():new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
  Promise.all([earliest,loaded]).then(finish);
  window.setTimeout(finish,4200);
})();
