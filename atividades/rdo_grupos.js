/* ERP ÍMPAR — RDO ao vivo (Grupos) | versão caprichada (cards + modal + highlight) */
(() => {
  const elRoot = document.getElementById("rdoLive");
  if (!elRoot) return;

  const BASE_PATH = (elRoot.dataset.basepath || "https://api.erpimpar.com.br/atividades/rdo").replace(/\/$/, "");
  const elGrid = document.getElementById("rdoGrid");
  const elEmpty = document.getElementById("rdoEmpty");
  const elStatus = document.getElementById("rdoStatus");
  const btnRefresh = document.getElementById("btnRdoRefresh");

  // Modal
  const elModal = document.getElementById("rdoModal");
  const elModalTitle = document.getElementById("rdoModalTitle");
  const elModalSub = document.getElementById("rdoModalSub");
  const elModalBody = document.getElementById("rdoModalBody");
  const btnModalClose = document.getElementById("rdoModalClose");

  const cache = new Map(); // slug -> { groupName, items, updatedAt, fp, isNew }

  function setStatus(ok, text) {
    if (!elStatus) return;
    const dot = elStatus.querySelector("span");
    const label = elStatus.querySelectorAll("span")[1];
    if (dot) dot.style.background = ok ? "#2bd27f" : "#ff5a5a";
    if (label) label.textContent = text || (ok ? "ok" : "erro");
  }

  function slugify(s) {
    return (s || "")
      .toString()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (r.status === 404) return { ok: true, items: [], updated_at: null };
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function normalizeItems(json) {
    // Aceita: {items:[...]}, {messages:[...]}, [ ... ]
    let items = [];
    if (Array.isArray(json)) items = json;
    else if (json && Array.isArray(json.items)) items = json.items;
    else if (json && Array.isArray(json.messages)) items = json.messages;
    // Normaliza campos comuns
    items = items
      .map((it) => {
        if (typeof it === "string") return { text: it, ts: null, who: "" };
        return {
          text: (it.text ?? it.msg ?? it.message ?? it.body ?? "").toString(),
          ts: it.ts ?? it.time ?? it.date ?? it.created_at ?? it.createdAt ?? null,
          who: (it.who ?? it.from ?? it.author ?? "").toString(),
        };
      })
      .filter((it) => it.text && it.text.trim().length);

    return items;
  }

  function formatTime(ts) {
    if (!ts) return "";
    // aceita ISO, epoch ms, epoch s, ou "HH:MM"
    if (typeof ts === "string" && /^\d{2}:\d{2}/.test(ts)) return ts.slice(0, 5);
    let d;
    if (typeof ts === "number") d = new Date(ts < 2e10 ? ts * 1000 : ts);
    else d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function fingerprint(items) {
    const last = items[items.length - 1] || {};
    const seed = `${items.length}|${last.ts ?? ""}|${(last.text || "").slice(0, 120)}`;
    // hash simples
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return String(h);
  }

  function isNewForSlug(slug, fp) {
    const key = `ERPIMPAR_RDO_FP_${slug}`;
    const old = localStorage.getItem(key);
    // Se nunca viu antes, não marca como "novo" (senão tudo fica piscando na 1ª carga)
    if (!old) return false;
    return old !== fp;
  }

  function markSeen(slug, fp) {
    localStorage.setItem(`ERPIMPAR_RDO_FP_${slug}`, fp);
  }

  function buildCard(slug, groupName, items, updatedAt, fp, isNew) {
    const card = document.createElement("div");
    card.className = "rdo-card" + (isNew ? " rdo-new" : "");
    card.dataset.slug = slug;

    const title = document.createElement("div");
    title.className = "rdo-title";
    title.innerHTML = `<span>${escapeHtml(groupName)}</span><span class="rdo-chip">${items.length} msg(s)</span>`;

    const sub = document.createElement("div");
    sub.className = "rdo-sub";
    const preview = items.length ? items[items.length - 1].text : "Sem mensagens";
    sub.textContent = preview.length > 140 ? preview.slice(0, 140) + "…" : preview;

    const meta = document.createElement("div");
    meta.className = "rdo-meta";
    const t = items.length ? formatTime(items[items.length - 1].ts) : "";
    meta.innerHTML = `<span>${t ? ("Última " + t) : "—"}</span><span>clique para abrir</span>`;

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(meta);

    card.addEventListener("click", () => {
      openModal(slug);
    });

    // guarda em cache
    cache.set(slug, { slug, groupName, items, updatedAt, fp, isNew });

    return card;
  }

  function openModal(slug) {
    const data = cache.get(slug);
    if (!data || !elModal) return;

    // marca como lido
    markSeen(slug, data.fp);

    // tira glow
    const card = elGrid?.querySelector(`.rdo-card[data-slug="${CSS.escape(slug)}"]`);
    if (card) card.classList.remove("rdo-new");

    elModalTitle.textContent = data.groupName;
    elModalSub.textContent = "Conversa (últimos 7 dias)";

    // render msgs
    elModalBody.innerHTML = "";
    if (!data.items.length) {
      elModalBody.innerHTML = `<div style="color:rgba(255,255,255,.70);font-size:13px;padding:8px 2px;">Sem mensagens.</div>`;
    } else {
      // mostra do mais antigo ao mais novo (mais fácil de ler)
      data.items.forEach((it) => {
        const row = document.createElement("div");
        row.className = "rdo-msg";
        const time = formatTime(it.ts) || "—";
        row.innerHTML = `<div class="t">${escapeHtml(time)}</div><div class="c">${escapeHtml(it.text)}</div>`;
        elModalBody.appendChild(row);
      });
      // rola pro final
      elModalBody.scrollTop = elModalBody.scrollHeight;
    }

    elModal.classList.add("is-open");
    elModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!elModal) return;
    elModal.classList.remove("is-open");
    elModal.setAttribute("aria-hidden", "true");
  }

  function escapeHtml(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  if (btnModalClose) btnModalClose.addEventListener("click", closeModal);
  if (elModal) {
    elModal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  async function loadOne(groupName) {
    const slug = slugify(groupName);
    const url = `https://api.erpimpar.com.br/atividades/rdo/${slug}.json`;
    const json = await fetchJson(url);

    const items = normalizeItems(json);
    const fp = fingerprint(items);
    const isNew = isNewForSlug(slug, fp);
    const updatedAt = json?.updated_at ?? json?.updatedAt ?? null;

    return { slug, groupName, items, fp, isNew, updatedAt };
  }

  async function reloadAll() {
    try {
      setStatus(true, "carregando…");
      const groups = (window.RDO_GROUPS && Array.isArray(window.RDO_GROUPS) ? window.RDO_GROUPS : []).slice();

      // fallback: se não vier do index, tenta ler de um data attr (opcional)
      if (!groups.length) {
        const raw = elRoot.getAttribute("data-groups");
        if (raw) {
          raw.split("|").map((s) => s.trim()).filter(Boolean).forEach((g) => groups.push(g));
        }
      }

      elGrid.innerHTML = "";
      let okCount = 0;

      for (const g of groups) {
        try {
          const data = await loadOne(g);
          const card = buildCard(data.slug, data.groupName, data.items, data.updatedAt, data.fp, data.isNew);
          elGrid.appendChild(card);

          // só grava como "visto" no 1º load se já tinha registro anterior — se não, deixa neutro
          if (!localStorage.getItem(`ERPIMPAR_RDO_FP_${data.slug}`)) {
            localStorage.setItem(`ERPIMPAR_RDO_FP_${data.slug}`, data.fp);
          }

          okCount++;
        } catch (err) {
          // cria card "erro"
          const slug = slugify(g);
          const card = document.createElement("div");
          card.className = "rdo-card";
          card.innerHTML = `<div class="rdo-title"><span>${escapeHtml(g)}</span><span class="rdo-chip">erro</span></div>
            <div class="rdo-sub">Não consegui carregar este grupo.</div>
            <div class="rdo-meta"><span>—</span><span style="color:#ffb4b4">${escapeHtml(err.message || "erro")}</span></div>`;
          elGrid.appendChild(card);
        }
      }

      if (!okCount) {
        elEmpty.style.display = "block";
      } else {
        elEmpty.style.display = "none";
      }
      setStatus(true, `ok · ${okCount}/${groups.length} grupos`);
    } catch (e) {
      setStatus(false, "erro");
      console.error(e);
    }
  }

  if (btnRefresh) btnRefresh.addEventListener("click", reloadAll);

  // Atualização automática (a cada 30s) sem ficar agressivo
  let timer = setInterval(() => {
    reloadAll().catch(() => {});
  }, 30000);

  // primeira carga
  reloadAll();

})();
