document.addEventListener("DOMContentLoaded", () => {
  console.log("📌 Script carregado");

  // Carregar dados do usuário logado
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (usuarioLogado) {
    const dadosUsuario = document.getElementById("dadosUsuario");
    if (dadosUsuario) {
      dadosUsuario.innerText = `${usuarioLogado.Nome} (${usuarioLogado.Email})`;
    }
  }

  // Carregar obras
  fetch("obras.json")
    .then(r => r.json())
    .then(obras => {
      const obraSelect = document.getElementById("obra");
      if (!obraSelect) return;

      obras
        .filter(o => o.Email.trim().toLowerCase() === usuarioLogado.Email.trim().toLowerCase())
        .forEach(obra => {
          const option = document.createElement("option");
          option.value = obra.Obra;
          option.textContent = obra.Obra;
          option.dataset.centroCusto = obra["Centro de Custo"];
          obraSelect.appendChild(option);
        });

      obraSelect.addEventListener("change", e => {
        const selected = obraSelect.selectedOptions[0];
        document.getElementById("centroCusto").value = selected?.dataset.centroCusto || "";
      });
    })
    .catch(err => console.error("Erro ao carregar obras:", err));

  // Carregar materiais
  fetch("materiais.json")
    .then(r => r.json())
    .then(materiais => {
      const materialSelect = document.getElementById("material");
      if (!materialSelect) return;

      materiais.forEach(mat => {
        const option = document.createElement("option");
        option.value = mat.Material;
        option.textContent = mat.Material;
        materialSelect.appendChild(option);
      });
    })
    .catch(err => console.error("Erro ao carregar materiais:", err));

  // Lista de materiais adicionados
  const listaMateriais = [];

  const addBtn = document.getElementById("addMaterial");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const material = document.getElementById("material").value;
      const quantidade = document.getElementById("quantidade").value;

      if (!material || !quantidade) {
        Swal.fire("⚠️ Preencha material e quantidade!", "", "warning");
        return;
      }

      listaMateriais.push({ material, quantidade });

      const tbody = document.querySelector("#tabelaMateriais tbody");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${material}</td>
        <td>${quantidade}</td>
        <td><span class="btn-remover">❌</span></td>
      `;
      tbody.appendChild(tr);

      tr.querySelector(".btn-remover").addEventListener("click", () => {
        tbody.removeChild(tr);
        const idx = listaMateriais.findIndex(m => m.material === material && m.quantidade === quantidade);
        if (idx > -1) listaMateriais.splice(idx, 1);
      });
    });
  }

  // Enviar solicitação
  const enviarBtn = document.getElementById("enviarSolicitacao");
  if (enviarBtn) {
    enviarBtn.addEventListener("click", () => {
      const obra = document.getElementById("obra").value;
      const centroCusto = document.getElementById("centroCusto").value;
      const dataEntrega = document.getElementById("dataEntrega").value;
      const localEntrega = document.getElementById("localEntrega").value;

      if (!obra || !centroCusto || !dataEntrega) {
        Swal.fire("⚠️ Preencha todos os campos obrigatórios!", "", "warning");
        return;
      }

      const templateParams = {
        nome: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra,
        centro_custo: centroCusto,
        data: dataEntrega,
        local_entrega: localEntrega,
        materiais: listaMateriais
          .map(m => `${m.material} - ${m.quantidade}`)
          .join("\n")
      };

      console.log("📧 Enviando com parâmetros:", templateParams);

      if (window.emailjs) {
        emailjs
          .send("service_fzht86y", "template_wz0ywdo", templateParams)
          .then(() => {
            Swal.fire("✅ Solicitação enviada com sucesso!", "", "success");
          })
          .catch(err => {
            console.error("Erro EmailJS:", err);
            Swal.fire("❌ Falha ao enviar solicitação!", err.text || "", "error");
          });
      } else {
        Swal.fire("❌ EmailJS não inicializado!", "", "error");
      }
    });
  }
});
