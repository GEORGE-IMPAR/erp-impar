document.addEventListener("DOMContentLoaded", () => {
    // Carregar usuários
    fetch("usuarios.json")
        .then(resp => resp.json())
        .then(data => {
            const usuarioSelect = document.getElementById("usuario");
            if (usuarioSelect) {
                data.forEach(user => {
                    const opt = document.createElement("option");
                    opt.value = user.Email;
                    opt.textContent = user.Name;
                    usuarioSelect.appendChild(opt);
                });
            }
        })
        .catch(err => {
            console.error("Erro ao carregar usuários:", err);
            Swal.fire("Erro!", "Falha ao carregar a lista de usuários.", "error");
        });

    // Alternar senha
    const toggleSenha = document.getElementById("toggleSenha");
    if (toggleSenha) {
        toggleSenha.addEventListener("click", () => {
            const senhaInput = document.getElementById("senha");
            senhaInput.type = senhaInput.type === "password" ? "text" : "password";
        });
    }

    // Login
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", e => {
            e.preventDefault();
            const email = document.getElementById("usuario").value;
            const senha = document.getElementById("senha").value;

            fetch("usuarios.json")
                .then(resp => resp.json())
                .then(users => {
                    const user = users.find(u => u.Email === email && u.Senha === senha);
                    if (user) {
                        localStorage.setItem("usuarioNome", user.Name);
                        localStorage.setItem("usuarioEmail", user.Email);
                        window.location.href = "solicitacao.html";
                    } else {
                        Swal.fire("Erro!", "Usuário ou senha inválidos!", "error");
                    }
                });
        });
    }

    // Solicitação de materiais
    const solicitacaoForm = document.getElementById("solicitacaoForm");
    if (solicitacaoForm) {
        // Carregar obras
        fetch("obras.json")
            .then(resp => resp.json())
            .then(obras => {
                const obraSelect = document.getElementById("obra");
                obras.forEach(obra => {
                    const opt = document.createElement("option");
                    opt.value = obra.Obra;
                    opt.textContent = obra.Obra;
                    opt.setAttribute("data-centro", obra["Centro de Custo"]);
                    opt.setAttribute("data-email", obra.Email);
                    obraSelect.appendChild(opt);
                });

                obraSelect.addEventListener("change", () => {
                    const selected = obraSelect.selectedOptions[0];
                    document.getElementById("centroCusto").value = selected.getAttribute("data-centro");
                });
            });

        // Carregar materiais
        fetch("materiais.json")
            .then(resp => resp.json())
            .then(materiais => {
                const materialSelect = document.getElementById("material");
                materiais.forEach(mat => {
                    const opt = document.createElement("option");
                    opt.value = mat.Material;
                    opt.textContent = mat.Material;
                    materialSelect.appendChild(opt);
                });
            });

        // Adicionar material à tabela
        document.getElementById("adicionarMaterial").addEventListener("click", () => {
            const material = document.getElementById("material").value;
            const quantidade = document.getElementById("quantidade").value;
            if (!material || !quantidade) {
                Swal.fire("Atenção!", "Preencha o material e a quantidade.", "warning");
                return;
            }

            const tbody = document.querySelector("#tabelaMateriais tbody");
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${material}</td>
                <td>Un</td>
                <td>${quantidade}</td>
                <td><span class="btn-remover">❌</span></td>
            `;
            tr.querySelector(".btn-remover").addEventListener("click", () => tr.remove());
            tbody.appendChild(tr);
        });

        // Enviar solicitação
        solicitacaoForm.addEventListener("submit", e => {
            e.preventDefault();

            const materiaisTabela = document.querySelector("#tabelaMateriais tbody").innerHTML;
            const params = {
                nome: localStorage.getItem("usuarioNome"),
                from_email: localStorage.getItem("usuarioEmail"),
                obra: document.getElementById("obra").value,
                centro_custo: document.getElementById("centroCusto").value,
                data: document.getElementById("dataEntrega").value,
                numero: Date.now(),
                materiais: materiaisTabela
            };

            console.log("📧 Enviando com parâmetros:", params);

            emailjs.send("service_fzht86y", "template_wz0ywdo", params)
                .then(resp => {
                    Swal.fire("Sucesso!", "Solicitação enviada com sucesso!", "success");
                })
                .catch(err => {
                    console.error("Erro EmailJS:", err);
                    Swal.fire("Erro!", "Falha ao enviar solicitação.", "error");
                });
        });
    }
});
