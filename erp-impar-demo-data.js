(function(){
  'use strict';
  var params=new URLSearchParams(location.search);
  if(params.get('demo')!=='1') return;
  document.documentElement.setAttribute('data-erp-demo','1');
  window.ERP_IMPAR_DEMO={
    obra:{codigo:'AC15926',nome:'TOYOTA MERCOSUL - TUBARAO',cliente:'MERCOSUL TOYOTA',cidade:'TUBARAO',uf:'SC',endereco:'Rua Amarildo Jose da Rosa, 700 - Humaita',coordenador:'FABIO',status:'EM EXECUCAO',progresso:68,previsto:72,valor:648500},
    equipe:['FABIO','PABLO','IBRAIS','VALDECI','HENRIQUE'],
    veiculos:['IZH2A86','RXO8A58','QIQ3921'],
    materiais:[
      {descricao:'CHAPA DE ACO GALVANIZADA #26 - 0,50 X 1,20 X 2,00 M',qtd:63,un:'FL',status:'EM COTACAO'},
      {descricao:'GAS REFRIGERANTE R410A HONEYWELL GENETRON AZ-20',qtd:4,un:'CIL',status:'APROVADO'},
      {descricao:'TUBO DE COBRE 7/8 POL.',qtd:180,un:'M',status:'ENTREGUE'}
    ],
    documentos:[
      {nome:'Contrato da obra',codigo:'CT-AC15926-001',status:'ASSINADO'},
      {nome:'Ordem de servico',codigo:'OS-AC15926-001',status:'EMITIDA'},
      {nome:'Cronograma executivo',codigo:'CR-AC15926-R02',status:'ATUALIZADO'},
      {nome:'Projeto executivo VRF',codigo:'PR-AC15926-R03',status:'LIBERADO'}
    ]
  };

  function text(id,value){var n=document.getElementById(id);if(n&&!String(n.textContent||'').trim())n.textContent=value}
  function html(id,value,force){var n=document.getElementById(id);if(n&&(force||!String(n.textContent||'').trim()||/carregando|selecione/i.test(n.textContent)))n.innerHTML=value}
  function valueFor(el){
    var s=((el.id||'')+' '+(el.name||'')+' '+(el.placeholder||'')).toLowerCase();
    if(/obra|projeto/.test(s))return window.ERP_IMPAR_DEMO.obra.nome;
    if(/cliente/.test(s))return window.ERP_IMPAR_DEMO.obra.cliente;
    if(/codigo|código|ac/.test(s))return window.ERP_IMPAR_DEMO.obra.codigo;
    if(/cidade/.test(s))return window.ERP_IMPAR_DEMO.obra.cidade;
    if(/endereco|endereço|local/.test(s))return window.ERP_IMPAR_DEMO.obra.endereco;
    if(/coordenador|responsavel|responsável/.test(s))return window.ERP_IMPAR_DEMO.obra.coordenador;
    if(/email/.test(s))return 'obras@erpimpar.com.br';
    if(/telefone|whatsapp/.test(s))return '(48) 3333-2026';
    if(/valor/.test(s))return '648500,00';
    if(/data|inicio|início/.test(s))return '2026-09-16';
    return '';
  }
  function fillFields(){
    document.querySelectorAll('input:not([type=file]):not([type=password]):not([type=checkbox]):not([type=radio]),textarea').forEach(function(el){
      if(!el.value){var v=valueFor(el);if(v){el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))}}
    });
    document.querySelectorAll('select').forEach(function(el){
      if(el.options.length===1&&/carregando|selecione/i.test(el.options[0].textContent||'')){
        el.innerHTML='<option value="AC15926">AC15926 - TOYOTA MERCOSUL - TUBARAO</option>';
      }
    });
  }
  function card(title,sub,status){return '<article style="border:1px solid #d5e2ec;border-radius:12px;padding:11px;margin:7px 0;background:#fff;box-shadow:0 6px 16px rgba(8,43,86,.06)"><b style="display:block;color:#0b3f82;font-size:11px">'+title+'</b><small style="display:block;margin-top:4px;color:#6f8293">'+sub+'</small><span style="display:inline-flex;margin-top:7px;padding:4px 7px;border-radius:99px;background:#eaf8f2;color:#087a54;font-size:8px;font-weight:900">'+status+'</span></article>'}
  function hydrate(){
    fillFields();
    var name=decodeURIComponent(location.pathname.split('/').pop()||'').toLowerCase();
    if(name.indexOf('solicitacao_materiais')>=0){
      text('statItens','3 itens');text('statQtd','247 unidades');text('statObra','Toyota Mercosul');text('statPrazo','Entrega: 21/09/2026');text('statusBadge','Em cotacao');
      html('emptyState','<div style="padding:18px"><h3 style="margin:0 0 6px;color:#0b3f82">Solicitacao SM-AC15926-014</h3><p style="margin:0;color:#6f8293">Materiais vinculados a obra Toyota Mercosul.</p>'+window.ERP_IMPAR_DEMO.materiais.map(function(m){return card(m.descricao,m.qtd+' '+m.un,m.status)}).join('')+'</div>',true);
    }
    if(name.indexOf('medicao_empreiteiro')>=0){
      html('contracts',card('CT-EMP-AC15926-003','Dutotec Instalacoes - Toyota Mercosul','MEDICAO ABERTA'),true);
      html('work','<div class="meta"><div><small>OBRA</small><b>TOYOTA MERCOSUL</b></div><div><small>EMPREITEIRO</small><b>DUTOTEC INSTALACOES</b></div><div><small>CONTRATO</small><b>R$ 186.400,00</b></div><div><small>SALDO</small><b>R$ 82.016,00</b></div></div><div class="table"><table><thead><tr><th>ITEM</th><th>DESCRICAO</th><th>CONTRATADO</th><th>ANTERIOR</th><th>ATUAL</th></tr></thead><tbody><tr><td>01</td><td>Fabricacao e montagem de dutos</td><td>100%</td><td>48%</td><td><b>68%</b></td></tr><tr><td>02</td><td>Isolamento termico</td><td>100%</td><td>35%</td><td><b>52%</b></td></tr><tr><td>03</td><td>Instalacao de difusores</td><td>100%</td><td>20%</td><td><b>34%</b></td></tr></tbody></table></div>',true);
      text('kContrato','R$ 186.400,00');text('kMedido','R$ 104.384,00');text('kSaldo','R$ 82.016,00');
    }
    if(name==='aprovacao.html'){
      html('body','<div class="meta"><div><small>OBRA</small><b>TOYOTA MERCOSUL</b></div><div><small>EMPREITEIRO</small><b>DUTOTEC INSTALACOES</b></div><div><small>CONTRATO</small><b>CT-EMP-AC15926-003</b></div><div><small>STATUS</small><b>AGUARDANDO APROVACAO</b></div></div><div class="total"><span>VALOR DESTA MEDICAO</span><b>R$ 37.280,00</b></div><div class="table"><table><thead><tr><th>ITEM</th><th>ETAPA</th><th>AVANCO</th><th>VALOR</th></tr></thead><tbody><tr><td>01</td><td>Fabricacao e montagem de dutos</td><td>20%</td><td>R$ 22.368,00</td></tr><tr><td>02</td><td>Isolamento termico</td><td>17%</td><td>R$ 9.506,40</td></tr><tr><td>03</td><td>Instalacao de difusores</td><td>14%</td><td>R$ 5.405,60</td></tr></tbody></table></div>',true);
    }
    if(name.indexOf('atualizacao_viagens')>=0){
      html('matrix','<div class="head"><div class="hcell">Colaborador</div><div class="hcell">SEGUNDA<span>14/09</span></div><div class="hcell">TERCA<span>15/09</span></div><div class="hcell">QUARTA<span>16/09</span></div><div class="hcell">QUINTA<span>17/09</span></div><div class="hcell">SEXTA<span>18/09</span></div></div><div class="row"><div class="name">FABIO<span class="mini">5 dias</span></div>'+['Hotel Tubarao','Hotel Tubarao','Hotel Tubarao','Hotel Tubarao','Retorno'].map(function(v,i){return '<div class="day"><div class="trip ok"><div class="trip-title">TOYOTA MERCOSUL</div><div class="trip-sub">'+v+'</div><div class="trip-foot"><span class="pill">R$ '+(i===4?'30,00':'210,00')+'</span></div></div></div>'}).join('')+'</div>',true);
    }
    if(name.indexOf('gestão_documental')>=0||name.indexOf('gestao_documental')>=0){
      ['docList','documents','listaDocumentos','documentList'].forEach(function(id){html(id,window.ERP_IMPAR_DEMO.documentos.map(function(d){return card(d.nome,d.codigo,d.status)}).join(''))});
    }
    if(name.indexOf('gestao_obras')>=0){
      document.querySelectorAll('.pc').forEach(function(n,i){if(i===0)n.classList.add('on')});
    }
    if(name.indexOf('index (25)')>=0||name.indexOf('motor_gps')>=0){
      ['status','resultado','results'].forEach(function(id){html(id,'<b>Rota analisada</b><br>IZH2A86 - Sao Jose/SC → Toyota Mercosul, Tubarao/SC<br>Distancia: 152 km | Tempo estimado: 2h08 | Permanencia na obra: 7h42')});
    }
    if(!document.querySelector('.erp-demo-badge')){
      var badge=document.createElement('div');badge.className='erp-demo-badge';badge.textContent='Cenario demonstrativo - Toyota Mercosul';document.body.appendChild(badge);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(hydrate,900)},{once:true});
  else setTimeout(hydrate,900);
  setTimeout(hydrate,2200);
})();
