const CACHE_NAME = "erp-impar-pwa-v5-fix-response";

const CORE_FILES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/erp-icon-192.png",
  "/icons/erp-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith("erp-impar-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  // Não interfere no Ágape nem em APIs/JSON/PHP dinâmicos.
  if (
    url.pathname.startsWith("/agape/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".php") ||
    url.pathname.endsWith(".json") ||
    url.pathname.includes("usuarios_erp.json")
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML sempre tenta rede primeiro para evitar tela velha em cache.
if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
  event.respondWith(
    fetch(req, { cache: "no-store" })
      .catch(async () => {
        const cached = await caches.match("/index.html");
        return cached || new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
  );
  return;
}
  
  // Assets: cache-first com atualização leve.
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
