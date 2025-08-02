// Checa se emailjs existe antes de inicializar
try {
  if (typeof emailjs !== "undefined") {
    emailjs.init("WddODLBw11FUrjP-q"); // sua public key
  } else {
    console.warn("⚠️ EmailJS não está carregado. O envio de emails pode falhar.");
  }
} catch (err) {
  console.error("Erro ao inicializar EmailJS:", err);
}

// Função para alertas padronizados
function showAlert(title, text, icon = "info") {
  if (typeof Swal !== "undefined") {
    Swal.fire({ title, text, icon, confirmButtonText: "OK" });
  } else {
    alert(`${title}\n${text}`);
  }
}

const BASE_URL = "https://george-impar.github.io/erp-impar/";

// ================== LOGIN ==================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value.trim();

    fetch(BASE_URL + "usuarios.json")
      .then(r => r.json())
      .then(usuarios => {
        const usuario = usuarios.find(
          u => u.Email.trim().toLowerCase() === email.toLowerCase() &&
               u.Senha.trim() === senha
        );

        if (usuario) {
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          showAlert("Login realizado!", `Bem-vindo, ${usuario.Nome}!`, "success")
            .then(() => window.location.href = "solicitacao.html");
        } else {
          showAlert("Erro", "Usuário ou senha incorretos.", "error");
        }
      })
      .catch(err => {
        console.error("Erro ao carregar usuarios.json:", err);
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
  const tabelaMateriais = document
    .getElementById("tabelaMateriais")
    .querySelector("tbody");
  const listaMateriais = [];

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) {
    showAlert("Atenção", "Você precisa fazer login novamente.", "warning")
      .then(() => (window.location.href = "login.html"));
  } else {
    // Carregar obras do usuário logado
    fetch(BASE_URL + "obras.json")
      .then(r => r.json())
      .then(obras => {
        const obrasUsuario = obras.filter(o => o.Email.trim().toLowerCase() === usuarioLogado.Email.toLowerCase());

        if (obrasUsuario.length === 0) {
          showAlert("Sem obras", "Nenhuma obra associada ao seu usuário.", "info")
            .then(() => (window.location.href = "login.html"));
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
        console.error("Erro ao carregar obras:", err);
        showAlert("Erro", "Falha ao carregar obras.", "error");
      });

    // Carregar materiais
    fetch(BASE_URL + "materiais.json")
      .then(r => r.json())
      .then(materiais => {
        materiais
          .sort((a, b) => a.Material.localeCompare(b.Material))
          .forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.Material;
            opt.textContent = `${m.Material} (${m.UND})`;
            materialSelect.appendChild(opt);
          });
      })
      .catch(err => {
        console.error("Erro ao carregar materiais:", err);
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

      console.log("📧 Tentando enviar EmailJS com:", templateParams);

      if (typeof emailjs !== "undefined") {
        emailjs
          .send("service_fzht86y", "template_wz0ywdo", templateParams)
          .then(() => {
            showAlert("Sucesso!", "Solicitação enviada com sucesso!", "success");
          })
          .catch(error => {
            console.error("Erro EmailJS:", error);
            showAlert("Erro", "Falha ao enviar solicitação. Verifique os dados.", "error");
          });
      } else {
        showAlert("Erro", "EmailJS não carregado. Verifique configuração.", "error");
      }
    });
  }
}
