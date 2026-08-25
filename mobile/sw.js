const CACHE_NAME = "erp-impar-mobile-v1.3-hotfix";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assistant_bridge.js",
  "./capabilities.json",
  "./consultas_v1.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // APIs: sempre rede. Não cacheia dados operacionais.
  if (url.hostname === "api.erpimpar.com.br") {
    event.respondWith(fetch(req, {cache:"no-store"}));
    return;
  }

  // Navegação: network-first para receber versão nova rapidamente.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put("./index.html", copy));
        return resp;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Shell estático: cache-first.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy));
      return resp;
    }))
  );
});
