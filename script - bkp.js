(function(){
  emailjs.init("WddODLBw11FUrjP-q"); // Public Key
})();

document.getElementById("btnEnviarSolicitacao").addEventListener("click", gerarWordEEnviar);

async function gerarWordEEnviar() {
  const { Document, Packer, Paragraph, TextRun } = docx;

  const usuarioLogado = sessionStorage.getItem("usuarioNome") || "Usuário Desconhecido";
  const emailLogado   = sessionStorage.getItem("usuarioEmail") || "sememail@impar.com";
  const obraSelecionada = document.getElementById("obra").value || "Não informado";
  const entregaSelecionada = document.getElementById("entrega").value || "Não informado";
  const dataSolicitacao = new Date().toLocaleDateString('pt-BR').replace(/\//g, '');
  const numeroSolicitacao = Math.floor(Math.random() * 10000);

  const nomeArquivo = `SOLICITACAO_MATERIAIS_${usuarioLogado.replace(/\s+/g, '_')}_${dataSolicitacao}_${numeroSolicitacao}.docx`;

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: "SOLICITAÇÃO DE MATERIAIS", bold: true, size: 28 })] }),
        new Paragraph("Solicitante: " + usuarioLogado),
        new Paragraph("Email: " + emailLogado),
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
      nome: usuarioLogado,
      from_email: emailLogado,
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
