// Inicialização do EmailJS
(function() {
  emailjs.init("WddODLBw11FUrjP-q"); // sua public key
})();

document.addEventListener("DOMContentLoaded", () => {
  // LOGIN
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("usuario").value.trim().toLowerCase();
      const senha = document.getElementById("senha").value.trim();

      try {
        const response = await fetch("usuarios.json");
        const usuarios = await response.json();

        const usuario = usuarios.find(
          (u) =>
            u.Email.trim().toLowerCase() === email &&
            u.Senha.trim() === senha
        );

        if (usuario) {
          localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
          Swal.fire({
            icon: "success",
            title: "Login realizado!",
            showConfirmButton: false,
            timer: 2000,
          }).then(() => {
            window.location.href = "solicitacao.html";
          });
        } else {
          Swal.fire("Erro", "Email ou senha inválidos.", "error");
        }
      } catch (error) {
        console.error("Erro login:", error);
        Swal.fire("Erro!", "Falha ao validar login.", "error");
      }
    });
  }

  // SOLICITAÇÃO
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (usuarioLogado) {
    const nomeEl = document.getElementById("usuarioNome");
    const emailEl = document.getElementById("usuarioEmail");

    if (nomeEl) nomeEl.innerText = usuarioLogado.Nome;
    if (emailEl) emailEl.innerText = usuarioLogado.Email;

    carregarObras(usuarioLogado.Email);
    carregarMateriais();
  }

  // Botão de envio da solicitação
  const formSolicitacao = document.getElementById("formSolicitacao");
  if (formSolicitacao) {
    formSolicitacao.addEventListener("submit", async (e) => {
      e.preventDefault();

      const obra = document.getElementById("obra").value;
      const centroCusto = document.getElementById("centroCusto").value;
      const data = document.getElementById("dataEntrega").value;
      const localEntrega = document.getElementById("localEntrega").value;
      const tabela = document.getElementById("tabelaMateriais").innerHTML;

      if (!obra || !centroCusto || !data || !localEntrega) {
        Swal.fire("Atenção", "Preencha todos os campos obrigatórios!", "warning");
        return;
      }

      const params = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra,
        centro_custo: centroCusto,
        data,
        materiais: tabela,
      };

      try {
        const res = await emailjs.send(
          "service_fzht86y",
          "template_wz0ywdo",
          params
        );

        console.log("📧 Enviado:", res);
        Swal.fire("Sucesso!", "Solicitação enviada com sucesso!", "success");
      } catch (error) {
        console.error("Erro EmailJS:", error);
        Swal.fire("Erro!", "Falha ao enviar a solicitação.", "error");
      }
    });
  }
});

// Função para carregar obras
async function carregarObras(email) {
  try {
    const response = await fetch("obras.json");
    const obras = await response.json();

    const comboObra = document.getElementById("obra");
    const centroCusto = document.getElementById("centroCusto");
    if (!comboObra) return;

    comboObra.innerHTML = '<option value="">Selecione a obra...</option>';

    obras.forEach((o) => {
      if (o.Email.trim().toLowerCase() === email.trim().toLowerCase()) {
        const option = document.createElement("option");
        option.value = o.Obra;
        option.textContent = o.Obra;
        option.setAttribute("data-centro", o["Centro de Custo"]);
        comboObra.appendChild(option);
      }
    });

    comboObra.addEventListener("change", () => {
      const selected = comboObra.options[comboObra.selectedIndex];
      if (selected && selected.getAttribute("data-centro")) {
        centroCusto.value = selected.getAttribute("data-centro");
      } else {
        centroCusto.value = "";
      }
    });
  } catch (error) {
    console.error("Erro ao carregar obras:", error);
    Swal.fire("Erro!", "Falha ao carregar obras.", "error");
  }
}

// Função para carregar materiais
async function carregarMateriais() {
  try {
    const response = await fetch("materiais.json");
    const materiais = await response.json();

    const comboMaterial = document.getElementById("material");
    if (!comboMaterial) return;

    comboMaterial.innerHTML = '<option value="">Selecione o material...</option>';
    materiais
      .sort((a, b) => a.Material.localeCompare(b.Material))
      .forEach((m) => {
        const option = document.createElement("option");
        option.value = m.Material;
        option.textContent = m.Material; // sem UND, como você pediu
        comboMaterial.appendChild(option);
      });
  } catch (error) {
    console.error("Erro ao carregar materiais:", error);
    Swal.fire("Erro!", "Falha ao carregar materiais.", "error");
  }
}
