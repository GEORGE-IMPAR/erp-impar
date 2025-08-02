// Inicializar EmailJS
(function() {
  emailjs.init("WddODLBw11FUrjP-q"); // sua public key
})();

document.addEventListener("DOMContentLoaded", () => {
  const usuarioSelect = document.getElementById("usuario");
  const senhaInput = document.getElementById("senha");
  const toggleSenha = document.getElementById("toggleSenha");
  const loginForm = document.getElementById("loginForm");
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  // Função para detectar se estamos no login
  if (usuarioSelect && loginForm) {
    carregarUsuarios(usuarioSelect);

    // Mostrar/ocultar senha
    toggleSenha.addEventListener("click", () => {
      senhaInput.type = senhaInput.type === "password" ? "text" : "password";
    });

    // Login
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = usuarioSelect.value;
      const senha = senhaInput.value;

      try {
        const resp = await fetch("usuarios.json");
        const usuarios = await resp.json();

        const usuario = usuarios.find(
          u => u.Email.trim().toLowerCase() === email.trim().toLowerCase() && u.Senha === senha
        );

        if (usuario) {
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          Swal.fire({
            icon: "success",
            title: "Login realizado com sucesso!",
            showConfirmButton: false,
            timer: 2000
          });
          setTimeout(() => window.location.href = "solicitacao.html", 2000);
        } else {
          Swal.fire({
            icon: "error",
            title: "Email ou senha inválidos!",
            confirmButtonText: "Tentar novamente"
          });
        }
      } catch (err) {
        console.error("Erro ao validar login:", err);
        Swal.fire("Erro", "Falha ao carregar usuários!", "error");
      }
    });
  }

  // Se estiver na tela de solicitação
  if (solicitacaoForm) {
    const obraSelect = document.getElementById("obra");
    const centroCustoInput = document.getElementById("centroCusto");
    const materialSelect = document.getElementById("material");
    const quantidadeInput = document.getElementById("quantidade");
    const tabelaMateriais = document.querySelector("#tabelaMateriais tbody");
    const adicionarBtn = document.getElementById("adicionarMaterial");
    const localEntregaSelect = document.getElementById("localEntrega");

    let materiaisAdicionados = [];
    let sequencial = Date.now().toString().slice(-4);

    // Carregar dados do usuário logado
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Você precisa fazer login novamente!", "error").then(() => {
        window.location.href = "login.html";
      });
      return;
    }
    document.getElementById("user-info").innerText = 
      `${usuarioLogado.Nome} - ${usuarioLogado.Email}`;

    // Carregar obras vinculadas ao usuário
    fetch("obras.json")
      .then(r => r.json())
      .then(obras => {
        const obrasFiltradas = obras.filter(
          o => o.Email.trim().toLowerCase() === usuarioLogado.Email.trim().toLowerCase()
        );
        if (obrasFiltradas.length === 0) {
          Swal.fire("Atenção", "Você não tem obras associadas!", "warning")
            .then(() => window.location.href = "login.html");
        }
        obrasFiltradas.forEach(obra => {
          const opt = document.createElement("option");
          opt.value = obra.Obra;
          opt.textContent = obra.Obra;
          obraSelect.appendChild(opt);
        });

        obraSelect.addEventListener("change", () => {
          const selecionada = obrasFiltradas.find(o => o.Obra === obraSelect.value);
          centroCustoInput.value = selecionada ? selecionada["Centro de Custo"] : "";
        });
      })
      .catch(err => {
        console.error("Erro ao carregar obras:", err);
        Swal.fire("Erro", "Falha ao carregar obras!", "error");
      });

    // Carregar materiais
    fetch("materiais.json")
      .then(r => r.json())
      .then(materiais => {
        materiais.sort((a, b) => a.Material.localeCompare(b.Material));
        materiais.forEach(mat => {
          const opt = document.createElement("option");
          opt.value = mat.Material;
          opt.textContent = `${mat.Material} (${mat.UND})`;
          opt.dataset.und = mat.UND;
          materialSelect.appendChild(opt);
        });
      })
      .catch(err => {
        console.error("Erro ao carregar materiais:", err);
        Swal.fire("Erro", "Falha ao carregar materiais!", "error");
      });

    // Adicionar material na lista
    adicionarBtn.addEventListener("click", () => {
      const material = materialSelect.value;
      const und = materialSelect.selectedOptions[0]?.dataset.und || "";
      const quantidade = quantidadeInput.value;

      if (!material || !quantidade) {
        return; // não mostra alerta, só ignora
      }

      materiaisAdicionados.push({ material, und, quantidade });
      atualizarTabela();
      quantidadeInput.value = "";
      materialSelect.value = "";
    });

    function atualizarTabela() {
      tabelaMateriais.innerHTML = "";
      materiaisAdicionados.forEach((item, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.material}</td>
          <td>${item.und}</td>
          <td>${item.quantidade}</td>
          <td><span class="btn-remover" data-index="${index}">❌</span></td>
        `;
        tabelaMateriais.appendChild(row);
      });

      document.querySelectorAll(".btn-remover").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const idx = e.target.dataset.index;
          materiaisAdicionados.splice(idx, 1);
          atualizarTabela();
        });
      });
    }

    // Enviar solicitação
    solicitacaoForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const obra = obraSelect.value;
      const centroCusto = centroCustoInput.value;
      const prazo = document.getElementById("prazo").value;
      const localEntrega = localEntregaSelect.value;

      if (!obra || !centroCusto || !prazo || !localEntrega) {
        Swal.fire("Atenção", "Preencha todos os campos obrigatórios!", "warning");
        return;
      }

      if (materiaisAdicionados.length === 0) {
        Swal.fire("Atenção", "Adicione pelo menos um material!", "warning");
        return;
      }

      const params = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra,
        centro_custo: centroCusto,
        data: new Date().toLocaleDateString(),
        numero: sequencial,
        local_entrega: localEntrega,
        materiais: materiaisAdicionados.map(m => `${m.material} (${m.und}) - ${m.quantidade}`).join("\n")
      };

      console.log("📧 Enviando com parâmetros:", params);

      emailjs.send("service_fzht86y", "template_wz0ywdo", params)
        .then(() => {
          Swal.fire({
            icon: "success",
            title: "Solicitação enviada com sucesso!",
            showConfirmButton: false,
            timer: 2500
          });
          materiaisAdicionados = [];
          atualizarTabela();
          solicitacaoForm.reset();
        })
        .catch(err => {
          console.error("Erro EmailJS:", err);
          Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
        });
    });
  }
});

// Carregar usuários
function carregarUsuarios(selectElement) {
  fetch("usuarios.json")
    .then(r => r.json())
    .then(users => {
      users.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.Email;
        opt.textContent = u.Nome;
        selectElement.appendChild(opt);
      });
    })
    .catch(err => {
      console.error("Erro ao carregar usuários:", err);
      Swal.fire("Erro", "Falha ao carregar a lista de usuários!", "error");
    });
}
