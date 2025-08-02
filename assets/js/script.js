document.addEventListener("DOMContentLoaded", async () => {
  console.log("📌 Script carregado");

  const usuarioSelect = document.getElementById("usuario");
  const senhaInput = document.getElementById("senha");
  const loginForm = document.getElementById("loginForm");

  // Função de carregar usuários
  async function carregarUsuarios() {
    try {
      const response = await fetch("usuarios.json");
      if (!response.ok) throw new Error("Erro ao buscar usuarios.json");
      const usuarios = await response.json();

      usuarios.forEach(usuario => {
        const option = document.createElement("option");
        option.text = usuario.Nome;   // Nome com N maiúsculo
        option.value = usuario.Email; // Email com E maiúsculo
        usuarioSelect.appendChild(option);
      });

      console.log("✅ Usuários carregados:", usuarios);
    } catch (erro) {
      console.error("❌ Erro ao carregar usuários:", erro);
    }
  }

  // Executa carregamento inicial dos usuários
  if (usuarioSelect) {
    await carregarUsuarios();
  }

  // Evento de login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailSelecionado = usuarioSelect.value.trim();
      const senhaDigitada = senhaInput.value.trim();

      try {
        const response = await fetch("usuarios.json");
        if (!response.ok) throw new Error("Erro ao buscar usuarios.json");
        const usuarios = await response.json();

        const usuario = usuarios.find(
          u => u.Email.trim().toLowerCase() === emailSelecionado.toLowerCase() && 
               u.Senha.trim() === senhaDigitada
        );

        if (usuario) {
          console.log("✅ Login bem-sucedido:", usuario);

          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));

          // Mostra popup de sucesso
          Swal.fire({
            icon: "success",
            title: "Login realizado com sucesso!",
            showConfirmButton: false,
            timer: 2000
          });

          setTimeout(() => {
            window.location.href = "solicitacao.html";
          }, 2000);

        } else {
          Swal.fire({
            icon: "error",
            title: "Falha no login",
            text: "Email ou senha incorretos."
          });
        }
      } catch (erro) {
        console.error("❌ Erro ao validar login:", erro);
        Swal.fire({
          icon: "error",
          title: "Erro no sistema",
          text: "Não foi possível validar o login."
        });
      }
    });
  }

  // Solicitação de materiais
  const obraSelect = document.getElementById("obra");
  const centroCustoInput = document.getElementById("centroCusto");
  const materialSelect = document.getElementById("material");
  const adicionarBtn = document.getElementById("adicionar");
  const tabelaMateriais = document.getElementById("tabelaMateriais");
  const enviarBtn = document.getElementById("enviarSolicitacao");

  // Carregar obras vinculadas ao usuário
  async function carregarObras(usuarioEmail) {
    try {
      const response = await fetch("obras.json");
      if (!response.ok) throw new Error("Erro ao buscar obras.json");
      const obras = await response.json();

      const obrasUsuario = obras.filter(
        o => o.Email.trim().toLowerCase() === usuarioEmail.toLowerCase()
      );

      if (obrasUsuario.length === 0) {
        Swal.fire({
          icon: "error",
          title: "Sem obras vinculadas",
          text: "Este usuário não possui obras associadas."
        }).then(() => {
          window.location.href = "login.html";
        });
        return;
      }

      obrasUsuario.forEach(obra => {
        const option = document.createElement("option");
        option.text = obra.Obra;
        option.value = obra.CentroDeCusto;
        obraSelect.appendChild(option);
      });

      obraSelect.addEventListener("change", () => {
        const centro = obraSelect.value;
        centroCustoInput.value = centro;
      });

      console.log("✅ Obras carregadas:", obrasUsuario);
    } catch (erro) {
      console.error("❌ Erro ao carregar obras:", erro);
    }
  }

  // Carregar materiais
  async function carregarMateriais() {
    try {
      const response = await fetch("materiais.json");
      if (!response.ok) throw new Error("Erro ao buscar materiais.json");
      const materiais = await response.json();

      materiais.sort((a, b) => a.Material.localeCompare(b.Material));

      materiais.forEach(mat => {
        const option = document.createElement("option");
        option.text = mat.Material;
        option.value = mat.Material;
        materialSelect.appendChild(option);
      });

      console.log("✅ Materiais carregados:", materiais);
    } catch (erro) {
      console.error("❌ Erro ao carregar materiais:", erro);
    }
  }

  // Se estiver na tela de solicitação
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (usuarioLogado && obraSelect && materialSelect) {
    document.getElementById("usuarioLogado").innerText = usuarioLogado.Nome;
    document.getElementById("emailLogado").innerText = usuarioLogado.Email;

    await carregarObras(usuarioLogado.Email);
    await carregarMateriais();
  }
});
