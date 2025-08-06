console.log("📌 script_email.js carregado");

// Inicializar EmailJS
(function () {
  emailjs.init("WddODLBw11FUrjP-q"); // sua public key
  console.log("✅ EmailJS inicializado");
})();

document.addEventListener("DOMContentLoaded", () => {
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  if (!solicitacaoForm) {
    console.warn("⚠️ Formulário de solicitação não encontrado");
    return;
  }

  solicitacaoForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Recuperar usuário logado
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Sessão expirada. Faça login novamente!", "error").then(
        () => (window.location.href = "login.html")
      );
      return;
    }
    console.log("👤 Usuário logado recuperado:", usuarioLogado);

    // Dados do formulário
    const obra = document.getElementById("obra").value;
    const centroCusto = document.getElementById("centroCusto").value;
    const prazo = document.getElementById("prazo").value;
    const localEntrega = document.getElementById("localEntrega").value;

    console.log("📌 Dados coletados do formulário:", {
      obra,
      centroCusto,
      prazo,
      localEntrega,
    });

    // Materiais
    const materiais = [];
    document.querySelectorAll("#tabelaMateriais tbody tr").forEach((row) => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 3) {
        materiais.push({
          material: cols[0].innerText,
          quantidade: cols[2].innerText,
        });
      }
    });

    if (!obra || !centroCusto || !prazo || !localEntrega || materiais.length === 0) {
    Swal.fire({
  	icon: "success",
	title: "Solicitação enviada com sucesso!",
  	showConfirmButton: false,
  	timer: 2500,
}).then(() => {
  // 🧹 Limpar tabela de materiais na interface
  const tbody = document.querySelector("#tabelaMateriais tbody");
  if (tbody) {
    tbody.innerHTML = "";
    console.log("🧹 Tabela de materiais resetada.");
  }

  // 🔄 Resetar formulário
  solicitacaoForm.reset();

  // 🧽 Limpar cache se houver
  localStorage.removeItem("materiaisAdicionados");
});
      .catch((error) => {
        console.error("Erro EmailJS:", error);
        Swal.fire("Erro", "Falha ao enviar a solicitação!", "error");
      });
  });
});
