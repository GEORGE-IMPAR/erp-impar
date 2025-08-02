// Inicialização EmailJS
(function() {
  emailjs.init("WddODLBw11FUrjP-q"); // sua public key
})();

document.addEventListener("DOMContentLoaded", async () => {
  const usuarioSelect = document.getElementById("usuario");
  const senhaInput = document.getElementById("senha");
  const toggleSenha = document.getElementById("toggleSenha");
  const loginForm = document.getElementById("loginForm");
  const obraSelect = document.getElementById("obra");
  const centroCustoInput = document.getElementById("centroCusto");
  const dataEntregaInput = document.getElementById("dataEntrega");
  const materialSelect = document.getElementById("material");
  const quantidadeInput = document.getElementById("quantidade");
  const adicionarBtn = document.getElementById("adicionarMaterial");
  const tabelaMateriais = document.getElementById("tabelaMateriais");
  const localEntregaSelect = document.getElementById("localEntrega");
  const formSolicitacao = document.getElementById("formSolicitacao");

  // Alternar visibilidade da senha
  if (toggleSenha) {
    toggleSenha.addEventListener("click", () => {
      senhaInput.type = senhaInput.type === "password" ? "text" : "password";
    });
  }

  // Carregar usuários
  if (usuarioSelect) {
    try {
      const resp = await fetch("usuarios.json");
      const usuarios = await resp.json();
      usuarios.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.Email;
        opt.textContent = u.Email;
        usuarioSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      Swal.fire("Erro", "Falha ao carregar a lista de usuários", "error");
    }
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = usuarioSelect.value.trim().toLowerCase();
      const senha = senhaInput.value.trim();

      try {
        const resp = await fetch("usuarios.json");
        const usuarios = await resp.json();
        const usuario = usuarios.find(
          u => u.Email.toLowerCase() === email && u.Senha === senha
        );

        if (!usuario) {
          Swal.fire("Erro", "Usuário ou senha inválidos!", "error");
          return;
        }

        localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
        Swal.fire("Sucesso", "Login realizado com sucesso!", "success").then(() => {
          window.location.href = "solicitacao.html";
        });
      } catch (err) {
        console.error("Erro login:", err);
        Swal.fire("Erro", "Falha ao validar login", "error");
      }
    });
  }

  // Preencher dados na solicitação
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (usuarioLogado && document.getElementById("usuarioNome")) {
    document.getElementById("usuarioNome").innerText = usuarioLogado.Nome;
    document.getElementById("usuarioEmail").innerText = usuarioLogado.Email;

    // Carregar obras vinculadas
    try {
      const resp = await fetch("obras.json");
      const obras = await resp.json();
      const obrasUsuario = obras.filter(
        o => o.Email.toLowerCase() === usuarioLogado.Email.toLowerCase()
      );

      if (obrasUsuario.length === 0) {
        Swal.fire("Atenção", "Nenhuma obra vinculada ao seu usuário!", "warning").then(() => {
          window.location.href = "login.html";
        });
        return;
      }

      obrasUsuario.forEach(o => {
        const opt = document.createElement("option");
        opt.value = o.Obra;
        opt.textContent = o.Obra;
        obraSelect.appendChild(opt);
      });

      obraSelect.addEventListener("change", () => {
        const obraSel = obrasUsuario.find(o => o.Obra === obraSelect.value);
        centroCustoInput.value = obraSel ? obraSel["Centro de Custo"] : "";
      });
    } catch (err) {
      console.error("Erro ao carregar obras:", err);
      Swal.fire("Erro", "Falha ao carregar as obras", "error");
    }

    // Carregar materiais
    try {
      const resp = await fetch("materiais.json");
      const materiais = await resp.json();
      materiais.sort((a, b) => a.Material.localeCompare(b.Material));
      materiais.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.Material;
        opt.textContent = m.Material;
        materialSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Erro ao carregar materiais:", err);
      Swal.fire("Erro", "Falha ao carregar os materiais", "error");
    }
  }

  // Adicionar materiais à lista
  if (adicionarBtn) {
    adicionarBtn.addEventListener("click", () => {
      const material = materialSelect.value;
      const quantidade = quantidadeInput.value;

      if (!material || !quantidade) {
        Swal.fire("Atenção", "Informe o material e a quantidade", "warning");
        return;
      }

      const row = tabelaMateriais.insertRow();
      row.insertCell(0).innerText = material;
      row.insertCell(1).innerText = quantidade;
      const removeCell = row.insertCell(2);
      removeCell.innerHTML = "❌";
      removeCell.style.cursor = "pointer";
      removeCell.addEventListener("click", () => tabelaMateriais.deleteRow(row.rowIndex));
    });
  }

  // Enviar solicitação por e-mail
  if (formSolicitacao) {
    formSolicitacao.addEventListener("submit", async (e) => {
      e.preventDefault();

      const obra = obraSelect.value;
      const centroCusto = centroCustoInput.value;
      const data = dataEntregaInput.value;
      const localEntrega = localEntregaSelect.value;

      if (!obra || !centroCusto || !data || !localEntrega) {
        Swal.fire("Atenção", "Preencha todos os campos obrigatórios!", "warning");
        return;
      }

      // Montar lista de materiais
      const materiais = [];
      for (let i = 0; i < tabelaMateriais.rows.length; i++) {
        const row = tabelaMateriais.rows[i];
        materiais.push({
          material: row.cells[0].innerText,
          quantidade: row.cells[1].innerText
        });
      }

      if (materiais.length === 0) {
        Swal.fire("Atenção", "Adicione pelo menos um material!", "warning");
        return;
      }

      const params = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra,
        centro_custo: centroCusto,
        data,
        local_entrega: localEntrega,
        materiais: JSON.stringify(materiais)
      };

      try {
        console.log("📧 Enviando com parâmetros:", params);
        const result = await emailjs.send("service_fzht86y", "template_wz0ywdo", params);
        console.log("✅ EmailJS enviado:", result);
        Swal.fire("Sucesso", "Solicitação enviada com sucesso!", "success");
      } catch (err) {
        console.error("Erro EmailJS:", err);
        Swal.fire("Erro", "Falha ao enviar a solicitação", "error");
      }
    });
  }
});
