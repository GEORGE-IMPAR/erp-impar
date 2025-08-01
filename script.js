document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 script.js carregado");

  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
  const obrasUsuario = JSON.parse(localStorage.getItem("obrasUsuario")) || [];

  // Exibir usuário
  const usuarioInfo = document.getElementById("usuarioInfo");
  if (usuario && usuarioInfo) {
    usuarioInfo.innerText = usuario.Nome;
    console.log("👤 Usuário logado:", usuario.Nome);
  } else {
    alert("Nenhum usuário logado. Faça login novamente.");
    window.location.href = "login.html";
    return;
  }

  // Preencher obras do usuário
  const obraSelect = document.getElementById("obraSelect");
  if (obraSelect && obrasUsuario.length > 0) {
    obraSelect.innerHTML = "<option value=''>Selecione uma obra...</option>";
    obrasUsuario.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o["Centro de Custo"];
      opt.textContent = o.Obras;
      obraSelect.appendChild(opt);
    });

    obraSelect.addEventListener("change", () => {
      const selectedObra = obrasUsuario.find(o => o["Centro de Custo"] === obraSelect.value);
      if (selectedObra) {
        document.getElementById("centroCusto").value = selectedObra["Centro de Custo"];
        console.log("🎯 Centro de Custo atualizado:", selectedObra["Centro de Custo"]);
      }
    });
  } else {
    console.warn("⚠️ Nenhuma obra encontrada para o usuário.");
  }

  // Preencher materiais
  try {
    const respMateriais = await fetch("materiais.json");
    if (!respMateriais.ok) throw new Error("Erro ao carregar materiais.json");
    const materiais = await respMateriais.json();

    const materialSelect = document.getElementById("material");
    materialSelect.innerHTML = "<option value=''>Selecione um material...</option>";
    materiais
      .sort((a, b) => a.MATERIAIS.localeCompare(b.MATERIAIS, 'pt-BR'))
      .forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.MATERIAIS;
        opt.textContent = m.MATERIAIS;
        materialSelect.appendChild(opt);
      });

    console.log("✅ Materiais carregados:", materiais.length);
  } catch (err) {
    console.error("❌ Erro ao carregar materiais:", err);
  }

  // Lógica do botão único
  const btnEnviar = document.getElementById("btnEnviarSolicitacao");
  if (btnEnviar) {
    btnEnviar.addEventListener("click", async () => {
      const material = document.getElementById("material").value;
      const quantidade = document.getElementById("quantidade").value;
      const tabela = document.getElementById("tabelaMateriais");

      // Adicionar linha se material e quantidade preenchidos
      if (material && quantidade) {
        const linha = tabela.insertRow();
        linha.classList.add("linha-material");

        const cellMaterial = linha.insertCell(0);
        const cellQtd = linha.insertCell(1);
        const cellAcao = linha.insertCell(2);

        const inputMat = document.createElement("input");
        inputMat.value = material;
        inputMat.classList.add("material");
        inputMat.readOnly = true;
        cellMaterial.appendChild(inputMat);

        const inputQtd = document.createElement("input");
        inputQtd.value = quantidade;
        inputQtd.classList.add("quantidade");
        inputQtd.readOnly = true;
        cellQtd.appendChild(inputQtd);

        const btnExcluir = document.createElement("button");
        btnExcluir.innerText = "❌";
        btnExcluir.onclick = () => tabela.deleteRow(linha.rowIndex);
        cellAcao.appendChild(btnExcluir);

        console.log(`✅ Material adicionado: ${material} - ${quantidade}`);
      }

      // Coletar materiais
      const materiaisArray = Array.from(document.querySelectorAll(".linha-material"))
        .map(linha => `${linha.querySelector(".material").value} — ${linha.querySelector(".quantidade").value}`);

      if (materiaisArray.length === 0) {
        alert("⚠️ Nenhum material adicionado!");
        return;
      }

      const materiais = materiaisArray.join("\n");

      // Atualizar pré-visualização
      document.getElementById("preview").innerText =
        `Solicitação de Materiais\nSolicitante: ${usuario.Nome}\n` +
        `Obra: ${obraSelect.selectedOptions[0]?.textContent}\n` +
        `Data limite de entrega: ${document.getElementById("dataEntrega").value}\n` +
        `Centro de Custo: ${document.getElementById("centroCusto").value}\n` +
        `Local de entrega: ${document.getElementById("localEntrega").value}\n\nMateriais:\n${materiais}`;

      // Gerar Word
      await gerarWordEEnviar();

      // Enviar via EmailJS
      const params = {
        solicitante: usuario.Nome,
        obra: obraSelect.selectedOptions[0]?.textContent,
        centroCusto: document.getElementById("centroCusto").value,
        entrega: document.getElementById("dataEntrega").value,
        localEntrega: document.getElementById("localEntrega").value,
        materiais: materiaisArray.map((m, i) => `${i + 1}. ${m}`).join("<br>")
      };

      emailjs.send("SEU_SERVICE_ID", "SEU_TEMPLATE_ID", params)
        .then(resp => {
          alert("✅ Solicitação enviada e Word gerado com sucesso!");
          console.log("Email enviado:", resp);
        })
        .catch(err => {
          alert("❌ Falha ao enviar o e-mail.");
          console.error("Erro:", err);
        });
    });
  }
});

// Geração básica de Word
async function gerarWordEEnviar() {
  console.log("📄 Gerando Word...");

  const materiais = Array.from(document.querySelectorAll(".linha-material"))
    .map(linha => `${linha.querySelector(".material").value} — ${linha.querySelector(".quantidade").value}`)
    .join("\n");

  const conteudo = `
    Solicitação de Materiais
    Solicitante: ${document.getElementById("usuarioInfo").innerText}
    Obra: ${document.getElementById("obraSelect").selectedOptions[0]?.textContent}
    Data limite de entrega: ${document.getElementById("dataEntrega").value}
    Centro de Custo: ${document.getElementById("centroCusto").value}
    Local de entrega: ${document.getElementById("localEntrega").value}
    Materiais:\n${materiais}
  `;

  const blob = new Blob([conteudo], { type: "application/msword" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "Solicitacao_Materiais.doc";
  link.click();

  console.log("✅ Word gerado e baixado.");
}
