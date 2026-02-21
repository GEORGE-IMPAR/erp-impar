/* gerar_os_docx.js — ERP ÍMPAR
   CLONE DO GERADOR DE CONTRATO
*/

(function () {
  "use strict";

  const API_DOCS =
    (typeof window.DOCS_BASE === "string" && window.DOCS_BASE)
      ? window.DOCS_BASE.replace(/\/+$/, "")
      : "https://api.erpimpar.com.br/storage/docs";

  const TEMPLATE_URL =
    `${API_DOCS}/template-os-PLACEHOLDERS.docx`;

  function safe(v){
    return (v ?? "").toString();
  }

  function sanitizeFilenamePart(s){
    return safe(s)
      .replace(/[\\\/:*?"<>|]+/g," ")
      .replace(/\s+/g," ")
      .trim()
      .slice(0,80);
  }

  async function fetchJSON(url){
    const r = await fetch(url,{cache:"no-store"});
    if(!r.ok) throw new Error("Erro ao baixar JSON");
    return await r.json();
  }

  async function fetchBuffer(url){
    const r = await fetch(url,{cache:"no-store"});
    if(!r.ok) throw new Error("Erro ao baixar template");
    return await r.arrayBuffer();
  }

  async function gerarOSDocx({codigo, nomeObra}){

    if(!window.PizZip)
      throw new Error("PizZip não carregado.");

    if(!window.docxtemplater)
      throw new Error("Docxtemplater não carregado.");

    const jsonURL =
      `${API_DOCS}/data/${encodeURIComponent(codigo)}.json`;

    const [dados, content] = await Promise.all([
      fetchJSON(jsonURL),
      fetchBuffer(TEMPLATE_URL)
    ]);

    const zip = new PizZip(content);

    const doc = new window.docxtemplater(zip,{
      paragraphLoop:true,
      linebreaks:true
    });

    doc.setData({
      codigo: dados.codigo,
      nomeObra: dados.nomeObra,
      nomeContratante: dados.nomeContratante,
      contatoContratante: dados.contatoContratante,
      telefoneContratante: dados.telefoneContratante,
      emailContratante: dados.emailContratante,
      endereco: dados.enderecoObra,
      servico: dados.servico,
      prazo: dados.prazoDias || dados.prazo,
      projetista: dados.projetista,
      dataExtenso: new Date().toLocaleDateString("pt-BR")
    });

    doc.render();

    const blob = doc.getZip().generate({
      type:"blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    const nomeSafe =
      sanitizeFilenamePart(nomeObra || dados.nomeObra);

    const filename =
      `Ordem de Serviço - ${codigo} ${nomeSafe}.docx`;

    const a=document.createElement("a");
    const url=URL.createObjectURL(blob);
    a.href=url;
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(()=>URL.revokeObjectURL(url),8000);

    return true;
  }

  window.gerarOSDocx = gerarOSDocx;

})();