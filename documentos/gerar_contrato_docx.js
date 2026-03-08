/* gerar_contrato_docx.js
   Gera DOCX no browser a partir de:
   - JSON:  https://api.erpimpar.com.br/storage/docs/data/{CODIGO}.json
   - DOCX:  https://api.erpimpar.com.br/storage/docs/template-contrato-PLACEHOLDERS.docx
   - Injeta hyperlinks reais nos anexos após o render do docxtemplater
*/

(function () {
  "use strict";

  const API_BASE = "https://api.erpimpar.com.br/storage/docs";
  const TEMPLATE_URL = API_BASE + "/template-contrato-PLACEHOLDERS.docx";

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
    if (!window.PizZip) {
      await loadScript("https://cdn.jsdelivr.net/npm/pizzip@3.1.7/dist/pizzip.min.js");
    }
    if (!window.docxtemplater) {
      await loadScript("https://cdn.jsdelivr.net/npm/docxtemplater@3.53.0/build/docxtemplater.js");
    }
  }

  function safeStr(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
  }

  function xmlEscape(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function enderecoCompleto(d, tipo) {
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
    if (!anexos || !anexos.length) return "";

    return anexos.map((a, i) => {
      const nome = safeStr(a.name || a.nomeArquivo || "");
      return `ANEXO ${i + 1} – ${nome}\n${descricaoAutomaticaAnexo(nome)}`;
    }).join("\n\n");
  }

  function montarLoopAnexos(anexos) {
    if (!anexos || !anexos.length) {
      return [{
        numero: "",
        nomeArquivo: "Sem anexos.",
        descricaoAutomatica: "",
        linkTexto: ""
      }];
    }

    return anexos.map((a, i) => {
      const nome = safeStr(a.name || a.nomeArquivo || "");
      const link = safeStr(a.webUrl || a.link || "");
      return {
        numero: String(i + 1),
        nomeArquivo: nome,
        descricaoAutomatica: descricaoAutomaticaAnexo(nome),
        linkTexto: link ? `__LINKMARK_${i + 1}__` : "",
        _linkUrl: link
      };
    });
  }

  function injectHyperlinks(zip, anexosLoop) {
    const linkItems = (anexosLoop || []).filter(a => a && a._linkUrl && a.linkTexto);
    if (!linkItems.length) return;

    const docPath = "word/document.xml";
    const relsPath = "word/_rels/document.xml.rels";

    let documentXml = zip.file(docPath).asText();
    let relsXml = zip.file(relsPath).asText();

    let nextId = 900;
    while (relsXml.includes(`Id="rIdHyper${nextId}"`)) {
      nextId += 1;
    }

    linkItems.forEach((item) => {
      const relId = `rIdHyper${nextId++}`;
      const escapedUrl = xmlEscape(item._linkUrl);
      const marker = item.linkTexto;

      relsXml = relsXml.replace(
        /<\/Relationships>\s*$/,
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapedUrl}" TargetMode="External"/></Relationships>`
      );

      const hyperlinkXml = [
        `<w:hyperlink r:id="${relId}" w:history="1">`,
        `<w:r>`,
        `<w:rPr>`,
        `<w:rStyle w:val="Hyperlink"/>`,
        `<w:u w:val="single"/>`,
        `<w:color w:val="0563C1"/>`,
        `</w:rPr>`,
        `<w:t xml:space="preserve">Abrir anexo</w:t>`,
        `</w:r>`,
        `</w:hyperlink>`
      ].join("");

      const markerRegex = new RegExp(
        `<w:r[^>]*>[\\s\\S]*?<w:t[^>]*>${marker}<\\/w:t>[\\s\\S]*?<\\/w:r>`
      );

      documentXml = documentXml.replace(markerRegex, hyperlinkXml);
    });

    zip.file(docPath, documentXml);
    zip.file(relsPath, relsXml);
  }

  async function gerarContratoBlob(codigo) {
    codigo = safeStr(codigo);
    if (!codigo) throw new Error("Código vazio.");

    await ensureLibs();

    const [data, templateBuf] = await Promise.all([
      fetchJson(codigo),
      fetchArrayBuffer(TEMPLATE_URL)
    ]);

    data.codigo = safeStr(data.codigo || codigo);
    data.enderecoContratanteCompleto = enderecoCompleto(data, "Contratante");
    data.enderecoContratadaCompleto  = enderecoCompleto(data, "Contratada");

    const anexos = Array.isArray(window.__ANEXOS_CONTRATO_UPLOADADOS__)
      ? window.__ANEXOS_CONTRATO_UPLOADADOS__
      : [];

    data.anexos = montarLoopAnexos(anexos);
    data.anexosResumo = montarResumoAnexos(anexos);

    const zip = new window.PizZip(templateBuf);

    const doc = new window.docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" }
    });

    doc.setData(data);

    try {
      doc.render();
    } catch (e) {
      console.error(e);
      const msg = (e.properties && e.properties.errors && e.properties.errors[0])
        ? e.properties.errors[0].properties.explanation
        : (e.message || "Erro ao renderizar template");
      throw new Error(msg);
    }

    injectHyperlinks(zip, data.anexos);

    const out = zip.generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    const filename = data.codigo + "_CONTRATO.docx";
    return { ok: true, filename, blob: out, data };
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

  window.ERP_DOCX = window.ERP_DOCX || {};
  window.ERP_DOCX.gerarContrato = gerarContrato;
  window.ERP_DOCX.gerarContratoBlob = gerarContratoBlob;

})();
