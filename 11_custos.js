(function(global){
  'use strict';
  const {Core,Importer,Normalizer,Engine,UI,Financeiro}=global.GPSV4;const $=id=>document.getElementById(id);let base=[],lastResult=null,mode='todos',metadata={cadastroCarros:[],cadastroObras:[],sede:null},locationsReady=false,locating=false;
  const modeLabel=()=>({todos:'Todos os dias',sabado:'Somente sábados',domingo:'Somente domingos',fora:'Fora do expediente'}[mode]||'Todos os dias');
  function filteredEvents(){const plate=$('placa').value;const start=$('inicio').value?new Date($('inicio').value+'T00:00:00'):null;const end=$('fim').value?new Date($('fim').value+'T23:59:59'):null;return base.filter(x=>(!plate||x.plate===plate)&&(!start||x.dt>=start)&&(!end||x.dt<=end)).filter(x=>mode==='sabado'?x.dt.getDay()===6:mode==='domingo'?x.dt.getDay()===0:mode==='fora'?Core.outsideWork(x.dt):true)}
  function params(){return {kmLitro:$('kmLitro').value,precoLitro:$('precoLitro').value,raio:$('raio').value}}
  function updateFinance(){if(!lastResult)return;if(!locationsReady){UI.financePending('Localizando sede e obras antes de calcular os custos...');return}UI.renderFinanceiro(Financeiro.run(lastResult,metadata,params()));global.GPSV4.MapUI?.renderLocations(metadata,$('raio').value)}
  function process(){lastResult=Engine.run(filteredEvents(),{showTechnical:$('mostrarTecnicos').checked});UI.render(lastResult);UI.renderCadastros(metadata);updateFinance();const discarded=lastResult.auditTrail.filter(x=>x.auditStatus.startsWith('DESCARTADO')||x.auditStatus.startsWith('SUBSTITUIDO')).length;UI.status(`Filtro ativo: ${modeLabel()} • ${lastResult.cycles.length} ciclo(s), ${lastResult.segments.length} trecho(s) e ${discarded} evento(s) descartado(s) ou substituído(s).`,'ok')}
  $('arquivo').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;UI.status('Lendo e normalizando arquivo...');try{const imported=await Importer.readFile(file);metadata={...(Importer.readFile.lastMetadata||{cadastroCarros:[],cadastroObras:[]}),sede:null};locationsReady=false;base=Normalizer.run(imported).eventos;if(!base.length)throw new Error('Não encontrei registros válidos. Confirme os cabeçalhos Data/Hora e Rastreável.');mode='todos';document.querySelectorAll('.chip').forEach(chip=>chip.classList.toggle('active',chip.dataset.mode==='todos'));UI.fillFilters(base);$('localizarPontos').disabled=false;$('atualizarFinanceiro').disabled=false;process();await locatePoints(true)}catch(error){console.error(error);UI.status(error.message||'Falha ao ler o arquivo.','error')}});
  $('processar').addEventListener('click',process);$('mostrarTecnicos').addEventListener('change',process);
  $('limpar').addEventListener('click',()=>{mode='todos';document.querySelectorAll('.chip').forEach((c,i)=>c.classList.toggle('active',i===0));$('placa').value='';if(base.length){$('inicio').value=Core.iso(base[0].dt);$('fim').value=Core.iso(base[base.length-1].dt)}$('mostrarTecnicos').checked=false;process()});
  document.querySelectorAll('.chip').forEach(chip=>chip.addEventListener('click',()=>{mode=chip.dataset.mode;document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));chip.classList.add('active');process()}));
  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));tab.classList.add('active');$(`panel-${tab.dataset.tab}`).classList.add('active')}));
  $('auditStatus').addEventListener('change',()=>lastResult&&UI.renderAuditRows(lastResult.auditTrail));$('exportarAuditoria').addEventListener('click',()=>lastResult&&UI.exportAudit(lastResult.auditTrail));
  $('animarRota').addEventListener('click',()=>global.GPSV4.MapUI?.play());
  $('pararRota').addEventListener('click',()=>global.GPSV4.MapUI?.stop());
  $('visaoGeral').addEventListener('click',()=>global.GPSV4.MapUI?.fitOverview());
  $('atualizarFinanceiro').addEventListener('click',updateFinance);
  async function locatePoints(automatic=false){
    if(locating)return;locating=true;
    const button=$('localizarPontos');button.disabled=true;
    try{
      const targets=[{tipo:'sede',nome:'Empresa',endereco:$('enderecoSede').value},...metadata.cadastroObras.map(x=>({tipo:'obra',ref:x,nome:x.nome,endereco:x.endereco}))];
      let found=0;const unresolved=[];
      for(let i=0;i<targets.length;i++){
        const target=targets[i];UI.status(`Localizando ${i+1} de ${targets.length}: ${target.nome}...`);
        const point=await Financeiro.geocode(target.endereco);
        if(point){found++;if(target.tipo==='sede')metadata.sede={nome:'Sede ÍMPAR',endereco:target.endereco,...point};else Object.assign(target.ref,point)}
        else unresolved.push(target.nome);
        if(i<targets.length-1)await new Promise(resolve=>setTimeout(resolve,1050));
      }
      locationsReady=true;updateFinance();global.GPSV4.MapUI?.fitOverview();
      if(unresolved.length){UI.financeWarning(`Classificação incompleta: ${unresolved.length} local(is) não encontrado(s): ${unresolved.join(', ')}.`);UI.status(`${found} de ${targets.length} locais encontrados. Revise os endereços não localizados.`,'error')}
      else UI.status(`${found} de ${targets.length} locais encontrados automaticamente. Raio ativo: ${$('raio').value} m.`,'ok');
    }catch(error){locationsReady=false;console.error(error);UI.financePending('Não foi possível localizar todos os pontos. Os custos permanecem bloqueados.');UI.status(`${error.message}. Você pode tentar novamente.`,'error')}finally{locating=false;button.disabled=false}
  }
  $('localizarPontos').addEventListener('click',()=>locatePoints(false));
})(window);
