/* gerar_contrato_docx.js
   Gera DOCX no browser a partir de:
   - JSON:  https://api.erpimpar.com.br/storage/docs/data/{CODIGO}.json
   - DOCX:  https://api.erpimpar.com.br/storage/docs/template-contrato-PLACEHOLDERS.docx
*/

(function () {
  "use strict";

  const API_BASE = "https://api.erpimpar.com.br/storage/docs";
  const TEMPLATE_URL = API_BASE + "/template-contrato-PLACEHOLDERS.docx";

  // --- loader simples de libs via CDN (sem build, sem npm) ---
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Falha ao carregar: " + src));
      document.head.appendChild(s);
    });
  }

  async function ensureLibs() {
    // PizZip + docxtemplater + FileSaver
    if (!window.PizZip) {
      await loadScript("https://cdn.jsdelivr.net/npm/pizzip@3.1.7/dist/pizzip.min.js");
    }
    if (!window.docxtemplater) {
      await loadScript("https://cdn.jsdelivr.net/npm/docxtemplater@3.53.0/build/docxtemplater.js");
    }
    if (!window.saveAs) {
      await loadScript("https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js");
    }
  }

  function safeStr(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
  }

  function enderecoCompleto(d, tipo) {
    // tipo: 'Contratante' | 'Contratada'
    const log = safeStr(d["logradouro" + tipo]);
    const num = safeStr(d["numero" + tipo]);
    const com = safeStr(d["complemento" + tipo]);
    const bai = safeStr(d["bairro" + tipo]);
    const cid = safeStr(d["cidade" + tipo]);
    const uf  = safeStr(d["uf" + tipo]);

    const parteCom = com ? " - " + com : "";
    const base = (log || num) ? (log + ", " + num + parteCom).trim() : "";
    const rest = (bai || cid || uf) ? (bai + " – " + cid + " - " + uf).trim() : "";

    if (!base && !rest) return "";
    if (!base) return rest;
    if (!rest) return base;
    return base + " - " + rest;
  }

  async function fetchJson(codigo) {
    const url = API_BASE + "/data/" + encodeURIComponent(codigo) + ".json?ts=" + Date.now();
    const r = await fetch(url, { method: "GET", mode: "cors", cache: "no-store" });
    if (!r.ok) throw new Error("JSON não encontrado/erro (" + r.status + "): " + url);
    return await r.json();
  }

  async function fetchArrayBuffer(url) {
    const r = await fetch(url + (url.includes("?") ? "&" : "?") + "ts=" + Date.now(), {
      method: "GET",
      mode: "cors",
      cache: "no-store"
    });
    if (!r.ok) throw new Error("Falha ao baixar template (" + r.status + ")");
    return await r.arrayBuffer();
  }

 async function gerarContrato(codigo) {
  const result = await gerarContratoBlob(codigo);
  return {
    ok: true,
    filename: result.filename,
    blob: result.blob,
    data: result.data
  };
}

  function descricaoAutomaticaAnexo(nomeArquivo) {
  const ext = String(nomeArquivo || "").split(".").pop().toLowerCase();

  switch (ext) {
    case "pdf":
      return "Documento complementar em formato PDF.";
    case "xls":
    case "xlsx":
      return "Planilha complementar contendo informações técnicas.";
    case "csv":
      return "Arquivo de dados complementar.";
    case "ppt":
    case "pptx":
      return "Apresentação complementar.";
    case "doc":
    case "docx":
      return "Documento complementar integrante deste instrumento.";
    case "png":
    case "jpg":
    case "jpeg":
      return "Imagem complementar integrante deste instrumento.";
    default:
      return "Documento complementar integrante deste instrumento.";
  }
}

function montarResumoAnexos(anexos) {
  if (!anexos || !anexos.length) return "Sem anexos.";

  return anexos.map((a, i) => {
    const nome = a.name || a.nomeArquivo || "";
    return `ANEXO ${i + 1} – ${nome}\n${descricaoAutomaticaAnexo(nome)}`;
  }).join("\n\n");
}

function montarLoopAnexos(anexos) {
  if (!anexos || !anexos.length) return [];

  return anexos.map((a, i) => {
    const nome = a.name || a.nomeArquivo || "";
    const link = a.webUrl || a.link || "";
    return {
      numero: String(i + 1),
      nomeArquivo: nome,
      descricaoAutomatica: descricaoAutomaticaAnexo(nome),
      linkTexto: link || "Link não disponível"
    };
  });
} 
   
  async function gerarContrato(codigo) {
    const result = await gerarContratoBlob(codigo);
    window.saveAs(result.blob, result.filename);
    return { ok: true, filename: result.filename };
  }

  // API pública para você chamar do seu código atual
window.ERP_DOCX = window.ERP_DOCX || {};
window.ERP_DOCX.gerarContrato = gerarContrato;
window.ERP_DOCX.gerarContratoBlob = gerarContratoBlob;

})();

