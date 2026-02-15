/* Ágape PWA Service Worker - v24 */
const CACHE_NAME = "agape-v25";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./assets/maconaria.png",
  "./assets/maconaria.gif",
  "./manifest.webmanifest",
  "./service-worker.js",
  "./favicon.ico",
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

const CONFIG_URL = "https://api.erpimpar.com.br/agape/consumo/agape_config.json";

const CONFIG_ORIGIN = "https://api.erpimpar.com.br";
const CONFIG_PATH   = "/agape/consumo/agape_config.json";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Config remoto: SEMPRE da rede, SEM cache (mesmo com ?t=...)
  if (url.origin === CONFIG_ORIGIN && url.pathname === CONFIG_PATH) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then(r => r)
        .catch(() => fetch(req))
    );
    return;
  }

  // 2) Se pedir config "local", redireciona pro remoto
  if (url.pathname.endsWith("/agape_config.json")) {
    const remote = CONFIG_ORIGIN + CONFIG_PATH;
    event.respondWith(fetch(remote, { cache: "no-store" }).catch(() => fetch(remote)));
    return;
  }

  // resto: cache normal
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
    data = { title: "Sistema Ágape", body: event.data?.text?.() || "" };
  }

  const title = data.title || "Sistema Ágape";
  const options = {
    body: data.body || "Nova notificação",
    icon: data.icon || "./assets/icon-192.png",
    badge: data.badge || "./assets/icon-192.png",
    data: {
      url: data.url || "/agape/index.html"
    },
    vibrate: [80, 30, 80],
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification?.data?.url || "/agape/index.html";
  const targetUrl = new URL(raw, self.location.origin).toString();

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of allClients) {
      if (client.url.includes("/agape/") && "focus" in client) {
        await client.focus();
        try { await client.navigate(targetUrl); } catch(e){}
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(targetUrl);
  })());
});



