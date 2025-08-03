document.addEventListener("DOMContentLoaded", () => {
  console.log("📌 script_email.js carregado");

  if (window.emailjs) {
    emailjs.init({ publicKey: "WddODLBw11FUrjP-q" });
    console.log("✅ EmailJS inicializado");
  } else {
    console.error("❌ EmailJS não carregado");
    return;
  }

  const formSolicitacao = document.getElementById('solicitacaoForm');
  if (!formSolicitacao) {
    console.warn("⚠️ Formulário de solicitação não encontrado");
    return;
  }

  formSolicitacao.addEventListener('submit', (e) => {
    e.preventDefault();

    const nome = document.getElementById('nomeUsuario')?.innerText || "Não informado";
    const from_email = document.getElementById('emailUsuario')?.innerText || "Não informado";
    const obra = document.getElementById('obra')?.value || "Não informado";
    const centro_custo = document.getElementById('centroCusto')?.value || "Não informado";
    const data = document.getElementById('dataEntrega')?.value || "Não informado";
    const local_entrega = document.getElementById('localEntrega')?.value || "Não informado";

    const materiais = [];
    document.querySelectorAll('#tabelaMateriais tbody tr').forEach(row => {
      const cols = row.querySelectorAll('td');
      if (cols.length >= 2) {
        materiais.push(`${cols[0].innerText} - ${cols[1].innerText}`);
      }
    });

    const templateParams = {
      nome,
      from_email,
      obra,
      centro_custo,
      data,
      local_entrega,
      materiais: materiais.join("\n")
    };

    console.log("📧 Enviando com parâmetros:", templateParams);

    emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams)
      .then(response => {
        console.log("✅ Email enviado:", response);
        Swal.fire("✅ Solicitação enviada com sucesso!", "", "success");
      })
      .catch(error => {
        console.error("❌ Erro EmailJS:", error);
        Swal.fire("❌ Erro ao enviar solicitação!", error.text || "", "error");
      });
  });
});
