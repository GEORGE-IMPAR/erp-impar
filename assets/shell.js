(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let context = null, busy = false, authorizationBusy = false;
  const api = window.ERP_SAAS;
  function el(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
  function login() { location.replace(new URL('login.html', location.href).href); }
  function error(err) {
    if (err.http === 401 || ['USUARIO_INATIVO', 'SESSAO_ALTERADA'].includes(err.status)) return login();
    context = null; $('empresa-topo').textContent = ''; $('usuario-nome').textContent = ''; $('usuario-perfil').textContent = '';
    $('inicio-empresa').hidden = true; $('selecao-empresa').hidden = true;
    const box = $('estado-acesso'); box.replaceChildren(el('h1', 'Não foi possível abrir o acesso'), el('p', err.message));
    const retry = el('button', 'Tentar novamente', 'btn btn-primario'); retry.type = 'button'; retry.addEventListener('click', load); box.append(retry); box.hidden = false;
  }
  function modules() {
    const term = $('busca-modulos').value.trim().toLocaleLowerCase('pt-BR');
    const list = $('lista-modulos'); list.replaceChildren();
    const rows = (context?.modulos || []).filter(m => m.nome.toLocaleLowerCase('pt-BR').includes(term));
    for (const m of rows) {
      const card = el('article', undefined, 'card'); card.dataset.module = m.id;
      card.append(el('h3', m.nome), el('p', m.descricao), el('span', 'Integração pendente', 'situacao neutra'));
      list.append(card);
    }
    if (!rows.length) list.append(el('p', term ? 'Nenhum módulo encontrado para esta busca.' : 'Nenhum módulo operacional habilitado para esta conta. Consulte o administrador.', 'aviso'));
  }
  function choose() {
    $('inicio-empresa').hidden = true; $('selecao-empresa').hidden = false;
    const list = $('lista-empresas'); list.replaceChildren();
    for (const company of context.empresas_disponiveis) {
      const button = el('button', undefined, 'card'); button.type = 'button'; button.dataset.company = String(company.id);
      button.append(el('strong', company.nome), el('p', company.perfil || 'Vínculo autorizado', 'texto-ajuda'));
      button.addEventListener('click', async () => {
        if (busy) return; busy = true; button.disabled = true;
        try { render(await api.call('company_select', { empresa_id: company.id })); }
        catch (err) { error(err); } finally { busy = false; button.disabled = false; }
      });
      list.append(button);
    }
  }
  function render(data) {
    if (!data.authenticated) return login();
    context = data; $('estado-acesso').hidden = true;
    $('usuario-nome').textContent = data.usuario.nome;
    $('usuario-iniciais').textContent = data.usuario.nome.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
    if (!data.empresa_ativa) { $('empresa-topo').textContent = ''; $('usuario-perfil').textContent = ''; choose(); return; }
    const company = data.empresa_ativa;
    $('selecao-empresa').hidden = true; $('inicio-empresa').hidden = false;
    $('empresa-topo').textContent = company.nome; $('empresa-nome').textContent = company.nome;
    $('usuario-perfil').textContent = company.perfil || 'Acesso autorizado';
    $('saudacao').textContent = 'Olá, ' + data.usuario.nome + '! Este é o ambiente da sua empresa.';
    $('usuario-email').textContent = data.usuario.email;
    $('trocar-empresa').hidden = data.empresas_disponiveis.length < 2;
    $('empresa-links').replaceChildren();
    const names = {site:'Site da empresa',instagram:'Instagram',facebook:'Facebook',linkedin:'LinkedIn',youtube:'YouTube'};
    for (const link of company.links || []) {
      let url; try { url = new URL(link.url); } catch (_) { continue; }
      if (url.protocol !== 'https:' || url.username || url.password) continue;
      const a = el('a', names[link.tipo] || 'Página da empresa', 'btn btn-secundario'); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; $('empresa-links').append(a);
    }
    modules(); $('painel-autorizacao').hidden = !data.can_authorize;
    if (data.can_authorize) loadAuthorizationCompanies();
  }
  async function load() { try { render(await api.session()); } catch (err) { error(err); } }
  async function logout() {
    if (busy) return; busy = true;
    try { await api.call('logout'); login(); } catch (err) { error(err); } finally { busy = false; }
  }
  async function loadAuthorizationCompanies() {
    const select = $('autorizar-empresa'); select.disabled = true;
    try {
      const data = await api.call('authorization_companies'); select.replaceChildren(el('option', 'Selecione a empresa')); select.firstChild.value = '';
      for (const company of data.empresas) { const option = el('option', company.nome); option.value = String(company.id); select.append(option); }
    } catch (err) { $('autorizacao-aviso').textContent = err.message; $('autorizacao-aviso').hidden = false; }
    finally { select.disabled = false; }
  }
  $('form-autorizacao').addEventListener('submit', e => {
    e.preventDefault(); if (authorizationBusy || !$('form-autorizacao').reportValidity()) return;
    const email = $('autorizar-email').value.trim().toLowerCase();
    const company = $('autorizar-empresa').selectedOptions[0];
    $('confirmacao-texto').textContent = 'Autorizar o e-mail ' + email + ' na empresa ' + company.textContent + '? A conta deve existir e estar ativa no cadastro oficial.';
    $('confirmacao-vinculo').showModal();
  });
  $('cancelar-vinculo').addEventListener('click', () => $('confirmacao-vinculo').close());
  $('confirmar-vinculo').addEventListener('click', async () => {
    if (authorizationBusy) return; authorizationBusy = true; $('confirmar-vinculo').disabled = true;
    try {
      const data = await api.call('authorize_email', { email: $('autorizar-email').value.trim().toLowerCase(), empresa_id: Number($('autorizar-empresa').value), confirmar: true });
      $('autorizacao-aviso').textContent = data.mensagem;
      $('autorizar-email').value = '';
    } catch (err) { $('autorizacao-aviso').textContent = err.message; }
    finally { $('autorizacao-aviso').hidden = false; $('confirmacao-vinculo').close(); authorizationBusy = false; $('confirmar-vinculo').disabled = false; }
  });
  $('sair-rail').addEventListener('click', logout); $('sair-topo').addEventListener('click', logout);
  $('trocar-empresa').addEventListener('click', choose); $('busca-modulos').addEventListener('input', modules);
  // Revalida após voltar da suspensão; não persiste identidade no armazenamento do navegador.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && context && !busy && !authorizationBusy) load(); });
  load();
})();
