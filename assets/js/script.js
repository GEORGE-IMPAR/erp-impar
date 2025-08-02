// Inicialização EmailJS
if (typeof emailjs !== "undefined") {
  emailjs.init("WddODLBw11FUrjP-q");
} else {
  console.warn("⚠️ EmailJS não carregado. O envio de emails pode falhar.");
}

// ===================== LOGIN =====================
document.addEventListener("DOMContentLoaded", () => {
  const usuarioSelect = document.getElementById("usuario");
  const loginForm = document.getElementById("loginForm");

  if (usuarioSelect && loginForm) {
    fetch("usuarios.json")
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar usuários");
        return res.json();
      })
      .then((usuarios) => {
        usuarios.forEach((user) => {
          const opt = document.createElement("option");
          opt.value = user.Email;
          opt.textContent = user.Name;
          usuarioSelect.appendChild(opt);
        });
      })
      .catch((err) => {
        console.error("Erro ao carregar usuários:", err);
        Swal.fire("Erro", "Falha ao carregar a lista de usuários.", "error");
      });

    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = usuarioSelect.value;
      const senha = document.getElementById("senha").value;

      fetch("usuarios.json")
        .then((res) => res.json())
        .then((usuarios) => {
          const user = usuarios.find(
            (u) => u.Email === email && u.Senha === senha
          );
          if (user) {
            localStorage.setItem("usuarioNome", user.Name);
            localStorage.setItem("usuarioEmail", user.Email);
            Swal.fire("Sucesso!", "Login realizado com sucesso!", "success").then(
              () => {
                window.location.href = "solicitacao.html";
              }
            );
          } else {
            Swal.fire("Erro", "Usuário ou senha inválidos!", "error");
          }
        })
        .catch((err) => {
          console.error("Erro login:", err);
          Swal.fire("Erro", "Falha ao validar login.", "error");
        });
    });
  }

  // ===================== SOLICITAÇÃO =====================
  const obraSelect = document.getElementById("obra");
  const materialSelect = document.getElementById("material");
  const tabelaBody = document.querySelector("#tabelaMateriais tbody");
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  if (obraSelect && materialSelect && tabelaBody && solicitacaoForm) {
    // Preencher nome e email do usuário logado
    document.getElementById("nomeSolicitante").innerText =
      localStorage.getItem("usuarioNome") || "Não identificado";
    document.getElementById("emailSolicitante").innerText =
      localStorage.getItem("usuarioEmail") || "Não identificado";

    // Carregar obras filtradas pelo email do usuário
    fetch("obras.json")
      .then((res) => res.json())
      .then((obras) => {
        const userEmail = localStorage.getItem("usuarioEmail");
        const obrasFiltradas = obras.filter((o) => o.Email === userEmail);

        if (obrasFiltradas.length === 0) {
          Swal.fire("Aviso", "Nenhuma obra associada ao seu usuário.", "warning").then(
            () => (window.location.href = "login.html")
          );
          return;
        }

        obrasFiltradas.forEach((obra) => {
          const opt = document.createElement("option");
          opt.value = obra.Obra;
          opt.textContent = obra.Obra;
          opt.dataset.centro = obra["Centro de Custo"];
          obraSelect.appendChild(opt);
        });

        obraSelect.addEventListener("change", () => {
          const selected = obraSelect.options[obraSelect.selectedIndex];
          document.getElementById("centroCusto").value =
            selected.dataset.centro || "";
        });
      })
      .catch((err) => console.error("Erro ao carregar obras:", err));

    // Carregar materiais
    fetch("materiais.json")
      .then((res) => res.json())
      .then((materiais) => {
        materiais.forEach((mat) => {
          const opt = document.createElement("option");
          opt.value = mat.Material;
          opt.textContent = `${mat.Material} (${mat.UND})`;
          opt.dataset.und = mat.UND;
          materialSelect.appendChild(opt);
        });
      })
      .catch((err) => console.error("Erro ao carregar materiais:", err));

    // Adicionar material à tabela
    document
      .getElementById("adicionarMaterial")
      .addEventListener("click", () => {
        const material = materialSelect.value;
        const quantidade = document.getElementById("quantidade").value;
        const selectedMat =
          materialSelect.options[materialSelect.selectedIndex];
        const und = selectedMat ? selectedMat.dataset.und : "";

        if (!material || !quantidade) {
          Swal.fire("Erro", "Selecione um material e informe a quantidade.", "error");
          return;
        }

        const row = tabelaBody.insertRow();
        row.innerHTML = `
          <td>${material}</td>
          <td>${und}</td>
          <td>${quantidade}</td>
          <td><span class="btn-remover">❌</span></td>
        `;

        row.querySelector(".btn-remover").addEventListener("click", () => {
          row.remove();
        });

        document.getElementById("quantidade").value = "";
      });

    // Enviar solicitação
    solicitacaoForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const materiais = [];
      tabelaBody.querySelectorAll("tr").forEach((row) => {
        const cols = row.querySelectorAll("td");
        materiais.push({
          material: cols[0].innerText,
          und: cols[1].innerText,
          quantidade: cols[2].innerText,
        });
      });

      if (materiais.length === 0) {
        Swal.fire("Erro", "Adicione ao menos um material.", "error");
        return;
      }

      const params = {
        nome: localStorage.getItem("usuarioNome"),
        from_email: localStorage.getItem("usuarioEmail"),
        obra: obraSelect.value,
        centro_custo: document.getElementById("centroCusto").value,
        data: document.getElementById("dataEntrega").value,
        materiais: JSON.stringify(materiais, null, 2),
      };

      console.log("📧 Enviando com parâmetros:", params);

      emailjs
        .send("service_fzht86y", "template_wz0ywdo", params)
        .then(() => {
          Swal.fire("Sucesso!", "Solicitação enviada com sucesso!", "success");
        })
        .catch((err) => {
          console.error("Erro EmailJS:", err);
          Swal.fire("Erro", "Falha ao enviar a solicitação.", "error");
        });
    });
  }
});
