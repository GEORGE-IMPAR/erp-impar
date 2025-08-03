document.addEventListener("DOMContentLoaded", () => {
  console.log("📌 script_email.js carregado");

  // Inicializar EmailJS
  if (window.emailjs) {
    emailjs.init("WddODLBw11FUrjP-q"); // sua public key
    console.log("✅ EmailJS inicializado");
  } else {
    console.error("❌ EmailJS não carregado");
    return;
  }

  const solicitacaoForm = document.getElementById("solicitacaoForm");
  if (!solicitacaoForm) {
    console.warn("⚠️ Formulário de solicitação não encontrado");
    return;
  }

  solicitacaoForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // 🔹 Recuperar usuário logado
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Você precisa fazer login novamente!", "error")
        .then(() => window.location.href = "login.html");
      return;
    }

    // 🔹 Coletar dados do formulário
    const obra = document.getElementById("obra").value;
    const centroCusto = document.getElementById("centroCusto").value;
    const prazo = document.getElementById("prazo").value;
    const localEntrega = document.getElementById("localEntrega").value;

    // 🔹 Coletar materiais da tabela
    const materiais = [];
    document.querySelectorAll("#tabelaMateriais tbody tr").forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 3) {
        materiais.push({
          material: cols[0].innerText,
          quantidade: cols[2].innerText
        });
      }
    });

    if (!obra || !centroCusto || !prazo || !localEntrega) {
      Swal.fire("⚠️", "Preencha todos os campos obrigatórios!", "warning");
      return;
    }

    if (materiais.length === 0) {
      Swal.fire("⚠️", "Adicione pelo menos um material!", "warning");
      return;
    }

    // 🔹 Montar parâmetros para EmailJS
    const params = {
      nome: usuarioLogado.Nome,
      from_email: usuarioLogado.Email,
      obra,
      centro_custo: centroCusto,
      data: prazo || new Date().toLocaleDateString(),
      local_entrega: localEntrega,
      materiais
    };

    console.log("📧 Enviando com parâmetros:", params);

    // 🔹 Enviar pelo EmailJS
    emailjs.send("service_fzht86y", "template_wz0ywdo", params)
      .then(() => {
        Swal.fire({
          icon: "success",
          title: "Solicitação enviada com sucesso!",
          showConfirmButton: false,
          timer: 2500
        });
        solicitacaoForm.reset();
        document.querySelector("#tabelaMateriais tbody").innerHTML = "";
      })
      .catch(err => {
        console.error("Erro EmailJS:", err);
        Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
      });
  });
});
