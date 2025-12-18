console.log("📌 script_email.js carregado");

// =============================
// SSO (Login único ERP ÍMPAR) — ponte segura para o módulo Materiais
// =============================
function getSessaoERP() {
  try { return JSON.parse(localStorage.getItem("ERPIMPAR_USER") || "null"); }
  catch (e) { return null; }
}

function ensureUsuarioLogadoSSO() {
  try {
    const atual = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
    if (atual && atual.Email) return atual;
  } catch (e) {}

  const erp = getSessaoERP();
  if (erp && erp.email) {
    const nome = erp.nome || erp.Nome || erp.name || "";
    const resp = (nome.split(" ")[0] || "").toUpperCase();
    const mapped = {
      Nome: nome || erp.email,
      Email: erp.email,
      responsável: resp || (erp.email.split("@")[0] || "").toUpperCase()
    };
    localStorage.setItem("usuarioLogado", JSON.stringify(mapped));
    return mapped;
  }
  return null;
}


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

    // trava dupla-clicada / duplicidade de e-mail
    const submitBtn = solicitacaoForm.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    // modal de envio (premium + spinner)

Swal.fire({
  title: "Enviando e-mail…",
  html: `
    <div style="font-size:13px;opacity:.85">
      Processando sua solicitação.<br>
      Aguarde alguns segundos. Não feche esta tela.
    </div>
  `,
  icon: undefined,              // 👈 força NÃO renderizar ícone
  showConfirmButton: false,
  allowOutsideClick: false,
  allowEscapeKey: false,
  didOpen: () => {
    Swal.showLoading();          // 👈 único spinner (central)
  }
});

    const usuarioLogado = ensureUsuarioLogadoSSO() || JSON.parse(localStorage.getItem("usuarioLogado") || "null");
    if (!usuarioLogado) {
      Swal.close();
      if (submitBtn) submitBtn.disabled = false;
      Swal.fire("Erro", "Você precisa fazer login novamente!", "error")
        .then(() => window.location.href = "menu.html");
      return;
    }

    const obra = document.getElementById("obra").value;
    const centroCusto = document.getElementById("centroCusto").value;
    const prazo = document.getElementById("prazo").value;
    const localEntrega = document.getElementById("localEntrega").value;

    if (!obra || !centroCusto || !prazo || !localEntrega) {
      Swal.close();
      if (submitBtn) submitBtn.disabled = false;
      Swal.fire("⚠️ Atenção", "Preencha todos os campos obrigatórios!", "warning");
      return;
    }

    // Capturar materiais da tabela
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
      Swal.close();
      if (submitBtn) submitBtn.disabled = false;
      Swal.fire("⚠️ Atenção", "Adicione pelo menos um material!", "warning");
      return;
    }

    console.log("📦 Materiais coletados:", materiais);

    // Montar HTML dos materiais para o template
    const materiaisHtml = materiais.map(m =>
      `<tr>
         <td style="border:1px solid #ccc; padding:8px; text-align:center;">${m.material}</td>
         <td style="border:1px solid #ccc; padding:8px; text-align:center;">${m.und}</td>
         <td style="border:1px solid #ccc; padding:8px; text-align:center;">${m.quantidade}</td>
         <td style="border:1px solid #ccc; padding:8px; text-align:center;">${m.observacao}</td>
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
      }).then(() => {
        // Limpa tudo
        solicitacaoForm.reset();
        document.querySelector("#tabelaMateriais tbody").innerHTML = "";
        localStorage.removeItem("usuarioLogado"); // Desloga o usuário
        window.location.href = "menu.html"; // Redireciona para o login
      });
    } catch (err) {
      console.error("❌ Erro EmailJS:", err);
      Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
    }
  });
});
