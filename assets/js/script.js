console.log("📌 script.js carregado");

let materiaisAdicionados = [];

const obraSelect = document.getElementById("obra");
const centroCustoInput = document.getElementById("centroCusto");
const materialSelect = document.getElementById("material");
const quantidadeInput = document.getElementById("quantidade");
const tabelaMateriais = document.getElementById("tabelaMateriais").querySelector("tbody");
const adicionarMaterialBtn = document.getElementById("adicionarMaterial");
const solicitacaoForm = document.getElementById("solicitacaoForm");

// Carregar usuário logado
const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
if (usuarioLogado) {
  console.log("👤 Usuário logado recuperado:", usuarioLogado);
  document.getElementById("user-info").innerText = `Logado como: ${usuarioLogado.Nome}`;
}

// Simula obras
const obras = [
  { nome: "AEMFLO", centroCusto: "AC1001" },
  { nome: "ARTISTI", centroCusto: "AC1002" },
  { nome: "ASTEL", centroCusto: "AC1003" },
  { nome: "AUTOMOTIVA", centroCusto: "AC1004" },
  { nome: "BIOS FARMACEUTICA", centroCusto: "AC1005" },
  { nome: "CLINICA CERNE", centroCusto: "AC1006" },
  { nome: "COMBO FORQUILHINHA", centroCusto: "AC1007" }
];

// Simula materiais
const materiaisDisponiveis = [
  "Disjuntor Bipolar 32A",
  "Disjuntor Tripolar 50A",
  "Cimento CP IV 32",
  "Cabo Flexível 4mm",
  "Fita Isolante 3M"
];

// Carrega obras no select
obras.forEach(obra => {
  const option = document.createElement("option");
  option.value = obra.nome;
  option.textContent = obra.nome;
  obraSelect.appendChild(option);
});

// Atualiza centro de custo ao selecionar obra
obraSelect.addEventListener("change", () => {
  const obraSelecionada = obras.find(o => o.nome === obraSelect.value);
  centroCustoInput.value = obraSelecionada ? obraSelecionada.centroCusto : "";
});

// Carrega materiais no select
materiaisDisponiveis.forEach(mat => {
  const option = document.createElement("option");
  option.value = mat;
  option.textContent = mat;
  materialSelect.appendChild(option);
});

// Adiciona material à tabela
adicionarMaterialBtn.addEventListener("click", () => {
  const material = materialSelect.value;
  const quantidade = quantidadeInput.value;

  if (!material || !quantidade) {
    Swal.fire("Atenção", "Selecione um material e informe a quantidade.", "warning");
    return;
  }

  materiaisAdicionados.push({ material, quantidade });
  atualizarTabela();

  materialSelect.value = "";
  quantidadeInput.value = "";
});

// Atualiza a tabela
function atualizarTabela() {
  tabelaMateriais.innerHTML = "";

  materiaisAdicionados.forEach((item, index) => {
    const row = document.createElement("tr");

    const materialCell = document.createElement("td");
    materialCell.textContent = item.material;

    const undCell = document.createElement("td");
    undCell.textContent = "Un";

    const quantidadeCell = document.createElement("td");
    quantidadeCell.textContent = item.quantidade;

    const acaoCell = document.createElement("td");
    const removerBtn = document.createElement("button");
    removerBtn.textContent = "❌";
    removerBtn.addEventListener("click", () => {
      materiaisAdicionados.splice(index, 1);
      atualizarTabela();
    });
    acaoCell.appendChild(removerBtn);

    row.appendChild(materialCell);
    row.appendChild(undCell);
    row.appendChild(quantidadeCell);
    row.appendChild(acaoCell);

    tabelaMateriais.appendChild(row);
  });
}

// ✅ Resetar materiais após o envio do formulário
solicitacaoForm.addEventListener("submit", (e) => {
  setTimeout(() => {
    materiaisAdicionados = [];
    atualizarTabela();
    console.log("🧹 Lista de materiais resetada após envio.");
  }, 1000); // pequena espera para garantir que o envio finalize
});
