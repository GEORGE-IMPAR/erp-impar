console.log("📌 script_email.js carregado");

// Inicializa EmailJS
emailjs.init("kTYhdZnFzX4OcPYnG");
console.log("✅ EmailJS inicializado");

// Função principal
document.addEventListener("DOMContentLoaded", () => {
  const solicitacaoForm = document.getElementById("solicitacaoForm");
  const tabela = document.getElementById("tabelaMateriais").querySelector("tbody");

  // Enviar solicitação
  solicitacaoForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // 🧹 Cria uma nova lista limpa para cada envio
    const materiais = [];

    const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
    console.log("👤 Usuário logado recuperado:", usuario);

    const obra = document.getElementById("obra").value;
    const centroCusto = document.getElementById("centroCusto").value;
    const prazo = document.getElementById("prazo").value;
    const localEntrega = document.getElementById("localEntrega").value;

    const dados = {
      obra,
      centroCusto,
      prazo,
      localEntrega
    };

    console.log("📌 Dados coletados do formulário:", dados);

    // Coletar os dados da tabela
    const linhas = tabela.querySelectorAll("tr");
    linhas.forEach((linha) => {
      const colunas = linha.querySelectorAll("td");
      if (colunas.length >= 3) {
        const material = colunas[0].innerText.trim();
        const quantidade = colunas[2].innerText.trim();
        if (material && quantidade) {
          materiais.push({ material, quantidade });
        }
      }
    });

    console.log("📦 Materiais coletados:", materiais);

    // Prepara os dados para o template
    const templateParams = {
      nome: usuario?.Nome || "Não informado",
      from_email: usuario?.Email || "Não informado",
      obra: dados.obra,
      centro_custo: dados.centroCusto,
      data: dados.prazo,
      local_entrega: dados.localEntrega,
      materiais: materiais
    };

    console.log("📧 Enviando com parâmetros:", templateParams);

    emailjs
      .send("service_yf6fbbe", "template_3e7c8xp", templateParams)
      .then((response) => {
        console.log("✅ Email enviado:", response);

        // 🧹 Limpa a tabela visual após o envio
        tabela.innerHTML = "";
        console.log("🧹 Lista e tabela de materiais resetadas.");
      })
      .catch((error) => {
        console.error("❌ Erro ao enviar o email:", error);
      });
  });
});
