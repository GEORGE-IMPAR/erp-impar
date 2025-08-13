<script>
// === script_email.js ===
// Mantém tudo o que já funciona. Apenas:
// - lê Material, UND e Quantidade da tabela
// - envia "materiais" como array de objetos { material, und, quantidade }
// - assunto continua sendo montado como você já configurou no EmailJS

(function () {
  console.log("📌 script_email.js carregado");

  // Inicializa EmailJS (mantendo sua public key)
  if (window.emailjs && emailjs.init) {
    emailjs.init("WddODLBw11FUrjP-q");
    console.log("✅ EmailJS inicializado");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("solicitacaoForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Usuário logado (como já está em produção)
      const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
      if (!usuarioLogado) {
        alert("Sessão expirada. Faça login novamente.");
        window.location.href = "login.html";
        return;
      }
      console.log("👤 Usuário logado recuperado:", usuarioLogado);

      // Campos do formulário
      const obra        = (document.getElementById("obra")?.value || "").trim();
      const centroCusto = (document.getElementById("centroCusto")?.value || "").trim();
      const prazo       = (document.getElementById("prazo")?.value || "").trim();
      const localEntrega= (document.getElementById("localEntrega")?.value || "").trim();

      const dadosForm = { obra, centroCusto, prazo, localEntrega };
      console.log("📌 Dados coletados do formulário:", dadosForm);

      // Coleta dos materiais da tabela (agora com UND)
      const materiais = [];
      document.querySelectorAll("#tabelaMateriais tbody tr").forEach((tr) => {
        const tds = tr.querySelectorAll("td");
        const material   = (tds[0]?.textContent || "").trim();
        const und        = (tds[1]?.textContent || "").trim();
        const quantidade = (tds[2]?.textContent || "").trim();
        if (material && quantidade) {
          materiais.push({ material, und, quantidade });
        }
      });
      console.log("📦 Materiais coletados:", materiais);

      if (materiais.length === 0) {
        alert("Adicione pelo menos um material antes de enviar.");
        return;
      }

      // Monta parâmetros do template (inclui UND)
      const templateParams = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra: obra,
        centro_custo: centroCusto,
        data: prazo,
        local_entrega: localEntrega,
        // IMPORTANTE: manda como array para usar {{#each materiais}} no EmailJS
        materiais
      };

      console.log("📧 Enviando com parâmetros:", templateParams);

      try {
        const resp = await emailjs.send(
          "service_fzht86y",       // seu Service ID
          "template_wz0ywdo",      // seu Template ID (ajuste se for outro)
          templateParams
        );
        console.log("✅ Email enviado:", resp);

        // mantém seu fluxo atual (limpar/redirect/etc.) – sem mudanças
        alert("Solicitação enviada com sucesso!");
        // Se você faz logoff/redirect após envio, mantenha aqui sua lógica existente.
        // Ex.: localStorage.removeItem("usuarioLogado"); window.location.href = "login.html";
      } catch (err) {
        console.error("❌ Erro ao enviar o email:", err);
        alert("Falha ao enviar a solicitação. Tente novamente.");
      }
    });
  });
})();
</script>
