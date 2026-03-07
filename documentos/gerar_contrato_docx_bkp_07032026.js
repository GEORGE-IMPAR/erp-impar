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
    codigo = safeStr(codigo);
    if (!codigo) throw new Error("Código vazio.");

    await ensureLibs();

    const [data, templateBuf] = await Promise.all([
      fetchJson(codigo),
      fetchArrayBuffer(TEMPLATE_URL)
    ]);

    // Campos compostos que seu template já espera
    data.codigo = safeStr(data.codigo || codigo);
    data.enderecoContratanteCompleto = enderecoCompleto(data, "Contratante");
    data.enderecoContratadaCompleto  = enderecoCompleto(data, "Contratada");

    const zip = new window.PizZip(templateBuf);

    const doc = new window.docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" } // seu template é {{chave}}
    });

    doc.setData(data);

    try {
      doc.render();
    } catch (e) {
      // Mostra erro “legível” quando faltar placeholder
      console.error(e);
      const msg = (e.properties && e.properties.errors && e.properties.errors[0])
        ? e.properties.errors[0].properties.explanation
        : (e.message || "Erro ao renderizar template");
      throw new Error(msg);
    }

    const out = doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    const filename = data.codigo + "_CONTRATO.docx";
    window.saveAs(out, filename);
    return { ok: true, filename };
  }

  // API pública para você chamar do seu código atual
window.ERP_DOCX = window.ERP_DOCX || {};
window.ERP_DOCX.gerarContrato = gerarContrato;

})();
