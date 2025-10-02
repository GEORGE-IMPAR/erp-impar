/*! consulta-fix.js — substitui buscarConsulta com link de PDF correto e sem "click duplo" */
(function(){
  function resolvePdfHref(row){
    try{
      var base = (window.__ERP_SAVE_PATCH__ && window.__ERP_SAVE_PATCH__.SAVE_URL || '').replace('/save.php','/');
      var url  = row && (row.pdfUrl || row.url);
      if (url) return url;
      var f = row && (row.file || row.pdf_file || row.PDF || row.pdf);
      return f ? (base + 'pdf.php?f=' + encodeURIComponent(String(f).replace(/^.*\//,''))) : '';
    }catch(e){ return ''; }
  }

  async function buscarConsultaNova(){
    try{
      var PATCH = window.__ERP_SAVE_PATCH__ || {};
      var LIST_URL = PATCH.LIST_URL || 'https://api.erpimpar.com.br/gerador/list.php';
      var token = PATCH.SAVE_TOKEN || '';
      var q = (document.getElementById('qCodigo')?.value || '').trim();
      var url = LIST_URL + '?limit=100' + (token ? '&token=' + encodeURIComponent(token) : '') + (q?('&codigo='+encodeURIComponent(q)) : '');
      var r = await fetch(url, { cache:'no-store' });
      var j = await r.json().catch(function(){return {ok:false, rows:[], items:[]};});
      var rows = j.rows || j.items || [];
      var tb = document.getElementById('consultaTBody');
      if(!tb) return;
      tb.innerHTML = rows.length? '' : '<tr><td colspan="3" style="padding:10px;color:#6b7280;text-align:center">Sem resultados.</td></tr>';
      rows.forEach(function(row){
        var cod  = row.codigo || row.CODIGO || '';
        var obra = row.enderecoObra || row.endereco || row.obra || row.OBRA || row.servico || '';
        var href = resolvePdfHref(row);
        var tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML =
          '<td style="padding:8px;border-bottom:1px solid #eee">'+ (cod || '&mdash;') +'</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee">'+ (obra || '&mdash;') +'</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">' +
            (href ? '<a class="btn small open-pdf" href="'+href+'" target="_blank" rel="noopener">abrir</a>' : '<span style="color:#888">—</span>') +
          '</td>';
        // evita que o clique do link acione o clique da linha
        tr.querySelector('.open-pdf')?.addEventListener('click', function(ev){ ev.stopPropagation(); });
        // clique na linha -> fluxo duplicado (preencher / atualizar)
        tr.addEventListener('click', function(){
          if (typeof window.openDup === 'function') {
            window.openDup(row);
          } else if (typeof window.handleDuplicate === 'function') {
            window.handleDuplicate(row);
          }
        });
        tb.appendChild(tr);
      });
    }catch(e){
      console.error('consulta-fix buscarConsulta error:', e);
    }
  }

  // aplica substituição quando a página estiver pronta
  function install(){
    window.buscarConsulta = buscarConsultaNova;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
