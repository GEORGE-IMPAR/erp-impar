// script_email.js

console.log("📌 script_email.js carregado");

// Inicializar EmailJS
emailjs.init("WddODLBw11FUrjP-q");
console.log("✅ EmailJS inicializado");

// Evento de envio do formulário
document.querySelector("form").addEventListener("submit", async function (event) {
  event.preventDefault();

  const user = JSON.parse(localStorage.getItem("usuarioLogado"));
  console.log("👤 Usuário logado recuperado:", user);

  const nome = user?.Nome || "Desconhecido";
  const from_email = user?.Email || "desconhecido@dominio.com";

  const obra = document.getElementById("obras").value;
  const centroCusto = document.getElementById("centroCusto").value;
  const prazo = document.getElementById("prazoEntrega").value;
  const localEntrega = document.getElementById("localEntrega").value;

  console.log("📌 Dados coletados do formulário:", {
    obra,
    centroCusto,
    prazo,
    localEntrega,
  });

  const materiais = JSON.parse(localStorage.getItem("materiais")) || [];
  console.log("📦 Materiais coletados:", materiais);

  const templateParams = {
    nome,
    from_email,
    obra,
    centro_custo: centroCusto,
    data: prazo,
    local_entrega: localEntrega,
    materiais: JSON.stringify(materiais, null, 2),
  };

  console.log("📧 Enviando com parâmetros:", templateParams);

  try {
    const response = await emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams);
    console.log("✅ Email enviado:", response);

    // Limpar localStorage e tabela após envio
    localStorage.removeItem("materiais");

    const tabelaBody = document.querySelector("#tabelaMateriais tbody");
    if (tabelaBody) {
      tabelaBody.innerHTML = "";
    }

    console.log("🧹 Lista e tabela de materiais resetadas.✅");
  } catch (error) {
    console.error("❌ Erro ao enviar o email:", error);
  }
});
