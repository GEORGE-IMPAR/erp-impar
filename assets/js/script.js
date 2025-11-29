// Inicializar EmailJS
(function() {
  emailjs.init("WddODLBw11FUrjP-q"); // sua public key
})();

document.addEventListener("DOMContentLoaded", () => {
  const usuarioSelect   = document.getElementById("usuario");
  const senhaInput      = document.getElementById("senha");
  const toggleSenha     = document.getElementById("toggleSenha");
  const loginForm       = document.getElementById("loginForm");
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  // ==============================
  // LOGIN
  // ==============================
  if (usuarioSelect && loginForm) {
    carregarUsuarios(usuarioSelect);

    if (toggleSenha && senhaInput) {
      toggleSenha.addEventListener("click", () => {
        senhaInput.type = senhaInput.type === "password" ? "text" : "password";
      });
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = usuarioSelect.value;
      const senha = senhaInput.value;

      try {
        const resp = await fetch("usuarios.json");
        const usuarios = await resp.json();

        const usuario = usuarios.find(
          u => u.Email.trim().toLowerCase() === email.trim().toLowerCase() &&
               u.Senha === senha
        );

        if (usuario) {
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          Swal.fire({
            icon: "success",
            title: "Login realizado com sucesso!",
            showConfirmButton: false,
            timer: 2000
          });
          setTimeout(() => window.location.href = "solicitacao.html", 2000);
        } else {
          Swal.fire({
            icon: "error",
            title: "Email ou senha inválidos!",
            confirmButtonText: "Tentar novamente"
          });
        }
      } catch (err) {
        console.error("Erro ao validar login:", err);
        Swal.fire("Erro", "Falha ao carregar usuários!", "error");
      }
    });
  }

  // ==============================
  // SOLICITAÇÃO DE MATERIAL
  // ==============================
  if (solicitacaoForm) {
    const obraSelect        = document.getElementById("obra");
    const centroCustoInput  = document.getElementById("centroCusto");
    const materialSelect    = document.getElementById("material");
    const quantidadeInput   = document.getElementById("quantidade");
    const observacaoInput   = document.getElementById("observacao");
    const tabelaMateriais   = document.querySelector("#tabelaMateriais tbody");
    const adicionarBtn      = document.getElementById("adicionarMaterial");
    const localEntregaSelect= document.getElementById("localEntrega");

    // NOVOS ELEMENTOS (modo manual)
    const modoManualChk       = document.getElementById("modoManual");
    const materialManualInput = document.getElementById("materialManual");

    let materiaisAdicionados = [];

    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Você precisa fazer login novamente!", "error").then(() => {
        window.location.href = "login.html";
      });
      return;
    }

    // CABEÇALHO CENTRALIZADO COM NOME E E-MAIL
    const headerDiv = document.getElementById("user-info");
    if (headerDiv) {
      headerDiv.style.textAlign = "center";
      headerDiv.innerHTML = `
        <div style="font-size: 1.1em;">${usuarioLogado.Nome}</div>
        <div style="font-size: 1.1em;">${usuarioLogado.Email}</div>
      `;
    }

    // ==============================
    // CARREGAR OBRAS
    // ==============================
    fetch("obras.json")
      .then(r => r.json())
      .then(obras => {
        const obrasFiltradas = obras.filter(
          o => o.Email.trim().toLowerCase() === usuarioLogado.Email.trim().toLowerCase()
        );
        if (obrasFiltradas.length === 0) {
          Swal.fire("Atenção", "Você não tem obras associadas!", "warning")
            .then(() => window.location.href = "login.html");
        }
        obrasFiltradas.forEach(obra => {
          const opt = document.createElement("option");
          opt.value = obra.Obra;
          opt.textContent = obra.Obra;
          obraSelect.appendChild(opt);
        });

        obraSelect.addEventListener("change", () => {
          const selecionada = obrasFiltradas.find(o => o.Obra === obraSelect.value);
          centroCustoInput.value = selecionada ? selecionada["Centro de Custo"] : "";
        });
      });

    // ==============================
    // CARREGAR MATERIAIS + TOMSELECT
    // ==============================
    fetch("materiais.json")
      .then(r => r.json())
      .then(materiais => {
        materiais.sort((a, b) => a.Material.localeCompare(b.Material));
        materiais.forEach(mat => {
          const opt = document.createElement("option");
          opt.value = mat.Material;
          opt.textContent = `${mat.Material} (${mat.UND})`;
          opt.dataset.und = mat.UND;
          materialSelect.appendChild(opt);
        });

        // Aplicar Tom Select após preenchimento dos materiais
        new TomSelect("#material", {
          create: false,
          maxOptions: 1000,
          sortField: {
            field: "text",
            direction: "asc"
          },
          placeholder: "Selecione um material..."
        });
      });

    // ==============================
    // MODO MANUAL: TOGGLE LISTA x INPUT
    // ==============================
    if (modoManualChk && materialManualInput && materialSelect) {
      modoManualChk.addEventListener("change", () => {
        const ts = materialSelect.tomselect; // TomSelect instância (se já carregou)

        if (modoManualChk.checked) {
          // MODO MANUAL
          if (ts) ts.disable();
          materialSelect.style.opacity = "0.4";
          materialManualInput.style.display = "block";
          materialManualInput.focus();
        } else {
          // MODO LISTA
          if (ts) ts.enable();
          materialSelect.style.opacity = "1";
          materialManualInput.style.display = "none";
          materialManualInput.value = "";
        }
      });
    }

    // ==============================
    // ADICIONAR MATERIAL
    // ==============================
    if (adicionarBtn) {
      adicionarBtn.addEventListener("click", () => {
        const usarManual = modoManualChk && modoManualChk.checked;
        const quantidade = quantidadeInput.value;
        const observacao = (observacaoInput?.value || "").trim();

        let materialDescricao;
        let und;
        let materialId = null;

        if (usarManual) {
          // ---------- MODO MANUAL ----------
          materialDescricao = (materialManualInput?.value || "").trim();
          und = "-";

          if (!materialDescricao) {
            Swal.fire({
              icon: "warning",
              title: "Informe o material",
              text: "Digite o nome do material quando estiver no modo manual."
            });
            return;
          }

        } else {
          // ---------- MODO LISTA ----------
          const material = materialSelect.value;

          // ALERTA DE MATERIAL NÃO SELECIONADO
          if (!material) {
            materialSelect.setCustomValidity("Preencha este campo.");
            materialSelect.reportValidity();
            return;
          } else {
            materialSelect.setCustomValidity("");
          }

          const selectedOption = materialSelect.selectedOptions[0];
          materialDescricao = selectedOption ? selectedOption.textContent : material;
          und = selectedOption?.dataset.und || "";
          materialId = material;
        }

        // ALERTA SE QUANTIDADE VAZIA OU INVÁLIDA
        if (!quantidade || isNaN(quantidade)) {
          quantidadeInput.setCustomValidity("Preencha este campo.");
          quantidadeInput.reportValidity();
          return;
        }

        // BLOQUEIO QUANTIDADE <= 0
        if (parseInt(quantidade) <= 0) {
          quantidadeInput.setCustomValidity("A quantidade deve ser maior que zero");
          quantidadeInput.reportValidity();
          return;
        } else {
          quantidadeInput.setCustomValidity("");
        }

        // Guarda no array (materialDescricao é o que aparece na tabela)
        materiaisAdicionados.push({
          id: materialId,
          material: materialDescricao,
          und,
          quantidade,
          observacao
        });

        atualizarTabela();

        // Limpar campos
        quantidadeInput.value = "";
        if (observacaoInput) observacaoInput.value = "";
        if (usarManual) {
          if (materialManualInput) materialManualInput.value = "";
        } else {
          if (materialSelect.tomselect) {
            materialSelect.tomselect.clear();
          } else {
            materialSelect.value = "";
          }
        }
      });
    }

    // ==============================
    // ATUALIZAR TABELA
    // ==============================
    function atualizarTabela() {
      tabelaMateriais.innerHTML = "";
      materiaisAdicionados.forEach((item, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.material}</td>
          <td>${item.und}</td>
          <td>${item.quantidade}</td>
          <td>${item.observacao || ""}</td>
          <td><span class="btn-remover" data-index="${index}">❌</span></td>
        `;
        tabelaMateriais.appendChild(row);
      });

      document.querySelectorAll(".btn-remover").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const idx = e.target.dataset.index;
          materiaisAdicionados.splice(idx, 1);
          atualizarTabela();
        });
      });
    }

    // Envio continua sendo feito no script_email.js
  }
});

// ==============================
// CARREGAR USUÁRIOS (LOGIN)
// ==============================
function carregarUsuarios(selectElement) {
  fetch("usuarios.json")
    .then(r => r.json())
    .then(users => {
      users.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.Email;
        opt.textContent = u.Nome;
        selectElement.appendChild(opt);
      });
    });
}
