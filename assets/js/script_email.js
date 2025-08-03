const templateParams = {
  nome: usuarioLogado.Nome,
  from_email: usuarioLogado.Email,
  obra: dadosForm.obra,
  centro_custo: dadosForm.centroCusto,
  data: dadosForm.prazo,
  numero: sequencial,
  local_entrega: dadosForm.localEntrega,
  materiais: materiais.map(m => ({
    material: m.material,
    quantidade: m.quantidade
  }))
};

console.log("📧 Enviando com parâmetros:", templateParams);

emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams)
  .then(resp => {
    console.log("✅ Email enviado:", resp);
    Swal.fire("Sucesso", "Solicitação enviada com sucesso!", "success");
  })
  .catch(err => {
    console.error("❌ Erro EmailJS:", err);
    Swal.fire("Erro", "Falha ao enviar solicitação!", "error");
  });
