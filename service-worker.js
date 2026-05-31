const CACHE_NAME = "erp-impar-pwa-v2";

const APP_SHELL = [
  "/",
  "/index.html",
  "/menu.html",
  "/usuarios_erp.json",
  "/manifest.webmanifest",
  "/icons/erp-icon-192.png",
  "/icons/erp-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith("erp-impar-pwa-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // Não interfere no Ágape nem em APIs/backends.
  if (
    url.pathname.startsWith("/agape/") ||
    url.pathname.startsWith("/API/") ||
    req.method !== "GET"
  ) {
    return;
  }

  // HTML/JSON: tenta rede primeiro para evitar tela antiga após publicação.
  if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return response;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match("/index.html")))
    );
    return;
  }

  // Ícones e arquivos estáticos: cache primeiro.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      return response;
    }))
  );
});
