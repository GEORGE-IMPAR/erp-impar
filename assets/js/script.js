// Inicializa EmailJS só se disponível (na tela de solicitação)
if (typeof emailjs !== "undefined") {
  emailjs.init("WddODLBw11FUrjP-q");
}

document.addEventListener("DOMContentLoaded", async () => {
  const usuarioSelect = document.getElementById("usuario");
  const senhaInput = document.getElementById("senha");
  const toggleSenha = document.getElementById("toggleSenha");
  const loginForm = document.getElementById("loginForm");
  const solicitacaoForm = document.getElementById("solicitacaoForm");

  // Alternar visibilidade da senha
  if (toggleSenha) {
    toggleSenha.addEventListener("click", () => {
      if (senhaInput.type === "password") {
        senhaInput.type = "text";
        toggleSenha.textContent = "🙈";
      } else {
        senhaInput.type = "password";
        toggleSenha.textContent = "👁️";
      }
    });
  }

  // Carregar usuários no login
  if (usuarioSelect) {
    try {
      const resp = await fetch("usuarios.json");
      const usuarios = await resp.json();

      usuarios.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.Email;
        opt.textContent = u.Nome;
        usuarioSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      Swal.fire("Erro", "Falha ao carregar a lista de usuários.", "error");
    }
  }

  // Validação do login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = usuarioSelect.value;
      const senha = senhaInput.value;

      try {
        const resp = await fetch("usuarios.json");
        const usuarios = await resp.json();
        const usuario = usuarios.find(u => u.Email === email && u.Senha === senha);

        if (usuario) {
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          Swal.fire("Sucesso", "Login realizado com sucesso!", "success")
            .then(() => window.location.href = "solicitacao.html");
        } else {
          Swal.fire("Erro", "Usuário ou senha inválidos.", "error");
        }
      } catch (err) {
        console.error("Erro no login:", err);
        Swal.fire("Erro", "Falha ao validar login.", "error");
      }
    });
  }

  // Solicitação
  if (solicitacaoForm) {
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Você precisa fazer login novamente.", "error")
        .then(() => window.location.href = "login.html");
      return;
    }

    const obraSelect = document.getElementById("obra");
    const centroCustoInput = document.getElementById("centroCusto");
    const materialSelect = document.getElementById("material");
    const quantidadeInput = document.getElementById("quantidade");
    const tabelaBody = document.querySelector("#tabelaMateriais tbody");
    const localEntregaSelect = document.getElementById("localEntrega");

    // Carregar obras vinculadas
    try {
      const resp = await fetch("obras.json");
      const obras = await resp.json();
      const obrasUsuario = obras.filter(o => o.Email === usuarioLogado.Email);

      if (obrasUsuario.length === 0) {
        Swal.fire("Aviso", "Nenhuma obra vinculada a este usuário.", "warning")
          .then(() => window.location.href = "login.html");
      } else {
        obrasUsuario.forEach(o => {
          const opt = document.createElement("option");
          opt.value = o.Obra;
          opt.textContent = `${o.Obra} (${o["Centro de Custo"]})`;
          obraSelect.appendChild(opt);
        });
      }

      obraSelect.addEventListener("change", () => {
        const obraSel = obrasUsuario.find(o => o.Obra === obraSelect.value);
        centroCustoInput.value = obraSel ? obraSel["Centro de Custo"] : "";
      });
    } catch {
      Swal.fire("Erro", "Falha ao carregar obras.", "error");
    }

    // Carregar materiais
    try {
      const respMat = await fetch("materiais.json");
      const materiais = await respMat.json();
      materiais.sort((a, b) => a.Material.localeCompare(b.Material));

      materiais.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.Material;
        opt.textContent = `${m.Material} (${m.UND})`;
        opt.setAttribute("data-und", m.UND);
        materialSelect.appendChild(opt);
      });
    } catch {
      Swal.fire("Erro", "Falha ao carregar materiais.", "error");
    }

    // Adicionar material
    document.getElementById("adicionarMaterial").addEventListener("click", () => {
      const materialOpt = materialSelect.options[materialSelect.selectedIndex];
      const und = materialOpt ? materialOpt.getAttribute("data-und") : "";

      if (!materialSelect.value || !quantidadeInput.value) {
        Swal.fire("Erro", "Preencha material e quantidade.", "error");
        return;
      }

      const row = tabelaBody.insertRow();
      row.insertCell(0).textContent = materialSelect.value;
      row.insertCell(1).textContent = und;
      row.insertCell(2).textContent = quantidadeInput.value;

      const acaoCell = row.insertCell(3);
      acaoCell.innerHTML = `<span class="btn-remover">❌</span>`;
      acaoCell.querySelector(".btn-remover").addEventListener("click", () => row.remove());

      materialSelect.value = "";
      quantidadeInput.value = "";
    });

    // Enviar solicitação
    solicitacaoForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!obraSelect.value || !centroCustoInput.value || !localEntregaSelect.value || !document.getElementById("dataLimite").value) {
        Swal.fire("Erro", "Preencha todos os campos obrigatórios antes de enviar.", "error");
        return;
      }

      const materiais = [];
      for (let row of tabelaBody.rows) {
        materiais.push({
          material: row.cells[0].textContent,
          unidade: row.cells[1].textContent,
          quantidade: row.cells[2].textContent
        });
      }

      const params = {
        nome: usuarioLogado.Nome,
        from_email: "george@imparsistemas.com", // fixo para evitar erro 412
        reply_to: usuarioLogado.Email,          // usuário logado para resposta
        obra: obraSelect.value,
        centro_custo: centroCustoInput.value,
        local_entrega: localEntregaSelect.value,
        data: new Date().toLocaleDateString("pt-BR"),
        numero: Math.floor(Math.random() * 100000),
        materiais: JSON.stringify(materiais)
      };

      emailjs.send("service_fzht86y", "template_wz0ywdo", params)
        .then(() => {
          Swal.fire("Sucesso", "Solicitação enviada com sucesso!", "success");
        })
        .catch((err) => {
          console.error("Erro EmailJS:", err);
          Swal.fire("Erro", "Falha ao enviar solicitação.", "error");
        });
    });
  }
});
