self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

async function carregarMensagemAgape() {
  try {
    const resp = await fetch('https://api.erpimpar.com.br/agape/carregar_config.php?t=' + Date.now(), { cache: 'no-store' });
    const data = await resp.json();
    const cfg = data.config || data;

    return {
      title: 'Convocação Ágape',
      body: cfg?.sessao?.chamado || 'Sessão convocada. Toque para confirmar presença.',
      url: 'https://www.erpimpar.com.br/agape/index.html'
    };
  } catch (error) {
    return {
      title: 'Sistema Ágape',
      body: 'Nova atualização disponível.',
      url: 'https://www.erpimpar.com.br/agape/index.html'
    };
  }
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    const msg = await carregarMensagemAgape();

    await self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: './logo-maconaria.png',
      badge: './logo-maconaria.png',
      data: { url: msg.url },
      requireInteraction: true
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification?.data?.url || 'https://www.erpimpar.com.br/agape/index.html';
  event.waitUntil(clients.openWindow(url));
});
