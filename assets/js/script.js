// ✅ Logs iniciais para confirmar carregamento
console.log("🚀 script.js carregado com sucesso");

// Função utilitária para exibir alertas bonitos
function showAlert(title, text, icon = "info") {
  Swal.fire({
    title: title,
    text: text,
    icon: icon,
    confirmButtonText: "OK",
    backdrop: true
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Carregar usuários no login
  const selectUsuario = document.getElementById("usuario");
  if (selectUsuario) {
    console.log("🔍 Carregando usuarios.json...");
    fetch("usuarios.json")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(usuarios => {
        console.log("✅ Usuários carregados:", usuarios);
        usuarios.forEach(u => {
          const option = document.createElement("option");
          option.value = u.Email;
          option.textContent = u.Nome;
          selectUsuario.appendChild(option);
        });
      })
      .catch(err => {
        console.error("❌ Erro ao carregar usuarios.json:", err);
        showAlert("Erro", "Falha ao carregar a lista de usuários.", "error");
      });
  }

  // Carregar obras
  const selectObra = document.getElementById("obra");
  const centroCusto = document.getElementById("centroCusto");
  if (selectObra && centroCusto) {
    console.log("🔍 Carregando obras.json...");
    fetch("obras.json")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(obras => {
        console.log("✅ Obras carregadas:", obras);
        obras.forEach(o => {
          const option = document.createElement("option");
          option.value = o.Obra;
          option.textContent = o.Obra;
          option.dataset.centroCusto = o["Centro de Custo"];
          option.dataset.email = o.Email;
          selectObra.appendChild(option);
        });

        // Atualizar centro de custo ao escolher obra
        selectObra.addEventListener("change", () => {
          const selected = selectObra.selectedOptions[0];
          if (selected) {
            centroCusto.value = selected.dataset.centroCusto || "";
          }
        });
      })
      .catch(err => {
        console.error("❌ Erro ao carregar obras.json:", err);
        showAlert("Erro", "Falha ao carregar a lista de obras.", "error");
      });
  }

  // Controle do olho da senha
  const toggleSenha = document.getElementById("toggleSenha");
  if (toggleSenha) {
    toggleSenha.addEventListener("click", () => {
      const senhaInput = document.getElementById("senha");
      if (senhaInput) {
        senhaInput.type = senhaInput.type === "password" ? "text" : "password";
      }
    });
  }

  // Envio da solicitação
  const formSolicitacao = document.getElementById("formSolicitacao");
  if (formSolicitacao) {
    formSolicitacao.addEventListener("submit", (e) => {
      e.preventDefault();

      const nome = JSON.parse(localStorage.getItem("usuarioLogado"))?.Nome;
      const from_email = JSON.parse(localStorage.getItem("usuarioLogado"))?.Email;
      const obra = selectObra?.value || "";
      const centro = centroCusto?.value || "";
      const localEntrega = document.getElementById("localEntrega")?.value || "";
      const materiais = [];

      document.querySelectorAll("#tabelaMateriais tbody tr").forEach(row => {
        materiais.push({
          material: row.cells[0].textContent,
          unidade: row.cells[1].textContent,
          quantidade: row.cells[2].textContent
        });
      });

      if (!obra || !centro || materiais.length === 0 || !localEntrega) {
        showAlert("Atenção", "Preencha todos os campos antes de enviar.", "warning");
        return;
      }

      const params = {
        nome,
        from_email,
        obra,
        numero: centro,
        data: new Date().toLocaleDateString("pt-BR"),
        materiais: JSON.stringify(materiais),
        local_entrega: localEntrega
      };

      console.log("📧 Enviando com parâmetros:", params);

      emailjs.send("service_fzht86y", "template_wz0ywdo", params)
        .then(() => {
          showAlert("Sucesso", "Solicitação enviada com sucesso!", "success");
        })
        .catch((err) => {
          console.error("❌ Erro EmailJS:", err);
          showAlert("Erro", "Falha ao enviar a solicitação. Verifique os logs.", "error");
        });
    });
  }
});
