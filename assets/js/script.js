// Inicializar EmailJS v3
(function() {
  emailjs.init({
    publicKey: "WddODLBw11FUrjP-q"
  });
})();

document.addEventListener("DOMContentLoaded", () => {
  const usuarioSelect = document.getElementById("usuario");
  const senhaInput = document.getElementById("senha");
  const toggleSenha = document.getElementById("toggleSenha");
  const loginForm = document.getElementById("loginForm");
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  // Login
  if (usuarioSelect && loginForm) {
    carregarUsuarios(usuarioSelect);

    toggleSenha.addEventListener("click", () => {
      senhaInput.type = senhaInput.type === "password" ? "text" : "password";
    });

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
          Swal.fire({ icon: "success", title: "Login realizado!", showConfirmButton: false, timer: 2000 });
          setTimeout(() => window.location.href = "solicitacao.html", 2000);
        } else {
          Swal.fire("Erro", "Email ou senha inválidos!", "error");
        }
      } catch (err) {
        console.error("Erro login:", err);
        Swal.fire("Erro", "Falha ao carregar usuários!", "error");
      }
    });
  }

  // Solicitação
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

    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Faça login novamente!", "error").then(() => window.location.href = "login.html");
      return;
    }
    document.getElementById("user-info").innerText =
      `${usuarioLogado.Nome} - ${usuarioLogado.Email}`;

    // Obras filtradas
    fetch("obras.json")
      .then(r => r.json())
      .then(obras => {
        const obrasFiltradas = obras.filter(
          o => o.Email.trim().toLowerCase() === usuarioLogado.Email.trim().toLowerCase()
        );
        if (obrasFiltradas.length === 0) {
          Swal.fire("Aviso", "Você não tem obras associadas!", "warning")
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
      .catch(err => Swal.fire("Erro", "Falha ao carregar obras!", "error"));

    // Materiais
    fetch("materiais.json")
      .then(r => r.json())
      .then(mats => {
        mats.sort((a, b) => a.Material.localeCompare(b.Material));
        mats.forEach(mat => {
          const opt = document.createElement("option");
          opt.value = mat.Material;
          opt.textContent = `${mat.Material} (${mat.UND})`;
          opt.dataset.und = mat.UND;
          materialSelect.appendChild(opt);
        });
      })
      .catch(err => Swal.fire("Erro", "Falha ao carregar materiais!", "error"));

    // Adicionar material
    adicionarBtn.addEventListener("click", () => {
      const material = materialSelect.value;
      const und = materialSelect.selectedOptions[0]?.dataset.und || "";
      const quantidade = quantidadeInput.value;
      if (!material || !quantidade) return;
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
        btn.addEventListener("click", e => {
          materiaisAdicionados.splice(e.target.dataset.index, 1);
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

      if (!obra || !centroCusto || !prazo || !localEntrega || materiaisAdicionados.length === 0) {
        Swal.fire("Aviso", "Preencha todos os campos e adicione pelo menos um material!", "warning");
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

      emailjs.send("service_fzht86y", "template_wz0ywdo", params)
        .then(() => {
          Swal.fire({ icon: "success", title: "Solicitação enviada!", showConfirmButton: false, timer: 2500 });
          materiaisAdicionados = [];
          atualizarTabela();
          solicitacaoForm.reset();
        })
        .catch(err => {
          console.error("Erro EmailJS:", err);
          Swal.fire("Erro", "Falha ao enviar solicitação!", "error");
        });
    });
  }
});

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
    .catch(err => Swal.fire("Erro", "Falha ao carregar usuários!", "error"));
}
