// Inicialização do EmailJS
(function() {
  emailjs.init("WddODLBw11FUrjP-q"); // sua Public Key
})();

document.addEventListener("DOMContentLoaded", async () => {
  const usuarioSelect = document.getElementById("usuario");
  const senhaInput = document.getElementById("senha");
  const toggleSenha = document.getElementById("toggleSenha");
  const loginForm = document.getElementById("loginForm");

  // Exibir/Ocultar senha
  if (toggleSenha) {
    toggleSenha.addEventListener("click", () => {
      senhaInput.type = senhaInput.type === "password" ? "text" : "password";
    });
  }

  // Carregar usuários no login
  if (usuarioSelect) {
    try {
      const response = await fetch("usuarios.json");
      const usuarios = await response.json();

      usuarios.forEach(user => {
        const option = document.createElement("option");
        option.value = user.Email;
        option.textContent = user.Email;
        usuarioSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      Swal.fire("Erro", "Falha ao carregar a lista de usuários.", "error");
    }
  }

  // Validação do Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = usuarioSelect.value.trim().toLowerCase();
      const senha = senhaInput.value.trim();

      try {
        const response = await fetch("usuarios.json");
        const usuarios = await response.json();

        const usuario = usuarios.find(u => 
          u.Email.trim().toLowerCase() === email && u.Senha.trim() === senha
        );

        if (usuario) {
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          Swal.fire({
            icon: "success",
            title: "Login realizado com sucesso!",
            showConfirmButton: false,
            timer: 2000
          }).then(() => {
            window.location.href = "solicitacao.html";
          });
        } else {
          Swal.fire("Erro", "Usuário ou senha inválidos.", "error");
        }
      } catch (error) {
        console.error("Erro ao validar login:", error);
        Swal.fire("Erro", "Falha ao validar login.", "error");
      }
    });
  }

  // Página de Solicitação
  const obraSelect = document.getElementById("obra");
  const centroCustoInput = document.getElementById("centroCusto");
  const materialSelect = document.getElementById("material");
  const quantidadeInput = document.getElementById("quantidade");
  const undSelect = document.getElementById("und");
  const localEntregaSelect = document.getElementById("localEntrega");
  const tabelaMateriais = document.querySelector("#tabelaMateriais tbody");
  const addMaterialBtn = document.getElementById("addMaterial");
  const enviarSolicitacaoBtn = document.getElementById("enviarSolicitacao");

  if (obraSelect && centroCustoInput) {
    try {
      const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
      const obrasResp = await fetch("obras.json");
      const obras = await obrasResp.json();

      const obrasUsuario = obras.filter(o => 
        o.Email.trim().toLowerCase() === usuarioLogado.Email.trim().toLowerCase()
      );

      if (obrasUsuario.length === 0) {
        Swal.fire("Atenção", "Nenhuma obra associada ao seu usuário.", "warning")
          .then(() => {
            localStorage.removeItem("usuarioLogado");
            window.location.href = "login.html";
          });
      } else {
        obrasUsuario.forEach(o => {
          const option = document.createElement("option");
          option.value = o.Obra;
          option.textContent = o.Obra;
          obraSelect.appendChild(option);
        });

        obraSelect.addEventListener("change", () => {
          const obraSelecionada = obrasUsuario.find(o => o.Obra === obraSelect.value);
          centroCustoInput.value = obraSelecionada ? obraSelecionada["Centro de Custo"] : "";
          centroCustoInput.readOnly = true;
          centroCustoInput.style.backgroundColor = "#e0e0e0";
        });
      }
    } catch (error) {
      console.error("Erro ao carregar obras:", error);
      Swal.fire("Erro", "Falha ao carregar as obras.", "error");
    }
  }

  // Carregar materiais
  if (materialSelect) {
    try {
      const matResp = await fetch("materiais.json");
      const materiais = await matResp.json();

      materiais.sort((a, b) => a.Material.localeCompare(b.Material));

      materiais.forEach(m => {
        const option = document.createElement("option");
        option.value = m.Material;
        option.textContent = m.Material;
        materialSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar materiais:", error);
      Swal.fire("Erro", "Falha ao carregar materiais.", "error");
    }
  }

  // Adicionar material à tabela
  if (addMaterialBtn && tabelaMateriais) {
    addMaterialBtn.addEventListener("click", () => {
      const material = materialSelect.value;
      const quantidade = quantidadeInput.value;
      const und = undSelect.value;

      if (!material || !quantidade || !und) {
        Swal.fire("Atenção", "Preencha todos os campos para adicionar um material.", "warning");
        return;
      }

      const row = tabelaMateriais.insertRow();
      row.insertCell(0).textContent = material;
      row.insertCell(1).textContent = quantidade;
      row.insertCell(2).textContent = und;

      const cellAcao = row.insertCell(3);
      const removerBtn = document.createElement("span");
      removerBtn.textContent = "❌";
      removerBtn.classList.add("btn-remover");
      removerBtn.addEventListener("click", () => row.remove());
      cellAcao.appendChild(removerBtn);

      quantidadeInput.value = "";
      undSelect.value = "";
    });
  }

  // Enviar solicitação por EmailJS
  if (enviarSolicitacaoBtn) {
    enviarSolicitacaoBtn.addEventListener("click", async () => {
      const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
      const obra = obraSelect.value;
      const centroCusto = centroCustoInput.value;
      const localEntrega = localEntregaSelect.value;
      const data = new Date().toLocaleDateString("pt-BR");

      if (!obra || !centroCusto || !localEntrega || tabelaMateriais.rows.length === 0) {
        Swal.fire("Erro", "Preencha todos os campos e adicione ao menos 1 material.", "error");
        return;
      }

      let materiaisLista = "";
      for (let row of tabelaMateriais.rows) {
        materiaisLista += `${row.cells[0].textContent} - ${row.cells[1].textContent} ${row.cells[2].textContent}\n`;
      }

      const params = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra,
        centro_custo: centroCusto,
        data,
        materiais: materiaisLista,
      };

      try {
        console.log("📧 Enviando com parâmetros:", params);
        await emailjs.send("service_fzht86y", "template_wz0ywdo", params);
        Swal.fire("Sucesso!", "E-mail com a solicitação enviado com sucesso!", "success");
      } catch (error) {
        console.error("Erro EmailJS:", error);
        Swal.fire("Erro", "Falha ao enviar o e-mail da solicitação.", "error");
      }
    });
  }
});
