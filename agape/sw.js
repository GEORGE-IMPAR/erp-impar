const CACHE_NAME = 'agape-pwa-v1';
const APP_SHELL = [
  './',
  './index.html',
  './app.html',
  './confirmar_tab.html',
  './tronco_tab.html',
  './consumo_tab.html',
  './manifest.json',
  './icon-152.png',
  './icon-167.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => null))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  const isApi = url.hostname.includes('api.erpimpar.com.br');
  const isHtml = url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isApi || isHtml) {
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => null);
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => null);
      return resp;
    }))
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  const title = data.title || data.titulo || 'AGAPE';
  const options = {
    body: data.body || data.mensagem || 'Nova notificação do AGAPE.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './index.html' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './index.html';
  event.waitUntil(clients.openWindow(url));
});
