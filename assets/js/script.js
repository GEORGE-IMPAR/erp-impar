document.addEventListener("DOMContentLoaded", function () {
    const userLogado = JSON.parse(localStorage.getItem("userLogado"));

    if (userLogado) {
        const nomeEmailDiv = document.createElement("div");
        nomeEmailDiv.style.textAlign = "center";
        nomeEmailDiv.style.fontSize = "0.9rem"; // menor que o título principal
        nomeEmailDiv.innerHTML = `
            <strong>${userLogado.Nome}</strong><br>
            <span>${userLogado.Email}</span>
        `;

        const titulo = document.querySelector("h2");
        titulo.parentNode.insertBefore(nomeEmailDiv, titulo.nextSibling);
    }

    // Carrega materiais do JSON e popula o select
    fetch('./assets/db/materiais.json')
        .then(response => response.json())
        .then(materiais => {
            const materialSelect = document.getElementById("material");
            materiais.forEach(mat => {
                const option = document.createElement("option");
                option.value = mat.nome;
                option.textContent = mat.nome;
                option.dataset.und = mat.und;
                materialSelect.appendChild(option);
            });
        });

    const btnAdicionar = document.getElementById("adicionarMaterial");
    const tabelaBody = document.getElementById("tabelaMateriais").querySelector("tbody");
    let materiaisAdicionados = [];

    btnAdicionar.addEventListener("click", function () {
        const materialSelect = document.getElementById("material");
        const materialNome = materialSelect.value;
        const materialUND = materialSelect.options[materialSelect.selectedIndex].dataset.und;
        const quantidade = document.getElementById("quantidade").value;

        if (!materialNome) {
            alert("⚠️ Por favor, selecione um material.");
            return;
        }

        if (!quantidade || isNaN(quantidade) || Number(quantidade) <= 0) {
            alert("⚠️ Por favor, insira uma quantidade válida (maior que zero).");
            return;
        }

        const novoMaterial = {
            material: materialNome,
            und: materialUND,
            quantidade: quantidade
        };

        materiaisAdicionados.push(novoMaterial);

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${novoMaterial.material}</td>
            <td>${novoMaterial.und}</td>
            <td>${novoMaterial.quantidade}</td>
            <td><button class="btnExcluir">❌</button></td>
        `;
        tabelaBody.appendChild(row);

        // Limpa os campos após adicionar
        materialSelect.value = "";
        document.getElementById("quantidade").value = "";
    });

    // Evento para remover material da tabela
    tabelaBody.addEventListener("click", function (e) {
        if (e.target.classList.contains("btnExcluir")) {
            const row = e.target.closest("tr");
            const index = Array.from(tabelaBody.children).indexOf(row);
            materiaisAdicionados.splice(index, 1);
            row.remove();
        }
    });

    // Expondo os materiais coletados para o outro script
    window.getMateriaisAdicionados = function () {
        return materiaisAdicionados;
    };
});
