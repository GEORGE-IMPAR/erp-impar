/* gerar_os_docx.js - CLONE do contrato (docxtemplater)
   - Usa o MESMO motor do contrato
   - Template OS precisa estar com {{campos}} (não #campos)
*/
(function(){
  "use strict";

  const API_DOCS = (typeof window.DOCS_BASE === "string" && window.DOCS_BASE)
    ? window.DOCS_BASE.replace(/\/+$/,"")
    : "https://api.erpimpar.com.br/storage/docs";

  const TEMPLATE_OS_URL = `${API_DOCS}/template-os-PLACEHOLDERS.docx`;

  function safeStr(v){
    if(v === null || v === undefined) return "";
    return String(v);
  }

  function sanitizeFilenamePart(s){
    s = safeStr(s).replace(/\s+/g," ").trim();
    return s.replace(/[\\\/:*?"<>|]+/g, " ").replace(/\s+/g," ").trim().slice(0, 80);
  }

  async function fetchArrayBuffer(url){
    const resp = await fetch(url, { cache:"no-store" });
    if(!resp.ok) throw new Error(`Falha ao baixar template (HTTP ${resp.status})`);
    return await resp.arrayBuffer();
  }

  async function fetchJson(url){
    const resp = await fetch(url, { cache:"no-store" });
    if(!resp.ok) throw new Error(`Falha ao baixar JSON (HTTP ${resp.status})`);
    return await resp.json();
  }

  function downloadBlob(blob, filename){
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 8000);
  }

  function dataExtensoHoje(){
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const d = new Date();
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  async function gerarOSDocx({ codigo, nomeObra }){
    if(!codigo) throw new Error("Código do projeto não informado.");

    // ✅ mesmas libs do contrato
    if(!window.PizZip) throw new Error("PizZip não carregado.");
    if(!window.docxtemplater) throw new Error("docxtemplater não carregado.");

    const jsonUrl = `${API_DOCS}/data/${encodeURIComponent(codigo)}.json`;

    const [tplBuf, dados] = await Promise.all([
      fetchArrayBuffer(TEMPLATE_OS_URL),
      fetchJson(jsonUrl)
    ]);

    const zip = new window.PizZip(tplBuf);
    const doc = new window.docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true
    });

    // ✅ campos iguais ao template ({{...}})
    doc.setData({
      codigo: dados.codigo ?? codigo,
      nomeObra: dados.nomeObra ?? nomeObra ?? "",
      nomeContratante: dados.nomeContratante ?? "",
      contatoContratante: dados.contatoContratante ?? "",
      telefoneContratante: dados.telefoneContratante ?? "",
      emailContratante: dados.emailContratante ?? "",
      endereco: dados.enderecoObra ?? dados.endereco ?? "",
      servico: dados.servico ?? "",
      dataExtenso: dados.dataExtenso ?? dataExtensoHoje()
    });

    try{
      doc.render();
    }catch(e){
      // deixa o erro legível
      throw new Error((e && e.message) ? e.message : "Erro ao renderizar template OS.");
    }

    const outNomeObra = sanitizeFilenamePart(nomeObra || dados.nomeObra || "obra");
    const filename = `Ordem de Serviço - ${codigo} ${outNomeObra}.docx`;

    const outBlob = doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    downloadBlob(outBlob, filename);
    return true;
  }

  window.gerarOSDocx = gerarOSDocx;

})();
