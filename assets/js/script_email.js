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

    // Recuperar usuário logado
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Sessão expirada. Faça login novamente!", "error").then(
        () => (window.location.href = "login.html")
      );
      return;
    }
    console.log("👤 Usuário logado recuperado:", usuarioLogado);

    // Dados do formulário
    const obra = document.getElementById("obra").value;
    const centroCusto = document.getElementById("centroCusto").value;
    const prazo = document.getElementById("prazo").value;
    const localEntrega = document.getElementById("localEntrega").value;

    console.log("📌 Dados coletados do formulário:", {
      obra,
      centroCusto,
      prazo,
      localEntrega,
    });

    // Materiais
    const materiais = [];
    document.querySelectorAll("#tabelaMateriais tbody tr").forEach((row) => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 3) {
        materiais.push({
          material: cols[0].innerText,
          quantidade: cols[2].innerText,
        });
      }
    });

    if (!obra || !centroCusto || !prazo || !localEntrega || materiais.length === 0) {
      Swal.fire("Atenção", "Preencha todos os campos e adicione materiais!", "warning");
      return;
    }

    console.log("📦 Materiais coletados:", materiais);

    // Montar parâmetros para EmailJS
    const templateParams = {
      nome: usuarioLogado.Nome || "Não informado",
      from_email: usuarioLogado.Email || "Não informado",
      obra: obra,
      centro_custo: centroCusto,
      data: prazo || "Não informado",
      local_entrega: localEntrega,
      materiais: materiais,
    };

    console.log("📧 Enviando com parâmetros:", templateParams);

    // Enviar email
    emailjs
      .send("service_fzht86y", "template_wz0ywdo", templateParams)
      .then((response) => {
        console.log("✅ Email enviado:", response);
        Swal.fire({
          icon: "success",
          title: "Solicitação enviada com sucesso!",
          showConfirmButton: false,
          timer: 2500,
        });

        // 🔑 Resetar lista e formulário após envio
        document.querySelector("#tabelaMateriais tbody").innerHTML = "";
        solicitacaoForm.reset();
        localStorage.removeItem("materiaisAdicionados"); // opcional: limpar também cache, se existir
      })
      .catch((error) => {
        console.error("Erro EmailJS:", error);
        Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
      });
  });
});
