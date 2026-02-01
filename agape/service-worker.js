// Sistema Ágape PWA - service worker (v12)
const CACHE_NAME = "agape-v12";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./agape_config.json",
  "./logo-Clementino-Brito.jpeg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(()=>{})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        try{
          const url = new URL(req.url);
          if(url.origin === self.location.origin && res.ok){
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(()=>{});
          }
        }catch(_){}
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
