/* documento_final_actions.js
   Camada separada para gerar/compartilhar a versão FINAL do documento
   após a edição no Word Web.
*/
(function () {
  "use strict";

  function getProjetoMetaForFilenameSafe() {
    if (typeof getProjetoMetaForFilename === "function") {
      return getProjetoMetaForFilename();
    }
    return {
      codigo: (document.getElementById("codigoProjeto")?.value || "").trim(),
      nomeObra: (document.getElementById("nomeObra")?.value || "").trim()
    };
  }

  async function postJson(url, body) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    let data = null;
    try { data = await resp.json(); } catch (_) {}

    if (!resp.ok || !data?.ok) {
      throw new Error(data?.message || `Falha na API (${resp.status}).`);
    }

    return data;
  }

  async function abrirModalDocumentoFinal(tipo) {
    const { codigo, nomeObra } = getProjetoMetaForFilenameSafe();

    if (!codigo) {
      Swal.fire({
        icon: "warning",
        title: "Código não informado",
        html: "Não foi possível preparar a versão final sem o código do projeto."
      });
      return;
    }

    const res = await Swal.fire({
      title: "Versão final do documento",
      html: "Escolha o que deseja fazer com a versão final já com os anexos.",
      icon: "question",
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: "Compartilhar arquivo",
      denyButtonText: "Baixar arquivo",
      cancelButtonText: "Cancelar",
      buttonsStyling: false,
      customClass: {
        popup: "impar-swal",
        confirmButton: "impar-swal-confirm",
        denyButton: "impar-swal-deny",
        cancelButton: "impar-swal-cancel",
        actions: "impar-swal-actions"
      }
    });

    if (res.isDismissed) return;

    const acao = res.isConfirmed ? "compartilhar" : "baixar";

    try {
      if (typeof showImparLoading === "function") {
        showImparLoading("Gerando versão final…", "Buscando o documento salvo no OneDrive e incorporando a seção final de anexos.");
      }

      const data = await postJson("https://api.erpimpar.com.br/word365/finalizar_documento_com_anexos.php", {
        codigo,
        tipo,
        nomeObra,
        acao
      });

      if (typeof hideImparLoading === "function") {
        hideImparLoading();
      }

      if (acao === "compartilhar") {
        const link = data.shareUrl || data.webUrl || "";
        const copied = !!(navigator.clipboard && navigator.clipboard.writeText && await navigator.clipboard.writeText(link).then(()=>true).catch(()=>false));

        await Swal.fire({
          icon: "success",
          title: copied ? "Link copiado" : "Arquivo pronto",
          html: copied
            ? "O link da versão final foi copiado para a área de transferência."
            : `Arquivo final pronto:<br><br><a href="${link}" target="_blank" rel="noopener">${link}</a>`,
          confirmButtonText: "OK",
          buttonsStyling: false,
          customClass: {
            popup: "impar-swal",
            confirmButton: "impar-swal-confirm"
          }
        });
        return;
      }

if (data.downloadUrl) {
  const a = document.createElement("a");
  a.href = data.downloadUrl;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

      await Swal.fire({
        icon: "success",
        title: "Download preparado",
        html: "A versão final foi preparada com sucesso.",
        confirmButtonText: "OK",
        buttonsStyling: false,
        customClass: {
          popup: "impar-swal",
          confirmButton: "impar-swal-confirm"
        }
      });
    } catch (err) {
      if (typeof hideImparLoading === "function") {
        hideImparLoading();
      }
      Swal.fire({
        icon: "error",
        title: "Erro ao gerar versão final",
        html: err?.message || String(err)
      });
    }
  }

  window.DOC_FINAL_ACTIONS = {
    abrirModalDocumentoFinal
  };
})();
