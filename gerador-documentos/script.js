// /gerador-documentos/script.js
document.addEventListener('DOMContentLoaded', async () => {
  // Se existir #usuario, estamos no login
  const selUser = document.getElementById('usuario');
  const senha = document.getElementById('senha');
  const btnEntrar = document.getElementById('btnEntrar');
  const toggleSenha = document.getElementById('toggleSenha');

  const userChip = document.getElementById('userChip');

  // Preencher lista de usuários (apenas no login)
  if (selUser && btnEntrar) {
    try {
      const resp = await fetch('usuarios.json', { cache: 'no-store' });
      const users = await resp.json();
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.Email;
        opt.textContent = u.Nome;
        selUser.appendChild(opt);
      });
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
      alert('Falha ao carregar usuários do módulo.');
    }

    toggleSenha?.addEventListener('click', () => {
      senha.type = senha.type === 'password' ? 'text' : 'password';
    });

    btnEntrar.addEventListener('click', async () => {
      const email = selUser.value?.trim();
      const pass = senha.value;

      if (!email) return alert('Selecione um usuário.');
      if (!pass) return alert('Informe sua senha.');

      try {
        const resp = await fetch('usuarios.json', { cache: 'no-store' });
        const users = await resp.json();
        const ok = users.find(u => u.Email.toLowerCase() === email.toLowerCase() && u.Senha === pass);
        if (!ok) {
          alert('E-mail ou senha inválidos.');
          return;
        }
        localStorage.setItem('GD_usuario', JSON.stringify(ok));
        location.href = 'contratos.html';
      } catch (e) {
        console.error(e);
        alert('Falha ao validar usuário.');
      }
    });
  }

  // Se existir userChip, estamos na tela principal -> validar sessão
  if (userChip) {
    const u = JSON.parse(localStorage.getItem('GD_usuario') || 'null');
    if (!u) {
      location.href = 'login.html';
      return;
    }
    userChip.textContent = `${u.Nome} — ${u.Email}`;
  }
});
