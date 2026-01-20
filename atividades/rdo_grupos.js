/*
 * ERP ÍMPAR - RDO ao vivo (Grupos) - módulo isolado
 *
 * - NÃO mexe em nada do fluxo das Atividades.
 * - Só lê arquivos JSON por grupo e renderiza cards + popup.
 *
 * Caminho esperado (pode ajustar no index se necessário):
 *   /atividades/rdo/<slug>.json
 *
 * Formatos aceitos (robusto):
 *   1) { ok:true, items:[...], updatedAt:"..." }
 *   2) { messages:[...] }
 *   3) [ ... ]
 * Cada item pode ter: { ts|date|time, from|sender|author, text|message }
 */

(function () {
  "use strict";

  // ===== CONFIG (mantém isolado) =====
  const DEFAULT_GROUPS = [
    "RDO-Contato Ecoparque Araranguá",
    "RDO-Giassi Araranguá",
    "Rdo-SOS Cárdio/Clínica Ritmo 2°Pavimento",
    "Rdo-Fórum de Araquari",
    "RDO-Residencial FUSION",
    "RDO - Residencial João Lohn Jurerê",
    "RDO - Tubarão Giassi",
    "RDO - Impact Hub",
    "RDO - UBS São ludgero",
    "RDO KHRONOS",
    "RDO - Auditório Praia Grande",
    "RDO - Artisti",
    "RDO - Cassol Centerlar",
    "RDO-CASA GRANDE",
    "Rdo-Hospital São Brás São Camilo Porto Vitória"
  ];

  const elWrap = document.getElementById("rdoLive");
  if (!elWrap) return; // não existe no HTML

  const elGrid = document.getElementById("rdoGrid");
  const elStatus = document.getElementById("rdoStatus");
  const elBtnReload = document.getElementById("rdoReload");
  const elModal = document.getElementById("rdoModal");
  const elModalTitle = document.getElementById("rdoModalTitle");
  const elModalMeta = document.getElementById("rdoModalMeta");
  const elModalBody = document.getElementById("rdoModalBody");
  const elModalClose = document.getElementById("rdoModalClose");

  // pega lista do dataset (editável no HTML) senão usa default
  const rawList = (elWrap.getAttribute("data-groups") || "").trim();
  const GROUPS = rawList ? rawList.split("|").map((s) => s.trim()).filter(Boolean) : DEFAULT_GROUPS;

  // base path (do dataset). Ex: /atividades/rdo
  const BASE_PATH = (elWrap.getAttribute("data-basepath") || "/atividades/rdo").replace(/\/$/, "");

  // ===== utils =====
  function stripAccents(str) {
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function slugify(name) {
    const s = stripAccents(name).toLowerCase();
    return s
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function toDate(ts) {
    if (!ts) return null;
    if (ts instanceof Date) return ts;

    // ISO
    const d1 = new Date(ts);
    if (!isNaN(d1.getTime())) return d1;

    // HH:MM or HH:MM:SS -> hoje
    const m = String(ts).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const now = new Date();
      now.setHours(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3] || "0", 10), 0);
      return now;
    }

    return null;
  }

  function fmtTime(d) {
    if (!d) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(ok, text) {
    if (!elStatus) return;
    elStatus.classList.remove("ok", "err");
    elStatus.classList.add(ok ? "ok" : "err");
    elStatus.textContent = text;
  }

  async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (r.status === 404) return { ok:true, items:[], updated_at:null };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function normalizeItems(json) {
    let items = [];
    let updatedAt = "";

    if (Array.isArray(json)) {
      items = json;
    } else if (json && typeof json === "object") {
      if (Array.isArray(json.items)) items = json.items;
      else if (Array.isArray(json.messages)) items = json.messages;
      else if (Array.isArray(json.data)) items = json.data;
      updatedAt = json.updatedAt || json.updated_at || "";
    }

    // normaliza campos
    items = items
      .map((it) => {
        const ts = it.ts || it.datetime || it.dateTime || it.time || it.date || it.createdAt || it.created_at || "";
        const from = it.from || it.sender || it.author || it.name || it.participant || "";
        const text = it.text || it.message || it.body || it.caption || "";
        const type = it.type || (it.mediaUrl ? "media" : "text");
        return {
          ts,
          from,
          text,
          type,
          raw: it
        };
      })
      .filter((x) => (x.text && String(x.text).trim()) || x.type !== "text");

    return { items, updatedAt };
  }

  function filterLastDays(items, days) {
    const now = new Date();
    const min = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return items.filter((it) => {
      const d = toDate(it.ts);
      if (!d) return true; // se não tem data, não descarta
      return d >= min;
    });
  }

  // ===== UI =====
  function cardHtml({ title, subtitle, count, lastLine, slug, ok }) {
    const status = ok ? "ok" : "err";
    const statusLabel = ok ? "ok" : "aguardando";

    return `
      <button class="rdo-card" data-slug="${escapeHtml(slug)}" type="button">
        <div class="rdo-card-head">
          <div class="rdo-card-title">${escapeHtml(title)}</div>
          <div class="rdo-badge ${status}">${escapeHtml(statusLabel)}</div>
        </div>
        <div class="rdo-card-sub">${escapeHtml(subtitle)}</div>
        <div class="rdo-card-foot">
          <span class="rdo-count">${count} msg(s)</span>
          <span class="rdo-last">${escapeHtml(lastLine || "—")}</span>
        </div>
      </button>
    `;
  }

  function openModal(groupName, meta, items) {
    if (!elModal) return;

    elModalTitle.textContent = groupName;
    elModalMeta.textContent = meta;

    const safe = items.slice(-200).map((it) => {
      const d = toDate(it.ts);
      const t = fmtTime(d);
      const from = it.from ? `${it.from}` : "";
      const line = it.text ? it.text : "(mídia/arquivo)";
      return `
        <div class="rdo-line">
          <span class="rdo-t">${escapeHtml(t || "")}</span>
          <span class="rdo-f">${escapeHtml(from || "")}</span>
          <span class="rdo-m">${escapeHtml(line)}</span>
        </div>
      `;
    });

    elModalBody.innerHTML = safe.length
      ? safe.join("")
      : `<div style="opacity:.75">Sem mensagens ainda.</div>`;

    elModal.classList.add("open");
  }

  function closeModal() {
    if (!elModal) return;
    elModal.classList.remove("open");
  }

  if (elModalClose) elModalClose.addEventListener("click", closeModal);
  if (elModal) elModal.addEventListener("click", (e) => {
    // fecha ao clicar fora do card
    if (e.target === elModal) closeModal();
  });

  // ===== state =====
  const cache = new Map(); // slug -> { groupName, ok, items, updatedAt }

  async function loadOne(groupName) {
    const slug = slugify(groupName);
    const url = '${BASE_PATH}/${slug}.json?ts=${Date.now()}';

    try {
      const json = await fetchJson(url);
      const { items, updatedAt } = normalizeItems(json);
      const filtered = filterLastDays(items, 7);

      cache.set(slug, {
        groupName,
        ok: true,
        items: filtered,
        updatedAt: updatedAt || ""
      });
      return true;
    } catch (e) {
      cache.set(slug, {
        groupName,
        ok: false,
        items: [],
        updatedAt: ""
      });
      return false;
    }
  }

  function render() {
    if (!elGrid) return;

    const cards = GROUPS.map((name) => {
      const slug = slugify(name);
      const s = cache.get(slug);

      const ok = s ? s.ok : false;
      const count = s ? s.items.length : 0;
      const last = s && s.items.length ? s.items[s.items.length - 1] : null;
      const d = last ? toDate(last.ts) : null;
      const lastLine = last ? `${fmtTime(d)} ${last.text || ""}`.trim() : "";
      const subtitle = ok ? "Atualizando automaticamente" : "Sem arquivo ainda (aguardando agente)";

      return cardHtml({
        title: name,
        subtitle,
        count,
        lastLine,
        slug,
        ok
      });
    });

    elGrid.innerHTML = cards.join("");

    // click handler (delegation)
    elGrid.querySelectorAll(".rdo-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.getAttribute("data-slug") || "";
        const s = cache.get(slug);
        if (!s) return;
        const meta = s.updatedAt ? `Atualizado: ${s.updatedAt}` : "Últimos 7 dias";
        openModal(s.groupName, meta, s.items);
      });
    });
  }

  async function reloadAll() {
    setStatus(true, "atualizando...");

    let okCount = 0;
    for (const name of GROUPS) {
      const ok = await loadOne(name);
      if (ok) okCount++;
    }

    render();
    const total = GROUPS.length;
    if (okCount) setStatus(true, `ok • ${okCount}/${total} grupos`);
    else setStatus(false, `aguardando agente • ${total} grupos`);
  }

  // botao
  if (elBtnReload) elBtnReload.addEventListener("click", reloadAll);

  // primeira carga e auto refresh
  reloadAll();
  setInterval(reloadAll, 15000);
})();
