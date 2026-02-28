/* Ágape PWA Service Worker - v28 (install blindado) */
const CACHE_NAME = "agape-v28";

// ✅ deixe aqui APENAS o que é 100% garantido existir
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./service-worker.js",

  "./assets/maconaria.png",
  "./assets/maconaria.gif",
  "./assets/logo-Clementino-Brito.jpeg",
  "./assets/logo-pix.jpg",

  // se existir mesmo (se não tiver, remove)
  // "./favicon.ico",
];

// ✅ opcionais: se falhar, NÃO derruba o SW
const OPTIONAL_ASSETS = [
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
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 1) core (falhar aqui é grave)
    await cache.addAll(CORE_ASSETS);

    // 2) opcionais (falha não quebra install)
    await Promise.all(
      OPTIONAL_ASSETS.map((u) => cache.add(u).catch(() => null))
    );

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CLEAR_CACHE") {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })());
  }
});

function isApiConfig(url){
  // ✅ config no KingHost/API
  return (
    url.origin === "https://api.erpimpar.com.br" &&
    url.pathname.endsWith("/agape/consumo/agape_config.json")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ✅ SEMPRE rede pro config (GitHub antigo ou API novo)
  const isLocalConfig = url.pathname.endsWith("/agape_config.json");
  if (isLocalConfig || isApiConfig(url)) {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(() => caches.match(req))
    );
    return;
  }

  // cache-first simples
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((resp) => {
        if (req.method === "GET" && url.origin === self.location.origin && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Sistema Ágape", body: "" };
  }

  const title = data.title || "Sistema Ágape";
  const options = {
    body: data.body || "Nova notificação",
    icon: data.icon || "./assets/icon-192.png",
    badge: data.badge || "./assets/icon-192.png",
    data: { url: data.url || "/agape/" },
    vibrate: [80, 30, 80],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/agape/";

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url.includes("/agape/") && "focus" in client) {
        await client.focus();
        try { await client.navigate(url); } catch (e) {}
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
