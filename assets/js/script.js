document.addEventListener('DOMContentLoaded', async () => {
  console.log("📌 Script carregado");

  // Recupera usuário logado
  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado')) || null;
  if (usuarioLogado) {
    const nomeEl = document.getElementById('usuarioNome');
    const emailEl = document.getElementById('usuarioEmail');
    if (nomeEl) nomeEl.innerText = usuarioLogado.Nome || "";
    if (emailEl) emailEl.innerText = usuarioLogado.Email || "";
  }

  // Carregar usuários (Login)
  if (document.getElementById('usuario')) {
    try {
      const resUsuarios = await fetch('usuarios.json');
      const usuarios = await resUsuarios.json();

      const selectUsuario = document.getElementById('usuario');
      usuarios.forEach(u => {
        const option = document.createElement('option');
        option.value = u.Email;
        option.textContent = u.Nome;
        selectUsuario.appendChild(option);
      });
    } catch (e) {
      console.error("Erro ao carregar usuários:", e);
    }

    // Validação login
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('usuario').value;
      const senha = document.getElementById('senha').value;

      try {
        const resUsuarios = await fetch('usuarios.json');
        const usuarios = await resUsuarios.json();
        const usuario = usuarios.find(u => u.Email === email && u.Senha === senha);

        if (usuario) {
          localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
          Swal.fire("✅ Login realizado com sucesso!", "", "success").then(() => {
            window.location.href = "solicitacao.html";
          });
        } else {
          Swal.fire("❌ Usuário ou senha inválidos!", "", "error");
        }
      } catch (err) {
        console.error("Erro login:", err);
        Swal.fire("❌ Falha ao validar login!", "", "error");
      }
    });
  }

  // Carregar obras e materiais (Solicitação)
  if (document.getElementById('obra')) {
    try {
      const resObras = await fetch('obras.json');
      const obras = await resObras.json();

      const obraSelect = document.getElementById('obra');
      obras.forEach(o => {
        if (o.Email === usuarioLogado?.Email) {
          const option = document.createElement('option');
          option.value = o.Obra;
          option.textContent = o.Obra;
          obraSelect.appendChild(option);
        }
      });

      obraSelect.addEventListener('change', () => {
        const obraSelecionada = obras.find(o => o.Obra === obraSelect.value && o.Email === usuarioLogado?.Email);
        if (obraSelecionada) {
          document.getElementById('centroCusto').value = obraSelecionada["Centro de Custo"];
        }
      });
    } catch (e) {
      console.error("Erro ao carregar obras:", e);
    }

    try {
      const resMateriais = await fetch('materiais.json');
      const materiais = await resMateriais.json();

      const materialSelect = document.getElementById('material');
      materiais.sort((a, b) => a.Material.localeCompare(b.Material)).forEach(m => {
        const option = document.createElement('option');
        option.value = m.Material;
        option.textContent = m.Material;
        materialSelect.appendChild(option);
      });
    } catch (e) {
      console.error("Erro ao carregar materiais:", e);
    }

    // Lista de materiais adicionados
    const listaMateriais = [];
    document.getElementById('addMaterial').addEventListener('click', () => {
      const material = document.getElementById('material').value;
      const quantidade = document.getElementById('quantidade').value;

      if (!material || !quantidade) {
        Swal.fire("⚠️ Preencha material e quantidade!", "", "warning");
        return;
      }

      listaMateriais.push({ material, quantidade });
      atualizarTabela();
    });

    function atualizarTabela() {
      const tbody = document.getElementById('materiaisLista');
      tbody.innerHTML = "";
      listaMateriais.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${item.material}</td>
          <td>${item.quantidade}</td>
          <td><span class="btn-remover" data-idx="${idx}">❌</span></td>
        `;
        tbody.appendChild(tr);
      });

      document.querySelectorAll('.btn-remover').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = e.target.getAttribute('data-idx');
          listaMateriais.splice(index, 1);
          atualizarTabela();
        });
      });
    }

    // Envio da solicitação por EmailJS
    document.getElementById('solicitacaoForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      // Debug listaMateriais
      console.log("📋 listaMateriais antes do envio:", listaMateriais);

      let materiaisFormatados;
      try {
        materiaisFormatados = JSON.stringify(listaMateriais);
      } catch (err) {
        materiaisFormatados = "Erro ao gerar lista de materiais";
        console.error("❌ Erro ao converter listaMateriais:", err, listaMateriais);
      }

      const templateParams = {
        nome: usuarioLogado?.Nome || "Usuário não identificado",
        from_email: usuarioLogado?.Email || "sememail@teste.com",
        obra: document.getElementById("obra")?.value || "Não selecionada",
        centro_custo: document.getElementById("centroCusto")?.value || "Não informado",
        data: document.getElementById("dataEntrega")?.value || "Não definida",
        local_entrega: document.getElementById("localEntrega")?.value || "Não informado",
        materiais: materiaisFormatados
      };

      console.log("📧 Enviando com parâmetros:", templateParams);

      try {
        await emailjs.send('service_fzht86y', 'template_wz0ywdo', templateParams, 'WddODLBw11FUrjP-q');
        Swal.fire("✅ Solicitação enviada com sucesso!", "", "success");
      } catch (err) {
        console.error("Erro EmailJS:", err);
        Swal.fire("❌ Falha ao enviar solicitação!", err.text || "", "error");
      }
    });
  }
});
