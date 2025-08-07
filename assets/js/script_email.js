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

  // ✅ Agora o array está *dentro* do submit, reinicia sempre
  const materiais = [];
  const linhas = tabelaBody.querySelectorAll("tr");

  linhas.forEach(linha => {
    const colunas = linha.querySelectorAll("td");
    if (colunas.length >= 3) {
      materiais.push({
        material: colunas[0].innerText.trim(),
        und: colunas[1].innerText.trim(),
        quantidade: colunas[2].innerText.trim()
      });
    }
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
    nome: usuarioLogado.Nome,
    from_email: usuarioLogado.Email,
    obra,
    centro_custo: centroCusto,
    data: prazo,
    local_entrega: localEntrega,
    materiais: materiaisHtml
  };

  console.log("📧 Enviando com parâmetros:", templateParams);

  try {
    const response = await emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams);
    console.log("✅ Email enviado:", response);

    Swal.fire({
      icon: "success",
      title: "Solicitação enviada com sucesso!",
      showConfirmButton: false,
      timer: 2500
    });

    // 🔁 RESET REAL
    document.getElementById("obra").selectedIndex = 0;
    document.getElementById("centroCusto").value = "";
    document.getElementById("prazo").value = "";
    document.getElementById("material").selectedIndex = 0;
    document.getElementById("quantidade").value = "";
    document.getElementById("localEntrega").selectedIndex = 0;

    tabelaBody.innerHTML = "";
    console.log("🧹 Todos os campos e tabela resetados. v2.1");

  } catch (err) {
    console.error("❌ Erro ao enviar o email:", err);
    Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
  }
});
