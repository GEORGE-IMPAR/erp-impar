document.addEventListener("DOMContentLoaded", async function () {
    console.log("📌 script.js carregado");

    const form = document.getElementById("formSolicitacao");
    const tabela = document.getElementById("tabelaMateriais");
    const tabelaBody = document.getElementById("tabelaBody");
    const campoObra = document.getElementById("obra");
    const campoCentroCusto = document.getElementById("centroCusto");
    const campoMaterial = document.getElementById("material");
    const campoQuantidade = document.getElementById("quantidade");
    const campoDataEntrega = document.getElementById("dataEntrega");
    const campoLocalEntrega = document.getElementById("localEntrega");
    const btnAdicionar = document.getElementById("btnAdicionar");
    const btnEnviar = document.getElementById("btnEnviar");

    const nomeUsuarioEl = document.getElementById("nomeUsuario");

    const usuario = JSON.parse(localStorage.getItem("usuario_logado"));
    if (!usuario) {
        window.location.href = "login.html";
        return;
    }

    // Corrige duplicação no cabeçalho
    if (nomeUsuarioEl) {
        nomeUsuarioEl.innerHTML = `
            <div style="text-align: center; font-size: 0.9em; line-height: 1.2;">
                ${usuario.Nome}<br>${usuario.Email}
            </div>
        `;
    }

    campoObra.addEventListener("change", function () {
        const obraSelecionada = campoObra.value;
        const obraUsuario = usuario.obras.find(o => o.nome === obraSelecionada);
        campoCentroCusto.value = obraUsuario ? obraUsuario.centro_custo : "";
    });

    const dadosArmazenados = JSON.parse(localStorage.getItem("materiais_solicitados")) || [];
    dadosArmazenados.forEach(dado => adicionarLinhaNaTabela(dado));
    atualizarStorage();

    btnAdicionar.addEventListener("click", function () {
        let materialSelecionado = campoMaterial.value;
        let quantidade = campoQuantidade.value;

        // Validação visual com estilo nativo
        if (!materialSelecionado) {
            campoMaterial.setCustomValidity("Por favor, selecione um material.");
            campoMaterial.reportValidity();
            return;
        } else {
            campoMaterial.setCustomValidity("");
        }

        if (!quantidade || parseFloat(quantidade) <= 0) {
            campoQuantidade.setCustomValidity("Informe uma quantidade válida maior que zero.");
            campoQuantidade.reportValidity();
            return;
        } else {
            campoQuantidade.setCustomValidity("");
        }

        const optionSelecionada = campoMaterial.options[campoMaterial.selectedIndex];
        const materialTexto = optionSelecionada.textContent;
        const und = materialTexto.match(/\((.*?)\)/)?.[1] || "";

        const novoMaterial = {
            material: materialTexto.replace(/\(.*?\)/, "").trim(),
            und: und,
            quantidade: parseFloat(quantidade)
        };

        adicionarLinhaNaTabela(novoMaterial);
        atualizarStorage();

        campoMaterial.selectedIndex = 0;
        campoQuantidade.value = "";
    });

    function adicionarLinhaNaTabela(dado) {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${dado.material}</td>
            <td>${dado.und}</td>
            <td>${dado.quantidade}</td>
            <td><button type="button" class="btn btn-link text-danger btn-sm btn-remover">❌</button></td>
        `;

        tr.querySelector(".btn-remover").addEventListener("click", function () {
            tr.remove();
            atualizarStorage();
        });

        tabelaBody.appendChild(tr);
    }

    function atualizarStorage() {
        const linhas = tabelaBody.querySelectorAll("tr");
        const materiais = [];

        linhas.forEach(tr => {
            const tds = tr.querySelectorAll("td");
            materiais.push({
                material: tds[0].textContent,
                und: tds[1].textContent,
                quantidade: parseFloat(tds[2].textContent)
            });
        });

        localStorage.setItem("materiais_solicitados", JSON.stringify(materiais));
    }

    // Carregar lista de materiais
    try {
        const response = await fetch("assets/db/materiais.json");
        const materiais = await response.json();

        materiais.forEach(mat => {
            const option = document.createElement("option");
            option.value = mat.nome;
            option.textContent = `${mat.nome} (${mat.und})`;
            campoMaterial.appendChild(option);
        });
    } catch (erro) {
        console.error("Erro ao carregar materiais:", erro);
    }
});
