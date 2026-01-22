/* RDO ao vivo - ERP ÍMPAR (garimpo estável)
   - URL CHUMBADA (sem variáveis confusas)
   - Sem crases / sem template string
   - Cards premium + modal bonito para leitura
   - Badge global (bolinha vermelha topo) com TOTAL de mensagens novas
*/
(function(){
  "use strict";

  var DEFAULT_GROUPS = [
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

  // ===== RDO BADGE GLOBAL (bolinha vermelha topo) =====
  function ensureRdoGlobalBadge(){
    var id = "rdoGlobalBadge";
    var el = document.getElementById(id);
    if(el) return el;

    el = document.createElement("div");
    el.id = id;

    el.style.position = "fixed";
    el.style.top = "14px";
    el.style.right = "18px";
    el.style.zIndex = "2147483647";
    el.style.background = "#e11d48";
    el.style.color = "#fff";
    el.style.borderRadius = "999px";
    el.style.padding = "6px 10px";
    el.style.fontSize = "12px";
    el.style.fontWeight = "900";
    el.style.letterSpacing = "0.2px";
    el.style.boxShadow = "0 10px 26px rgba(0,0,0,.35)";
    el.style.border = "1px solid rgba(255,255,255,.25)";
    el.style.display = "none";
    el.style.userSelect = "none";
    el.style.cursor = "pointer";
    el.setAttribute("title", "Novas mensagens no RDO");

    el.addEventListener("click", function(){
      try{
        var sec = document.getElementById("rdoLive");
        if(sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }catch(e){}
    });

    document.body.appendChild(el);
    return el;
  }

  function setRdoGlobalBadgeCount(n){
    var el = ensureRdoGlobalBadge();
    var total = Number(n || 0) || 0;
    if(total > 0){
      el.textContent = "● " + total;
      el.style.display = "block";
    }else{
      el.textContent = "";
      el.style.display = "none";
    }
  }

  function $(sel){ return document.querySelector(sel); }
  function esc(s){
    s = (s === null || s === undefined) ? "" : String(s);
    return s.replace(/[&<>"]/g, function(m){
      return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" })[m];
    });
  }

  function slugify(name){
    var s = String(name || "").toLowerCase().trim();
    s = s.replace(/[ãáàâä]/g,"a").replace(/[ẽéèêë]/g,"e").replace(/[ĩíìîï]/g,"i")
         .replace(/[õóòôö]/g,"o").replace(/[ũúùûü]/g,"u").replace(/ç/g,"c");
    s = s.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
    if (s.indexOf("rdo-") !== 0) s = "rdo-" + s;
    return s;
  }

  // >>> URL CERTA (chumbada) <<<
  var API_GET = "https://api.erpimpar.com.br/atividades/rdo/rdo_get.php?slug=";

  async function fetchJson(url){
    var r = await fetch(url, { cache: "no-store" });
    if (r.status === 404) return { ok:true, items:[], updated_at:null };
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  function pickUpdatedAt(data){
    return data && (data.updated_at || data.updatedAt || data.updated || data.last_update || null);
  }

  function normalizeItems(data){
    var items = (data && Array.isArray(data.items)) ? data.items : [];
    var updatedAt = pickUpdatedAt(data);
    return { items: items, updatedAt: updatedAt };
  }

  // ===== SEEN (agora em OBJ para contar "novas msgs") =====
  function lastKey(slug){ return "ERPIMPAR_RDO_SEEN_" + slug; }

  function getSeenObj(slug){
    try{
      var raw = localStorage.getItem(lastKey(slug));
      if(!raw) return { u:"", c:0 };
      var obj = JSON.parse(raw);
      return {
        u: (obj && obj.u) ? String(obj.u) : "",
        c: (obj && typeof obj.c === "number") ? obj.c : Number(obj.c||0)||0
      };
    }catch(e){
      return { u:"", c:0 };
    }
  }

  function markSeenObj(slug, updatedAt, count){
    try{
      var obj = { u: String(updatedAt || ""), c: Number(count || 0) || 0 };
      localStorage.setItem(lastKey(slug), JSON.stringify(obj));
    }catch(e){}
  }

  function fmtShortDate(d){
    try{
      var dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return "";
      var hh = String(dt.getHours()).padStart(2,"0");
      var mm = String(dt.getMinutes()).padStart(2,"0");
      var dd = String(dt.getDate()).padStart(2,"0");
      var mo = String(dt.getMonth()+1).padStart(2,"0");
      return dd + "/" + mo + " " + hh + ":" + mm;
    }catch(e){ return ""; }
  }

  // ✅ Modal wiring: usa ".is-open" (igual seu CSS)
  function ensureModalWiring(){
    var modal = $("#rdoModal");
    if (!modal) return null;

    // evita “empilhar” listeners se reloadAll rodar muitas vezes
    if (modal.__wired) return modal.__wired;

    var btnClose = $("#rdoModalClose");
    var backdrop = modal.querySelector(".backdrop");

    function close(){
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden","true");
      document.body.style.overflow = "";
    }
    function open(){
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
    }

    if (btnClose) btnClose.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);

    document.addEventListener("keydown", function(ev){
      if (ev.key === "Escape" && modal.classList.contains("is-open")) close();
    });

    modal.__wired = { open: open, close: close };
    return modal.__wired;
  }

  function renderModal(groupName, slug, data){
    var modal = $("#rdoModal");
    if (!modal) return;

    var title = $("#rdoModalTitle");
    var sub = $("#rdoModalSub");
    var body = $("#rdoModalBody");

    if (title) title.textContent = groupName;

    var updatedAt = pickUpdatedAt(data);
    var meta = updatedAt ? ("Atualizado: " + fmtShortDate(updatedAt)) : "Últimos 7 dias";
    if (sub) sub.textContent = meta;

    if (body) body.innerHTML = "";

    var items = (data && Array.isArray(data.items)) ? data.items : [];
    if (!items.length){
      var empty = document.createElement("div");
      empty.className = "rdo-msg";
      empty.innerHTML = '<div class="t">—</div><div class="c">Sem mensagens</div>';
      body.appendChild(empty);

      // marca como lido (sem mensagens)
      markSeenObj(slug, String(updatedAt || ""), 0);
      return;
    }

    for (var i=0;i<items.length;i++){
      var it = items[i];
      var when = "";
      var who = "";
      var txt = "";

      if (typeof it === "string"){
        txt = it;
      } else if (it && typeof it === "object"){
        when = it.ts || it.time || it.hora || it.datetime || it.date || "";
        who = it.user || it.autor || it.from || it.remetente || "";
        txt = it.text || it.msg || it.mensagem || it.body || JSON.stringify(it);
      } else {
        txt = String(it);
      }

      var box = document.createElement("div");
      box.className = "rdo-msg";

      var t = document.createElement("div");
      t.className = "t";
      var left = [];
      if (when) left.push(fmtShortDate(when) || String(when));
      if (who) left.push(String(who));
      t.textContent = left.join(" • ") || "Mensagem";

      var c = document.createElement("div");
      c.className = "c";
      c.innerHTML = esc(txt).replace(/\n/g,"<br>");

      box.appendChild(t);
      box.appendChild(c);
      body.appendChild(box);
    }

    // marcou como lido (zera “novas” desse grupo)
    markSeenObj(slug, String(updatedAt || ""), items.length);
  }

  async function loadOne(groupName){
    var slug = slugify(groupName);
    var url = API_GET + encodeURIComponent(slug) + "&ts=" + String(Date.now());

    var json = await fetchJson(url);
    var norm = normalizeItems(json);

    var updatedAt = norm.updatedAt;
    var items = norm.items || [];

    // calcula novas mensagens comparando o "seen"
    var seen = getSeenObj(slug);

    var newMsgs = 0;

    if (items.length === 0){
      newMsgs = 0;
    } else if (updatedAt){
      // se updatedAt mudou, considera tudo novo
      newMsgs = (String(updatedAt) !== String(seen.u)) ? items.length : 0;
    } else {
      // fallback: se não tem updatedAt, usa diferença de count
      var diff = items.length - Number(seen.c || 0);
      newMsgs = diff > 0 ? diff : 0;
    }

    return {
      groupName: groupName,
      slug: slug,
      ok: true,
      items: items,
      updatedAt: updatedAt,
      newMsgs: newMsgs
    };
  }

  function renderCard(container, rec, onOpen){
    var card = document.createElement("div");
    card.className = "rdo-card" + (rec.newMsgs > 0 ? " rdo-new" : "");
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");

    var title = document.createElement("div");
    title.className = "rdo-title";

    var chip = document.createElement("span");
    chip.className = "rdo-chip";
    chip.textContent = (rec.newMsgs > 0) ? (String(rec.newMsgs) + " novo") : "ok";

    title.appendChild(document.createTextNode(rec.groupName));
    title.appendChild(chip);

    var sub = document.createElement("div");
    sub.className = "rdo-sub";
    sub.textContent = rec.updatedAt ? ("Atualizado: " + fmtShortDate(rec.updatedAt)) : "—";

    var meta = document.createElement("div");
    meta.className = "rdo-meta";
    meta.innerHTML =
      "<span>" + (rec.items && rec.items.length ? (String(rec.items.length) + " msg(s)") : "0 msg(s)") + "</span>" +
      "<span>Abrir</span>";

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(meta);

    function openIt(){
      if (typeof onOpen === "function") onOpen(rec);
    }
    card.addEventListener("click", openIt);
    card.addEventListener("keydown", function(ev){
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openIt(); }
    });

    container.appendChild(card);
  }

  function setHeaderStatus(okCount, totalCount){
    // ✅ IDs do seu HTML: rdoStatus + btnRdoRefresh
    var status = $("#rdoStatus");
    if (status){
      status.innerHTML =
        '<span style="width:10px;height:10px;border-radius:50%;background:#2bd27f;display:inline-block;"></span>' +
        "<span>ok • " + String(okCount) + "/" + String(totalCount) + " grupos</span>";
    }
  }

  async function reloadAll(){
    var grid = $("#rdoGrid");
    var btn = $("#btnRdoRefresh");
    if (!grid) return;

    if (btn) btn.disabled = true;
    setHeaderStatus(0, DEFAULT_GROUPS.length);

    grid.innerHTML = "";
    var ok = 0;

    // ✅ cria o controller do modal uma vez
    var modalCtl = ensureModalWiring();

    // 🔴 total de mensagens novas (somatório)
    var totalNewMsgs = 0;

    for (var i=0;i<DEFAULT_GROUPS.length;i++){
      var name = DEFAULT_GROUPS[i];
      try{
        var rec = await loadOne(name);
        ok += 1;

        totalNewMsgs += Number(rec.newMsgs || 0) || 0;

        renderCard(grid, rec, async function(r){
          try{
            var data = await fetchJson(
              API_GET + encodeURIComponent(r.slug) + "&ts=" + String(Date.now())
            );

            renderModal(r.groupName, r.slug, data);

            // ✅ abre modal (fix principal: usa is-open e wiring correto)
            if (modalCtl && modalCtl.open) modalCtl.open();

            // ✅ após abrir, atualiza cards + badge (vai cair pra 0 nesse grupo)
            reloadAll();

          }catch(e){
            alert("Não consegui abrir este registro.\n" + String(e && e.message ? e.message : e));
          }
        });

      }catch(e){
        var c = document.createElement("div");
        c.className = "rdo-card";
        c.innerHTML =
          '<div class="rdo-title">' + esc(name) + '<span class="rdo-chip">erro</span></div>' +
          '<div class="rdo-sub">Erro ao carregar</div>' +
          '<div class="rdo-meta"><span>—</span><span>—</span></div>';
        grid.appendChild(c);
      }
    }

    setHeaderStatus(ok, DEFAULT_GROUPS.length);

    // 🔴 badge global com TOTAL de mensagens novas
    setRdoGlobalBadgeCount(totalNewMsgs);

    if (btn) btn.disabled = false;
  }

  function boot(){
    var btn = $("#btnRdoRefresh");
    if (btn) btn.addEventListener("click", reloadAll);
    ensureRdoGlobalBadge();
    reloadAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();

