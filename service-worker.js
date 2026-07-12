const CACHE_NAME = "erp-impar-pwa-v6-safe-response";

const CORE_FILES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/erp-icon-192.png",
  "/icons/erp-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        CORE_FILES.map(file =>
          cache.add(file).catch(error => {
            console.warn("Não foi possível armazenar no cache:", file, error);
            return null;
          })
        )
      )
    )
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

  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  const unavailable = (contentType = "text/plain; charset=utf-8") =>
    new Response("Recurso temporariamente indisponível.", {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store"
      }
    });

  // Não armazena nem interfere no conteúdo dinâmico do Ágape, APIs, PHP ou JSON.
  if (
    url.pathname.startsWith("/agape/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".php") ||
    url.pathname.endsWith(".json") ||
    url.pathname.includes("usuarios_erp.json")
  ) {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(() =>
        unavailable("application/json; charset=utf-8")
      )
    );
    return;
  }

  // HTML sempre tenta a rede primeiro para evitar páginas antigas no cache.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .catch(async () => {
          const cached = await caches.match(req) || await caches.match("/index.html");
          return cached || unavailable("text/html; charset=utf-8");
        })
    );
    return;
  }

  // Assets: cache-first com atualização em segundo plano e fallback sempre válido.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(req, copy))
            .catch(error => console.warn("Falha ao atualizar cache:", error));
        }
        return res;
      }).catch(() => cached || unavailable());

      return cached || network;
    }).catch(() => unavailable())
  );
});
