(function(global){
  'use strict';
  const {Core,Importer,Normalizer,Engine,UI,Financeiro}=global.GPSV4;const $=id=>document.getElementById(id);let base=[],lastResult=null,lastFinance=null,mode='todos',metadata={cadastroCarros:[],cadastroObras:[],sede:null},locationsReady=false,locating=false;
  const STORAGE_KEY='ERPIMPAR_MRT_RESIDENCIAS_V2';
  const employeeHomes=[
    {nome:'FABIO',endereco:'Rua Antônio de Paula Xavier, 242, Prado de Baixo, Biguaçu, SC, 88160-024'},
    {nome:'LEANDRO',endereco:'Rua Zita Althoff Koerich, 1658, Casa 2, Colônia Santana, São José, SC, 88123-100'},
    {nome:'NERI',endereco:'Rua Florianópolis, 270, Prado, Biguaçu, SC, 88165-064'},
    {nome:'VALDECI',endereco:'Rua Maria Gama de Jesus, 217, Prado, Biguaçu, SC, 88165-060'},
    {nome:'IBRAIS',endereco:'Rua Cônego Rodolfo Machado, 1527, Rio Caveiras, Biguaçu, SC, 88161-740'},
    {nome:'NICOLAS',endereco:'Rua Manoel Rosa, 116, Bloco 28, Apartamento 203, Areias, São José, SC, 88113-835'},
    {nome:'PABLO',endereco:'Rua Irineu Pavan, 580, Bloco 5, Apartamento 402, Serraria, São José, SC, 88115-535'},
    {nome:'HENRIQUE',endereco:'Rua Vitorino José Luiz, 205, Bloco 3, Apartamento 301, Forquilhinha, São José, SC, 88106-516'}
  ];
  const driverByPlate={'IZH-2A86':'FABIO','RXO-8A58':'PABLO','QHQ-8009':'SELO','QII-5E96':'VALDECI','QIQ-3921':'NICOLAS','RXL-6H17':'NICOLAS'};
  const normName=value=>Core.norm(value).replace(/[^a-z0-9 ]/g,' ');
  function loadSavedHomes(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(value)?value:[]}catch(error){console.warn('Cadastro residencial local indisponível.',error);return []}}
  function saveHomes(){
    const data=(metadata.residencias||[]).filter(x=>x.endereco).map(x=>({placa:x.placa,nome:x.nome||'',endereco:x.endereco,confirmado:true,principal:Boolean(x.principal),origem:'Cadastro salvo'}));
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true}catch(error){console.warn('Não foi possível salvar o cadastro residencial.',error);return false}
  }
  function mergeHomes(cars){
    const items=[];
    cars.forEach(car=>{
      const linked=normName(`${car.responsavel||''} ${(car.equipe||[]).map(x=>x.nome).join(' ')}`);
      employeeHomes.forEach(home=>{
        if(linked.includes(normName(home.nome)))items.push({placa:car.placa,nome:home.nome,endereco:home.endereco,confirmado:true,principal:driverByPlate[car.placa]===home.nome,origem:'Cadastro RH'});
      });
      if(car.enderecoResidencial&&!items.some(x=>x.placa===car.placa&&x.endereco===car.enderecoResidencial))items.push({placa:car.placa,nome:car.responsavel||'',endereco:car.enderecoResidencial,confirmado:true,principal:true,origem:'Planilha'});
    });
    loadSavedHomes().forEach(item=>{
      if(!item.placa||!item.endereco)return;
      const index=items.findIndex(x=>x.placa===item.placa&&normName(x.nome)===normName(item.nome));
      if(index>=0)items[index]={...items[index],...item,confirmado:true,origem:'Cadastro salvo'};
      else items.push({...item,confirmado:true,origem:'Cadastro salvo'});
    });
    return items;
  }
  const modeLabel=()=>({todos:'Todos os dias',sabado:'Somente sábados',domingo:'Somente domingos',fora:'Fora do expediente'}[mode]||'Todos os dias');
  const meters=(a,b)=>{const r=6371000,rad=x=>x*Math.PI/180,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude),q=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;return 2*r*Math.asin(Math.sqrt(q))};
  function inferNightAnchors(events,residencias){
    const byPlate=new Map();events.forEach(e=>{if(!byPlate.has(e.plate))byPlate.set(e.plate,new Map());const days=byPlate.get(e.plate),key=Core.iso(e.dt);if(!days.has(key))days.set(key,[]);days.get(key).push(e)});
    const companyPoints=events.filter(e=>Core.norm(e.address).includes('rua sao ludgero'));
    const company=companyPoints.length?{latitude:companyPoints.reduce((s,x)=>s+x.latitude,0)/companyPoints.length,longitude:companyPoints.reduce((s,x)=>s+x.longitude,0)/companyPoints.length}:null;
    byPlate.forEach((days,plate)=>{
      if(residencias.some(x=>x.placa===plate&&x.principal&&x.confirmado))return;
      const keys=[...days.keys()].sort(),nights=[];
      keys.forEach((key,i)=>{const next=keys[i+1];if(!next)return;const d=new Date(`${key}T12:00:00`),expected=new Date(d);expected.setDate(d.getDate()+1);if(Core.iso(expected)!==next)return;const a=days.get(key).sort((x,y)=>x.dt-y.dt).at(-1),b=days.get(next).sort((x,y)=>x.dt-y.dt)[0];if(a.dt.getHours()<17||b.dt.getHours()>8||meters(a,b)>500)return;const point={latitude:(a.latitude+b.latitude)/2,longitude:(a.longitude+b.longitude)/2};if(company&&meters(point,company)<=500)return;nights.push(point)});
      const clusters=[];nights.forEach(point=>{let cluster=clusters.find(c=>meters(c.center,point)<=500);if(!cluster){cluster={center:{...point},points:[]};clusters.push(cluster)}cluster.points.push(point);cluster.center={latitude:cluster.points.reduce((s,x)=>s+x.latitude,0)/cluster.points.length,longitude:cluster.points.reduce((s,x)=>s+x.longitude,0)/cluster.points.length}});
      clusters.sort((a,b)=>b.points.length-a.points.length);const best=clusters[0],confidence=best&&nights.length?best.points.length/nights.length:0;
      if(best&&best.points.length>=2){const current=residencias.find(x=>x.placa===plate&&x.principal);const values={...best.center,nome:driverByPlate[plate]||'CONDUTOR',principal:true,regraUsuario:true,confianca:confidence,noites:best.points.length,noitesForaEmpresa:nights.length};if(current)Object.assign(current,values);else residencias.push({placa:plate,...values})}
    });
  }
  function filteredEvents(){const plate=$('placa').value;const start=$('inicio').value?new Date($('inicio').value+'T00:00:00'):null;const end=$('fim').value?new Date($('fim').value+'T23:59:59'):null;return base.filter(x=>(!plate||x.plate===plate)&&(!start||x.dt>=start)&&(!end||x.dt<=end)).filter(x=>mode==='sabado'?x.dt.getDay()===6:mode==='domingo'?x.dt.getDay()===0:mode==='fora'?Core.outsideWork(x.dt):true)}
  function params(){return {kmLitro:$('kmLitro').value,precoLitro:$('precoLitro').value,raio:$('raio').value}}
  function updateFinance(){if(!lastResult)return;if(!locationsReady){lastFinance=null;UI.financePending('Localizando sede e obras antes de calcular os custos...');return}lastFinance=Financeiro.run(lastResult,metadata,params());UI.renderFinanceiro(lastFinance);$('exportarFinanceiro').disabled=false;global.GPSV4.MapUI?.renderLocations(metadata,$('raio').value)}
  function process(){lastResult=Engine.run(filteredEvents(),{showTechnical:$('mostrarTecnicos').checked});UI.render(lastResult);UI.renderCadastros(metadata);updateFinance();const discarded=lastResult.auditTrail.filter(x=>x.auditStatus.startsWith('DESCARTADO')||x.auditStatus.startsWith('SUBSTITUIDO')).length;UI.status(`Filtro ativo: ${modeLabel()} • ${lastResult.cycles.length} ciclo(s), ${lastResult.segments.length} trecho(s) e ${discarded} evento(s) descartado(s) ou substituído(s).`,'ok')}
  $('arquivo').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;UI.status('Lendo e normalizando arquivo...');try{const imported=await Importer.readFile(file);const importedMetadata=Importer.readFile.lastMetadata||{cadastroCarros:[],cadastroObras:[]};metadata={...importedMetadata,sede:null,residencias:mergeHomes(importedMetadata.cadastroCarros||[])};locationsReady=false;base=Normalizer.run(imported).eventos;inferNightAnchors(base,metadata.residencias);if(!base.length)throw new Error('Não encontrei registros válidos. Confirme os cabeçalhos Data/Hora e Rastreável.');mode='todos';document.querySelectorAll('.chip').forEach(chip=>chip.classList.toggle('active',chip.dataset.mode==='todos'));UI.fillFilters(base);$('localizarPontos').disabled=false;$('atualizarFinanceiro').disabled=false;$('salvarResidencias').disabled=false;process();await locatePoints(true)}catch(error){console.error(error);UI.status(error.message||'Falha ao ler o arquivo.','error')}});
  $('processar').addEventListener('click',process);$('mostrarTecnicos').addEventListener('change',process);
  $('limpar').addEventListener('click',()=>{mode='todos';document.querySelectorAll('.chip').forEach((c,i)=>c.classList.toggle('active',i===0));$('placa').value='';if(base.length){$('inicio').value=Core.iso(base[0].dt);$('fim').value=Core.iso(base[base.length-1].dt)}$('mostrarTecnicos').checked=false;process()});
  document.querySelectorAll('.chip').forEach(chip=>chip.addEventListener('click',()=>{mode=chip.dataset.mode;document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));chip.classList.add('active');process()}));
  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));tab.classList.add('active');$(`panel-${tab.dataset.tab}`).classList.add('active')}));
  $('auditStatus').addEventListener('change',()=>lastResult&&UI.renderAuditRows(lastResult.auditTrail));$('exportarAuditoria').addEventListener('click',()=>lastResult&&UI.exportAudit(lastResult.auditTrail));
  $('animarRota').addEventListener('click',()=>global.GPSV4.MapUI?.play());
  $('pararRota').addEventListener('click',()=>global.GPSV4.MapUI?.stop());
  $('visaoGeral').addEventListener('click',()=>global.GPSV4.MapUI?.fitOverview());
  $('atualizarFinanceiro').addEventListener('click',updateFinance);
  $('exportarFinanceiro').addEventListener('click',()=>lastFinance&&UI.exportFinanceiro(lastFinance));
  $('salvarResidencias').addEventListener('click',async()=>{UI.readCadastroEdits(metadata);(metadata.residencias||[]).filter(x=>x.endereco).forEach(x=>{x.confirmado=true;x.origem='Cadastro salvo'});const saved=saveHomes();await locatePoints(false);UI.status(saved?'Cadastro residencial salvo e custos recalculados.':'Endereços aplicados nesta análise, mas o navegador bloqueou a gravação permanente.',saved?'ok':'error')});
  async function locatePoints(automatic=false){
    if(locating)return;locating=true;
    const button=$('localizarPontos');button.disabled=true;
    try{
      UI.readCadastroEdits(metadata);
      if(!automatic)saveHomes();
      const inferred=(metadata.residencias||[]).filter(x=>!x.endereco&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));
      for(let i=0;i<inferred.length;i++){
        const item=inferred[i];UI.status(`Identificando endereço residencial ${i+1} de ${inferred.length}: ${item.placa}...`);
        const address=await Financeiro.reverseGeocode(item.latitude,item.longitude);
        if(address){item.endereco=address;item.origem='Inferência GPS';item.confirmado=false}
        if(i<inferred.length-1)await new Promise(resolve=>setTimeout(resolve,1050));
      }
      const targets=[{tipo:'sede',nome:'Empresa',endereco:$('enderecoSede').value},...metadata.cadastroObras.map(x=>({tipo:'obra',ref:x,nome:x.nome,endereco:x.endereco})),...metadata.residencias.filter(x=>x.endereco&&(!Number.isFinite(x.latitude)||x.confirmado)).map(x=>({tipo:'residencia',ref:x,nome:`Residência operacional ${x.placa}`,endereco:x.endereco}))];
      let found=0;const unresolved=[];
      for(let i=0;i<targets.length;i++){
        const target=targets[i];UI.status(`Localizando ${i+1} de ${targets.length}: ${target.nome}...`);
        const point=await Financeiro.geocode(target.endereco);
        if(point){found++;if(target.tipo==='sede')metadata.sede={nome:'Sede ÍMPAR',endereco:target.endereco,...point};else Object.assign(target.ref,point)}
        else unresolved.push(target.nome);
        if(i<targets.length-1)await new Promise(resolve=>setTimeout(resolve,1050));
      }
      locationsReady=true;UI.renderCadastros(metadata);updateFinance();global.GPSV4.MapUI?.fitOverview();
      if(unresolved.length){UI.financeWarning(`Classificação incompleta: ${unresolved.length} local(is) não encontrado(s): ${unresolved.join(', ')}.`);UI.status(`${found} de ${targets.length} locais encontrados. Revise os endereços não localizados.`,'error')}
      else UI.status(`${found} de ${targets.length} locais encontrados automaticamente. Raio ativo: ${$('raio').value} m.`,'ok');
    }catch(error){locationsReady=false;console.error(error);UI.financePending('Não foi possível localizar todos os pontos. Os custos permanecem bloqueados.');UI.status(`${error.message}. Você pode tentar novamente.`,'error')}finally{locating=false;button.disabled=false}
  }
  $('localizarPontos').addEventListener('click',()=>locatePoints(false));
})(window);
