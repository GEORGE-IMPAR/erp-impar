'use strict';

function $(sel, ctx) { return (ctx || document).querySelector(sel); }
function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

function ensureOverlay() {
  let o = $('#cj_overlay_busy');
  if (o) return o;
  o = el('div');
  o.id = 'cj_overlay_busy';
  o.setAttribute('style', [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,.6)', 'backdrop-filter: blur(2px)',
    'display:none', 'align-items:center', 'justify-content:center', 'z-index:99999'
  ].join(';'));
  const box = el('div');
  box.setAttribute('style', [
    'min-width:260px', 'padding:22px 26px', 'border:2px solid #fff', 'border-radius:14px',
    'color:#fff', 'font:600 15px/1.2 system-ui,Segoe UI,Roboto,Arial',
    'background:rgba(0,0,0,.85)', 'box-shadow:0 10px 30px rgba(0,0,0,.5)',
    'display:flex', 'gap:12px', 'align-items:center', 'justify-content:center'
  ].join(';'));
  const spinner = el('div', 'cj-spin');
  spinner.setAttribute('style', [
    'width:22px', 'height:22px', 'border:3px solid #fff', 'border-top-color:transparent',
    'border-radius:50%', 'animation:cj_spin 0.8s linear infinite'
  ].join(';'));
  const msg = el('div');
  msg.textContent = 'Processando... aguarde';
  box.appendChild(spinner);
  box.appendChild(msg);
  o.appendChild(box);
  const css = document.createElement('style');
  css.id = 'cj_spin_css';
  css.textContent = '@keyframes cj_spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(css);
  document.body.appendChild(o);
  return o;
}

function showBusy() { ensureOverlay().style.display = 'flex'; }
function hideBusy() {
  const o = $('#cj_overlay_busy');
  if (o) o.style.display = 'none';
}

function makeContract(code) {
  if (!code) {
    alert('Código não informado.');
    return;
  }
  const url = 'https://api.erpimpar.com.br/gerador/make_contract.php?codigo=' + encodeURIComponent(code);
  showBusy();
  return fetch(url, { cache: 'no-store' })
    .then(r => r.text())
    .then(txt => {
      let j = null;
      try { j = JSON.parse(txt); } catch (e) { }
      if (!j || !j.ok || !j.url) {
        console.warn('Resposta inesperada:', txt);
        alert((j && j.msg) ? j.msg : 'Falha ao gerar o contrato.');
        return;
      }
      const w = window.open(j.url, '_blank');
      if (!w || w.closed || typeof w.closed === 'undefined') {
        window.location.href = j.url;
      }
    })
    .catch(() => alert('Erro de rede ao gerar o contrato.'))
    .finally(hideBusy);
}

function bindDefaultButton() {
  const btn = $('#cj_btn_gerar');
  if (!btn) return;
  if (btn.__bound_make_contract__) return;
  btn.__bound_make_contract__ = true;
  btn.addEventListener('click', function (ev) {
    ev.preventDefault();
    const code = (this.getAttribute('data-code') || '').trim();
    makeContract(code);
  });
}

window.__CJ_MAKE_CONTRACT__ = makeContract;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindDefaultButton, { once: true });
} else {
  bindDefaultButton();
}

// === Patch para botões dentro do modal ===
(function () {
  const btnPdf = document.getElementById('btnActionPdf');
  const btnUpdate = document.getElementById('btnActionUpdate');
  const actDocCode = document.getElementById('actDocCode');

  if (btnPdf) {
    btnPdf.addEventListener('click', function () {
      const codigo = (actDocCode?.textContent || '').trim();
      if (!codigo) {
        alert('Código do documento não encontrado.');
        return;
      }

      console.log('[Gerar Contrato] Código:', codigo);
      if (typeof window.__CJ_MAKE_CONTRACT__ === 'function') {
        window.__CJ_MAKE_CONTRACT__(codigo);
      } else {
        alert('Função de geração de contrato não disponível.');
      }
    });
  }

  if (btnUpdate) {
    btnUpdate.addEventListener('click', function () {
      const codigo = (actDocCode?.textContent || '').trim();
      if (!codigo) {
        alert('Código do documento não encontrado.');
        return;
      }

      console.log('[Atualizar Documento] Código:', codigo);
      if (typeof window.atualizarDocumento === 'function') {
        window.atualizarDocumento(codigo);
      } else {
        alert('Função de atualização não disponível.');
      }
    });
  }
})();
