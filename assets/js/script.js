document.addEventListener("DOMContentLoaded", async () => {
  const obraSelect = document.getElementById("obra");
  const centroCustoInput = document.getElementById("centroCusto");
  const materialSelect = document.getElementById("material");
  const quantidadeInput = document.getElementById("quantidade");
  const adicionarBtn = document.getElementById("adicionarMaterial");
  const tabelaBody = document.querySelector("#tabelaMateriais tbody");
  const solicitacaoForm = document.getElementById("solicitacaoForm");
  const localEntregaSelect = document.getElementById("localEntrega");

  let usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado")) || null;

  if (!usuarioLogado) {
    Swal.fire("Erro", "Faça login novamente.", "error").then(() => {
      window.location.href = "login.html";
    });
    return;
  }

  // Carregar obras filtradas por usuário
  try {
    const obrasResp = await fetch("obras.json");
    const obras = await obrasResp.json();
    const obrasUsuario = obras.filter(o =>
      o.Email.trim().toLowerCase() === usuarioLogado.Email.trim().toLowerCase()
    );

    if (obrasUsuario.length === 0) {
      Swal.fire("Aviso", "Nenhuma obra associada ao seu usuário.", "warning")
        .then(() => window.location.href = "login.html");
      return;
    }

    obrasUsuario.forEach(obra => {
      const opt = document.createElement("option");
      opt.value = obra.Obra;
      opt.textContent = obra.Obra;
      obraSelect.appendChild(opt);
    });

    obraSelect.addEventListener("change", () => {
      const obraSel = obrasUsuario.find(o => o.Obra === obraSelect.value);
      centroCustoInput.value = obraSel ? obraSel["Centro de Custo"] : "";
    });

  } catch (err) {
    console.error("Erro ao carregar obras:", err);
    Swal.fire("Erro", "Falha ao carregar obras.", "error");
  }

  // Carregar materiais
  try {
    const materiaisResp = await fetch("materiais.json");
    const materiais = await materiaisResp.json();
    materiais.sort((a, b) => a.Material.localeCompare(b.Material));
    materiais.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.Material;
      opt.textContent = `${m.Material} (${m.UND})`;
      opt.dataset.und = m.UND;
      materialSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao carregar materiais:", err);
    Swal.fire("Erro", "Falha ao carregar materiais.", "error");
  }

  // Adicionar material na tabela
  adicionarBtn.addEventListener("click", () => {
    if (!materialSelect.value || !quantidadeInput.value) {
      Swal.fire("Erro", "Selecione um material e informe a quantidade.", "error");
      return;
    }

    const und = materialSelect.selectedOptions[0].dataset.und;
    const row = tabelaBody.insertRow();
    row.insertCell(0).textContent = materialSelect.value;
    row.insertCell(1).textContent = und;
    row.insertCell(2).textContent = quantidadeInput.value;

    const cellAcao = row.insertCell(3);
    const btnRemover = document.createElement("span");
    btnRemover.textContent = "❌";
    btnRemover.classList.add("btn-remover");
    btnRemover.addEventListener("click", () => row.remove());
    cellAcao.appendChild(btnRemover);

    materialSelect.value = "";
    quantidadeInput.value = "";
  });

  // Gerar número sequencial por dia
  function gerarNumeroSequencial() {
    const hoje = new Date().toLocaleDateString("pt-BR");
    const chave = `seq_${hoje}`;
    let numero = localStorage.getItem(chave);
    if (!numero) numero = 1;
    else numero = parseInt(numero) + 1;
    localStorage.setItem(chave, numero);
    return numero;
  }

  // Enviar solicitação via EmailJS
  solicitacaoForm.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!obraSelect.value || !centroCustoInput.value ||
        !localEntregaSelect.value || !document.getElementById("dataLimite").value) {
      Swal.fire("Erro", "Preencha todos os campos obrigatórios antes de enviar.", "error");
      return;
    }

    const materiais = [];
    for (let row of tabelaBody.rows) {
      materiais.push({
        material: row.cells[0].textContent,
        unidade: row.cells[1].textContent,
        quantidade: row.cells[2].textContent
      });
    }

    let tabelaHTML = "<table border='1' style='border-collapse:collapse; width:100%'>";
    tabelaHTML += "<tr><th>Material</th><th>UND</th><th>Quantidade</th></tr>";
    materiais.forEach(m => {
      tabelaHTML += `<tr><td>${m.material}</td><td>${m.unidade}</td><td>${m.quantidade}</td></tr>`;
    });
    tabelaHTML += "</table>";

    const numeroSequencial = gerarNumeroSequencial();
    const dataPedido = new Date().toLocaleDateString("pt-BR");

    const params = {
      nome: usuarioLogado.Nome,
      reply_to: usuarioLogado.Email, // e-mail de quem logou
      obra: obraSelect.value,
      centro_custo: centroCustoInput.value,
      local_entrega: localEntregaSelect.value,
      data: dataPedido,
      numero: centroCustoInput.value, // centro de custo
      materiais_tabela: tabelaHTML,
      assunto: `SOLICITAÇÃO DE MATERIAIS - ${obraSelect.value} - ${usuarioLogado.Nome} - ${dataPedido} - ${numeroSequencial}`
    };

    emailjs.send("service_fzht86y", "template_wz0ywdo", params)
      .then(() => {
        Swal.fire("Sucesso", "Solicitação enviada com sucesso!", "success");
      })
      .catch((err) => {
        console.error("Erro EmailJS:", err);
        Swal.fire("Erro", "Falha ao enviar solicitação.", "error");
      });
  });
});
