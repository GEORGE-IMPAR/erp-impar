(function(global){
  'use strict';
  const {Core}=global.GPSV4;
  const UI={};const $=id=>document.getElementById(id);
  UI.status=(message,type='')=>{const el=$('status');el.textContent=message;el.className='status'+(type?` ${type}`:'')};
  UI.fillFilters=events=>{const plates=[...new Set(events.map(x=>x.plate).filter(Boolean))].sort();$('placa').innerHTML='<option value="">Todas</option>'+plates.map(p=>`<option>${Core.escape(p)}</option>`).join('');const dates=events.map(x=>x.dt).filter(d=>d instanceof Date&&!isNaN(d.getTime())).sort((a,b)=>a-b);if(!dates.length)throw new Error('Nenhuma data válida foi encontrada no arquivo.');$('inicio').value=Core.iso(dates[0]);$('fim').value=Core.iso(dates[dates.length-1]);['placa','inicio','fim','processar','limpar'].forEach(id=>$(id).disabled=false)};
  UI.render=result=>{
    if(result.positionMode){
      $('kRecebidos').textContent=result.received.length.toLocaleString('pt-BR');
      $('kValidos').textContent=result.valid.length.toLocaleString('pt-BR');
      $('kDescartados').textContent=`${result.dashboard.totalKm.toFixed(2).replace('.',',')} km`;
      $('kCiclos').textContent=result.cycles.length.toLocaleString('pt-BR');
      $('kTrechos').textContent=result.dashboard.movingPositions.toLocaleString('pt-BR');
      $('kIncompletos').textContent=`${result.dashboard.maxSpeed.toLocaleString('pt-BR')} km/h`;
      renderPositionTimeline(result);renderSegments(result.segments);renderCycles(result.cycles);renderAudit(result.auditTrail);
      $('exportarAuditoria').disabled=!result.auditTrail.length;
      global.GPSV4.MapUI?.render(result);return;
    }
    $('kRecebidos').textContent=result.received.length.toLocaleString('pt-BR');$('kValidos').textContent=result.valid.length.toLocaleString('pt-BR');$('kDescartados').textContent=result.auditTrail.filter(x=>x.auditStatus.startsWith('DESCARTADO')||x.auditStatus.startsWith('SUBSTITUIDO')).length.toLocaleString('pt-BR');$('kCiclos').textContent=result.cycles.length.toLocaleString('pt-BR');$('kTrechos').textContent=result.segments.length.toLocaleString('pt-BR');$('kIncompletos').textContent=result.cycles.filter(x=>x.incomplete).length.toLocaleString('pt-BR');
    renderTimeline(result);renderSegments(result.segments);renderCycles(result.cycles);renderAudit(result.auditTrail);$('exportarAuditoria').disabled=!result.auditTrail.length;
  };
  function renderPositionTimeline(result){
    const el=$('timeline');
    el.innerHTML=(result.rotas||[]).map(route=>`<div class="day"><h3><span>${Core.formatDate(route.date)} — ${Core.dayName(route.date)}</span><span>${route.km.toFixed(2).replace('.',',')} km</span></h3><div class="cycle"><div class="cycle-top"><div><div class="time">${Core.escape(route.plate)} • ${route.positions.length} posições</div><div class="address">${Core.escape(route.positions[0]?.address||'')} → ${Core.escape(route.positions.at(-1)?.address||'')}</div></div><span class="badge ok">Hodômetro</span></div><div class="meta">${route.movingMinutes.toFixed(0)} min em movimento • máxima ${route.maxSpeed} km/h</div><span class="rule">GPS: ${route.kmGps.toFixed(2).replace('.',',')} km • Hodômetro: ${route.kmHodometro.toFixed(2).replace('.',',')} km</span></div></div>`).join('')||'<div class="empty">Nenhuma rota encontrada.</div>';
  }
  function renderTimeline(result){const el=$('timeline');if(!result.cycles.length){el.innerHTML='<div class="empty">Nenhum ciclo iniciado por Ligou ignição foi encontrado.</div>';return}const groups={};result.cycles.forEach(c=>(groups[Core.iso(c.date)]??=[]).push(c));el.innerHTML=Object.entries(groups).map(([key,cycles])=>{const d=cycles[0].date;let html='';cycles.forEach((c,index)=>{html+=`<div class="cycle"><div class="cycle-top"><div><div class="time">${c.id} • ${Core.formatTime(c.start.dt)} → ${Core.formatTime(c.end.dt)}</div><div class="address">${Core.escape(c.start.address||'Endereço não informado')}</div></div><span class="badge ${c.incomplete?'warn':'ok'}">${c.incomplete?'Incompleto':'Fechado'}</span></div><div class="meta">${Core.escape(c.plate)} • ${c.rawEvents} evento(s) recebido(s) • ${c.discarded} substituído(s)</div><span class="rule">Duração: ${Core.duration(c.end.dt-c.start.dt)} • ${c.points.length} ponto(s) válido(s)</span></div>`;c.points.forEach((p,i)=>{const next=c.points[i+1];if(!next)return;if(Core.norm(p.address)!==Core.norm(next.address))html+=`<div class="segment"><strong>${Core.formatTime(p.dt)} → ${Core.formatTime(next.dt)}</strong><br>${Core.escape(p.address)} → ${Core.escape(next.address)}<br>Tempo: <strong>${Core.duration(next.dt-p.dt)}</strong> • KM: <strong>pendente Google Maps</strong></div>`});const nextCycle=cycles[index+1];if(nextCycle)html+=`<div class="stop">Permanência entre ciclos: <strong>${Core.formatTime(c.end.dt)} → ${Core.formatTime(nextCycle.start.dt)}</strong> (${Core.duration(nextCycle.start.dt-c.end.dt)})<br>${Core.escape(c.end.address||'Endereço não informado')}</div>`});return `<div class="day"><h3 class="${[0,6].includes(d.getDay())?'weekend':''}"><span>${Core.formatDate(d)} — ${Core.dayName(d)}</span><span>${cycles.length} ciclo(s)</span></h3>${html}</div>`}).join('')}
  function renderSegments(list){$('tbodyTrechos').innerHTML=list.length?list.map((x,i)=>`<tr class="${[0,6].includes(x.date.getDay())?'weekend-row':''}"><td>${i+1}</td><td>${x.cycleId}</td><td>${Core.formatDate(x.date)}</td><td>${Core.formatTime(x.departure)}</td><td>${Core.escape(x.origin)}</td><td>${Core.formatTime(x.arrival)}</td><td>${Core.escape(x.destination)}</td><td>${Core.duration(x.duration)}</td><td>${Number(x.km||0).toFixed(3).replace('.',',')}</td></tr>`).join(''):'<tr><td colspan="9" class="empty">Nenhum trecho identificado.</td></tr>'}
  function renderCycles(list){$('tbodyCiclos').innerHTML=list.length?list.map(c=>`<tr><td>${c.id}</td><td>${Core.escape(c.plate)}</td><td>${Core.formatDate(c.date)}</td><td>${Core.formatTime(c.start.dt)}</td><td>${Core.formatTime(c.end.dt)}</td><td>${Core.duration(c.end.dt-c.start.dt)}</td><td>${c.points.length}</td><td>${c.rawEvents}</td><td>${c.discarded}</td><td><span class="badge ${c.incomplete?'warn':'ok'}">${c.incomplete?'Incompleto':'Fechado'}</span></td></tr>`).join(''):'<tr><td colspan="10" class="empty">Nenhum ciclo identificado.</td></tr>'}
  function renderAudit(list){const select=$('auditStatus');const current=select.value;const statuses=[...new Set(list.map(x=>x.auditStatus))].sort();select.innerHTML='<option value="">Todos</option>'+statuses.map(s=>`<option ${s===current?'selected':''}>${s}</option>`).join('');UI.renderAuditRows(list)}
  UI.renderAuditRows=list=>{const filter=$('auditStatus').value;const rows=filter?list.filter(x=>x.auditStatus===filter):list;$('tbodyAuditoria').innerHTML=rows.length?rows.map((x,i)=>`<tr><td>${i+1}</td><td>${Core.formatDate(x.dt)} ${Core.formatTime(x.dt)}</td><td>${Core.escape(x.plate)}</td><td>${Core.escape(x.type)}</td><td>${Core.escape(x.address)}</td><td><span class="badge ${x.auditStatus.startsWith('DESCARTADO')?'bad':x.auditStatus.startsWith('SUBSTITUIDO')?'warn':'info'}">${x.auditStatus}</span></td><td>${Core.escape(x.auditReason)}</td><td>${Core.escape(x.cycleId||'—')}</td></tr>`).join(''):'<tr><td colspan="8" class="empty">Nenhum evento para o filtro selecionado.</td></tr>'};
  UI.renderCadastros=metadata=>{
    const carros=metadata?.cadastroCarros||[],obras=metadata?.cadastroObras||[];
    const residencias=metadata.residencias||[];
    const cadastroRows=[];
    carros.forEach(carro=>{
      const homes=residencias.filter(item=>item.placa===carro.placa);
      (homes.length?homes:[{}]).forEach(r=>{
        const status=r.confirmado&&Number.isFinite(r.latitude)?'<span class="badge ok">Confirmado e localizado</span>':r.confirmado?'<span class="badge info">Confirmado • localizar</span>':r.regraUsuario?`<span class="badge warn">Ponto noturno • ${r.noites} noite(s)</span>`:'<span class="badge bad">Endereço pendente</span>';
        const origem=r.origem||(r.regraUsuario?'Inferência GPS':'Não informado'),nome=r.nome||carro.responsavel||'';
        cadastroRows.push(`<tr><td>${Core.escape(carro.placa)}</td><td>${Core.escape(carro.responsavel||'—')}</td><td>${Core.escape(nome||'—')}${r.principal?' <span class="badge info">Condutor principal</span>':''}</td><td>R$ ${Number(carro.valorHora||0).toFixed(2).replace('.',',')}</td><td>${Number(carro.horasDia||0).toLocaleString('pt-BR')}</td><td><input class="residencia-endereco" data-placa="${Core.escape(carro.placa)}" data-nome="${Core.escape(nome)}" value="${Core.escape(r.endereco||'')}" placeholder="Rua, número, bairro, cidade e UF"></td><td>${Core.escape(origem)}</td><td>${status}</td></tr>`);
      });
    });
    $('tbodyCarros').innerHTML=cadastroRows.length?cadastroRows.join(''):'<tr><td colspan="8" class="empty">A aba Cadastro_Carros_Valor_h_h não foi encontrada.</td></tr>';
    $('tbodyObras').innerHTML=obras.length?obras.map((x,i)=>`<tr><td>${Core.escape(x.idObra)}</td><td>${Core.escape(x.nome)}</td><td><input class="obra-endereco" data-index="${i}" value="${Core.escape(x.endereco||'')}" placeholder="Endereço completo da obra"></td><td>${Number.isFinite(x.latitude)?'<span class="badge ok">Localizada</span>':'<span class="badge warn">Pendente</span>'}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">A aba Cadastro_Obras não foi encontrada.</td></tr>';
    const cadastradas=carros.filter(x=>residencias.some(r=>r.placa===x.placa&&r.endereco)).length;
    $('cadastroResumo').textContent=`${carros.length} veículo(s), ${cadastradas} residência(s) preenchida(s) e ${obras.length} obra(s). Endereços pendentes deixam o cálculo casa ↔ empresa zerado para a respectiva placa.`;
  };
  UI.readCadastroEdits=metadata=>{
    document.querySelectorAll('.obra-endereco').forEach(input=>{const item=metadata.cadastroObras[Number(input.dataset.index)];if(item&&item.endereco!==input.value.trim()){item.endereco=input.value.trim();delete item.latitude;delete item.longitude}});
    document.querySelectorAll('.residencia-endereco').forEach(input=>{let item=metadata.residencias.find(x=>x.placa===input.dataset.placa&&Core.norm(x.nome||'')===Core.norm(input.dataset.nome||''));if(!item){item={placa:input.dataset.placa,nome:input.dataset.nome||''};metadata.residencias.push(item)}const value=input.value.trim();if(!value&&item.regraUsuario)return;if(item.endereco!==value){item.endereco=value;item.confirmado=Boolean(value);item.origem=value?'Cadastro digitado':'Não informado';item.regraUsuario=false;delete item.latitude;delete item.longitude}});
  };
  UI.renderFinanceiro=data=>{
    const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),km=n=>`${Number(n||0).toFixed(2).replace('.',',')} km`;
    const s=data.summary;
    const bind=(kmId,costId,row)=>{$(kmId).textContent=km(row.km);$(costId).textContent=money(row.custo)};
    $('fTotal').textContent=km(s.totalKm);$('fTotalCusto').textContent=money(s.totalCustoCombustivel);
    bind('fObras','fObrasCusto',s.obra);bind('fEmpresa','fEmpresaCusto',s.empresa);
    bind('fIda','fIdaCusto',s.residencia_empresa);bind('fVolta','fVoltaCusto',s.empresa_residencia);
    bind('fFimSemana','fFimSemanaCusto',s.fim_semana);bind('fForaHorario','fForaHorarioCusto',s.fora_horario);
    bind('fNaoClassificado','fNaoClassificadoCusto',s.nao_classificado);
    const labels={obra:'1.1. Obra',empresa:'1.2. Empresa',residencia_empresa:'1.3. Residência → empresa',empresa_residencia:'1.4. Empresa → residência',fim_semana:'1.5. Sábado e domingo',fora_horario:'1.6. Fora do horário',nao_classificado:'1.7. Não classificado'};
    const categories=['obra','empresa','residencia_empresa','empresa_residencia','fim_semana','fora_horario','nao_classificado'];
    $('tbodyCategorias').innerHTML=categories.map(key=>`<tr><td>${labels[key]}</td><td>${km(s[key].km)}</td><td>${s[key].litros.toFixed(2).replace('.',',')} L</td><td>${money(s[key].custo)}</td><td>${(s.totalKm?s[key].km/s.totalKm*100:0).toFixed(1).replace('.',',')}%</td></tr>`).join('');
    const categoryKm=categories.reduce((sum,key)=>sum+s[key].km,0),difference=s.totalKm-categoryKm,reconciliationOk=Math.abs(difference)<.01;
    const reconciliation=$('conciliacaoFinanceira');reconciliation.textContent=`${reconciliationOk?'CONCILIAÇÃO OK':'REVISAR CONCILIAÇÃO'} • Total: ${km(s.totalKm)} • Categorias: ${km(categoryKm)} • Diferença: ${km(difference)}`;reconciliation.className=`status ${reconciliationOk?'ok':'error'}`;
    $('tbodyFinanceiroObras').innerHTML=data.obras.length?data.obras.map(x=>`<tr><td>${Core.escape(x.nome)}</td><td>${km(x.km)}</td><td>${x.litros.toFixed(2).replace('.',',')} L</td><td>${money(x.custo)}</td><td>${Number(x.horas||0).toFixed(2).replace('.',',')} h</td><td>${money(x.maoObra)}</td><td><strong>${money(x.total)}</strong></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nenhuma permanência ou deslocamento associado a obra.</td></tr>';
    $('financeiroAviso').textContent=`Cálculo: ${s.kmLitro.toLocaleString('pt-BR')} km/L • ${money(s.precoLitro)}/L • raio ${s.raio.toLocaleString('pt-BR')} m. Cada KM pertence a somente uma categoria.`;
    $('financeiroAviso').className='status ok';
  };
  UI.financePending=message=>{
    const el=$('financeiroAviso');el.textContent=message;el.className='status warn';
    ['fTotal','fObras','fEmpresa','fIda','fVolta','fFimSemana','fForaHorario','fNaoClassificado'].forEach(id=>$(id).textContent='—');
    ['fTotalCusto','fObrasCusto','fEmpresaCusto','fIdaCusto','fVoltaCusto','fFimSemanaCusto','fForaHorarioCusto','fNaoClassificadoCusto'].forEach(id=>$(id).textContent='Aguardando localização');
    $('tbodyFinanceiroObras').innerHTML='<tr><td colspan="7" class="empty">Aguardando a localização automática da sede e das obras.</td></tr>';
    $('tbodyCategorias').innerHTML='<tr><td colspan="5" class="empty">Aguardando classificação.</td></tr>';
    $('conciliacaoFinanceira').textContent='Aguardando cálculo.';$('conciliacaoFinanceira').className='status warn';
  };
  UI.financeWarning=message=>{const el=$('financeiroAviso');el.textContent=message;el.className='status error'};
  UI.exportAudit=list=>{const sep=';';const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;const header=['ID Evento','Data/Hora','Placa','Evento','Endereço','Status','Motivo','Ciclo'];const lines=[header.map(q).join(sep),...list.map(x=>[x.idEvento,`${Core.formatDate(x.dt)} ${Core.formatTime(x.dt)}`,x.plate,x.type,x.address,x.auditStatus,x.auditReason,x.cycleId].map(q).join(sep))];const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`auditoria_mrt_v5_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)};
  UI.exportFinanceiro=data=>{
    const sep=';',q=value=>`"${String(value??'').replace(/"/g,'""')}"`,decimal=value=>Number(value||0).toFixed(4).replace('.',',');
    const header=['Linha','ID trecho','Data','Início','Fim','Placa','Responsável','Origem','Destino','Categoria exclusiva','Obra','Regra aplicada','KM','KM/L','Litros','Preço/L','Custo combustível'];
    const rows=data.items.map((x,index)=>[index+1,x.id,x.inicio?Core.formatDate(x.inicio):'',x.inicio?Core.formatTime(x.inicio):'',x.fim?Core.formatTime(x.fim):'',x.placa,x.responsavel,x.origem,x.destino,x.categoria,x.nome,x.motivo,decimal(x.km),decimal(data.summary.kmLitro),decimal(x.litros),decimal(data.summary.precoLitro),decimal(x.custo)]);
    const totalKm=data.items.reduce((sum,x)=>sum+x.km,0),totalCusto=data.items.reduce((sum,x)=>sum+x.custo,0);
    rows.push(['TOTAL','','','','','','','','','conciliação','Total das linhas','Deve coincidir com o combustível total',decimal(totalKm),decimal(data.summary.kmLitro),decimal(totalKm/data.summary.kmLitro),decimal(data.summary.precoLitro),decimal(totalCusto)]);
    const blob=new Blob(['\uFEFF'+[header,...rows].map(row=>row.map(q).join(sep)).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`memoria_calculo_financeiro_mrt_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
  };
  global.GPSV4.UI=UI;
})(window);
