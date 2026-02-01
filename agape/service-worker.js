const CACHE_NAME = "agape-cache-v24-1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./agape_config.json",
  "./assets/logo-Clementino-Brito.jpeg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/produtos/agua.jpg",
  "./assets/produtos/carvao.jpg",
  "./assets/produtos/coca2l.jpg",
  "./assets/produtos/coca15l.jpg",
  "./assets/produtos/heineken600.jpg",
  "./assets/produtos/heineken600Zero.jpg",
  "./assets/produtos/original600.jpg",
  "./assets/produtos/pureza2l.jpg",
  "./assets/produtos/stellasemgluten.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "CLEAR_CACHES") {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    })());
  }
});

// Network-first for JSON config, cache-first for everything else.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("agape_config.json")) {
    event.respondWith((async () => {
      try {
        const res = await fetch(event.request, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, res.clone());
        return res;
      } catch (e) {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const res = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(event.request, res.clone());
    return res;
  })());
});
