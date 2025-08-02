console.log("📌 Script carregado");

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar EmailJS
  if (typeof emailjs !== "undefined") {
    emailjs.init("VZ2H8uoqg4dI4Z1uS"); // Substitua pelo seu PUBLIC KEY
    console.log("✅ EmailJS inicializado.");
  }

  // Variáveis globais
  let usuarioLogado = null;
  const tabelaBody = document.querySelector("#tabelaMateriais tbody");
  const listaMateriais = [];

  // Carregar usuários
  try {
    const resp = await fetch("usuarios.json");
    const usuarios = await resp.json();
    console.log("✅ Usuários carregados:", usuarios);

    const usuarioSelect = document.getElementById("usuario");
    if (usuarioSelect) {
      usuarios.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.Email;
        opt.textContent = u.Nome;
        usuarioSelect.appendChild(opt);
      });
    }

    // Login
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = usuarioSelect.value;
        const senha = document.getElementById("senha").value;

        const usuario = usuarios.find(u => u.Email === email && u.Senha === senha);
        if (!usuario) {
          Swal.fire("Erro", "Usuário ou senha inválidos!", "error");
          return;
        }

        // Salva login
        localStorage.setItem("usuario", JSON.stringify(usuario));
        window.location.href = "solicitacao.html";
      });
    }
  } catch (err) {
    console.error("Erro ao carregar usuários:", err);
    Swal.fire("Erro", "Falha ao carregar a lista de usuários.", "error");
  }

  // Se estiver na página de solicitação
  if (document.getElementById("solicitacaoForm")) {
    usuarioLogado = JSON.parse(localStorage.getItem("usuario"));
    if (!usuarioLogado) {
      Swal.fire("Erro", "Faça login novamente.", "error").then(() => {
        window.location.href = "login.html";
      });
      return;
    }

    document.getElementById("nomeUsuario").innerText = usuarioLogado.Nome;
    document.getElementById("emailUsuario").innerText = usuarioLogado.Email;

    // Carregar obras
    try {
      const respObras = await fetch("obras.json");
      const obras = await respObras.json();
      console.log("✅ Obras carregadas:", obras);

      const obraSelect = document.getElementById("obra");
      obras.filter(o => o.Email === usuarioLogado.Email).forEach(o => {
        const opt = document.createElement("option");
        opt.value = o.Obra;
        opt.textContent = o.Obra;
        obraSelect.appendChild(opt);
      });

      obraSelect.addEventListener("change", () => {
        const obraSelecionada = obras.find(o => o.Obra === obraSelect.value);
        document.getElementById("centroCusto").value = obraSelecionada ? obraSelecionada["Centro de Custo"] : "";
      });
    } catch (err) {
      console.error("Erro ao carregar obras:", err);
    }

    // Carregar materiais
    try {
      const respMateriais = await fetch("materiais.json");
      const materiais = await respMateriais.json();
      console.log("✅ Materiais carregados:", materiais);

      const materialSelect = document.getElementById("material");
      materiais.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.Material;
        opt.textContent = m.Material;
        opt.setAttribute("data-und", m.UND);
        materialSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Erro ao carregar materiais:", err);
    }

    // Adicionar material
    document.getElementById("adicionarBtn").addEventListener("click", () => {
      const material = document.getElementById("material").value;
      const quantidade = document.getElementById("quantidade").value;
      const und = document.querySelector(`#material option[value="${material}"]`)?.getAttribute("data-und");

      if (!material || !quantidade) {
        Swal.fire("Erro", "Preencha material e quantidade!", "error");
        return;
      }

      listaMateriais.push({ material, und, quantidade });
      atualizarTabela();
    });

    function atualizarTabela() {
      tabelaBody.innerHTML = "";
      listaMateriais.forEach((item, idx) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.material}</td>
          <td>${item.und}</td>
          <td>${item.quantidade}</td>
          <td><span class="btn-remover" data-idx="${idx}">❌</span></td>
        `;
        tabelaBody.appendChild(row);
      });

      document.querySelectorAll(".btn-remover").forEach(btn => {
        btn.addEventListener("click", () => {
          listaMateriais.splice(btn.getAttribute("data-idx"), 1);
          atualizarTabela();
        });
      });
    }

    // Enviar solicitação
    document.getElementById("solicitacaoForm").addEventListener("submit", (e) => {
      e.preventDefault();

      if (!listaMateriais.length) {
        Swal.fire("Erro", "Adicione pelo menos um material!", "error");
        return;
      }

      const params = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra: document.getElementById("obra").value,
        centro_custo: document.getElementById("centroCusto").value,
        data: document.getElementById("prazo").value,
        local_entrega: document.getElementById("localEntrega").value,
        materiais: JSON.stringify(listaMateriais, null, 2)
      };

      console.log("📧 Enviando com parâmetros:", params);

      emailjs.send("service_fzht86y", "template_wz0ywdo", params)
        .then(() => Swal.fire("Sucesso!", "Solicitação enviada com sucesso!", "success"))
        .catch(err => Swal.fire("Erro", "Falha no envio: " + err.text, "error"));
    });
  }
});

function toggleSenha() {
  const senha = document.getElementById("senha");
  senha.type = senha.type === "password" ? "text" : "password";
}
