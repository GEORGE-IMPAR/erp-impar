async function apiRequest(endpoint, options = {}) {
  const url = `${window.PREDIO_CONFIG.API_BASE}/${endpoint.replace(/^\//, "")}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/json",
      ...(options.body instanceof FormData ? {} : {"Content-Type": "application/json"}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Falha na API (${response.status})`);
  }
  return data;
}
