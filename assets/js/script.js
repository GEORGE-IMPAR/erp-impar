document.addEventListener("DOMContentLoaded", () => {
  console.log("📌 script.js carregado");

  let materiaisAdicionados = [];

  const obraSelect = document.getElementById("obra");
  const centroCustoInput = document.getElementById("centroCusto");
  const materialSelect = document.getElementById("material");
  const quantidadeInput = document.getElementById("quantidade");
  const tabelaMateriais = document.getElementById("tabelaMateriais").querySelector("tbody");
  const adicionarMaterialBtn = document.getElementById("adicionarMaterial");
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  // Atualizar Centro de Custo ao selecionar Obra
  obraSelect.addEventListener("change", () => {
    const obraSelecionada = obraSelect.value;
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));

    if (usuarioLogado && usuarioLogado.obras) {
      const obra = usuarioLogado.obras.find((o) => o.nome === obraSelecionada);
      if (obra) {
        centroCustoInput.value = obra.centroCusto;
      }
    }
  });

  // Adicionar material à lista
  adicionarMaterialBtn.addEventListener("click", () => {
    const material = materialSelect.value;
    const quantidade = quantidadeInput.value;

    if (!material || !quantidade) {
      Swal.fire("Atenção", "Selecione o material e informe a quantidade!", "warning");
      return;
    }

    const novoMaterial = { material, quantidade };
    materiaisAdicionados.push(novoMaterial);
    atualizarTabela();

    materialSelect.value = "";
    quantidadeInput.value = "";
  });

  // Atualizar a tabela de materiais
  function atualizarTabela() {
    tabelaMateriais.innerHTML = "";

    materiaisAdicionados.forEach((item, index) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${item.material}</td>
        <td>UND</td>
        <td>${item.quantidade}</td>
        <td><button type="button" class="remover-btn" data-index="${index}">❌</button></td>
      `;

      tabelaMateriais.appendChild(row);
    });

    // Botões de remoção
    document.querySelectorAll(".remover-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = btn.getAttribute("data-index");
        materiaisAdicionados.splice(index, 1);
        atualizarTabela();
      });
    });
  }

  // Expor a função para resetar lista/tabela de materiais
  window.resetarMateriais = () => {
    materiaisAdicionados = [];
    atualizarTabela();
    console.log("🧹 Lista e tabela de materiais resetadas.");
  };
});
