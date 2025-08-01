document.addEventListener('DOMContentLoaded', async () => {
  const usuarioSelect = document.getElementById('usuario');

  try {
    console.debug("🔄 Iniciando carregamento do usuarios.json...");

    // Agora busca do MESMO DOMÍNIO
    const response = await fetch('usuarios.json');
    console.debug("📡 Resposta recebida:", response);

    if (!response.ok) throw new Error('Erro HTTP: ' + response.status);

    const usuarios = await response.json();
    console.debug("✅ Usuários carregados:", usuarios);

    usuarios.forEach(user => {
      const option = document.createElement('option');
      option.value = user.Email.trim().toLowerCase();
      option.textContent = user.Email;
      usuarioSelect.appendChild(option);
    });

    console.debug("📋 Combo preenchido com usuários");

    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      console.debug("➡️ Tentando login...");

      const email = usuarioSelect.value;
      const senha = document.getElementById('senha').value;

      console.debug("📧 Email digitado:", email);
      console.debug("🔑 Senha digitada:", senha);

      const usuarioValido = usuarios.find(u =>
        u.Email.trim().toLowerCase() === email &&
        u.Senha.trim() === senha
      );

      if (usuarioValido) {
        console.debug("✅ Login bem-sucedido:", usuarioValido);
        localStorage.setItem('usuarioLogado', JSON.stringify(usuarioValido));
        window.location.href = 'solicitacao.html';
      } else {
        console.warn("❌ Falha no login: usuário ou senha incorretos");
        alert('Usuário ou senha inválidos.');
      }
    });
  } catch (error) {
    console.error("🚨 Erro ao carregar usuários:", error);
    alert('Falha ao carregar a lista de usuários.');
  }
});

// Toggle da senha
document.getElementById('toggleSenha').addEventListener('click', () => {
  const senhaInput = document.getElementById('senha');
  senhaInput.type = senhaInput.type === 'password' ? 'text' : 'password';
  console.debug("👁️ Toggle senha:", senhaInput.type);
});
