// Inicializar EmailJS (mantém o que você já usava)
(function() {
  try {
    emailjs.init("WddODLBw11FUrjP-q"); // sua public key
  } catch (e) {
    console.warn("EmailJS não inicializado (modo local?):", e);
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  const usuarioSelect    = document.getElementById("usuario");
  const senhaInput       = document.getElementById("senha");
  const toggleSenha      = document.getElementById("toggleSenha");
  const loginForm        = document.getElementById("loginForm");
  const solicitacaoForm  = document.getElementById("solicitacaoForm");

  // ==========================
  // LOGIN
  // ==========================
  if (usuarioSelect && loginForm) {
    carregarUsuarios(usuarioSelect);

if (toggleSenha && senhaInput) {
  toggleSenha.addEventListener("click", (e) => {
    e.preventDefault();

    const isPassword = senhaInput.type === "password";
    // alterna o tipo do input
    senhaInput.type = isPassword ? "text" : "password";
    // alterna o ícone do olho
    toggleSenha.textContent = isPassword ? "🙈" : "👁️";
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
          u =>
            u.Email.trim().toLowerCase() === email.trim().toLowerCase() &&
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

  // ==========================
  // SOLICITAÇÃO DE MATERIAIS
  // ==========================
  if (solicitacaoForm) {
    const obraSelect         = document.getElementById("obra");
    const centroCustoInput   = document.getElementById("centroCusto");
    const materialSelect     = document.getElementById("material");
    const quantidadeInput    = document.getElementById("quantidade");
    const observacaoInput    = document.getElementById("observacao");
    const tabelaMateriais    = document.querySelector("#tabelaMateriais tbody");
    const adicionarBtn       = document.getElementById("adicionarMaterial");
    const localEntregaSelect = document.getElementById("localEntrega");

    // NOVOS elementos para modo manual
    const chkModoManual      = document.getElementById("modoManual");
    const inputMaterialManual= document.getElementById("materialManual");

    let materiaisAdicionados = [];

    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Você precisa fazer login novamente!", "error")
        .then(() => { window.location.href = "login.html"; });
      return;
    }

    // Cabeçalho com nome + e-mail
    const headerDiv = document.getElementById("user-info");
    if (headerDiv) {
      headerDiv.style.textAlign = "left";
      headerDiv.innerHTML = `
        <div style="font-size: 1.1em;"><strong>${usuarioLogado.Nome}</strong></div>
        <div style="font-size: 1.1em;">${usuarioLogado.Email}</div>
      `;
    }

    // ===== Obras associadas ao usuário =====
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

    // ===== Materiais (modo lista + TomSelect) =====
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

        new TomSelect("#material", {
          create: false,
          maxOptions: 1000,
          sortField: {
            field: "text",
            direction: "asc"
          },
          placeholder: "Selecione um material."
        });
      });

    // ===== Toggle entre LISTA x MANUAL =====
    if (chkModoManual && inputMaterialManual && materialSelect) {
      chkModoManual.addEventListener("change", () => {
        const manual = chkModoManual.checked;

        if (manual) {
          // MODO MANUAL
          materialSelect.disabled = true;
          materialSelect.style.opacity = 0.4;
          if (materialSelect.tomselect) {
            materialSelect.tomselect.disable();
            materialSelect.tomselect.clear();
          }
          inputMaterialManual.style.display = "block";
          inputMaterialManual.focus();
        } else {
          // MODO LISTA
          materialSelect.disabled = false;
          materialSelect.style.opacity = 1;
          if (materialSelect.tomselect) {
            materialSelect.tomselect.enable();
            materialSelect.tomselect.clear();
          } else {
            materialSelect.value = "";
          }
          inputMaterialManual.style.display = "none";
          inputMaterialManual.value = "";
        }
      });
    }

    // ===== Adicionar material na tabela =====
    adicionarBtn.addEventListener("click", () => {
      const manual = chkModoManual && chkModoManual.checked;

      let material = "";
      let und = "";

      if (manual) {
        material = (inputMaterialManual.value || "").trim();
        und = "-"; // unidade em branco / traço no modo manual
      } else {
        material = materialSelect.value;
        const selectedOption = materialSelect.selectedOptions[0];
        und = selectedOption?.dataset.und || "";
      }

      const quantidade = quantidadeInput.value;
      const observacao = (observacaoInput?.value || "").trim();

      // Validação de material
      if (manual) {
        if (!material) {
          inputMaterialManual.setCustomValidity("Preencha este campo.");
          inputMaterialManual.reportValidity();
          return;
        } else {
          inputMaterialManual.setCustomValidity("");
        }
      } else {
        if (!material) {
          materialSelect.setCustomValidity("Preencha este campo.");
          materialSelect.reportValidity();
          return;
        } else {
          materialSelect.setCustomValidity("");
        }
      }

      // Validação de quantidade
      if (!quantidade || isNaN(quantidade)) {
        quantidadeInput.setCustomValidity("Preencha este campo.");
        quantidadeInput.reportValidity();
        return;
      }
      if (parseInt(quantidade, 10) <= 0) {
        quantidadeInput.setCustomValidity("A quantidade deve ser maior que zero");
        quantidadeInput.reportValidity();
        return;
      } else {
        quantidadeInput.setCustomValidity("");
      }

      // Adiciona na lista e atualiza tabela
      materiaisAdicionados.push({ material, und, quantidade, observacao });
      atualizarTabela();

      // Limpa campos
      quantidadeInput.value = "";
      if (observacaoInput) observacaoInput.value = "";

      if (manual) {
        inputMaterialManual.value = "";
        inputMaterialManual.focus();
      } else if (materialSelect.tomselect) {
        materialSelect.tomselect.clear();
      } else {
        materialSelect.value = "";
      }
    });

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

      // Deixa o array acessível para o script_email.js
      window.materiaisAdicionados = materiaisAdicionados;
      window.localEntregaSelect   = localEntregaSelect;
      window.obraSelect           = obraSelect;
      window.prazoInput           = document.getElementById("prazo");
    }

    // garante que o array esteja disponível mesmo sem clicar ainda
    window.materiaisAdicionados = materiaisAdicionados;
    window.localEntregaSelect   = localEntregaSelect;
    window.obraSelect           = obraSelect;
    window.prazoInput           = document.getElementById("prazo");
  }
});

// Helper para carregar usuários no combo de login
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

