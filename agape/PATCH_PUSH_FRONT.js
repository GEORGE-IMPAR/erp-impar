const AGAPE_VAPID_PUBLIC_KEY = 'BDnm3ar4jG4l5_Mn1tu0MYvH3VI1s2nvPL6dMlxbquc0VyInd--uB8ejlNn4JM8grkb3G1mzqwnqDWa1aFbFYwI';

function agapeUrlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function registrarPushAgape() {
  try {
    if (!('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;
    if (!('PushManager' in window)) return;

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('Push não permitido:', permission);
      return;
    }

    const reg = await navigator.serviceWorker.register('./sw.js?t=' + Date.now());
    await navigator.serviceWorker.ready;

    let subscription = await reg.pushManager.getSubscription();

    // Fase de implantação limpa: garante subscription nova com a chave VAPID atual.
    if (subscription) {
      try {
        await subscription.unsubscribe();
      } catch (e) {}
    }

    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: agapeUrlBase64ToUint8Array(AGAPE_VAPID_PUBLIC_KEY)
    });

    const resp = await fetch('https://api.erpimpar.com.br/agape/push_subscribe.php?t=' + Date.now(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    console.log('Push registrado:', await resp.text());

  } catch (e) {
    console.error('Erro push:', e);
  }
}

registrarPushAgape();
