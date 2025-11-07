
/**
 * pesquisa_modulo.js
 * Módulo independente de pesquisa/listagem com geração de documentos
 * Exponibiliza window.PesquisaDocs.mount(containerElement)
 */
(function(){
  const JSON_URL = 'https://api.erpimpar.com.br/gerador/json_table_cors.php';
  const SAVE_TOKEN = '8ce29ab4b2d531b0eca93b9f3a8882e543cbad73663b77';
  const API_BASE = '/api/gerador';
  const TPL_CONTRATO = 'Template-Contrato.docx';
  const TPL_OS = 'Template_OS.docx';

  async function fetchList(){
    const u = `${JSON_URL}?op=list${SAVE_TOKEN?('&token='+encodeURIComponent(SAVE_TOKEN)):""}`;
    const r = await fetch(u,{cache:'no-store'}); const j = await r.json().catch(()=>null);
    return (j && j.ok) ? (j.items||[]) : [];
  }
  async function fetchGet(codigo){
    const u = `${JSON_URL}?op=get&codigo=${encodeURIComponent(codigo)}${SAVE_TOKEN?('&token='+encodeURIComponent(SAVE_TOKEN)):""}`;
    const r = await fetch(u,{cache:'no-store'}); const j = await r.json().catch(()=>null);
    return (j && j.ok) ? j.item : null;
  }
  async function gerar(code, php, template){
    const url = `${API_BASE}/${php}?codigo=${encodeURIComponent(code)}&template=${encodeURIComponent(template)}`;
    const r = await fetch(url,{cache:'no-store'});
    const j = await r.json();
    if(j && j.ok && j.url){ window.open(j.url,'_blank'); return true; }
    alert('Falha ao gerar documento'); console.warn(j); return false;
  }

  function mount(container){
    const el = (tag, attrs={}, html=null)=>{
      const e=document.createElement(tag); for(const k in attrs){ e.setAttribute(k, attrs[k]); }
      if(html!=null) e.innerHTML = html; return e;
    };
    const root = el('div',{class:'pesq-root'}, `
      <style>
        .pesq-head{display:flex;gap:8px;margin:8px 0}
        .pesq-head input{flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:10px}
        .pesq-btn{border:none;border-radius:999px;padding:10px 14px;font-weight:700;cursor:pointer}
        .pesq-btn.p{background:linear-gradient(90deg,#08142E,#0A1A3A);color:#fff}
        .pesq-btn.g{background:#e5e7eb;color:#0A1A3A}
        .pesq-list{border-top:1px solid #e5e7eb}
        .pesq-item{display:grid;grid-template-columns:160px 160px 1fr;gap:12px;padding:10px;border-bottom:1px solid #e5e7eb;cursor:pointer}
        .pesq-code{font-weight:900;color:#0A1A3A}
        .pesq-date{color:#475569}
        .pesq-client{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
      </style>
      <div class="pesq-head">
         <input id="pesq-codigo" placeholder="Digite o código" />
         <button class="pesq-btn p" id="pesq-listar">Listar</button>
         <button class="pesq-btn g" id="pesq-todos">Listar todos</button>
      </div>
      <div class="pesq-list" id="pesq-list"></div>
    `);
    container.appendChild(root);
    const $ = s => root.querySelector(s);

    function render(items){
      const list = $('#pesq-list'); list.innerHTML='';
      if(!items || !items.length){ list.innerHTML='<div style="padding:12px;color:#64748b">Sem registros.</div>'; return; }
      items.forEach(r=>{
        const d = el('div',{class:'pesq-item'});
        d.innerHTML = `<div class="pesq-code">${r.codigo||''}</div>
                       <div class="pesq-date">${(r.data_criacao||'').slice(0,10)}</div>
                       <div class="pesq-client">${r.nomeContratante||''}</div>`;
        d.addEventListener('click', async ()=>{
          const code = (r.codigo||'').toUpperCase();
          const escolha = await new Promise(res=>{
            const ok = confirm(`Gerar contrato para ${code}? (OK=Contrato / Cancel=OS)`);
            res(ok ? 'contrato' : 'os');
          });
          if(escolha === 'contrato') await gerar(code,'make_contract.php',TPL_CONTRATO);
          else                        await gerar(code,'make_os.php',TPL_OS);
        });
        list.appendChild(d);
      });
    }

    $('#pesq-todos').addEventListener('click', async ()=> render(await fetchList()));
    $('#pesq-listar').addEventListener('click', async ()=>{
      const c = ($('#pesq-codigo').value||'').trim(); 
      if(!c) return $('#pesq-todos').click();
      const item = await fetchGet(c); render(item?[item]:[]);
    });

    $('#pesq-todos').click();
  }

  window.PesquisaDocs = { mount };
})();
