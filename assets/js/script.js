document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("loginForm");
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  // === LOGIN ===
  if (loginForm) {
    const toggleSenha = document.getElementById("toggleSenha");
    const senhaInput = document.getElementById("senha");

    if (toggleSenha && senhaInput) {
      toggleSenha.addEventListener("click", () => {
        senhaInput.type = senhaInput.type === "password" ? "text" : "password";
        toggleSenha.textContent = senhaInput.type === "password" ? "👁️" : "🙈";
      });
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim().toLowerCase();
      const senha = senhaInput.value.trim();

      try {
        console.log("🔍 Carregando usuarios.json...");
        const response = await fetch("usuarios.json");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const usuarios = await response.json();

        const usuario = usuarios.find(
          (u) =>
            u.Email.trim().toLowerCase() === email &&
            u.Senha.trim() === senha
        );

        if (usuario) {
          console.log("✅ Usuário encontrado:", usuario.Email);
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          Swal.fire("Sucesso", "Login realizado com sucesso!", "success").then(
            () => (window.location.href = "solicitacao.html")
          );
        } else {
          Swal.fire("Erro", "Email ou senha inválidos.", "error");
        }
      } catch (error) {
        console.error("❌ Erro ao carregar usuários:", error);
        Swal.fire("Erro", "Falha ao validar login.", "error");
      }
    });
  }

  // === SOLICITAÇÃO ===
  if (solicitacaoForm) {
    console.log("📦 Página de solicitação carregada.");
    const obraSelect = document.getElementById("obra");
    const centroCustoInput = document.getElementById("centroCusto");
    const materialSelect = document.getElementById("material");
    const quantidadeInput = document.getElementById("quantidade");
    const adicionarBtn = document.getElementById("adicionarMaterial");
    const tabelaBody = document.querySelector("#tabelaMateriais tbody");
    const localEntregaSelect = document.getElementById("localEntrega");

    let usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado")) || null;

    if (!usuarioLogado) {
      Swal.fire("Erro", "Faça login novamente.", "error").then(() => {
        window.location.href = "login.html";
      });
      return;
    }

    // Carregar obras
    try {
      console.log("🔍 Carregando obras.json...");
      const obrasResp = await fetch("obras.json");
      if (!obrasResp.ok) throw new Error(`HTTP ${obrasResp.status}`);
      const obras = await obrasResp.json();
      const obrasUsuario = obras.filter(
        (o) =>
          o.Email.trim().toLowerCase() ===
          usuarioLogado.Email.trim().toLowerCase()
      );

      if (obrasUsuario.length === 0) {
        Swal.fire("Aviso", "Nenhuma obra associada ao seu usuário.", "warning").then(
          () => (window.location.href = "login.html")
        );
        return;
      }

      obrasUsuario.forEach((obra) => {
        const opt = document.createElement("option");
        opt.value = obra.Obra;
        opt.textContent = obra.Obra;
        obraSelect.appendChild(opt);
      });

      obraSelect.addEventListener("change", () => {
        const obraSel = obrasUsuario.find((o) => o.Obra === obraSelect.value);
        centroCustoInput.value = obraSel ? obraSel["Centro de Custo"] : "";
      });
    } catch (err) {
      console.error("❌ Erro ao carregar obras:", err);
      Swal.fire("Erro", "Falha ao carregar obras.", "error");
    }

    // Carregar materiais
    try {
      console.log("🔍 Carregando materiais.json...");
      const materiaisResp = await fetch("materiais.json");
      if (!materiaisResp.ok) throw new Error(`HTTP ${materiaisResp.status}`);
      const materiais = await materiaisResp.json();
      materiais.sort((a, b) => a.Material.localeCompare(b.Material));
      materiais.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.Material;
        opt.textContent = `${m.Material} (${m.UND})`;
        opt.dataset.und = m.UND;
        materialSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("❌ Erro ao carregar materiais:", err);
      Swal.fire("Erro", "Falha ao carregar materiais.", "error");
    }

    // Adicionar material
    adicionarBtn?.addEventListener("click", () => {
      if (!materialSelect.value || !quantidadeInput.value) {
        Swal.fire("Erro", "Selecione um material e informe a quantidade.", "error");
        return;
      }

      const und = materialSelect.selectedOptions[0].dataset.und;
      const row = tabelaBody.insertRow();
      row.insertCell(0).textContent = materialSelect.value;
      row.insertCell(1).textContent = und;
      row.insertCell(2).textContent = quantidadeInput.value;

      const cellAcao = row.insertCell(3);
      const btnRemover = document.createElement("span");
      btnRemover.textContent = "❌";
      btnRemover.classList.add("btn-remover");
      btnRemover.addEventListener("click", () => row.remove());
      cellAcao.appendChild(btnRemover);

      materialSelect.value = "";
      quantidadeInput.value = "";
    });
  }
});
