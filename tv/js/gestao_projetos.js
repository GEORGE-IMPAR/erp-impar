document.getElementById('formProjeto').addEventListener('submit', async (e) => {
  e.preventDefault();

  const projetoId = document.getElementById('projeto').value;
  const status = document.getElementById('status').value.trim();
  const execucao = document.querySelector('input[name="execucao"]:checked')?.value;
  const farol = document.getElementById('farol').value;

  if (!projetoId || isNaN(Number(projetoId)) || !status || !execucao || !farol) {
    Swal.fire({
      icon: 'warning',
      title: 'Atenção',
      text: 'Preencha todos os campos obrigatórios.'
    });
    return;
  }

  const option = document.querySelector(`#projeto option[value="${CSS.escape(projetoId)}"]`);
  const coordenador = option?.dataset?.coordenador || '';

  const user = getLoggedUser();
  const usuario = (user?.nome || 'Usuário').trim() || 'Usuário';

  const payload = {
    projeto_id: Number(projetoId),
    status,
    execucao,
    farol,
    coordenador,
    usuario_atualizacao: usuario
  };

  console.log('📤 Atualizando projeto:', payload);

  try {
    const response = await fetch(`${API_BASE}/atualizar.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Não foi possível salvar a atualização');
    }

    await Swal.fire({
      icon: 'success',
      title: 'Sucesso!',
      text: 'Projeto atualizado com sucesso.',
      timer: 1800,
      showConfirmButton: false
    });

    document.getElementById('formProjeto').reset();
    farolSelecionado = '';
    document.querySelectorAll('.farol-btn').forEach(btn => btn.classList.remove('active'));
  } catch (error) {
    console.error(error);
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: error.message || 'Não foi possível salvar a atualização.'
    });
  }
});
