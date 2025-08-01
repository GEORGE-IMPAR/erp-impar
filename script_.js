(function(){
  emailjs.init("WddODLBw11FUrjP-q"); // Public Key
})();

document.addEventListener("DOMContentLoaded", () => {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
  const obrasUsuario = JSON.parse(localStorage.getItem("obrasUsuario")) || [];

  if (usuario) {
    document.getElementById("usuarioInfo").innerHTML = `
      <strong>Usuário:</strong> ${usuario.Nome} <br>
      <strong>Email:</strong> ${usuario.Email}
    `;
    document.getElementById("centroCusto").value = usuario.CentroCusto || "Centro de custo será definido pela obra";
  } else {
    document.getElementById("usuarioInfo").innerText = "Nenhum usuário logado.";
  }

  // Popular a lista de obras do usuário
  const obraSelect = document.getElementById("obraSelect");
  obraSelect.innerHTML = "<option value=''>Selecione uma obra...</option>";
  obrasUsuario.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.nome;
    opt.textContent = o.nome;
    obraSelect.appendChild(opt);
  });
});

document.getElementById("btnEnviarSolicitacao").addEventListener("click", gerarWordEEnviar);

async function gerarWordEEnviar() {
  const { Document, Packer, Paragraph, TextRun } = docx;

  const usuario = JSON.parse(localStorage.getItem("usuarioLogado")) || {};
  const usuarioNome  = usuario.Nome || "Usuário Desconhecido";
  const usuarioEmail = usuario.Email || "sememail@impar.com";

  const obraSelecionada = document.getElementById("obraSelect").value || "Não informado";
  const entregaSelecionada = document.getElementById("localEntrega").value || "Não informado";
  const dataSolicitacao = new Date().toLocaleDateString('pt-BR').replace(/\//g, '');
  const numeroSolicitacao = Math.floor(Math.random() * 10000);

  const nomeArquivo = `SOLICITACAO_MATERIAIS_${usuarioNome.replace(/\s+/g, '_')}_${dataSolicitacao}_${numeroSolicitacao}.docx`;

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: "SOLICITAÇÃO DE MATERIAIS", bold: true, size: 28 })] }),
        new Paragraph("Solicitante: " + usuarioNome),
        new Paragraph("Email: " + usuarioEmail),
        new Paragraph("Obra: " + obraSelecionada),
        new Paragraph("Local de entrega: " + entregaSelecionada),
        new Paragraph("Data: " + dataSolicitacao),
        new Paragraph("Número da Solicitação: " + numeroSolicitacao),
        new Paragraph(" "),
        new Paragraph("Itens Solicitados:"),
        ...Array.from(document.querySelectorAll(".linha-material")).map(linha => 
          new Paragraph(
            `${linha.querySelector(".material").value} - Quantidade: ${linha.querySelector(".quantidade").value}`
          )
        )
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const base64Word = await blobToBase64(blob);

  emailjs.send("service_fzht86y", "template_wz0ywdo", {
      nome: usuarioNome,
      from_email: usuarioEmail,
      obra: obraSelecionada,
      data: dataSolicitacao,
      numero: numeroSolicitacao,
      mensagem: "Segue em anexo a solicitação de materiais.",
      arquivo_de_palavras: base64Word,
      nome_arquivo: nomeArquivo
  }).then(() => {
      alert("✅ Solicitação enviada com sucesso!");
  }, (error) => {
      alert("❌ Erro ao enviar: " + JSON.stringify(error));
      console.error(error);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
