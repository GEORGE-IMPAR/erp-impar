(() => {
  'use strict';
  const form = document.getElementById('loginForm');
  const notice = document.getElementById('login-aviso');
  const submit = form.querySelector('[type="submit"]');
  const password = document.getElementById('senha');
  let busy = false;
  function show(message) { notice.textContent = message; notice.hidden = false; }
  function goHome() { location.replace(new URL('menu-shell.html', location.href).href); }
  // Mesmo controle MOSTRAR/OCULTAR da tela fornecida.
  const parent = password.parentElement;
  parent.style.position = 'relative'; password.style.paddingRight = '104px';
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'login-ver-senha'; toggle.textContent = 'MOSTRAR';
  toggle.setAttribute('aria-label', 'Mostrar a senha digitada'); toggle.setAttribute('aria-pressed', 'false');
  function position() { const r = password.getBoundingClientRect(), p = parent.getBoundingClientRect(); toggle.style.top = (r.top - p.top + r.height / 2 - toggle.offsetHeight / 2) + 'px'; }
  toggle.addEventListener('click', () => { const visible = password.type === 'password'; password.type = visible ? 'text' : 'password'; toggle.textContent = visible ? 'OCULTAR' : 'MOSTRAR'; toggle.setAttribute('aria-pressed', String(visible)); toggle.setAttribute('aria-label', visible ? 'Ocultar a senha digitada' : 'Mostrar a senha digitada'); password.focus(); });
  parent.append(toggle); position(); addEventListener('resize', position); document.fonts.ready.then(position);
  const recovery = document.getElementById('recuperacao');
  const recoveryForm = document.getElementById('form-recuperacao');
  let recoveryStage = 'request', recoveryBusy = false;
  document.getElementById('recuperar-senha').addEventListener('click', e => {
    e.preventDefault(); recoveryForm.reset(); recoveryStage = 'request';
    document.getElementById('rec-email').value = document.getElementById('email').value.trim();
    document.getElementById('rec-email').readOnly = false;
    document.getElementById('rec-campos').hidden = true;
    document.getElementById('rec-code').required = false; document.getElementById('rec-password').required = false;
    document.getElementById('rec-aviso').hidden = true; document.getElementById('rec-enviar').textContent = 'Enviar código';
    recovery.showModal();
  });
  document.getElementById('rec-cancelar').addEventListener('click', () => recovery.close());
  recoveryForm.addEventListener('submit', async e => {
    e.preventDefault(); if (recoveryBusy || !recoveryForm.reportValidity()) return;
    const button = document.getElementById('rec-enviar'), note = document.getElementById('rec-aviso');
    const email = document.getElementById('rec-email').value.trim().toLowerCase();
    recoveryBusy = true; button.disabled = true;
    try {
      if (recoveryStage === 'request') {
        const result = await window.ERP_SAAS.call('password_recovery_request', { email });
        note.textContent = result.message; note.hidden = false; recoveryStage = 'reset';
        document.getElementById('rec-email').readOnly = true;
        document.getElementById('rec-campos').hidden = false;
        document.getElementById('rec-code').required = true; document.getElementById('rec-password').required = true;
        button.textContent = 'Redefinir senha'; document.getElementById('rec-code').focus();
      } else {
        const result = await window.ERP_SAAS.call('password_recovery_reset', { email, code: document.getElementById('rec-code').value.trim(), password: document.getElementById('rec-password').value });
        recoveryForm.reset(); recovery.close(); document.getElementById('email').value = email; show(result.message); password.focus();
      }
    } catch (err) { note.textContent = err.message; note.hidden = false; }
    finally { recoveryBusy = false; button.disabled = false; }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (busy || !form.reportValidity()) return;
    busy = true; submit.disabled = true; const label = submit.innerHTML; submit.textContent = 'Entrando…'; notice.hidden = true;
    try {
      const email = document.getElementById('email').value.trim().toLowerCase();
      await window.ERP_SAAS.call('login', { email, password: password.value });
      password.value = ''; goHome();
    } catch (err) { show(err.message); }
    finally { busy = false; submit.disabled = false; submit.innerHTML = label; }
  });
  window.ERP_SAAS.session().then(s => { if (s.authenticated) goHome(); }).catch(e => show(e.message));
})();
