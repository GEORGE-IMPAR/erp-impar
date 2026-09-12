/* ERP ÍMPAR HF6 — seleção por célula, mover, cópia em lote e checkpoint. */
(() => {
  'use strict';
  const daily = Boolean(window.AgendaDiaClient);
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = cell => `${cell.personId}_${cell.day}`;
  const same = (a, b) => Boolean(a && b && key(a) === key(b));
  const cellOf = node => {
    const cell = node?.closest?.('.day-card');
    if (cell?.dataset.personId) return {personId: cell.dataset.personId, day: Number(cell.dataset.day)};
    const card = node?.closest?.('.agenda-dia-person-card');
    return card ? {personId: card.dataset.personId, day: 0} : null;
  };
  const items = cell => schedule[key(cell)] || [];
  const editable = () => daily
    ? Boolean(window.__AGENDA_DIA_ACTIVE_RECORD__ && !window.__AGENDA_DIA_ACTIVE_RECORD__.finalizado && !weekLocked)
    : !weekLocked;
  const notify = error => showToast('error', 'Alteração não confirmada', error.message);
  let origin = null, pending = null, busy = false, saved = null;
  const button = document.createElement('button');
  button.id = 'undoAgenda'; button.type = 'button'; button.className = 'toolbar-btn';
  button.textContent = '↶ Desfazer';
  button.title = 'Restaurar todas as alterações posteriores ao último Salvar (Ctrl+Z)';
  document.getElementById('saveMock')?.after(button);
  const status = document.createElement('div');
  status.className = 'agenda-copy-status'; status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite'); status.hidden = true;
  document.getElementById('weekGrid')?.before(status);
  const css = document.createElement('style');
  css.textContent = '.activity-card.selected{outline:2px solid #1698e6!important;outline-offset:2px}' +
    '.day-card.copy-target{outline:3px dashed #1698e6!important;outline-offset:-4px}' +
    '.agenda-copy-status{padding:8px 12px;color:#17455e;background:#eef7ff;border:1px solid #bed9f1;border-radius:10px;font-size:12px;margin:8px 0}' +
    '.agenda-copy-status[hidden]{display:none}.activity-card{touch-action:manipulation}' +
    '.module-toolbar:not(.collapsed){height:auto!important}' +
    '.content{top:var(--agenda-toolbar-bottom,calc(var(--toolbar-h) + 18px))!important}';
  document.head.append(css);
  const toolbar = document.querySelector('.module-toolbar');
  const fitToolbar = () => {
    if (toolbar) document.documentElement.style.setProperty('--agenda-toolbar-bottom', `${Math.ceil(toolbar.getBoundingClientRect().bottom) + 12}px`);
  };
  if (toolbar) new ResizeObserver(fitToolbar).observe(toolbar);
  window.addEventListener('resize', fitToolbar); fitToolbar();
  function paint() {
    document.querySelectorAll('.activity-card').forEach(el => {
      const selected = same(origin, cellOf(el)) && selectedActivities.has(el.dataset.itemId);
      if (el.classList.contains('selected') !== selected) el.classList.toggle('selected', selected);
      if (el.getAttribute('aria-selected') !== String(selected)) el.setAttribute('aria-selected', String(selected));
    });
    document.querySelectorAll('.day-card').forEach(el => {
      const target = Boolean(pending?.targets.has(key(cellOf(el))));
      if (el.classList.contains('copy-target') !== target) el.classList.toggle('copy-target', target);
    });
    status.hidden = !pending;
    status.textContent = pending ? `${pending.ids.length} atividade(s) • ${pending.targets.size} destino(s). Mantenha Ctrl para indicar destinos; solte Ctrl para copiar. Esc cancela.` : '';
    button.disabled = busy || !editable();
  }
  function clear() {
    pending = null; origin = null; selectedActivities.clear(); dragPayload = null; paint();
  }
  function select(cell, id) {
    if (busy || !editable()) return;
    if (!same(origin, cell)) { pending = null; selectedActivities.clear(); origin = cell; }
    selectedActivities.add(String(id)); paint();
  }
  function snapshot() {
    const chosen = origin ? items(origin).filter(item => selectedActivities.has(String(item.id))) : [];
    if (!chosen.length) throw new Error('Selecione as atividades em uma única célula de origem.');
    if (chosen.some(item => item.cancelado || item.cancelled || ['cancelado','cancelada','cancelled'].includes(item.status)))
      throw new Error('Descancele a atividade antes de mover ou copiar.');
    return {origin: {...origin}, ids: chosen.map(item => String(item.id)), date: currentWeekKey, targets: new Map()};
  }
  function addTarget(cell) {
    if (!cell || same(origin, cell) || busy || !editable()) return;
    try {
      pending ||= snapshot();
      pending.targets.set(key(cell), {...cell}); paint();
    } catch (error) { notify(error); }
  }
  async function transact(operation, gesture) {
    if (busy || !editable() || !gesture.targets.size) return;
    if (gesture.date !== currentWeekKey) { clear(); return; }
    busy = true; pending = null; paint();
    const targets = [...gesture.targets.values()];
    const last = targets.at(-1);
    try {
      const sourceItems = items(gesture.origin).filter(item => gesture.ids.includes(String(item.id)));
      if (sourceItems.length !== gesture.ids.length) throw new Error('A origem mudou. Selecione as atividades novamente.');
      let destinationIds;
      if (daily) {
        if (targets.some(cell => cell.day !== 0)) throw new Error('A Agenda do Dia altera somente o dia aberto.');
        const name = cell => people.find(p => String(p.id) === cell.personId)?.name;
        if (!name(gesture.origin) || targets.some(cell => !name(cell))) throw new Error('Um colaborador não está mais no dia.');
        const before = new Set(items(last).map(item => String(item.id)));
        await window.AgendaDiaClient.plan([{operacao: operation, origem_colaborador: name(gesture.origin),
          destinos: targets.map(name), atividade_ids: gesture.ids}]);
        destinationIds = items(last).filter(item => !before.has(String(item.id))).map(item => String(item.id));
      } else {
        // Semana: preparação integral em cópia antes de substituir o estado em memória.
        const next = clone(schedule); destinationIds = [];
        for (const target of targets) {
          if (!people.some(p => String(p.id) === target.personId)) throw new Error('Destino não encontrado.');
          const copies = sourceItems.map(item => ({...clone(item), id: crypto.randomUUID(), car: null,
            originalItemId: item.originalItemId ?? item.id, operacaoOrigem: operation === 'mover' ? 'MOVE' : 'COPY',
            origemColaboradorId: gesture.origin.personId, origemDia: gesture.origin.day, origemSemana: gesture.date}));
          next[key(target)] = [...(next[key(target)] || []), ...copies];
          if (same(last, target)) destinationIds = copies.map(item => String(item.id));
        }
        if (operation === 'mover') next[key(gesture.origin)] = next[key(gesture.origin)].filter(item => !gesture.ids.includes(String(item.id)));
        schedule = next; saveState(); renderAll();
      }
      origin = last; selectedActivities.clear(); destinationIds.forEach(id => selectedActivities.add(id));
      showToast('success', operation === 'mover' ? 'Atividades movidas' : 'Atividades copiadas',
        `${gesture.ids.length} atividade(s) em ${targets.length} destino(s).`);
    } catch (error) { notify(error); }
    finally { busy = false; dragPayload = null; paint(); }
  }
  function startDrag(event, cell, id) {
    if (busy || !editable()) { event.preventDefault(); return; }
    if (!same(origin, cell) || !selectedActivities.has(String(id))) select(cell, id);
    try {
      const gesture = snapshot();
      dragPayload = {type: 'activities', gesture};
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('text/plain', 'ERPIMPAR_AGENDA_ATIVIDADES');
      closeInline();
    } catch (error) { event.preventDefault(); notify(error); }
  }
  function drop(event, cell) {
    if (!dragPayload?.gesture || busy || !editable()) return;
    const gesture = dragPayload.gesture;
    if (same(gesture.origin, cell)) { dragPayload = null; return; }
    if (event.ctrlKey) { pending ||= gesture; addTarget(cell); dragPayload = null; }
    else { gesture.targets.set(key(cell), cell); window.__AGENDA_CAP_PENDING__ = transact('mover', gesture); }
  }
  function checkpoint(confirmedState) {
    if (!daily) saved = confirmedState ? clone(confirmedState) : {date: currentWeekKey, people: clone(people), schedule: clone(schedule), roomLinks: clone(roomLinks)};
    clear();
  }
  async function undo() {
    if (busy || !editable()) return;
    clear(); busy = true; paint();
    try {
      if (daily) await window.AgendaDiaClient.undo();
      else {
        if (!saved || saved.date !== currentWeekKey) throw new Error('O rascunho salvo desta semana ainda não foi carregado.');
        people = clone(saved.people); schedule = clone(saved.schedule); roomLinks = clone(saved.roomLinks); renderAll();
      }
      showToast('success', 'Alterações desfeitas', 'Agenda restaurada ao último Salvar.');
    } catch (error) { notify(error); }
    finally { busy = false; paint(); }
  }
  button.onclick = () => { window.__AGENDA_CAP_PENDING__ = undo(); };
  window.addEventListener('click', event => {
    const node = event.target;
    if (busy && node.closest?.('#weekGrid,.module-toolbar')) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const cell = cellOf(node);
    if (event.ctrlKey && origin && cell && !same(origin, cell)) {
      event.preventDefault(); event.stopImmediatePropagation(); addTarget(cell); return;
    }
    if (pending && !cell) { clear(); return; }
    const activity = node.closest?.('.activity-card');
    if (activity && !node.closest('button,input,textarea,select,a')) {
      event.preventDefault(); event.stopImmediatePropagation();
      select(cell, activity.dataset.itemId); return;
    }
    if (origin && !same(origin, cell) && !node.closest?.('#inlineEditor')) clear();
  }, true);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') { clear(); closeInline(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' &&
        !event.target.closest?.('input,textarea,[contenteditable=true]')) {
      event.preventDefault(); event.stopImmediatePropagation(); window.__AGENDA_CAP_PENDING__ = undo();
    }
  }, true);
  window.addEventListener('keyup', event => {
    if (event.key === 'Control' && pending) {
      const gesture = pending; pending = null;
      window.__AGENDA_CAP_PENDING__ = transact('copiar', gesture);
    }
  }, true);
  window.addEventListener('blur', () => { if (pending) clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && pending) clear(); });
  document.addEventListener('dragend', () => { dragPayload = null; document.querySelectorAll('.drop-day').forEach(el => el.classList.remove('drop-day')); });
  const grid = document.getElementById('weekGrid');
  if (grid) new MutationObserver(() => {
    if (pending && pending.date !== currentWeekKey) clear(); else paint();
  }).observe(grid, {childList: true, subtree: true});
  window.AgendaInteracoes = {select, startDrag, drop, clear, checkpoint, undo};
  // A resposta da semana pode chegar antes deste arquivo terminar de carregar.
  if (!daily && window.__AGENDA_WEEK_CONFIRMED__) checkpoint(window.__AGENDA_WEEK_CONFIRMED__);
  paint();
})();
