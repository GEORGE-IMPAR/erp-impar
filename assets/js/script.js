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

    document.getElementById('solicitacaoForm').addEventListener('submit', function(e) {
      e.preventDefault();

      if (materiaisSelecionados.length === 0) {
        Swal.fire('Erro', 'Adicione pelo menos um material!', 'error');
        return;
      }

      const templateParams = {
        usuario: usuarioLogado.Nome,
        from_email: usuarioLogado.Email,
        obra: obraSelect.value,
        centroCusto: centroCustoInput.value,
        localEntrega: document.getElementById('localEntrega').value,
        data: document.getElementById('data').value,
        materiais: JSON.stringify(materiaisSelecionados, null, 2)
      };

      emailjs.send("SEU_SERVICE_ID", "SEU_TEMPLATE_ID", templateParams)
        .then(() => {
          Swal.fire('Sucesso', 'E-mail com o relatório de compras enviado com sucesso!', 'success');
          document.getElementById('solicitacaoForm').reset();
          listaMateriaisBody.innerHTML = "";
          materiaisSelecionados = [];
        }, (error) => {
          Swal.fire('Erro', 'Falha ao enviar solicitação.', 'error');
          console.error('Erro EmailJS:', error);
          fetch('logs_envio.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              data: new Date().toISOString(),
              usuario: usuarioLogado.Email,
              erro: error
            })
          });
        });
    });

  } catch (error) {
    Swal.fire('Erro', 'Falha ao carregar materiais.', 'error');
    console.error('Erro carregando materiais:', error);
  }
});
