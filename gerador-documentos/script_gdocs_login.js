console.log("🔐 Login GDOCs carregado");

const usuarioSel = document.getElementById("usuario");
const senhaInput = document.getElementById("senha");
const entrarBtn = document.getElementById("entrar");

// Carrega usuários do módulo
fetch("./usuarios.json")
  .then(r => r.json())
  .then(users => {
    usuarioSel.innerHTML = '<option value="">Selecione um usuário…</option>';
    users.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.Email;
      opt.textContent = u.Nome;
      usuarioSel.appendChild(opt);
    });
  })
  .catch(() => {
    Swal.fire("Erro", "Falha ao carregar usuários.", "error");
  });

entrarBtn.addEventListener("click", async () => {
  const email = usuarioSel.value?.trim().toLowerCase();
  const senha = senhaInput.value;

  if(!email){ return Swal.fire("Atenção", "Selecione o usuário.", "warning"); }
  if(!senha){ return Swal.fire("Atenção", "Informe a senha.", "warning"); }

  try {
    const users = await (await fetch("./usuarios.json")).json();
    const ok = users.find(u => u.Email.trim().toLowerCase()===email && u.Senha===senha);
    if(!ok){
      return Swal.fire("Ops", "E-mail ou senha inválidos.", "error");
    }
    // guarda sessão isolada do gerador
    localStorage.setItem("gdocs_usuario", JSON.stringify(ok));
    location.href = "./gerador.html";
  } catch (e) {
    console.error(e);
    Swal.fire("Erro", "Não foi possível validar o login.", "error");
  }
});
