// Carrega emails do mesmo usuarios.json da aplicação principal (na raiz)
const $ = (sel, root=document) => root.querySelector(sel);

document.addEventListener('DOMContentLoaded', async () => {
  const select = $('#gdUsuario');
  const senha  = $('#gdSenha');
  const eye    = $('#gdEye');
  const form   = $('#gdLoginForm');

  // Mostrar / ocultar senha
  eye.addEventListener('click', () => {
    senha.type = senha.type === 'password' ? 'text' : 'password';
  });

  // Carregar usuários
  try{
    const resp = await fetch('../usuarios.json', {cache:'no-store'});
    const lista = await resp.json();
    lista.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.Email;
      opt.textContent = u.Nome;
      select.appendChild(opt);
    });
  }catch(err){
    console.error('Falha ao carregar usuários:', err);
    Swal.fire('Erro', 'Não foi possível carregar a lista de usuários.', 'error');
  }

  // Login
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = select.value.trim().toLowerCase();
    const pass  = senha.value.trim();

    if(!email || !pass){
      Swal.fire('Atenção','Preencha usuário e senha.','warning');
      return;
    }

    try{
      const resp = await fetch('../usuarios.json', {cache:'no-store'});
      const users = await resp.json();
      const ok = users.find(u => u.Email.trim().toLowerCase() === email && u.Senha === pass);

      if(!ok){
        Swal.fire('Ops','Email ou senha inválidos.','error');
        return;
      }
      // Guarda um contexto separado para o gerador (não interfere no outro módulo)
      localStorage.setItem('gdUsuarioLogado', JSON.stringify(ok));
      // Vai para o app do gerador
      location.href = 'app.html';
    }catch(e2){
      console.error(e2);
      Swal.fire('Erro','Falha ao validar credenciais.','error');
    }
  });
});
