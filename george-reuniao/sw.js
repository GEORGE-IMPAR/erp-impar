const CACHE='erp-impar-george-hf10-v12';
const SHELL=[
  './george_v09.html',
  './manifest.webmanifest',
  './assets/v09/styles.css',
  './assets/v09/pwa_shell.css',
  './assets/v09/pwa_shell.js',
  './assets/v09/agenda_day_experience.css',
  './assets/v09/agenda_day_experience.js',
  './assets/v09/agenda_report_bridge.js',
  './assets/v09/app.js',
  './assets/v09/logo_george.png',
  './assets/v09/pwa_logo.jpg',
  './assets/v09/pwa_logo.svg',
  './assets/v09/pwa_icon_192.png',
  './assets/v09/pwa_icon_512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(url)))));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('erp-impar-george-')&&key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||/\/api(?:\/|\.|$)/i.test(url.pathname))return;

  event.respondWith(fetch(request).then(response=>{
    if(response.ok&&['document','script','style','image','font'].includes(request.destination)){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
    }
    return response;
  }).catch(()=>caches.match(request).then(hit=>hit||(request.mode==='navigate'?caches.match('./george_v09.html'):Response.error()))));
});
