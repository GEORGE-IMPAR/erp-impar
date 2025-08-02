// Inicialização do EmailJS
(function() {
  emailjs.init("WddODLBw11FUrjP-q"); // ✅ sua Public Key
})();

// ================== LOGIN ==================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    fetch("usuarios.json")
      .then(r => r.json())
      .then(usuarios => {
        const usuario = usuarios.find(u => u.Email === email && u.Senha === senha);

        if (usuario) {
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          Swal.fire({
            title: "Login realizado!",
            text: `Bem-vindo, ${usuario.Nome}!`,
            icon: "success",
            confirmButtonText: "Continuar"
          }).then(() => {
            window.location.href = "solicitacao.html";
          });
        } else {
          Swal.fire("Erro no login", "Usuário ou senha incorretos!", "error");
        }
      })
      .catch(err => {
        console.error("Erro ao carregar usuarios.json:", err);
        Swal.fire("Erro", "Não foi possível validar o login.", "error");
      });
  });
}

// ================== SOLICITAÇÃO ==================
const solicitacaoForm = document.getElementById("solicitacaoForm");
if (solicitacaoForm) {
  const obraSelect = document.getElementById("obra");
  const centroCustoInput = document.getElementById("centroCusto");
  const materialSelect = document.getElementById("material");
  const tabelaMateriais = document.getElementById("tabelaMateriais").querySelector("tbody");
  const listaMateriais = [];

  // Preencher obras filtradas pelo usuário logado
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) {
    Swal.fire("Atenção", "Você precisa fazer login novamente.", "warning").then(() => {
      window.location.href = "login.html";
    });
  } else {
    fetch("obras.json")
      .then(r => r.json())
      .then(obras => {
        const obrasUsuario = obras.filter(o => o.Email === usuarioLogado.Email);

        if (obrasUsuario.length === 0) {
          Swal.fire("Sem obras", "Nenhuma obra associada ao seu usuário.", "info").then(() => {
            window.location.href = "login.html";
          });
          return;
        }

        obrasUsuario.forEach(o => {
          const opt = document.createElement("option");
          opt.value = o.Obra;
          opt.textContent = `${o.Obra} (${o["Centro de Custo"]})`;
          obraSelect.appendChild(opt);
        });

        // Preencher centro de custo ao selecionar obra
        obraSelect.addEventListener("change", () => {
          const obraSelecionada = obrasUsuario.find(o => o.Obra === obraSelect.value);
          centroCustoInput.value = obraSelecionada ? obraSelecionada["Centro de Custo"] : "";
        });
      })
      .catch(err => {
        console.error("Erro ao carregar obras:", err);
        Swal.fire("Erro", "Não foi possível carregar as obras.", "error");
      });

    // Preencher materiais
    fetch("materiais.json")
      .then(r => r.json())
      .then(materiais => {
        materiais.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m.Material;
          opt.textContent = `${m.Material} (${m.UND})`;
          materialSelect.appendChild(opt);
        });
      })
      .catch(err => {
        console.error("Erro ao carregar materiais:", err);
        Swal.fire("Erro", "Não foi possível carregar os materiais.", "error");
      });

    // Adicionar material à tabela
    document.getElementById("adicionarMaterial").addEventListener("click", () => {
      const material = materialSelect.value;
      const quantidade = document.getElementById("quantidade").value;

      if (!material || !quantidade) {
        Swal.fire("Erro", "Selecione um material e informe a quantidade.", "error");
        return;
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${material}</td>
        <td>Un</td>
        <td>${quantidade}</td>
        <td><span class="btn-remover">❌</span></td>
      `;
      tabelaMateriais.appendChild(row);

      listaMateriais.push({ material, quantidade });

      row.querySelector(".btn-remover").addEventListener("click", () => {
        tabelaMateriais.removeChild(row);
      });

      document.getElementById("quantidade").value = "";
    });

    // Enviar solicitação
    solicitacaoForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const obra = obraSelect.value;
      const centroCusto = centroCustoInput.value;
      const prazo = document.getElementById("prazo").value;
      const localEntrega = document.getElementById("localEntrega").value;

      if (!obra || !centroCusto || !prazo || !localEntrega) {
        Swal.fire("Erro", "Preencha todos os campos obrigatórios.", "error");
        return;
      }

      const templateParams = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra,
        data: prazo,
        numero: centroCusto,
        localEntrega,
        materiais: listaMateriais.length > 0
          ? listaMateriais.map(m => `${m.material} - ${m.quantidade}`).join("\n")
          : "Nenhum material adicionado"
      };

      console.log("📧 Enviando:", templateParams);

      emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams)
        .then(() => {
          Swal.fire("Sucesso!", "Solicitação enviada com sucesso!", "success");
        })
        .catch((error) => {
          console.error("Erro EmailJS:", error);
          Swal.fire("Erro", "Não foi possível enviar a solicitação.", "error");
        });
    });
  }
}
