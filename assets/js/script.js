console.log("📌 Script carregado");

// Inicialização do EmailJS
document.addEventListener("DOMContentLoaded", () => {
  if (window.emailjs) {
    emailjs.init({ publicKey: "WddODLBw11FUrjP-q" });
    console.log("✅ EmailJS inicializado");
  } else {
    console.error("❌ EmailJS não carregado");
  }
});

// Lista de materiais adicionados
let listaMateriais = [];

// ---------------- LOGIN ----------------
document.addEventListener("DOMContentLoaded", () => {
  const usuarioSelect = document.getElementById("usuario");
  const senhaInput = document.getElementById("senha");
  const loginForm = document.getElementById("loginForm");

  if (usuarioSelect && loginForm) {
    console.log("🔑 Tela de login detectada");

    fetch("usuarios.json")
      .then((res) => res.json())
      .then((usuarios) => {
        usuarios.forEach((u) => {
          const opt = document.createElement("option");
          opt.value = u.Email;
          opt.textContent = u.Nome;
          usuarioSelect.appendChild(opt);
        });
      })
      .catch((err) => console.error("⚠️ Erro ao carregar usuários:", err));

    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const email = usuarioSelect.value;
      const senha = senhaInput.value.trim();

      fetch("usuarios.json")
        .then((res) => res.json())
        .then((usuarios) => {
          const usuario = usuarios.find(
            (u) =>
              u.Email.trim().toLowerCase() === email.trim().toLowerCase() &&
              u.Senha.trim() === senha
          );

          if (usuario) {
            localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
            Swal.fire("✅ Login com sucesso!", "", "success").then(() => {
              window.location.href = "solicitacao.html";
            });
          } else {
            Swal.fire("❌ Email ou senha inválidos", "", "error");
          }
        })
        .catch((err) => {
          console.error("Erro login:", err);
          Swal.fire("❌ Falha ao validar login", "", "error");
        });
    });
  }
});

// ---------------- SOLICITAÇÃO ----------------
document.addEventListener("DOMContentLoaded", () => {
  const usuarioInfo = document.getElementById("usuarioInfo");
  const obraSelect = document.getElementById("obra");
  const centroCustoInput = document.getElementById("centroCusto");
  const materialSelect = document.getElementById("material");
  const addMaterialBtn = document.getElementById("addMaterial");
  const tabelaMateriais = document
    .getElementById("tabelaMateriais")
    ?.querySelector("tbody");
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  if (obraSelect && solicitacaoForm) {
    console.log("📋 Tela de solicitação detectada");

    // Preenche info do usuário logado
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (usuarioLogado && usuarioInfo) {
      usuarioInfo.innerText = `${usuarioLogado.Nome} (${usuarioLogado.Email})`;
    }

    // Carrega obras do usuário logado
    fetch("obras.json")
      .then((res) => res.json())
      .then((obras) => {
        const obrasUsuario = obras.filter(
          (o) =>
            o.Email.trim().toLowerCase() ===
            usuarioLogado.Email.trim().toLowerCase()
        );

        if (obrasUsuario.length === 0) {
          Swal.fire(
            "⚠️ Nenhuma obra associada a este usuário!",
            "",
            "warning"
          ).then(() => {
            window.location.href = "login.html";
          });
        }

        obrasUsuario.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o.Obra;
          opt.textContent = o.Obra;
          opt.dataset.cc = o["Centro de Custo"];
          obraSelect.appendChild(opt);
        });

        obraSelect.addEventListener("change", () => {
          const selected = obrasUsuario.find(
            (o) => o.Obra === obraSelect.value
          );
          centroCustoInput.value = selected
            ? selected["Centro de Custo"]
            : "";
        });
      })
      .catch((err) => console.error("Erro ao carregar obras:", err));

    // Carrega materiais
    fetch("materiais.json")
      .then((res) => res.json())
      .then((materiais) => {
        materiais.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.Material;
          opt.textContent = m.Material;
          materialSelect.appendChild(opt);
        });
      })
      .catch((err) => console.error("Erro ao carregar materiais:", err));

    // Adicionar material
    if (addMaterialBtn && tabelaMateriais) {
      addMaterialBtn.addEventListener("click", () => {
        const material = materialSelect.value;
        const quantidade = document.getElementById("quantidade").value;

        if (!material || !quantidade) {
          Swal.fire("⚠️ Preencha material e quantidade!", "", "warning");
          return;
        }

        listaMateriais.push({ material, quantidade });

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${material}</td>
          <td>${quantidade}</td>
          <td><span class="btn-remover">❌</span></td>
        `;
        tabelaMateriais.appendChild(row);

        row.querySelector(".btn-remover").addEventListener("click", () => {
          tabelaMateriais.removeChild(row);
          listaMateriais = listaMateriais.filter((m) => m.material !== material);
        });
      });
    }

    // Enviar solicitação
    solicitacaoForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const obra = obraSelect.value;
      const centro_custo = centroCustoInput.value;
      const data = document.getElementById("data").value;
      const local_entrega = document.getElementById("localEntrega").value;

      if (!obra || !centro_custo || !data || !local_entrega) {
        Swal.fire("⚠️ Preencha todos os campos!", "", "warning");
        return;
      }

      const templateParams = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra,
        centro_custo,
        data,
        local_entrega,
        materiais: listaMateriais
          .map((m) => `${m.material} - ${m.quantidade}`)
          .join("\n"),
      };

      console.log("📧 Enviando com parâmetros:", templateParams);

      emailjs
        .send("service_fzht86y", "template_wz0ywdo", templateParams)
        .then(() => {
          Swal.fire("✅ Solicitação enviada com sucesso!", "", "success");
          listaMateriais = [];
          tabelaMateriais.innerHTML = "";
          solicitacaoForm.reset();
        })
        .catch((error) => {
          console.error("Erro EmailJS:", error);
          Swal.fire("❌ Falha ao enviar solicitação!", "", "error");
        });
    });
  }
});
