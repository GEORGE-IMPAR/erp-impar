console.log("📌 script_email.js carregado");

document.addEventListener("DOMContentLoaded", () => {
  if (window.emailjs) {
    emailjs.init({ publicKey: "WddODLBw11FUrjP-q" });
    console.log("✅ EmailJS inicializado");
  } else {
    console.error("❌ EmailJS não carregado");
    return;
  }

  const form = document.getElementById("solicitacaoForm");
  if (!form) {
    console.warn("⚠️ Formulário de solicitação não encontrado");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Captura de dados
    const nome = document.getElementById("nomeUsuario")?.innerText.trim() || "Não informado";
    const from_email = document.getElementById("emailUsuario")?.innerText.trim() || "Não informado";
    const obra = document.getElementById("obra")?.value || "Não informado";
    const centro_custo = document.getElementById("centroCusto")?.value || "Não informado";
    const data = document.getElementById("dataEntrega")?.value || "Não informado";
    const local_entrega = document.getElementById("localEntrega")?.value || "Não informado";

    // Lista de materiais
    const listaMateriais = [];
    document.querySelectorAll("#tabelaMateriais tbody tr").forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 2) {
        listaMateriais.push({
          material: cols[0].innerText,
          quantidade: cols[1].innerText
        });
      }
    });

    if (listaMateriais.length === 0) {
      Swal.fire("⚠️ Nenhum material adicionado!", "", "warning");
      return;
    }

    const templateParams = {
      nome,
      from_email,
      obra,
      centro_custo,
      data,
      local_entrega,
      materiais: listaMateriais
    };

    console.log("📧 Enviando com parâmetros:", templateParams);

    try {
      const response = await emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams);
      console.log("✅ Email enviado:", response);
      Swal.fire("✅ Solicitação enviada com sucesso!", "", "success");
    } catch (error) {
      console.error("❌ Erro EmailJS:", error);
      Swal.fire("❌ Erro ao enviar solicitação!", error.text || "", "error");
    }
  });
});
