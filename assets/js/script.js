// =========================
// ERP Impar - script.js
// =========================

// Carrega usuários no login
document.addEventListener("DOMContentLoaded", async () => {
  console.log("📌 Script carregado");

  // Popula usuários no login
  const usuarioSelect = document.getElementById('usuario');
  if (usuarioSelect) {
    try {
      const response = await fetch('usuarios.json');
      const usuarios = await response.json();

      usuarios.forEach(u => {
        const option = document.createElement('option');
        option.value = u.Email;
        option.textContent = u.Nome;
        usuarioSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  }

  // Login
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("usuario").value;
      const senha = document.getElementById("senha").value;

      try {
        const response = await fetch('usuarios.json');
        const usuarios = await response.json();
        const usuario = usuarios.find(u => u.Email === email && u.Senha === senha);

        if (usuario) {
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          window.location.href = "solicitacao.html";
        } else {
          alert("❌ Email ou senha inválidos.");
        }
      } catch (error) {
        console.error("Erro ao validar login:", error);
        alert("❌ Falha ao validar login.");
      }
    });
  }

  // Solicitação
  if (window.location.pathname.includes("solicitacao.html")) {
    const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuario) {
      alert("⚠️ Faça login novamente.");
      window.location.href = "login.html";
      return;
    }

    // Preenche cabeçalho
    const nomeUsuario = document.getElementById("nomeUsuario");
    const emailUsuario = document.getElementById("emailUsuario");
    if (nomeUsuario) nomeUsuario.innerText = usuario.Nome;
    if (emailUsuario) emailUsuario.innerText = usuario.Email;

    // Carrega obras
    try {
      const response = await fetch("obras.json");
      const obras = await response.json();

      const obraSelect = document.getElementById("obra");
      obras
        .filter(o => o.Email.trim().toLowerCase() === usuario.Email.trim().toLowerCase())
        .forEach(o => {
          const option = document.createElement("option");
          option.value = o.Obra;
          option.textContent = o.Obra;
          option.dataset.centroCusto = o["Centro de Custo"];
          obraSelect.appendChild(option);
        });

      obraSelect.addEventListener("change", () => {
        const selected = obraSelect.options[obraSelect.selectedIndex];
        document.getElementById("centroCusto").value = selected.dataset.centroCusto || "";
      });
    } catch (error) {
      console.error("Erro ao carregar obras:", error);
    }

    // Carrega materiais
    try {
      const response = await fetch("materiais.json");
      const materiais = await response.json();

      const materialSelect = document.getElementById("material");
      materiais.sort((a, b) => a.Material.localeCompare(b.Material))
        .forEach(m => {
          const option = document.createElement("option");
          option.value = m.Material;
          option.textContent = m.Material;
          materialSelect.appendChild(option);
        });
    } catch (error) {
      console.error("Erro ao carregar materiais:", error);
    }

    // Adicionar materiais na tabela
    const btnAdd = document.getElementById("addMaterial");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        const material = document.getElementById("material").value;
        const quantidade = document.getElementById("quantidade").value;

        if (!material || !quantidade) {
          alert("⚠️ Selecione um material e informe a quantidade.");
          return;
        }

        const tbody = document.querySelector("#tabelaMateriais tbody");
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${material}</td>
          <td>${quantidade}</td>
          <td><span class="btn-remover">❌</span></td>
        `;
        tbody.appendChild(row);

        // Remover item
        row.querySelector(".btn-remover").addEventListener("click", () => row.remove());
      });
    }

    // Enviar solicitação (EmailJS)
    const btnEnviar = document.getElementById("enviarSolicitacao");
    if (btnEnviar) {
      btnEnviar.addEventListener("click", async (e) => {
        e.preventDefault();

        const obra = document.getElementById("obra").value;
        const centroCusto = document.getElementById("centroCusto").value;
        const dataEntrega = document.getElementById("dataEntrega").value;
        const localEntrega = document.getElementById("localEntrega").value;

        const materiais = [];
        document.querySelectorAll("#tabelaMateriais tbody tr").forEach(row => {
          materiais.push({
            material: row.cells[0].innerText,
            quantidade: row.cells[1].innerText
          });
        });

        if (!obra || !centroCusto || !dataEntrega || !localEntrega || materiais.length === 0) {
          alert("⚠️ Preencha todos os campos e adicione ao menos um material.");
          return;
        }

        const templateParams = {
          nome: usuario.Nome,
          from_email: usuario.Email,
          obra,
          centro_custo: centroCusto,
          data: dataEntrega,
          local_entrega: localEntrega,
          materiais: materiais
        };

        console.log("📧 Enviando com parâmetros:", templateParams);

        try {
          const response = await emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams, "WddODLBw
