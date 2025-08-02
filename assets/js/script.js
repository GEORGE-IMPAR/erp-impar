document.addEventListener('DOMContentLoaded', async () => {
  const usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
  if (!usuarioLogado || !usuarioLogado.obras) {
    Swal.fire('Erro', 'Nenhum usuário logado ou sem obra associada.', 'error')
      .then(() => location.href = 'login.html');
    return;
  }

  const obraSelect = document.getElementById('obra');
  const centroCustoInput = document.getElementById('centroCusto');
  const materialSelect = document.getElementById('material');
  const listaMateriaisBody = document.getElementById('listaMateriaisBody');
  let materiaisSelecionados = [];

  // Popula obras vinculadas ao usuário logado
  usuarioLogado.obras.forEach(o => {
    const option = document.createElement('option');
    option.value = o.Obra;
    option.textContent = `${o.Obra} (${o['Centro de Custo']})`;
    obraSelect.appendChild(option);
  });

  obraSelect.addEventListener('change', e => {
    const obraSelecionada = usuarioLogado.obras.find(o => o.Obra === e.target.value);
    centroCustoInput.value = obraSelecionada ? obraSelecionada['Centro de Custo'] : '';
  });

  // Carrega materiais em ordem alfabética
  try {
    const materiaisResponse = await fetch('materiais.json');
    const materiais = await materiaisResponse.json();
    materiais.sort((a, b) => a.Material.localeCompare(b.Material));
    materiais.forEach(m => {
      const option = document.createElement('option');
      option.value = JSON.stringify(m);
      option.textContent = `${m.Material} (${m.UND})`;
      materialSelect.appendChild(option);
    });
  } catch (error) {
    Swal.fire('Erro', 'Falha ao carregar materiais.', 'error');
    console.error('Erro carregando materiais:', error);
  }

  // Adiciona material à lista
  document.getElementById('adicionarBtn').addEventListener('click', () => {
    const materialObj = JSON.parse(materialSelect.value || '{}');
    const quantidade = document.getElementById('quantidade').value;

    if (!materialObj.Material || !quantidade) {
      Swal.fire('Erro', 'Selecione material e informe a quantidade!', 'error');
      return;
    }

    materiaisSelecionados.push({
      Material: materialObj.Material,
      UND: materialObj.UND,
      Quantidade: quantidade
    });

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${materialObj.Material}</td>
      <td>${materialObj.UND}</td>
      <td>${quantidade}</td>
      <td><span class="btn-remover">❌</span></td>
    `;
    row.querySelector('.btn-remover').addEventListener('click', () => {
      row.remove();
      materiaisSelecionados = materiaisSelecionados.filter(m => m.Material !== materialObj.Material);
    });
    listaMateriaisBody.appendChild(row);
  });

  // Envia solicitação
  document.getElementById('solicitacaoForm').addEventListener('submit', function(e) {
    e.preventDefault();

    if (materiaisSelecionados.length === 0) {
      Swal.fire('Erro', 'Adicione pelo menos um material!', 'error');
      return;
    }

    const templateParams = {
      nome: usuarioLogado.Nome,
      from_email: usuarioLogado.Email,
      obra: obraSelect.value,
      centro_custo: centroCustoInput.value,
      local_entrega: document.getElementById('localEntrega').value,
      data: document.getElementById('data').value,
      materiais: JSON.stringify(materiaisSelecionados, null, 2)
    };

    console.log("📧 Enviando com parâmetros:", templateParams);

    emailjs.send("service_fzht86y", "template_wz0ywdo", templateParams)
      .then(() => {
        Swal.fire('Sucesso', 'E-mail com o relatório de compras enviado com sucesso!', 'success');
        document.getElementById('solicitacaoForm').reset();
        listaMateriaisBody.innerHTML = "";
        materiaisSelecionados = [];

        // Registra log de sucesso
        salvarLog({ status: 'sucesso', usuario: usuarioLogado.Email, params: templateParams });
      })
      .catch((error) => {
        Swal.fire('Erro', 'Falha ao enviar solicitação.', 'error');
        console.error('Erro EmailJS:', error);

        // Registra log de erro
        salvarLog({ status: 'erro', usuario: usuarioLogado.Email, params: templateParams, erro: error });
      });
  });

  // Função para salvar log (apenas simulação em console no GitHub Pages)
  function salvarLog(dados) {
    dados.dataHora = new Date().toLocaleString();
    console.log("📝 Log registrado:", dados);
    // Em GitHub Pages não dá pra gravar o log.json, mas deixamos a função para futura API
  }
});
