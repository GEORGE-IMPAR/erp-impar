/* Ágape PWA Service Worker - v24 */
const CACHE_NAME = "agape-v24";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./agape_config.json",
  "./manifest.webmanifest",
  "./service-worker.js",
  "./favicon.ico",
  "./assets/icon-192.gif",
  "./assets/icon-512.png",
  "./assets/logo-Clementino-Brito.jpeg",
  "./assets/logo-pix.jpg",

  // produtos (opcionais)
  "./assets/agua.jpg",
  "./assets/carvao.jpg",
  "./assets/coca15l.jpg",
  "./assets/coca2l.jpg",
  "./assets/heineken600.jpg",
  "./assets/heineken600Zero.jpg",
  "./assets/original600.jpg",
  "./assets/pureza2l.jpg",
  "./assets/stellasemgluten.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CLEAR_CACHE") {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      })()
    );
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // sempre buscar config atualizado
  if (url.pathname.endsWith("/agape_config.json")) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req)));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          // cache only GET same-origin
          if (req.method === "GET" && url.origin === self.location.origin && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
