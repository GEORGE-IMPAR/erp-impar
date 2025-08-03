document.addEventListener("DOMContentLoaded", () => {
  console.log("📌 Script carregado");

  // Inicializar EmailJS
  if (window.emailjs) {
    emailjs.init({ publicKey: "WddODLBw11FUrjP-q" });
    console.log("✅ EmailJS inicializado");
  }

  // Verifica se estamos na tela de solicitação
  if (document.getElementById("solicitacaoForm")) {
    console.log("📋 Tela de solicitação detectada");

    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    const usuarioInfo = document.getElementById("usuarioInfo");
    if (usuarioLogado && usuarioInfo) {
      usuarioInfo.innerText = `${usuarioLogado.Nome} (${usuarioLogado.Email})`;
    }

    const obraSelect = document.getElementById("obra");
    const centroCustoInput = document.getElementById("centroCusto");
    const materialSelect = document.getElementById("material");
    const addMaterialBtn = document.getElementById("addMaterial");
    const tabelaMateriais = document
      .getElementById("tabelaMateriais")
      ?.querySelector("tbody");
    const form = document.getElementById("solicitacaoForm");

    let listaMateriais = [];
    let obrasUsuario = [];

    // Carregar obras do JSON
    fetch("obras.json")
      .then((res) => res.json())
      .then((obras) => {
        if (obraSelect) {
          obrasUsuario = obras.filter(
            (o) => usuarioLogado && o.Email === usuarioLogado.Email
          );
          obrasUsuario.forEach((obra) => {
            const opt = document.createElement("option");
            opt.value = obra.Obra;
            opt.textContent = obra.Obra;
            obraSelect.appendChild(opt);
          });
        }
      })
      .catch((err) => console.error("Erro ao carregar obras:", err));

    // Atualizar centro de custo ao escolher obra
    if (obraSelect && centroCustoInput) {
      obraSelect.addEventListener("change", () => {
        const selected = obrasUsuario.find(
          (o) => o.Obra === obraSelect.value
        );
        centroCustoInput.value = selected
          ? selected["Centro de Custo"]
          : "";
      });
    }

    // Carregar materiais
    fetch("materiais.json")
      .then((res) => res.json())
      .then((materiais) => {
        if (materialSelect) {
          materiais.forEach((mat) => {
            const opt = document.createElement("option");
            opt.value = mat.Material;
            opt.textContent = mat.Material;
            materialSelect.appendChild(opt);
          });
        }
      })
      .catch((err) => console.error("Erro ao carregar materiais:", err));

    // Adicionar material à lista
    if (addMaterialBtn && tabelaMateriais) {
      addMaterialBtn.addEventListener("click", () => {
        const material = materialSelect.value;
        const quantidade = document.getElementById("quantidade").value;

        if (!material || !quantidade) {
          Swal.fire("⚠️ Preencha material e quantidade!", "", "warning");
          return;
        }

        listaMateriais.push({ material, quantidade });

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${material}</td>
          <td>${quantidade}</td>
          <td><span class="btn-remover">❌</span></td>
        `;

        row.querySelector(".btn-remover").addEventListener("click", () => {
          tabelaMateriais.removeChild(row);
          listaMateriais = listaMateriais.filter(
            (item) => !(item.material === material && item.quantidade === quantidade)
          );
        });

        tabelaMateriais.appendChild(row);
        document.getElementById("quantidade").value = "";
      });
    }

    // Envio do formulário
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();

        const obra = obraSelect?.value;
        const centro_custo = centroCustoInput?.value;
        const data = document.getElementById("data")?.value;
        const local_entrega = document.getElementById("localEntrega")?.value;

        if (!obra || !centro_custo || !data || !local_entrega || listaMateriais.length === 0) {
          Swal.fire("⚠️ Preencha todos os campos e adicione materiais!", "", "warning");
          return;
        }

        const templateParams = {
          nome: usuarioLogado.Nome,
          from_email: usuarioLogado.Email,
          obra,
          centro_custo,
          data,
          local_entrega,
          materiais: listaMateriais
            .map((m) => `${m.material} - ${m.quantidade}`)
            .join("\n"),
        };

        console.log("📧 Enviando com parâmetros:", templateParams);

        emailjs
          .send("service_fzht86y", "template_wz0ywdo", templateParams)
          .then(() => {
            Swal.fire("✅ Solicitação enviada com sucesso!", "", "success");
          })
          .catch((err) => {
            console.error("Erro EmailJS:", err);
            Swal.fire("❌ Erro ao enviar solicitação!", "", "error");
          });
      });
    }
  }
});
