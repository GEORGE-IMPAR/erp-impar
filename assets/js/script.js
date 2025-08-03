document.addEventListener("DOMContentLoaded", () => {
  console.log("📌 Script carregado");

  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (usuario) {
    document.getElementById("nomeUsuario").innerText = usuario.Nome;
    document.getElementById("emailUsuario").innerText = usuario.Email;
  }

  const listaMateriais = [];

  // Carregar obras
  fetch("obras.json")
    .then(r => r.json())
    .then(obras => {
      const selectObra = document.getElementById("obra");
      obras
        .filter(o => o.Email.trim().toLowerCase() === usuario.Email.trim().toLowerCase())
        .forEach(o => {
          const option = document.createElement("option");
          option.value = o.Obra;
          option.textContent = o.Obra;
          option.dataset.centro = o["Centro de Custo"];
          selectObra.appendChild(option);
        });

      selectObra.addEventListener("change", () => {
        const centro = selectObra.options[selectObra.selectedIndex].dataset.centro;
        document.getElementById("centro_custo").value = centro || "";
      });
    })
    .catch(e => console.error("Erro ao carregar obras:", e));

  // Carregar materiais
  fetch("materiais.json")
    .then(r => r.json())
    .then(materiais => {
      const selectMaterial = document.getElementById("material");
      materiais.forEach(m => {
        const option = document.createElement("option");
        option.value = m.Material;
        option.textContent = m.Material;
        selectMaterial.appendChild(option);
      });
    })
    .catch(e => console.error("Erro ao carregar materiais:", e));

  // Adicionar material
  document.getElementById("addMaterial").addEventListener("click", () => {
    const material = document.getElementById("material").value;
    const quantidade = document.getElementById("quantidade").value;

    if (!material || !quantidade) {
      Swal.fire("⚠️ Preencha material e quantidade!", "", "warning");
      return;
    }

    listaMateriais.push({ material, quantidade });

    const tbody = document.getElementById("tabelaMateriais").querySelector("tbody");
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${material}</td>
      <td>${quantidade}</td>
      <td><span class="btn-remover">❌</span></td>
    `;

    row.querySelector(".btn-remover").addEventListener("click", () => {
      tbody.removeChild(row);
      listaMateriais.splice(listaMateriais.indexOf(material), 1);
    });

    tbody.appendChild(row);

    document.getElementById("quantidade").value = "";
  });

  // Enviar solicitação
  document.getElementById("solicitacaoForm").addEventListener("submit", e => {
    e.preventDefault();

    const templateParams = {
      nome: usuario?.Nome || "Usuário",
      from_email: usuario?.Email || "nao@definido.com",
      obra: document.getElementById("obra").value,
      centro_custo: document.getElementById("centro_custo").value,
      data: document.getElementById("data_limite").value,
      local_entrega: document.getElementById("local_entrega").value,
      materiais: listaMateriais.map(m => `${m.material} - ${m.quantidade}`).join("\n"),
      numero: Date.now().toString().slice(-6)
    };

    console.log("📧 Enviando com parâmetros:", templateParams);

    emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams)
      .then(resp => {
        Swal.fire("✅ Solicitação enviada com sucesso!", "", "success");
        console.log("📨 EmailJS OK:", resp);
      })
      .catch(err => {
        Swal.fire("❌ Erro ao enviar solicitação!", "Veja o console.", "error");
        console.error("Erro EmailJS:", err);
      });
  });
});
