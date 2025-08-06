console.log("📌 script.js carregado");

document.addEventListener("DOMContentLoaded", () => {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  const userInfo = document.getElementById("user-info");

  if (usuarioLogado && userInfo) {
    userInfo.textContent = `Logado como: ${usuarioLogado.Nome}`;
  }

  const obraSelect = document.getElementById("obra");
  const centroCustoInput = document.getElementById("centroCusto");
  const materialSelect = document.getElementById("material");
  const quantidadeInput = document.getElementById("quantidade");
  const adicionarBtn = document.getElementById("adicionarMaterial");
  const solicitacaoForm = document.getElementById("solicitacaoForm");
  const localEntregaSelect = document.getElementById("localEntrega");
  const tabelaElement = document.getElementById("tabelaMateriais");
  const tabelaMateriais = tabelaElement ? tabelaElement.querySelector("tbody") : null;

  let materiaisAdicionados = [];

  // Preencher select de obras
  if (usuarioLogado && usuarioLogado.obras) {
    usuarioLogado.obras.forEach((obra) => {
      const option = document.createElement("option");
      option.value = obra.nome;
      option.textContent = obra.nome;
      option.dataset.centroCusto = obra.centroCusto;
      obraSelect.appendChild(option);
    });
  }

  // Preencher materiais
  fetch("assets/db/materiais.json")
    .then((res) => res.json())
    .then((materiais) => {
      materiais.forEach((material) => {
        const option = document.createElement("option");
        option.value = material.nome;
        option.textContent = material.nome;
        materialSelect.appendChild(option);
      });
    });

  // Atualizar centro de custo ao selecionar obra
  obraSelect?.addEventListener("change", () => {
    const selectedOption = obraSelect.options[obraSelect.selectedIndex];
    centroCustoInput.value = selectedOption.dataset.centroCusto || "";
  });

  // Adicionar material
  adicionarBtn?.addEventListener("click", () => {
    const material = materialSelect.value;
    const quantidade = quantidadeInput.value;

    if (!material || !quantidade) {
      Swal.fire("Atenção", "Preencha material e quantidade!", "warning");
      return;
    }

    materiaisAdicionados.push({ material, quantidade });
    atualizarTabela();
    materialSelect.value = "";
    quantidadeInput.value = "";
  });

  // Atualizar a tabela
  function atualizarTabela() {
    if (!tabelaMateriais) return;

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

    document.querySelectorAll(".remover-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = btn.getAttribute("data-index");
        materiaisAdicionados.splice(index, 1);
        atualizarTabela();
      });
    });
  }

  // Resetar materiais ao submeter o formulário
  solicitacaoForm?.addEventListener("submit", () => {
    materiaisAdicionados = [];
    atualizarTabela();
  });
});
