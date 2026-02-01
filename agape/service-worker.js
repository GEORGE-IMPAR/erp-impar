const CACHE = "agape-v16";
const ASSETS = [
  "./",
  "./index.html",
  "./agape_config.json",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/logo.jpeg",
  "./assets/agua.jpg",
  "./assets/carvao.jpg",
  "./assets/coca15l.jpg",
  "./assets/coca2l.jpg",
  "./assets/heineken600.jpg",
  "./assets/heineken600Zero.jpg",
  "./assets/original600.jpg",
  "./assets/pureza2l.jpg"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method!=="GET") return;
  e.respondWith(
    caches.match(req).then(res=> res || fetch(req).then(net=>{
      const copy = net.clone();
      caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
      return net;
    }).catch(()=>res))
  );
});