document.addEventListener("DOMContentLoaded", async () => {
  console.log("📌 Script iniciado...");

  // =============================
  // Inicializar EmailJS
  // =============================
  try {
    emailjs.init("WddODLBw11FUrjP-q"); // sua public key
    console.log("✅ EmailJS inicializado.");
  } catch (e) {
    console.warn("⚠️ EmailJS não carregado. O envio de emails pode falhar.");
  }

  // =============================
  // Carregar usuários
  // =============================
  const usuarioSelect = document.getElementById("usuario");
  if (usuarioSelect) {
    try {
      const resp = await fetch("usuarios.json");
      const usuarios = await resp.json();
      usuarios.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.email;
        opt.innerText = u.nome; // mostra nome no select
        usuarioSelect.appendChild(opt);
      });
    } catch (e) {
      alert("Falha ao carregar a lista de usuários.");
      console.error("Erro ao carregar usuários:", e);
    }
  }

  // =============================
  // Login
  // =============================
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const email = usuarioSelect.value;
      const senha = document.getElementById("senha").value;

      if (!email || !senha) {
        Swal.fire("Erro", "Preencha usuário e senha!", "error");
        return;
      }

      fetch("usuarios.json")
        .then(r => r.json())
        .then(usuarios => {
          const usuario = usuarios.find(u => u.email === email && u.senha === senha);
          if (usuario) {
            sessionStorage.setItem("usuarioLogado", JSON.stringify(usuario));
            Swal.fire("Sucesso", "Login realizado com sucesso!", "success").then(() => {
              window.location.href = "solicitacao.html";
            });
          } else {
            Swal.fire("Erro", "Usuário ou senha inválidos!", "error");
          }
        })
        .catch(err => {
          console.error("Erro login:", err);
          Swal.fire("Erro", "Falha no login.", "error");
        });
    });
  }

  // =============================
  // Solicitação de Materiais
  // =============================
  const solicitacaoContainer = document.querySelector(".solicitacao-container");
  if (solicitacaoContainer) {
    const usuarioLogado = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Nenhum usuário logado!", "error").then(() => {
        window.location.href = "login.html";
      });
      return;
    }

    document.getElementById("usuarioNome").innerText = usuarioLogado.nome;
    document.getElementById("usuarioEmail").innerText = usuarioLogado.email;

    // Carregar obras do usuário
    const obraSelect = document.getElementById("obra");
    try {
      const respObras = await fetch("obras.json");
      const obras = await respObras.json();
      obras
        .filter(o => o.Email === usuarioLogado.email)
        .forEach(o => {
          const opt = document.createElement("option");
          opt.value = o.Obra;
          opt.innerText = o.Obra;
          obraSelect.appendChild(opt);
        });

      obraSelect.addEventListener("change", e => {
        const obraSel = obras.find(o => o.Obra === e.target.value);
        document.getElementById("centroCusto").value = obraSel ? obraSel["Centro de Custo"] : "";
      });
    } catch (e) {
      console.error("Erro ao carregar obras:", e);
    }

    // Adicionar materiais
    const materiais = [];
    const tabela = document.getElementById("tabelaMateriais");
    document.getElementById("addMaterial").addEventListener("click", () => {
      const material = document.getElementById("material").value;
      const quantidade = document.getElementById("quantidade").value;
      const unidade = document.getElementById("material").selectedOptions[0].dataset.und || "";

      if (!material || !quantidade) {
        Swal.fire("Erro", "Selecione material e quantidade!", "error");
        return;
      }

      materiais.push({ material, quantidade, und: unidade });
      const row = tabela.insertRow();
      row.innerHTML = `
        <td>${material}</td>
        <td>${unidade}</td>
        <td>${quantidade}</td>
        <td><span class="btn-remover">❌</span></td>`;
      row.querySelector(".btn-remover").addEventListener("click", () => {
        tabela.deleteRow(row.rowIndex);
        materiais.splice(row.rowIndex - 1, 1);
      });
    });

    // Enviar solicitação
    document.getElementById("solicitacaoForm").addEventListener("submit", e => {
      e.preventDefault();
      if (!obraSelect.value || materiais.length === 0) {
        Swal.fire("Erro", "Preencha todos os campos e adicione materiais!", "error");
        return;
      }

      const params = {
        nome: usuarioLogado.nome,
        from_email: usuarioLogado.email,
        obra: obraSelect.value,
        centro_custo: document.getElementById("centroCusto").value,
        data: document.getElementById("prazo").value,
        local_entrega: document.getElementById("localEntrega").value,
        materiais: materiais
      };

      console.log("📧 Enviando com parâmetros:", params);

      emailjs.send("service_fzht86y", "template_wz0ywdo", params)
        .then(() => {
          Swal.fire("Sucesso!", "Solicitação enviada com sucesso!", "success");
        })
        .catch(err => {
          console.error("Erro EmailJS:", err);
          Swal.fire("Erro", "Falha ao enviar solicitação.", "error");
        });
    });
  }
});
