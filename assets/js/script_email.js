document.addEventListener("DOMContentLoaded", () => {
  console.log("📌 script_email.js carregado");

  // Inicializa EmailJS
  if (window.emailjs) {
    emailjs.init({ publicKey: "WddODLBw11FUrjP-q" });
    console.log("✅ EmailJS inicializado no script_email.js");
  } else {
    console.error("❌ EmailJS não carregado no script_email.js");
  }

  const solicitacaoForm = document.getElementById("solicitacaoForm");
  if (solicitacaoForm) {
    solicitacaoForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
      if (!usuarioLogado) {
        Swal.fire("⚠️ Usuário não encontrado!", "", "warning");
        return;
      }

      const obra = document.getElementById("obra").value;
      const centroCusto = document.getElementById("centroCusto").value;
      const data = document.getElementById("prazo").value;
      const localEntrega = document.getElementById("localEntrega").value;

      // Captura materiais da tabela
      const listaMateriais = [];
      document.querySelectorAll("#tabelaMateriais tbody tr").forEach((row) => {
        listaMateriais.push({
          material: row.cells[0].innerText,
          quantidade: row.cells[2].innerText
        });
      });

      if (!obra || !centroCusto || !data || !localEntrega || listaMateriais.length === 0) {
        Swal.fire("⚠️ Preencha todos os campos e adicione materiais!", "", "warning");
        return;
      }

      const templateParams = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra,
        centro_custo: centroCusto,
        data,
        local_entrega: localEntrega,
        materiais: JSON.stringify(listaMateriais, null, 2)
      };

      console.log("📧 Enviando com parâmetros (script_email.js):", templateParams);

      emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams)
        .then(() => {
          Swal.fire("✅ Solicitação enviada com sucesso!", "", "success");
        })
        .catch((erro) => {
          console.error("Erro EmailJS:", erro);
          Swal.fire("❌ Falha ao enviar solicitação", erro.text || "", "error");
        });
    });
  }
});
