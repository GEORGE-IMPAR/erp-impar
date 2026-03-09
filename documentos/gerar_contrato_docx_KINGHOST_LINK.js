/* gerar_contrato_docx_KINGHOST_LINK.js
   Monta links seguros para anexos hospedados no KingHost
   Requer CryptoJS (SHA256) carregado no HTML
*/

(function () {
  "use strict";

  const VIEW_BASE = "https://api.erpimpar.com.br/word365/anexo_view.php";
  const SECRET_KEY = "ERP_IMPAR_2026_SUPER_SECRET";

  function buildHash(file) {
    return CryptoJS.SHA256(file + "|" + SECRET_KEY).toString();
  }

  function buildLink(file) {
    const h = buildHash(file);
    return VIEW_BASE + "?file=" + encodeURIComponent(file) + "&h=" + h;
  }

  function montarLoopAnexos(anexos) {
    if (!anexos || !anexos.length) return [];

    return anexos.map((a, i) => {
      const nome = a.name || "";
      return {
        numero: String(i + 1),
        nomeArquivo: nome,
        linkTexto: buildLink(nome)
      };
    });
  }

  window.ERP_DOCX_KINGHOST = {
    montarLoopAnexos
  };

})();