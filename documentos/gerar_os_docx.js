/* gerar_os_docx.js - ERP ÍMPAR
   Gera ORDEM DE SERVIÇO no FRONT:
   - baixa JSON do projeto
   - baixa template DOCX (placeholders #...)
   - substitui e baixa o .docx final
*/
(function(){
  "use strict";

  const API_DOCS = (typeof window.DOCS_BASE === "string" && window.DOCS_BASE)
    ? window.DOCS_BASE.replace(/\/+$/,"")
    : "https://api.erpimpar.com.br/storage/docs";

  // >>> Ajuste o nome do arquivo do template OS no KingHost aqui:
  const TEMPLATE_OS_URL = `${API_DOCS}/template-os-PLACEHOLDERS.docx`;

  function safeStr(v){
    if(v === null || v === undefined) return "";
    return String(v).replace(/\s+/g," ").trim();
  }

  function sanitizeFilenamePart(s){
    s = safeStr(s);
    // remove caracteres ruins de filename
    return s
      .replace(/[\\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g," ")
      .trim()
      .slice(0, 80);
  }

  async function fetchArrayBuffer(url){
    const resp = await fetch(url, { cache: "no-store" });
    if(!resp.ok) throw new Error(`Falha ao baixar arquivo: ${url} (HTTP ${resp.status})`);
    return await resp.arrayBuffer();
  }

  async function fetchJson(url){
    const resp = await fetch(url, { cache: "no-store" });
    if(!resp.ok) throw new Error(`Falha ao baixar JSON: ${url} (HTTP ${resp.status})`);
    const j = await resp.json();
    if(!j || typeof j !== "object") throw new Error("JSON inválido.");
    return j;
  }

  function downloadBlob(blob, filename){
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 8000);
  }

  // Corrige o caso clássico do DOCX: "#" em um <w:t> e "endereco" em outro <w:t>
  function fixSplitPlaceholder(xml, name){
    // tenta juntar "#"</w:t> ... <w:t>name</w:t>  => "#name"
    const re = new RegExp(`(<w:t[^>]*>)#</w:t>[\\s\\S]*?<w:t[^>]*>${name}</w:t>`, "g");
    return xml.replace(re, `$1#${name}</w:t>`);
  }

  function applyReplacements(xml, map){
    // substituição simples
    Object.keys(map).forEach((k)=>{
      const val = safeStr(map[k]);
      // substituir todas as ocorrências
      xml = xml.split(k).join(val);
    });
    return xml;
  }

  async function gerarOSDocx({ codigo, nomeObra }){
    if(!codigo) throw new Error("Código do projeto não informado.");

if(!window.PizZip) {
  throw new Error("PizZip não carregado. Inclua o pizzip.min.js antes do gerar_os_docx.js.");
}
if(!window.docxtemplater) {
  throw new Error("docxtemplater não carregado. Inclua docxtemplater.js antes do gerar_os_docx.js.");
}
     const jsonUrl = `${API_DOCS}/data/${encodeURIComponent(codigo)}.json`;

    // 1) baixa json + template
    const [dados, tplBuf] = await Promise.all([
      fetchJson(jsonUrl),
      fetchArrayBuffer(TEMPLATE_OS_URL)
    ]);

    // 2) abre docx
    const zip = new PizZip(content);;
    const docXmlPath = "word/document.xml";
    if(!zip.file(docXmlPath)) throw new Error("Template inválido (word/document.xml não encontrado).");

    let xml = await zip.file(docXmlPath).async("string");

    // 3) corrige placeholder quebrado no template (endereco costuma vir splitado)
    xml = fixSplitPlaceholder(xml, "endereco");

    // 4) mapa de placeholders do template
    const prazo = (dados.prazoDias ?? dados.prazo ?? "");
    const map = {
      "#codigo": dados.codigo ?? codigo,
      "#nomeObra": dados.nomeObra ?? "",   // ✅ NOVO
      "#nomeContratante": dados.nomeContratante ?? "",
      "#contatoContratante": dados.contatoContratante ?? "",
      "#prazo": prazo,
      "#projtista": dados.projetista ?? "",          // template está com esse nome
      "#endereco": dados.enderecoObra ?? ""          // seu JSON tem enderecoObra
    };

    // 5) aplica e salva
    xml = applyReplacements(xml, map);
    zip.file(docXmlPath, xml);

    const outNomeObra = sanitizeFilenamePart(nomeObra || dados.nomeObra || "obra");
    const filename = `Ordem de Serviço - ${codigo} ${outNomeObra}.docx`;

    const outBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(outBlob, filename);

    return true;
  }

  // expõe global
  window.gerarOSDocx = gerarOSDocx;

})();


