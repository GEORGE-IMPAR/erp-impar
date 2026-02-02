/* Ágape PWA Service Worker - v25 */
const CACHE_NAME = "agape-v25";

// Não “congele” o index aqui
const CORE_ASSETS = [
  "./manifest.webmanifest",
  "./favicon.ico",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/logo-Clementino-Brito.jpeg",
  "./assets/logo-pix.jpg",

  // produtos
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

// install: cache só dos assets “estáveis”
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// activate: limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// comando manual p/ limpar cache
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CLEAR_CACHE") {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })());
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) index / navegação: NETWORK-FIRST (pra não travar layout antigo)
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        // offline fallback
        const cached = await caches.match(req);
        return cached || caches.match("./index.html") || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // 2) config: sempre atualizado
  if (url.pathname.endsWith("/agape_config.json")) {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(() => caches.match(req))
    );
    return;
  }

  // 3) assets: cache-first com atualização em background (stale-while-revalidate “simplificado”)
  if (req.method === "GET" && url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const fetchPromise = fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => null);

      return cached || (await fetchPromise) || new Response("", { status: 504 });
    })());
    return;
  }

  // 4) fallback padrão
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
