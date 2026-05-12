self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {

  const data = event.data ? event.data.json() : {};

  const title = data.title || 'Sistema Ágape';

  const options = {
    body: data.body || 'Nova atualização disponível.',
    icon: './logo.png',
    badge: './logo.png'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );

});