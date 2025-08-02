// Inicialização EmailJS
(function() {
  emailjs.init("WddODLBw11FUrjP-q"); // ✅ Public Key
})();

function showAlert(title, text, icon = "info") {
  Swal.fire({ title, text, icon, confirmButtonText: "OK" });
}

// Caminho base absoluto para JSONs no GitHub Pages
const BASE_URL = "https://george-impar.github.io/erp-impar/";

// ================== LOGIN ==================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    fetch(BASE_URL + "usuarios.json")
      .then(r => {
        if (!r.ok) throw new Error(`Erro HTTP ${r.status}`);
        return r.json();
      })
      .then(usuarios => {
        console.log("✅ Usuários carregados:", usuarios);

        const usuario = usuarios.find(u => u.Email === email && u.Senha === senha);

        if (usuario) {
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          Swal.fire({
            title: "Login realizado!",
            text: `Bem-vindo, ${usuario.Nome}!`,
            icon: "success"
          }).then(() => window.location.href = "solicitacao.html");
        } else {
          showAlert("Erro no login", "Usuário ou senha incorretos!", "error");
        }
      })
      .catch(err => {
        console.error("❌ Erro ao carregar usuarios.json:", err);
        showAlert("Erro", "Falha ao carregar lista de usuários.", "error");
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

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) {
    Swal.fire("Atenção", "Você precisa fazer login novamente.", "warning")
      .then(() => window.location.href = "login.html");
  } else {
    // Obras filtradas pelo usuário logado
    fetch(BASE_URL + "obras.json")
      .then(r => r.json())
      .then(obras => {
        console.log("✅ Obras carregadas:", obras);
        const obrasUsuario = obras.filter(o => o.Email === usuarioLogado.Email);

        if (obrasUsuario.length === 0) {
          Swal.fire("Sem obras", "Nenhuma obra associada ao seu usuário.", "info")
            .then(() => window.location.href = "login.html");
          return;
        }

        obrasUsuario.forEach(o => {
          const opt = document.createElement("option");
          opt.value = o.Obra;
          opt.textContent = o.Obra;
          opt.dataset.centroCusto = o["Centro de Custo"];
          obraSelect.appendChild(opt);
        });

        obraSelect.addEventListener("change", () => {
          const selected = obrasUsuario.find(o => o.Obra === obraSelect.value);
          centroCustoInput.value = selected ? selected["Centro de Custo"] : "";
        });
      })
      .catch(err => {
        console.error("❌ Erro ao carregar obras:", err);
        showAlert("Erro", "Falha ao carregar obras.", "error");
      });

    // Materiais
    fetch(BASE_URL + "materiais.json")
      .then(r => r.json())
      .then(materiais => {
        console.log("✅ Materiais carregados:", materiais);
        materiais.sort((a, b) => a.Material.localeCompare(b.Material));
        materiais.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m.Material;
          opt.textContent = `${m.Material} (${m.UND})`;
          materialSelect.appendChild(opt);
        });
      })
      .catch(err => {
        console.error("❌ Erro ao carregar materiais:", err);
        showAlert("Erro", "Falha ao carregar materiais.", "error");
      });

    // Adicionar material
    document.getElementById("adicionarMaterial").addEventListener("click", () => {
      const material = materialSelect.value;
      const quantidade = document.getElementById("quantidade").value;

      if (!material || !quantidade) {
        showAlert("Erro", "Selecione material e quantidade.", "error");
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
        showAlert("Erro", "Preencha todos os campos obrigatórios.", "error");
        return;
      }

      const templateParams = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra,
        data: prazo,
        numero: centroCusto,
        localEntrega,
        materiais: listaMateriais.length > 0 ? listaMateriais : []
      };

      console.log("📧 Enviando EmailJS com params:", templateParams);

      emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams)
        .then(() => {
          Swal.fire("Sucesso!", "Solicitação enviada com sucesso!", "success");
        })
        .catch((error) => {
          console.error("Erro EmailJS:", error);
          showAlert("Erro", "Falha ao enviar solicitação. Verifique logs.", "error");
        });
    });
  }
}
