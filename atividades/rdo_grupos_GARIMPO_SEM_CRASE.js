
/* RDO ao vivo - ERP ÍMPAR (garimpo estável)
   - URL CHUMBADA (sem variáveis confusas)
   - Sem crases / sem template string
   - Cards premium + modal bonito para leitura
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

  function $(sel){ return document.querySelector(sel); }
  function esc(s){
    s = (s === null || s === undefined) ? "" : String(s);
    return s.replace(/[&<>"]/g, function(m){ return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" })[m]; });
  }
  function slugify(name){
    // Mantém padrão já usado: "RDO - X" / "RDO-X" / "Rdo-X"
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

  function lastKey(slug){ return "ERPIMPAR_RDO_SEEN_" + slug; }
  function markSeen(slug, value){
    try{ localStorage.setItem(lastKey(slug), String(value || "")); }catch(e){}
  }
  function getSeen(slug){
    try{ return localStorage.getItem(lastKey(slug)) || ""; }catch(e){ return ""; }
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

  function statusDot(count){
    // 0 msgs => ok (verde), 1-2 => warn, >=3 => azul (tratado como ok+)
    if (count >= 3) return { cls:"", label:"novas" };
    if (count >= 1) return { cls:"warn", label:"atenção" };
    return { cls:"", label:"ok" };
  }

  function ensureModalWiring(){
    var modal = $("#rdoModal");
    if (!modal) return;
    var btnClose = $("#rdoModalClose");
    var backdrop = modal.querySelector(".backdrop");
    function close(){
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden","true");
      document.body.style.overflow = "";
    }
    function open(){
      modal.classList.add("open");
      modal.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
    }
    if (btnClose) btnClose.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);
    document.addEventListener("keydown", function(ev){
      if (ev.key === "Escape" && modal.classList.contains("open")) close();
    });
    return { open: open, close: close };
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
      empty.className = "msg";
      empty.innerHTML = '<div class="mmeta">Sem mensagens</div><div>—</div>';
      body.appendChild(empty);
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

      var card = document.createElement("div");
      card.className = "msg";
      var mmeta = document.createElement("div");
      mmeta.className = "mmeta";
      var metaParts = [];
      if (when) metaParts.push(fmtShortDate(when) || String(when));
      if (who) metaParts.push(String(who));
      mmeta.textContent = metaParts.join(" • ") || "Mensagem";
      var mtxt = document.createElement("div");
      mtxt.innerHTML = esc(txt).replace(/\n/g,"<br>");
      card.appendChild(mmeta);
      card.appendChild(mtxt);
      body.appendChild(card);
    }

    // marcou como lido
    var keyVal = (updatedAt || items.length || Date.now());
    markSeen(slug, keyVal);
  }

  async function loadOne(groupName){
    var slug = slugify(groupName);
    var url = API_GET + encodeURIComponent(slug) + "&ts=" + String(Date.now());

    var json = await fetchJson(url);
    var norm = normalizeItems(json);

    var updatedAt = norm.updatedAt;
    var items = norm.items || [];
    var lastSeen = getSeen(slug);
    var keyVal = String(updatedAt || items.length || "");
    var isNew = keyVal && keyVal !== lastSeen && items.length > 0;

    return {
      groupName: groupName,
      slug: slug,
      ok: true,
      items: items,
      updatedAt: updatedAt,
      isNew: isNew,
      keyVal: keyVal
    };
  }

  function renderCard(container, rec, onOpen){
    var card = document.createElement("div");
    card.className = "rdo-card" + (rec.isNew ? " is-new" : "");
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");

    var title = document.createElement("div");
    title.className = "rdo-title";
    title.textContent = rec.groupName;

    var sub = document.createElement("div");
    sub.className = "rdo-sub";
    sub.textContent = rec.updatedAt ? ("Atualizado: " + fmtShortDate(rec.updatedAt)) : "—";

    var foot = document.createElement("div");
    foot.className = "rdo-foot";

    var left = document.createElement("div");
    left.className = "pill";
    var dot = document.createElement("span");
    dot.className = "dot" + ((rec.items && rec.items.length) ? " warn" : "");
    dot.title = (rec.items && rec.items.length) ? "com mensagens" : "ok";
    left.appendChild(dot);

    var label = document.createElement("span");
    label.textContent = (rec.items && rec.items.length) ? (String(rec.items.length) + " msg(s)") : "0 msg(s)";
    left.appendChild(label);

    var right = document.createElement("div");
    right.className = "pill";
    right.textContent = rec.isNew ? "NOVO" : "Abrir";
    foot.appendChild(left);
    foot.appendChild(right);

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(foot);

    function openIt(){
      if (typeof onOpen === "function") onOpen(rec);
    }
    card.addEventListener("click", openIt);
    card.addEventListener("keydown", function(ev){
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openIt(); }
    });

    container.appendChild(card);
  }

  async function reloadAll(){
    var grid = $("#rdoGrid");
    var meta = $("#rdoMeta");
    var btn = $("#rdoReload");
    if (!grid) return;

    if (btn) btn.disabled = true;
    if (meta) meta.textContent = "Atualizando…";

    grid.innerHTML = "";
    var ok = 0;
    var modalCtl = ensureModalWiring();

    // carrega sequencial para não estourar
    for (var i=0;i<DEFAULT_GROUPS.length;i++){
      var name = DEFAULT_GROUPS[i];
      try{
        var rec = await loadOne(name);
        ok += 1;
        renderCard(grid, rec, async function(r){
          try{
            var data = await fetchJson(API_GET + encodeURIComponent(r.slug) + "&ts=" + String(Date.now()));
            renderModal(r.groupName, r.slug, data);
            if (modalCtl && modalCtl.open) modalCtl.open();
            // após ler, re-render para tirar "NOVO"
            reloadAll();
          }catch(e){
            alert("Não consegui abrir este registro.\n" + String(e && e.message ? e.message : e));
          }
        });
      }catch(e){
        // card de erro
        var err = { groupName: name, slug: slugify(name), ok:false, items:[], updatedAt:null, isNew:false, keyVal:"" };
        var c = document.createElement("div");
        c.className = "rdo-card";
        c.innerHTML = '<div class="rdo-title">'+esc(name)+'</div><div class="rdo-sub">Erro ao carregar</div><div class="rdo-foot"><span class="pill"><span class="dot err"></span><span>erro</span></span><span class="pill">—</span></div>';
        grid.appendChild(c);
      }
    }

    if (meta) meta.textContent = "ok: " + ok + "/" + DEFAULT_GROUPS.length + " grupos";
    if (btn) btn.disabled = false;
  }

  function boot(){
    var btn = $("#rdoReload");
    if (btn) btn.addEventListener("click", reloadAll);
    reloadAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
