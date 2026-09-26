(() => {
  'use strict';
  let csrf = null;
  let sessionPromise = null;
  const cfg = window.ERP_SAAS_CONFIG;
  class AccessError extends Error {
    constructor(message, status, http = 0) { super(message); this.status = status; this.http = http; }
  }
  async function request(method, payload) {
    if (location.protocol === 'file:') throw new AccessError('Abra esta tela por um endereço HTTP/HTTPS, não por duplo clique.', 'FILE_PROTOCOL');
    const url = new URL(cfg.apiUrl, location.href);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new AccessError('O serviço de acesso deve usar HTTPS.', 'HTTPS_REQUIRED');
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), cfg.timeoutMs);
    try {
      const headers = { Accept: 'application/json' };
      if (method === 'POST') { headers['Content-Type'] = 'application/json'; headers['X-ERP-CSRF'] = csrf || ''; }
      const res = await fetch(url.href, { method, headers, credentials: 'include', cache: 'no-store', redirect: 'error', signal: abort.signal, ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}) });
      let data;
      try { data = await res.json(); } catch (_) { throw new AccessError('O servidor não retornou o formato esperado. Confira a instalação do serviço.', 'RESPONSE_INVALID', res.status); }
      if (typeof data.csrf === 'string') csrf = data.csrf;
      if (!res.ok || data.ok !== true) throw new AccessError(data.error || 'Não foi possível concluir a operação.', data.status || 'REQUEST_FAILED', res.status);
      return data;
    } catch (e) {
      if (e instanceof AccessError) throw e;
      if (e.name === 'AbortError') throw new AccessError('O servidor demorou para responder. Confira a conexão e tente novamente.', 'TIMEOUT');
      throw new AccessError('Não foi possível conectar ao serviço. Confira a conexão e a origem de homologação autorizada.', 'NETWORK');
    } finally { clearTimeout(timer); }
  }
  function session() {
    if (!sessionPromise) sessionPromise = request('GET').finally(() => { sessionPromise = null; });
    return sessionPromise;
  }
  async function call(action, fields = {}) {
    if (!csrf) await session();
    return request('POST', { ...fields, action });
  }
  window.ERP_SAAS = Object.freeze({ session, call, AccessError });
})();
