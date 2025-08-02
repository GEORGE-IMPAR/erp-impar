// ==========================
// Inicialização segura EmailJS
// ==========================
(function() {
    function initEmailJS() {
        if (typeof emailjs !== "undefined") {
            try {
                emailjs.init("WddODLBw11FUrjP-q"); // Sua Public Key
                console.log("✅ EmailJS inicializado com sucesso.");
            } catch (e) {
                console.warn("⚠️ Falha ao inicializar EmailJS:", e);
            }
        } else {
            console.warn("⚠️ EmailJS ainda não está carregado.");
        }
    }

    if (typeof emailjs === "undefined") {
        const script = document.createElement("script");
        script.src = "https://cdn.emailjs.com/dist/email.min.js";
        script.onload = initEmailJS;
        script.onerror = () => console.error("❌ Falha ao carregar EmailJS.");
        document.head.appendChild(script);
    } else {
        initEmailJS();
    }
})();

// ==========================
// Carregar Usuários
// ==========================
document.addEventListener("DOMContentLoaded", () => {
    const usuarioSelect = document.getElementById("usuario");
    const senhaInput = document.getElementById("senha");
    const loginForm = document.getElementById("loginForm");

    fetch("https://george-impar.github.io/erp-impar/usuarios.json")
        .then(resp => resp.json())
        .then(data => {
            data.forEach(user => {
                const option = document.createElement("option");
                option.value = user.Email;
                option.textContent = user.Name;
                usuarioSelect.appendChild(option);
            });
            console.log("✅ Usuários carregados:", data.length);
        })
        .catch(err => {
            console.error("❌ Erro ao carregar usuários:", err);
            alert("Falha ao carregar a lista de usuários.");
        });

    // ==========================
    // Login
    // ==========================
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = usuarioSelect.value;
        const senha = senhaInput.value;

        fetch("https://george-impar.github.io/erp-impar/usuarios.json")
            .then(resp => resp.json())
            .then(users => {
                const user = users.find(u => u.Email === email && u.Senha === senha);
                if (user) {
                    localStorage.setItem("usuarioLogado", JSON.stringify(user));
                    Swal.fire({
                        icon: "success",
                        title: "Login realizado!",
                        text: `Bem-vindo, ${user.Name}!`,
                        timer: 2000,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.href = "solicitacao.html";
                    });
                } else {
                    Swal.fire({
                        icon: "error",
                        title: "Erro!",
                        text: "Usuário ou senha incorretos."
                    });
                }
            })
            .catch(err => {
                console.error("❌ Erro no login:", err);
                Swal.fire({
                    icon: "error",
                    title: "Erro!",
                    text: "Falha ao validar login."
                });
            });
    });

    // ==========================
    // Mostrar/ocultar senha
    // ==========================
    const toggleSenha = document.getElementById("toggleSenha");
    if (toggleSenha) {
        toggleSenha.addEventListener("click", () => {
            senhaInput.type = senhaInput.type === "password" ? "text" : "password";
        });
    }
});
