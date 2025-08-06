console.log("📌 script_email.js carregado");

// Inicializar EmailJS
(function () {
  emailjs.init("WddODLBw11FUrjP-q"); // sua public key
  console.log("✅ EmailJS inicializado");
})();

document.addEventListener("DOMContentLoaded", () => {
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  if (!solicitacaoForm) {
    console.warn("⚠️ Formulário de solicitação não encontrado");
    return;
  }

  solicitacaoForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // 🔹 Recuperar usuário logado
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    console.log("👤 Usuário logado recuperado:", usuarioLogado);

    if (!usuarioLogado) {
      Swal.fire("Erro", "Sessão expirada. Faça login novamente.", "error").then(
        () => (window.location.href = "login.html")
      );
      return;
    }

    // 🔹 Coletar dados do formulário
    const obra = document.getElementById("obra")?.value || "";
    const centroCusto = document.getElementById("centroCusto")?.value || "";
    const prazo = document.getElementById("prazo")?.value || "";
    const localEntrega = document.getElementById("localEntrega")?.value || "";

    console.log("📌 Dados coletados do formulário:", {
      obra,
      centroCusto,
      prazo,
      localEntrega,
    });

    if (!obra || !centroCusto || !prazo || !localEntrega) {
      Swal.fire("Atenção", "Preencha todos os campos obrigatórios!", "warning");
      return;
    }

    // 🔹 Coletar materiais
    let materiais = []; // <<< sempre recria a lista
    document.querySelectorAll("#tabelaMateriais tbody tr").forEach((row) => {
      const cols = row.querySelectorAll("td");
      materiais.push({
        material: cols[0]?.innerText || "",
        quantidade: cols[2]?.innerText || "",
      });
    });

    if (materiais.length === 0) {
      Swal.fire("Atenção", "Adicione pelo menos um material!", "warning");
      return;
    }

    console.log("📦 Materiais coletados:", materiais);

    // 🔹 Parâmetros para EmailJS
    const params = {
      nome: usuarioLogado.Nome,
      from_email: usuarioLogado.Email,
      obra,
      centro_custo: centroCusto,
      data: prazo,
      local_entrega: localEntrega,
      materiais: JSON.stringify(materiais), // agora sempre serializado
    };

    console.log("📧 Enviando com parâmetros:", params);

    // 🔹 Desabilitar botão enquanto envia
    const botaoEnviar = solicitacaoForm.querySelector("button[type=submit]");
    if (botaoEnviar) botaoEnviar.disabled = true;

    // 🔹 Enviar email
    emailjs
      .send("service_fzht86y", "template_wz0ywdo", params)
      .then((response) => {
        console.log("✅ Email enviado:", response);

        Swal.fire({
          icon: "success",
          title: "Solicitação enviada com sucesso!",
          showConfirmButton: false,
          timer: 2500,
        });

        // 🧹 Resetar tabela e materiais
        document.querySelector("#tabelaMateriais tbody").innerHTML = "";
        materiais = []; // <<< limpa o array
        console.log("🧹 Lista e tabela de materiais resetadas.");

        solicitacaoForm.reset();
      })
      .catch((err) => {
        console.error("Erro EmailJS:", err);
        Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
      })
      .finally(() => {
        if (botaoEnviar) botaoEnviar.disabled = false;
      });
  });
});
