console.log("📌 script_email.js carregado");

// Inicializar EmailJS
(function() {
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

    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Você precisa fazer login novamente!", "error").then(() => {
        window.location.href = "login.html";
      });
      return;
    }

    console.log("👤 Usuário logado recuperado:", usuarioLogado);

    const obra = document.getElementById("obra").value;
    const centroCusto = document.getElementById("centroCusto").value;
    const prazo = document.getElementById("prazo").value;
    const localEntrega = document.getElementById("localEntrega").value;

    const materiais = [];
    document.querySelectorAll("#tabelaMateriais tbody tr").forEach(row => {
      const cols = row.querySelectorAll("td");
      materiais.push({
        material: cols[0].innerText,
        quantidade: cols[2].innerText // coluna de quantidade
      });
    });

    console.log("📦 Materiais coletados:", materiais);

    if (!obra || !centroCusto || !prazo || !localEntrega || materiais.length === 0) {
      Swal.fire("Atenção", "Preencha todos os campos e adicione pelo menos um material!", "warning");
      return;
    }

    const templateParams = {
      nome: usuarioLogado.Nome,
      from_email: usuarioLogado.Email,
      obra: obra,
      centro_custo: centroCusto,
      data: prazo,
      local_entrega: localEntrega,
      materiais: materiais // array de objetos (como o template espera)
    };

    console.log("📧 Enviando com parâmetros:", templateParams);

    emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams)
      .then((response) => {
        console.log("✅ Email enviado:", response);
        Swal.fire({
          icon: "success",
          title: "Solicitação enviada com sucesso!",
          showConfirmButton: false,
          timer: 2500
        });
        solicitacaoForm.reset();
        document.querySelector("#tabelaMateriais tbody").innerHTML = "";
      })
      .catch((error) => {
        console.error("❌ Erro ao enviar email:", error);
        Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
      });
  });
});
