console.log("📌 script_email.js carregado");

document.addEventListener("DOMContentLoaded", () => {
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

  solicitacaoForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Você precisa fazer login novamente!", "error")
        .then(() => window.location.href = "login.html");
      return;
    }

    const obra = document.getElementById("obra").value;
    const centroCusto = document.getElementById("centroCusto").value;
    const prazo = document.getElementById("prazo").value;
    const localEntrega = document.getElementById("localEntrega").value;

    if (!obra || !centroCusto || !prazo || !localEntrega) {
      Swal.fire("⚠️ Atenção", "Preencha todos os campos obrigatórios!", "warning");
      return;
    }

    // Reset local da variável para garantir que a lista seja limpa a cada envio
    let materiais = [];

    const linhas = document.querySelectorAll("#tabelaMateriais tbody tr");
    linhas.forEach(linha => {
      const cols = linha.querySelectorAll("td");
      materiais.push({
        material: cols[0].innerText,
        und: cols[1].innerText,
        quantidade: cols[2].innerText
      });
    });

    if (materiais.length === 0) {
      Swal.fire("⚠️ Atenção", "Adicione pelo menos um material!", "warning");
      return;
    }

    console.log("📦 Materiais coletados:", materiais);

    const materiaisHtml = materiais.map(m =>
      `<tr>
         <td style="border:1px solid #ccc; padding:8px; text-align:center;">${m.material}</td>
         <td style="border:1px solid #ccc; padding:8px; text-align:center;">${m.quantidade}</td>
       </tr>`
    ).join("");

    const templateParams = {
      nome: usuarioLogado.Nome || "Não informado",
      from_email: usuarioLogado.Email || "Não informado",
      obra,
      centro_custo: centroCusto,
      data: prazo,
      local_entrega: localEntrega,
      materiais: materiaisHtml
    };

    console.log("📧 Enviando com parâmetros:", templateParams);

    try {
      const resp = await emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams);
      console.log("✅ Email enviado:", resp);

      Swal.fire({
        icon: "success",
        title: "Solicitação enviada com sucesso!",
        showConfirmButton: false,
        timer: 2500
      });

      // Limpar a tabela e a lista DOM
      solicitacaoForm.reset();
      document.querySelector("#tabelaMateriais tbody").innerHTML = "";
      materiais = []; // <<<<<< ZERA a variável de materiais após o envio
      console.log("🧹 Lista e tabela de materiais resetadas.");
    } catch (err) {
      console.error("❌ Erro EmailJS:", err);
      Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
    }
  });
});
