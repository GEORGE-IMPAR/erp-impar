// Alternar visibilidade da senha
document.addEventListener("DOMContentLoaded", () => {
  const toggleSenha = document.getElementById("toggleSenha");
  if (toggleSenha) {
    toggleSenha.addEventListener("click", () => {
      const senhaInput = document.getElementById("senha");
      senhaInput.type = senhaInput.type === "password" ? "text" : "password";
    });
  }

  // Carregar usuários
  if (document.getElementById("usuario")) {
    fetch("usuarios.json")
      .then(res => res.json())
      .then(usuarios => {
        const select = document.getElementById("usuario");
        usuarios.forEach(u => {
          const option = document.createElement("option");
          option.value = u.Email;
          option.textContent = u.Email;
          select.appendChild(option);
        });
      })
      .catch(err => {
        console.error("Erro ao carregar usuários:", err);
        Swal.fire("Erro!", "Falha ao carregar a lista de usuários.", "error");
      });

    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("usuario").value;
      const senha = document.getElementById("senha").value;

      fetch("usuarios.json")
        .then(res => res.json())
        .then(usuarios => {
          const usuario = usuarios.find(u => u.Email === email && u.Senha === senha);
          if (usuario) {
            localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
            Swal.fire("Sucesso!", "Login realizado com sucesso!", "success")
              .then(() => window.location.href = "solicitacao.html");
          } else {
            Swal.fire("Erro!", "Usuário ou senha inválidos.", "error");
          }
        });
    });
  }

  // Solicitação
  if (document.getElementById("solicitacaoForm")) {
    if (typeof emailjs !== "undefined") {
      emailjs.init("WddODLBw11FUrjP-q");
    }

    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    const materiais = [];

    // Carregar obras do usuário
    fetch("obras.json")
      .then(res => res.json())
      .then(obras => {
        const obrasUsuario = obras.filter(o => o.Email.toLowerCase() === usuarioLogado.Email.toLowerCase());
        const selectObra = document.getElementById("obra");

        if (obrasUsuario.length === 0) {
          Swal.fire("Atenção!", "Nenhuma obra vinculada ao seu usuário.", "warning")
            .then(() => window.location.href = "login.html");
          return;
        }

        obrasUsuario.forEach(o => {
          const option = document.createElement("option");
          option.value = o.Nome;
          option.textContent = o.Nome;
          selectObra.appendChild(option);
        });

        selectObra.addEventListener("change", () => {
          const obraSel = obrasUsuario.find(o => o.Nome === selectObra.value);
          document.getElementById("centroCusto").value = obraSel ? obraSel.CentroCusto : "";
        });
      });

    // Carregar materiais
    fetch("materiais.json")
      .then(res => res.json())
      .then(mats => {
        const selectMat = document.getElementById("material");
        mats.sort((a, b) => a.Material.localeCompare(b.Material));
        mats.forEach(m => {
          const option = document.createElement("option");
          option.value = m.Material;
          option.textContent = m.Material;
          selectMat.appendChild(option);
        });
      });

    document.getElementById("adicionarMaterial").addEventListener("click", () => {
      const material = document.getElementById("material").value;
      const quantidade = document.getElementById("quantidade").value;

      if (!material || !quantidade) {
        Swal.fire("Atenção!", "Preencha material e quantidade.", "warning");
        return;
      }

      materiais.push({ nome: material, und: "Un", qtd: quantidade });
      renderTabela(materiais);
    });

    document.getElementById("solicitacaoForm").addEventListener("submit", (e) => {
      e.preventDefault();

      const params = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra: document.getElementById("obra").value,
        centro_custo: document.getElementById("centroCusto").value,
        local_entrega: document.getElementById("localEntrega").value,
        materiais: JSON.stringify(materiais),
        data: new Date().toLocaleDateString(),
        numero: Math.floor(Math.random() * 100000)
      };

      emailjs.send("service_fzht86y", "template_wz0ywdo", params)
        .then(() => Swal.fire("Sucesso!", "Solicitação enviada com sucesso!", "success"))
        .catch(err => {
          console.error("Erro EmailJS:", err);
          Swal.fire("Erro!", "Falha ao enviar solicitação.", "error");
        });
    });
  }
});

// Função para renderizar a tabela
function renderTabela(materiais) {
  const tbody = document.querySelector("#tabelaMateriais tbody");
  tbody.innerHTML = "";
  materiais.forEach((m, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${m.nome}</td>
      <td>${m.und}</td>
      <td>${m.qtd}</td>
      <td><span class="btn-remover" onclick="removerMaterial(${i})">❌</span></td>
    `;
    tbody.appendChild(row);
  });
}

function removerMaterial(index) {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  const materiais = [];
  materiais.splice(index, 1);
  renderTabela(materiais);
}
