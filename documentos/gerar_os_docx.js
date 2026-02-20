// gerar_os_docx.js
// Requer: PizZip carregado antes (via CDN) OU já existente no seu projeto.

(function () {
  "use strict";

  // AJUSTE AQUI (recomendado deixar o template no GitHub também, HTTPS)
  // Exemplo: https://www.erpimpar.com.br/documentos/templates/Template_OS.docx
  const OS_TEMPLATE_URL = "https://api.erpimpar.com.br/storage/docs/Template_OS.docx";

  // JSON (já existe no seu servidor)
  function getJsonUrl(codigo){
    return `https://api.erpimpar.com.br/storage/docs/data/${encodeURIComponent(codigo)}.json?ts=${Date.now()}`;
  }

  function sanitizeFilenamePart(s){
    return String(s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function fetchArrayBuffer(url){
    const resp = await fetch(url, { cache: "no-store" });
    if(!resp.ok) throw new Error(`Falha ao baixar arquivo (HTTP ${resp.status}).`);
    return await resp.arrayBuffer();
  }

  async function fetchJson(url){
    const resp = await fetch(url, { cache: "no-store" });
    if(!resp.ok) throw new Error(`Falha ao ler JSON (HTTP ${resp.status}).`);
    return await resp.json();
  }

  function replaceAllXml(zip, replacements){
    const fileNames = Object.keys(zip.files || {});
    const xmlNames = fileNames.filter(n =>
      n.startsWith("word/") && n.endsWith(".xml")
    );

    xmlNames.forEach(name => {
      const file = zip.file(name);
      if(!file) return;

      let xml = file.asText();

      // replaces simples
      for(const [needle, value] of Object.entries(replacements)){
        const v = (value === null || value === undefined) ? "" : String(value);
        // replace ALL (split/join) pra evitar regex escapando
        xml = xml.split(needle).join(v);
      }

      zip.file(name, xml);
    });
  }

  function downloadBlob(blob, filename){
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  // Função pública: chama isso quando o usuário escolher "Gerar Ordem de Serviço"
  window.gerarOSDocx = async function gerarOSDocx({ codigo, nomeObra }){
    if(!codigo) throw new Error("Código não informado.");

    // 1) baixa template DOCX + JSON
    const [tplBuf, data] = await Promise.all([
      fetchArrayBuffer(OS_TEMPLATE_URL),
      fetchJson(getJsonUrl(codigo))
    ]);

    // 2) abre DOCX e faz replace
    if(typeof PizZip === "undefined"){
      throw new Error("PizZip não carregado. Inclua o CDN do PizZip antes deste script.");
    }
    const zip = new PizZip(tplBuf);

    const replacements = {
      "#codigo": data.codigo || codigo,
      "#nomeContratante": data.nomeContratante || "",
      "#servico": data.servico || "",
      "#contatoContratante": data.contatoContratante || "",
      "#telefoneContratante": data.telefoneContratante || "",
      "#emailContratante": data.emailContratante || "",
      "#endereco": data.enderecoObra || data.endereco || "",
      "#dataExtenso": data.dataExtenso || "",
      "#prazo": data.prazoDias || data.prazo || "",
      // template tem typo "#projtista"
      "#projtista": data.projetista || ""
    };

    replaceAllXml(zip, replacements);

    // 3) gera docx final
    const outName = `OS - ${sanitizeFilenamePart(data.codigo || codigo)} ${sanitizeFilenamePart(nomeObra || data.nomeObra || "")}.docx`.trim();
    const blob = zip.generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    downloadBlob(blob, outName);

    return true;
  };
})();