/*! consulta-fix.v2.js — mapeia colunas de forma tolerante e resolve link do PDF */
(function(){
  function norm(s){
    return String(s||'')
      .normalize('NFD').replace(/\p{Diacritic}/gu,'') // tira acentos
      .toLowerCase().replace(/[^a-z0-9]+/g,'');        // só letras/números
  }
  function pick(obj, candidates){
    // procura por chave equivalente (sem acentos/case)
    const keys = Object.keys(obj||{});
    for (let i=0;i<candidates.length;i++){
      const wanted = norm(candidates[i]);
      for (let k=0;k<keys.length;k++){
        if (norm(keys[k]) === wanted) return obj[keys[k]];
      }
    }
    return '';
  }

  function resolvePdfHref(row){
    try{
      var base=(window.__ERP_SAVE_PATCH__&&window.__ERP_SAVE_PATCH__.SAVE_URL||'').replace('/save.php','/');
      var url = pick(row, ['pdfUrl','url']);
      if (url) return url;
      var f = pick(row, ['file','pdf_file','PDF','pdf']);
      return f ? (base+'pdf.php?f='+encodeURIComponent(String(f).replace(/^.*\//,''))) : '';
    }catch(e){ return ''; }
  }

  window.buscarConsulta = async function(){
    try{
      var PATCH=window.__ERP_SAVE_PATCH__||{};
      var LIST_URL=PATCH.LIST_URL||'https://api.erpimpar.com.br/gerador/list.php';
      var token=PATCH.SAVE_TOKEN||'';
      var q=(document.getElementById('qCodigo')?.value||'').trim();
      var url=LIST_URL+'?limit=100'+(token?'&token='+encodeURIComponent(token):'')+(q?('&codigo='+encodeURIComponent(q)):'');      
      var r=await fetch(url,{cache:'no-store'});
      var j=await r.json().catch(function(){return {rows:[],items:[]};});
      var rows=j.rows||j.items||[];
      var tb=document.getElementById('consultaTBody'); if(!tb) return;
      tb.innerHTML=rows.length?'':'<tr><td colspan="3" style="padding:10px;color:#6b7280;text-align:center">Sem resultados.</td></tr>';
      rows.forEach(function(row){
        var codigo = pick(row, ['codigo','cod','codigo_projeto','CÓDIGO','Código']);
        var obra   = pick(row, ['enderecoObra','obra','endereco','servico','contratante_nome','cliente','descricao']);
        var href   = resolvePdfHref(row);
        var tr=document.createElement('tr'); tr.style.cursor='pointer';
        tr.innerHTML =
          '<td style="padding:8px;border-bottom:1px solid #eee">'+(codigo||'—')+'</td>'+
          '<td style="padding:8px;border-bottom:1px solid #eee">'+(obra||'—')+'</td>'+
          '<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">'+
            (href?'<a class="btn small open-pdf" href="'+href+'" target="_blank" rel="noopener">abrir</a>':'<span style="color:#888">—</span>')+
          '</td>';
        tr.addEventListener('click', function(){
          if(typeof window.openDup==='function') openDup(row);
          else if(typeof window.handleDuplicate==='function') handleDuplicate(row);
        });
        tr.querySelector('.open-pdf')?.addEventListener('click', function(ev){ ev.stopPropagation(); });
        tb.appendChild(tr);
      });
    }catch(e){
      console.error('consulta-fix v2 error:', e);
    }
  };
})();
