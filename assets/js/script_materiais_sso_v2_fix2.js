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

   // if (toggleSenha && senhaInput) {
   //   toggleSenha.addEventListener("click", () => {
   //     senhaInput.type = senhaInput.type === "password" ? "text" : "password";
   //   });
   // }

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

    
  
  // ============================
  // SSO (MENU -> MÓDULO MATERIAIS)
  // Pega o usuário autenticado no MENU e espelha no formato que este módulo espera
  // (usuarioLogado com chaves Nome/Email/responsável). Isso evita "usuário preso" (stale)
  // e garante que SEMPRE use o usuário atual do menu.
  // ============================
  function __detectMenuUser() {
    const preferredKeys = [
      "ERPIMPAR_USER",
      "ERP_IMPAR_USER",
      "ERP_USER",
      "usuarioERP",
      "usuario_erp",
      "usuarioLogadoERP",
      "usuarioLogadoMenu",
      "menuUser",
      "currentUser"
    ];

    const readFromStorage = (stg, key) => {
      try {
        const raw = stg.getItem(key);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object") return obj;
      } catch (e) {}
      return null;
    };

    // 1) chaves preferidas
    for (const k of preferredKeys) {
      const a = readFromStorage(localStorage, k) || readFromStorage(sessionStorage, k);
      if (a && (a.email || a.Email)) return a;
    }

    // 2) heurística: varre storages e pega o objeto que parece "usuário ERP"
    const scan = (stg) => {
      try {
        for (let i = 0; i < stg.length; i++) {
          const k = stg.key(i);
          if (!k) continue;
          const obj = readFromStorage(stg, k);
          if (!obj) continue;
          const email = (obj.email || obj.Email || "").toString();
          const nome  = (obj.nome || obj.Nome || obj.name || "").toString();
          const mods  = obj.modulos || obj.modules || obj.permissoes || obj.permissions;
          // sinais fortes: email + (modulos array) ou foto/cargo
          const looksLikeERP =
            email.includes("@") &&
            (
              Array.isArray(mods) ||
              obj.foto || obj.Foto ||
              obj.cargo || obj.Cargo ||
              obj.telefone || obj.Telefone
            );

          if (looksLikeERP) return obj;
        }
      } catch (e) {}
      return null;
    };

    return scan(localStorage) || scan(sessionStorage) || null;
  }

  try {
    const mu = __detectMenuUser();
    const urlParams = new URLSearchParams(location.search);
    const muNome  = (urlParams.get("nome") || urlParams.get("name") || (mu?.Nome || mu?.nome || mu?.name) || "").trim();
    const muEmail = (urlParams.get("email") || (mu?.Email || mu?.email) || "").trim();

    if (muEmail) {
      const mapped = {
        Nome: muNome || muEmail.split("@")[0],
        Email: muEmail,
        "responsável": (muNome || muEmail.split("@")[0]),
        Senha: "" // não é usado aqui
      };
      // sempre sobrescreve para não ficar "preso" no usuário anterior
      localStorage.setItem("usuarioLogado", JSON.stringify(mapped));
      sessionStorage.setItem("usuarioLogado", JSON.stringify(mapped));
    }
  } catch (e) {
    console.warn("SSO: falha ao sincronizar usuário do menu:", e);
  }

const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Você precisa fazer login novamente!", "error")
        .then(() => { window.location.href = "menu.html"; });
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
            .then(() => window.location.href = "menu.html");
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


// ==========================
// CONSULTA DE SOLICITAÇÕES POR COORDENADOR
// ==========================
(function configurarConsultaSolicitacoes() {
  const URL_SOLICITACOES = "https://api.erpimpar.com.br/materiais/data/solicitacoes_material.json";
  let solicitacoesMaterialCache = [];

  function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function normalizaFiltro(txt) {
    return String(txt || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  function formatarDataBR(dataHora) {
    if (!dataHora) return "-";
    const dt = new Date(dataHora);
    if (Number.isNaN(dt.getTime())) return escapeHtml(dataHora);
    return dt.toLocaleString("pt-BR");
  }

  function obterCoordenadoresUnicos(lista) {
    return [...new Set(
      (lista || [])
        .map(s => String(s.coordenador || "").trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function renderListaSolicitacoesModal() {
    const box = document.getElementById("swalListaSolicitacoes");
    const select = document.getElementById("swalFiltroCoord");
    const total = document.getElementById("swalTotalSolicitacoes");
    if (!box) return;

    const coordSelecionado = normalizaFiltro(select?.value || "");

    const filtradas = coordSelecionado
      ? solicitacoesMaterialCache.filter(s => normalizaFiltro(s.coordenador) === coordSelecionado)
      : solicitacoesMaterialCache;

    if (total) {
      total.textContent = `${filtradas.length} solicitação(ões) encontrada(s)`;
    }

    if (!filtradas.length) {
      box.innerHTML = `
        <div style="
          padding:14px;
          border-radius:14px;
          border:1px dashed rgba(148,163,184,.35);
          color:#cbd5e1;
          font-weight:800;
          text-align:center;
        ">
          Nenhuma solicitação encontrada para este filtro.
        </div>
      `;
      return;
    }

    box.innerHTML = filtradas.slice().reverse().map((s, idx) => {
      const materiais = Array.isArray(s.materiais) ? s.materiais : [];
      const materiaisHtml = materiais.length
        ? `
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:8px;border-radius:12px;border:1px solid rgba(148,163,184,.26);">
            <table style="width:100%;min-width:620px;border-collapse:collapse;background:rgba(2,6,23,.78);font-size:12px;">
              <thead>
                <tr>
                  <th style="padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.30);text-align:left;color:#e5e7eb;background:rgba(15,23,42,.88);">Material</th>
                  <th style="padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.30);text-align:center;color:#e5e7eb;background:rgba(15,23,42,.88);width:80px;">UND</th>
                  <th style="padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.30);text-align:center;color:#e5e7eb;background:rgba(15,23,42,.88);width:110px;">Quantidade</th>
                  <th style="padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.30);text-align:left;color:#e5e7eb;background:rgba(15,23,42,.88);width:190px;">Observação</th>
                </tr>
              </thead>
              <tbody>
                ${materiais.map(m => {
                  const material = escapeHtml(m.material || "-");
                  const unidade = escapeHtml(m.unidade || m.und || "-");
                  const quantidade = escapeHtml(m.quantidade || "-");
                  const observacao = escapeHtml(m.observacao || "-");
                  return `
                    <tr>
                      <td style="padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.18);color:#dbeafe;vertical-align:top;">${material}</td>
                      <td style="padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.18);color:#e5e7eb;text-align:center;vertical-align:top;">${unidade}</td>
                      <td style="padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.18);color:#e5e7eb;text-align:center;vertical-align:top;font-weight:900;">${quantidade}</td>
                      <td style="padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.18);color:#cbd5e1;vertical-align:top;">${observacao}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div style="margin-top:8px;padding:10px;border-radius:12px;border:1px dashed rgba(148,163,184,.32);color:#cbd5e1;">Nenhum material informado.</div>`;

      return `
        <div style="
          border-radius:16px;
          padding:13px 14px;
          background:linear-gradient(135deg, rgba(2,6,23,.78), rgba(15,23,42,.62));
          border:1px solid rgba(148,163,184,.22);
          color:#e5e7eb;
          font-size:13px;
          line-height:1.5;
          box-shadow:0 12px 26px rgba(0,0,0,.22);
        ">
          <div style="
            display:flex;
            justify-content:space-between;
            gap:10px;
            flex-wrap:wrap;
            margin-bottom:6px;
          ">
            <div style="font-weight:900;color:#fff;">${escapeHtml(s.obra || "-")}</div>
            <div style="
              font-size:11px;
              font-weight:900;
              color:#93c5fd;
              text-transform:uppercase;
              letter-spacing:.04em;
            ">${escapeHtml(s.coordenador || "Não informado")}</div>
          </div>

          <div><strong>Solicitante:</strong> ${escapeHtml(s.solicitante || "-")}</div>
          <div><strong>Data:</strong> ${formatarDataBR(s.dataHora)}</div>
          ${s.localEntrega ? `<div><strong>Local de entrega:</strong> ${escapeHtml(s.localEntrega)}</div>` : ""}
          ${s.prazo ? `<div><strong>Prazo:</strong> ${escapeHtml(s.prazo)}</div>` : ""}
          ${s.centroCusto ? `<div><strong>Centro de custo:</strong> ${escapeHtml(s.centroCusto)}</div>` : ""}

          <div style="margin-top:10px;font-weight:900;color:#bfdbfe;">Materiais solicitados</div>
          ${materiaisHtml}
        </div>
      `;
    }).join("");
  }

  async function abrirConsultaSolicitacoes() {
    try {
      Swal.fire({
        title: "Carregando solicitações…",
        html: `<div style="font-size:13px;opacity:.85">Buscando histórico salvo no JSON.</div>`,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
      });

      const resp = await fetch(URL_SOLICITACOES + "?ts=" + Date.now(), { cache: "no-store" });
      if (!resp.ok) {
        throw new Error("HTTP " + resp.status);
      }

      const lista = await resp.json();
      solicitacoesMaterialCache = Array.isArray(lista) ? lista : [];

      const coordenadores = obterCoordenadoresUnicos(solicitacoesMaterialCache);
      const options = `<option value="">Todos</option>` +
        coordenadores.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

      Swal.fire({
        title: "Consultar solicitações",
        width: 920,
        html: `
          <div style="text-align:left">
            <label style="
              display:block;
              margin-bottom:6px;
              font-size:11px;
              text-transform:uppercase;
              letter-spacing:.08em;
              color:#9ca3af;
              font-weight:800;
            ">Coordenador</label>

            <select id="swalFiltroCoord" style="
              width:100%;
              height:42px;
              margin-bottom:10px;
              border-radius:12px;
              border:1px solid rgba(96,165,250,.28);
              background:#071532;
              color:#fff;
              font-size:13px;
              font-weight:800;
              padding:0 12px;
              outline:none;
            ">
              ${options}
            </select>

            <div id="swalTotalSolicitacoes" style="
              font-size:12px;
              color:#cbd5e1;
              font-weight:800;
              margin:0 0 10px;
            "></div>

            <div id="swalListaSolicitacoes" style="
              max-height:430px;
              overflow:auto;
              display:flex;
              flex-direction:column;
              gap:10px;
              padding-right:4px;
            "></div>
          </div>
        `,
        showConfirmButton: true,
        confirmButtonText: "Fechar",
        didOpen: () => {
          const select = document.getElementById("swalFiltroCoord");
          if (select) {
            select.addEventListener("change", renderListaSolicitacoesModal);
          }
          renderListaSolicitacoesModal();
        }
      });

    } catch (err) {
      console.error("Erro ao consultar solicitações:", err);
      Swal.fire("Erro", "Não foi possível carregar as solicitações.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnConsultarSolicitacoes");
    if (btn) {
      btn.addEventListener("click", abrirConsultaSolicitacoes);
    }
  });
})();

