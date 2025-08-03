document.addEventListener("DOMContentLoaded", () => {
  console.log("📌 script_email.js carregado");

  if (window.emailjs) {
    emailjs.init({ publicKey: "WddODLBw11FUrjP-q" }); // 🔑 sua chave pública
    console.log("✅ EmailJS inicializado");
  } else {
    console.error("❌ EmailJS não carregado");
  }

  const form = document.getElementById("formSolicitacao");
  if (!form) {
    console.warn("⚠️ Formulário de solicitação não encontrado");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Recupera dados do localStorage
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      alert("Nenhum usuário logado.");
      return;
    }

    // Lista de materiais
    const tabela = document.querySelectorAll("#tabelaMateriais tbody tr");
    const listaMateriais = [];
    tabela.forEach(row => {
      const material = row.cells[0]?.innerText || "";
      const quantidade = row.cells[1]?.innerText || "";
      if (material && quantidade) {
        listaMateriais.push({ material, quantidade });
      }
    });

    // Parâmetros para o EmailJS
    const templateParams = {
      nome: usuarioLogado.nome,
      from_email: usuarioLogado.email,
      obra: document.getElementById("obra").value,
      centro_custo: document.getElementById("centroCusto").value,
      data: document.getElementById("data").value,
      local_entrega: document.getElementById("localEntrega").value,
      numero: Date.now().toString().slice(-4), // sequencial simples
      materiais: listaMateriais // 👉 agora vai como array, não como string
    };

    console.log("📧 Enviando com parâmetros:", templateParams);

    try {
      const response = await emailjs.send(
        "service_21gln5j",   // seu Service ID
        "template_r3gec9a", // seu Template ID
        templateParams
      );
      console.log("✅ Email enviado:", response);
      Swal.fire("✅ Sucesso!", "Solicitação enviada com sucesso!", "success");
    } catch (error) {
      console.error("❌ Erro ao enviar EmailJS:", error);
      Swal.fire("❌ Erro!", "Não foi possível enviar a solicitação.", "error");
    }
  });
});
