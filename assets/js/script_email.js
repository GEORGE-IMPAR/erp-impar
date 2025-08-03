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

    // Recuperar usuário logado
    let usuarioLogado = null;
    try {
      usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
      console.log("👤 Usuário logado recuperado:", usuarioLogado);
    } catch (err) {
      console.error("❌ Erro ao ler usuário logado:", err);
    }

    if (!usuarioLogado || !usuarioLogado.Nome || !usuarioLogado.Email) {
      Swal.fire("Erro", "Você precisa fazer login novamente!", "error")
        .then(() => window.location.href = "login.html");
      return;
    }

    // Coletar dados do formulário
    const obra = document.getElementById("obra")?.value || "";
    const centroCusto = document.getElementById("centroCusto")?.value || "";
    const prazo = document.getElementById("prazo")?.value || new Date().toLocaleDateString();
    const localEntrega = document.getElementById("localEntrega")?.value || "";

    console.log("📌 Dados coletados do formulário:", { obra, centroCusto, prazo, localEntrega });

    // Coletar materiais
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

    console.log("📦 Materiais coletados:", materiais);

    if (!obra || !centroCusto || !prazo || !localEntrega) {
      Swal.fire("⚠️", "Preencha todos os campos obrigatórios!", "warning");
      return;
    }

    if (materiais.length === 0) {
      Swal.fire("⚠️", "Adicione pelo menos um material!", "warning");
      return;
    }

    const params = {
      nome: usuarioLogado.Nome,
      from_email: usuarioLogado.Email,
      obra,
      centro_custo: centroCusto,
      data: prazo,
      local_entrega: localEntrega,
      materiais: materiais
    };

    console.log("📧 Enviando com parâmetros:", params);

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
        console.error("❌ Erro EmailJS:", err);
        Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
      });
  });
});
