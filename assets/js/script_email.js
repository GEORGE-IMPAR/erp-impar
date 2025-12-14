console.log("📌 script_email.js carregado");

document.addEventListener("DOMContentLoaded", () => {
  // Inicializar EmailJS
  if (window.emailjs) {
    emailjs.init("WddODLBw11FUrjP-q");
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

    // 🔐 Login único + login antigo (fallback)
    const usuarioLogado =
      JSON.parse(localStorage.getItem("usuarioLogado")) ||
      JSON.parse(localStorage.getItem("ERPIMPAR_USER"));

    if (!usuarioLogado) {
      Swal.fire("Sessão expirada", "Faça login novamente.", "error")
        .then(() => window.location.href = "index.html");
      return;
    }

    const btnSubmit = solicitacaoForm.querySelector("button[type='submit']");
    if (btnSubmit) btnSubmit.disabled = true;

    const obra = document.getElementById("obra").value;
    const centroCusto = document.getElementById("centroCusto").value;
    const prazo = document.getElementById("prazo").value;
    const localEntrega = document.getElementById("localEntrega").value;

    if (!obra || !centroCusto || !prazo || !localEntrega) {
      Swal.fire("⚠️ Atenção", "Preencha todos os campos obrigatórios!", "warning");
      if (btnSubmit) btnSubmit.disabled = false;
      return;
    }

    const linhas = document.querySelectorAll("#tabelaMateriais tbody tr");
    let materiais = [];

    linhas.forEach(linha => {
      const cols = linha.querySelectorAll("td");
      materiais.push({
        material: cols[0].innerText,
        und: cols[1].innerText,
        quantidade: cols[2].innerText,
        observacao: cols[3].innerText
      });
    });

    if (materiais.length === 0) {
      Swal.fire("⚠️ Atenção", "Adicione pelo menos um material!", "warning");
      if (btnSubmit) btnSubmit.disabled = false;
      return;
    }

    const materiaisHtml = materiais.map(m =>
      `<tr>
        <td style="border:1px solid #ccc; padding:8px;">${m.material}</td>
        <td style="border:1px solid #ccc; padding:8px;">${m.und}</td>
        <td style="border:1px solid #ccc; padding:8px;">${m.quantidade}</td>
        <td style="border:1px solid #ccc; padding:8px;">${m.observacao}</td>
      </tr>`
    ).join("");

    const templateParams = {
      nome: usuarioLogado.Nome || usuarioLogado.nome || "Não informado",
      from_email: usuarioLogado.Email || usuarioLogado.email || "Não informado",
      obra,
      centro_custo: centroCusto,
      data: prazo,
      local_entrega: localEntrega,
      materiais: materiaisHtml
    };

    // 🎬 Spinner premium
    Swal.fire({
      title: "Enviando solicitação",
      html: "Aguarde, estamos enviando o e-mail…",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      await emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams);

      Swal.fire({
        icon: "success",
        title: "Solicitação enviada!",
        text: "O e-mail foi enviado com sucesso.",
        timer: 2200,
        showConfirmButton: false
      }).then(() => {
        solicitacaoForm.reset();
        document.querySelector("#tabelaMateriais tbody").innerHTML = "";
        // ❌ NÃO desloga
        window.location.href = "menu.html";
      });

    } catch (err) {
      console.error("❌ Erro EmailJS:", err);
      Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
      if (btnSubmit) btnSubmit.disabled = false;
    }
  });
});
