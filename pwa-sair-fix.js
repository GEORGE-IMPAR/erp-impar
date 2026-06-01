/*
  ERP ÍMPAR - correção para botão SAIR em qualquer tela/menu.
  Uso no botão existente:
    <button onclick="sairERPImpar()">Sair</button>
*/
async function limparMemoriaERPImpar(){
  try { localStorage.removeItem("ERPIMPAR_USER"); } catch(e) {}
  try { sessionStorage.removeItem("ERPIMPAR_USER"); } catch(e) {}
  try { localStorage.setItem("ERPIMPAR_LOGOUT_TS", String(Date.now())); } catch(e) {}
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => String(k).toLowerCase().includes("erp-impar")).map(k => caches.delete(k)));
    } catch(e) {}
  }
}
async function sairERPImpar(){
  await limparMemoriaERPImpar();
  try { history.replaceState(null, "", "/index.html?logout=1&t=" + Date.now()); } catch(e) {}
  window.location.replace("/index.html?logout=1&t=" + Date.now());
}
