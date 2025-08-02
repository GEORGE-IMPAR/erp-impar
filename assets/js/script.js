// Inicializa EmailJS
(function(){
  emailjs.init("WddODLBw11FUrjP-q"); // sua public key
})();

const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
let materiais = [];

// Preenche obras filtradas
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const obrasResp = await fetch("obras.json");
    const obras = await obrasResp.json();

    const obrasUsuario = obras.filter(o => o.Email.toLowerCase() === usuarioLogado.Email.toLowerCase());
    const selectObra = document.getElementById("obra");

    if (obrasUsuario.length === 0) {
      Swal.fire("Atenção!", "Nenhuma obra vinculada ao seu usuário.", "warning").then(() => {
        window.location.href = "login.html";
      });
      return;
    }

    obrasUsuario.forEach(obra => {
      const option = document.createElement("option");
      option.value = obra.Nome;
      option.textContent = obra.Nome;
      selectObra.appendChild(option);
    });

    selectObra.addEventListener("change", () => {
      const obraSelecionada = obrasUsuario.find(o => o.Nome === selectObra.value);
      document.getElementById("centroCusto").value = obraSelecionada ? obraSelecionada.CentroCusto : "";
    });

  } catch (error) {
    console.error("Erro ao carregar obras:", error);
    Swal.fire("Erro!", "Não foi possível carregar as obras.", "error");
  }
});

// Adicionar material
document.getElementById("adicionarMaterial").addEventListener("click", () => {
  const material = document.getElementById("material").value;
  const quantidade = document.getElementById("quantidade").value;

  if (!material || !quantidade) {
    Swal.fire("Atenção!", "Preencha material e quantidade.", "warning");
    return;
  }

  materiais.push({ nome: material, und: "Un", qtd: quantidade });
  renderTabela();
});

// Renderizar tabela
function renderTabela() {
  const tbody = document.querySelector("#tabelaMateriais tbody");
  tbody.innerHTML = "";
  materiais.forEach((mat, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${mat.nome}</td>
      <td>${mat.und}</td>
      <td>${mat.qtd}</td>
      <td><button onclick="removerMaterial(${index})">❌</button></td>
    `;
    tbody.appendChild(row);
  });
}

function removerMaterial(index) {
  materiais.splice(index, 1);
  renderTabela();
}

// Envio do formulário
document.getElementById("solicitacaoForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const params = {
    nome: usuarioLogado.Nome,
    from_email: usuarioLogado.Email,
    obra: document.getElementById("obra").value,
    centro_custo: document.getElementById("centroCusto").value,
    local_entrega: document.getElementById("localEntrega").value,
    materiais: JSON.stringify(materiais),
    data: new Date().toLocaleDateString(),
    numero: Math.floor(Math.random() * 100000)
  };

  try {
    console.log("📧 Enviando com parâmetros:", params);

    const res = await emailjs.send("service_fzht86y", "template_wz0ywdo", params);
    Swal.fire("Sucesso!", "Solicitação enviada com sucesso!", "success");

  } catch (erro) {
    console.error("Erro EmailJS:", erro);

    Swal.fire("Erro!", "Falha ao enviar a solicitação.", "error");

    await fetch("logs/logs.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "erro",
        usuario: usuarioLogado.Email,
        params,
        erro,
        dataHora: new Date().toLocaleString()
      })
    });
  }
});
