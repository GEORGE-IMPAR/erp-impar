async function registrarPushAgape() {
  try {

    if (!('serviceWorker' in navigator)) return;
    if (!('PushManager' in window)) return;

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('Push não permitido.');
      return;
    }

    const reg = await navigator.serviceWorker.register('./sw.js?t=' + Date.now());

    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BElExemploFakeTrocarDepois'
      });
    }

    const resp = await fetch('https://api.erpimpar.com.br/agape/push_subscribe.php?t=' + Date.now(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    });

    console.log('Push registrado:', await resp.text());

  } catch (e) {
    console.error('Erro push:', e);
  }
}

registrarPushAgape();