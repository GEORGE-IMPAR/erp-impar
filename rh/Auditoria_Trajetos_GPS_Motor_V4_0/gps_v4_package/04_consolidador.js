(function(global){
  'use strict';
  const F={};
  const distance=(a,b)=>{
    const r=6371000,toRad=x=>x*Math.PI/180;
    const dLat=toRad(b.latitude-a.latitude),dLon=toRad(b.longitude-a.longitude);
    const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLon/2)**2;
    return 2*r*Math.asin(Math.sqrt(q));
  };
  const validPoint=point=>Number.isFinite(point?.latitude)&&Number.isFinite(point?.longitude);
  function nearest(point,locations,radius){
    if(!validPoint(point))return null;
    let best=null;
    (locations||[]).forEach(location=>{
      if(!validPoint(location))return;
      const meters=distance(point,location);
      if(meters<=radius&&(!best||meters<best.meters))best={location,meters};
    });
    return best;
  }
  const isWeekend=date=>[0,6].includes(date.getDay());
  const isOffhours=date=>{
    const minutes=date.getHours()*60+date.getMinutes();
    return minutes<330||minutes>=1260; // antes de 05:30 ou a partir de 21:00
  };
  function rawSegments(route){
    const positions=(route.positions||[]).slice().sort((a,b)=>a.dt-b.dt);
    const segments=new Array(Math.max(0,positions.length-1)).fill(null);
    positions.slice(1).forEach((point,index)=>{
      const prev=positions[index];
      if(point.dt.toDateString()!==prev.dt.toDateString())return;
      const delta=Number.isFinite(point.odometro)&&Number.isFinite(prev.odometro)?point.odometro-prev.odometro:distance(prev,point)/1000;
      if(!Number.isFinite(delta)||delta<0||delta>=100)return;
      segments[index]={index,plate:route.plate,date:route.date,prev,point,km:delta,categoria:null,obraNome:'',motivo:''};
    });
    return {positions,segments};
  }
  const MIN_WORK_STAY_MS=40*60*1000;
  function workVisits(positions,pointZones){
    const visits=[];
    pointZones.forEach((zone,index)=>{
      if(zone?.tipo!=='obra')return;
      const previous=visits.at(-1);
      if(previous&&previous.nome===zone.nome&&index<=previous.end+1){previous.end=index;previous.center=(previous.start+previous.end)/2}
      else visits.push({nome:zone.nome,start:index,end:index,center:index});
    });
    return visits.filter(visit=>{
      visit.durationMs=positions[visit.end].dt-positions[visit.start].dt;
      visit.valid=visit.durationMs>=MIN_WORK_STAY_MS;
      return visit.valid;
    });
  }
  function anchorRuns(zones){
    const runs=[];
    zones.forEach((zone,index)=>{
      if(!zone)return;
      const previous=runs.at(-1);
      if(previous&&previous.tipo===zone.tipo&&previous.nome===zone.nome&&index===previous.end+1)previous.end=index;
      else runs.push({tipo:zone.tipo,nome:zone.nome||'',start:index,end:index});
    });
    return runs;
  }
  function gapCategory(runs,index){
    const from=runs[index],to=runs[index+1];
    if(from.tipo==='residencia'&&to.tipo==='empresa')return {categoria:'residencia_empresa',motivo:'Residência → empresa dentro do encadeamento operacional reconhecido.'};
    if(from.tipo==='empresa'&&to.tipo==='residencia')return {categoria:'empresa_residencia',motivo:'Empresa → residência dentro do encadeamento operacional reconhecido.'};
    if(from.tipo==='empresa'&&to.tipo==='obra')return {categoria:'empresa_obra',obraNome:to.nome,motivo:`Empresa → obra ${to.nome}, com permanência mínima de 40 minutos confirmada.`};
    if(from.tipo==='obra'&&to.tipo==='empresa')return {categoria:'obra_empresa',obraNome:from.nome,motivo:`Obra ${from.nome} → empresa.`};
    if(from.tipo==='residencia'&&to.tipo==='obra')return {categoria:'residencia_obra',obraNome:to.nome,motivo:`Residência/hotel → obra ${to.nome}, com permanência mínima de 40 minutos confirmada.`};
    if(from.tipo==='obra'&&to.tipo==='residencia')return {categoria:'obra_residencia',obraNome:from.nome,motivo:`Obra ${from.nome} → residência/hotel.`};
    if(to.tipo==='obra')return {categoria:'empresa_obra',obraNome:to.nome,motivo:`Deslocamento operacional com destino à obra ${to.nome}.`};
    if(from.tipo==='obra')return {categoria:'obra_empresa',obraNome:from.nome,motivo:`Deslocamento operacional de saída da obra ${from.nome}.`};
    if(to.tipo==='empresa')return {categoria:'empresa',motivo:'Deslocamento operacional com destino à empresa.'};
    return null;
  }
  function classifyRoute(route,metadata,params){
    const raio=params.raio,obras=metadata.cadastroObras||[],sede=metadata.sede?[metadata.sede]:[];
    const homes=(metadata.residencias||[]).filter(x=>x.placa===route.plate&&validPoint(x));
    const {positions,segments}=rawSegments(route);
    if(!segments.length)return [];
    const pointZones=positions.map(point=>{
      const obra=nearest(point,obras,raio);
      if(obra)return {tipo:'obra',nome:obra.location.nome,ref:obra.location};
      const empresa=nearest(point,sede,raio);
      if(empresa)return {tipo:'empresa',nome:'Empresa',ref:empresa.location};
      const home=nearest(point,homes,raio);
      return home?{tipo:'residencia',nome:home.location.nome||home.location.placa,ref:home.location}:null;
    });
    const visits=workVisits(positions,pointZones);
    const acceptedWorkIndexes=new Map();
    visits.forEach(visit=>{
      for(let index=visit.start;index<=visit.end;index++)acceptedWorkIndexes.set(index,visit);
    });
    const acceptedZones=pointZones.map((zone,index)=>{
      if(zone?.tipo!=='obra')return zone;
      const visit=acceptedWorkIndexes.get(index);
      return visit?{...zone,durationMs:visit.durationMs}:null;
    });
    const runs=anchorRuns(acceptedZones);
    runs.forEach(run=>{
      if(run.tipo!=='obra'&&run.tipo!=='empresa')return;
      for(let index=run.start;index<run.end&&index<segments.length;index++){
        const segment=segments[index];
        if(!segment||segment.categoria)continue;
        segment.categoria=run.tipo;
        segment.obraNome=run.tipo==='obra'?run.nome:'';
        segment.motivo=run.tipo==='obra'
          ?`Permanência confirmada na obra ${run.nome}: pelo menos 40 minutos dentro do raio.`
          :'Trecho integralmente dentro do raio da empresa.';
      }
    });
    runs.slice(0,-1).forEach((run,index)=>{
      const next=runs[index+1],rule=gapCategory(runs,index);
      if(!rule)return;
      for(let segmentIndex=run.end;segmentIndex<next.start&&segmentIndex<segments.length;segmentIndex++){
        const segment=segments[segmentIndex];
        if(!segment||segment.categoria)continue;
        Object.assign(segment,rule);
      }
    });
    /* Prioridade exclusiva definida com o RH: fim de semana e horário extra sobrescrevem qualquer rota operacional. */
    segments.forEach(segment=>{
      if(!segment)return;
      const midpoint=new Date((segment.prev.dt.getTime()+segment.point.dt.getTime())/2);
      if(isWeekend(midpoint)){
        segment.categoria='fim_semana';
        segment.obraNome='';
        segment.motivo='Prioridade 1 — todo KM realizado em sábado ou domingo.';
        return;
      }
      if(isOffhours(midpoint)){
        segment.categoria='fora_horario';
        segment.obraNome='';
        segment.motivo=midpoint.getHours()*60+midpoint.getMinutes()<330
          ?'Prioridade 2 — dia útil antes de 05:30.'
          :'Prioridade 2 — dia útil a partir de 21:00.';
        return;
      }
      if(!segment.categoria){
        segment.categoria='rota_nao_prevista';
        segment.motivo='Rota não prevista — trecho sem encadeamento válido entre residência/hotel, empresa e obra confirmada.';
      }
    });
    return segments.filter(Boolean);
  }
  function pointLocation(point,metadata,raio){
    const obra=nearest(point,metadata.cadastroObras||[],raio);
    if(obra)return {tipo:'obra',nome:obra.location.nome};
    const empresa=nearest(point,metadata.sede?[metadata.sede]:[],raio);
    return empresa?{tipo:'empresa',nome:'Empresa'}:null;
  }
  F.run=(result,metadata,params)=>{
    const kmLitro=Math.max(.1,Number(params.kmLitro)||10),precoLitro=Math.max(0,Number(params.precoLitro)||0),raio=Math.max(10,Number(params.raio)||500);
    const carros=metadata.cadastroCarros||[];
    const carByPlate=new Map();
    carros.forEach(carro=>{
      const row=carByPlate.get(carro.placa)||{placa:carro.placa,responsaveis:[],valorHora:0};
      if(carro.responsavel&&!row.responsaveis.includes(carro.responsavel))row.responsaveis.push(carro.responsavel);
      row.valorHora+=Number(carro.valorHora)||0;
      carByPlate.set(carro.placa,row);
    });
    let ledger=[];
    (result.rotas||[]).forEach(route=>ledger.push(...classifyRoute(route,metadata,{raio})));
    ledger=ledger.map((segment,index)=>{
      const carro=carByPlate.get(segment.plate),litros=segment.km/kmLitro;
      return {id:`KM-${String(index+1).padStart(6,'0')}`,ciclo:'SEGMENTO',placa:segment.plate,responsavel:carro?.responsaveis.join(' + ')||'',inicio:segment.prev.dt,fim:segment.point.dt,origem:segment.prev.address||'',destino:segment.point.address||'',categoria:segment.categoria,nome:segment.obraNome||'',motivo:segment.motivo,km:segment.km,litros,custo:litros*precoLitro};
    });
    const segmentedKm=ledger.reduce((sum,x)=>sum+x.km,0),dashboardKm=Number(result.dashboard?.totalKm);
    const total=Number.isFinite(dashboardKm)&&dashboardKm>=segmentedKm-.01?dashboardKm:segmentedKm;
    if(total>segmentedKm+.001){
      const km=total-segmentedKm;
      ledger.push({id:'KM-AJUSTE',ciclo:'AJUSTE',placa:'—',responsavel:'',inicio:null,fim:null,origem:'',destino:'',categoria:'rota_nao_prevista',nome:'',motivo:'Diferença de fechamento entre o hodômetro total e os segmentos válidos.',km,litros:km/kmLitro,custo:km/kmLitro*precoLitro});
    }
    const categories=['obra','empresa','residencia_empresa','empresa_residencia','empresa_obra','obra_empresa','residencia_obra','obra_residencia','fim_semana','fora_horario','rota_nao_prevista'];
    const summary={totalKm:total,totalLitros:total/kmLitro,totalCustoCombustivel:total/kmLitro*precoLitro,kmLitro,precoLitro,raio};
    categories.forEach(category=>{
      const rows=ledger.filter(x=>x.categoria===category);
      summary[category]={km:rows.reduce((sum,x)=>sum+x.km,0),litros:rows.reduce((sum,x)=>sum+x.litros,0),custo:rows.reduce((sum,x)=>sum+x.custo,0)};
    });
    const classified=categories.filter(x=>x!=='rota_nao_prevista').reduce((sum,key)=>sum+summary[key].km,0);
    summary.rota_nao_prevista.km=Math.max(0,total-classified);
    summary.rota_nao_prevista.litros=summary.rota_nao_prevista.km/kmLitro;
    summary.rota_nao_prevista.custo=summary.rota_nao_prevista.litros*precoLitro;
    const nonRows=ledger.filter(x=>x.categoria==='rota_nao_prevista'),nonRaw=nonRows.reduce((sum,x)=>sum+x.km,0);
    if(nonRows.length&&Math.abs(nonRaw-summary.rota_nao_prevista.km)>.001){
      const factor=nonRaw?summary.rota_nao_prevista.km/nonRaw:0;
      nonRows.forEach(x=>{x.km*=factor;x.litros=x.km/kmLitro;x.custo=x.litros*precoLitro});
    }
    const permanencias=[];
    (result.rotas||[]).forEach(route=>{
      const carro=carByPlate.get(route.plate),valorHora=Number(carro?.valorHora)||0,responsavel=carro?.responsaveis.join(' + ')||'';
      const positions=(route.positions||[]).slice().sort((a,b)=>a.dt-b.dt);
      const zones=positions.map(point=>pointLocation(point,metadata,raio));
      const visits=workVisits(positions,zones);
      visits.forEach(visit=>{
        const horas=visit.durationMs/3600000;
        permanencias.push({placa:route.plate,responsavel,tipo:'obra',nome:visit.nome,horas,valorHora,custoMaoObra:horas*valorHora});
      });
      positions.slice(1).forEach((point,index)=>{
        const anterior=positions[index],a=zones[index],b=zones[index+1],horas=(point.dt-anterior.dt)/3600000;
        if(!a||!b||a.tipo!=='empresa'||b.tipo!=='empresa'||horas<=0||horas>12)return;
        permanencias.push({placa:route.plate,responsavel,tipo:'empresa',nome:'Empresa',horas,valorHora,custoMaoObra:horas*valorHora});
      });
    });
    const obrasMap=new Map();
    ledger.filter(x=>['obra','empresa_obra','obra_empresa','residencia_obra','obra_residencia'].includes(x.categoria)).forEach(x=>{
      const key=x.nome||'Obra não identificada',row=obrasMap.get(key)||{nome:key,km:0,litros:0,custo:0,horas:0,maoObra:0,total:0};
      row.km+=x.km;row.litros+=x.litros;row.custo+=x.custo;obrasMap.set(key,row);
    });
    permanencias.filter(x=>x.tipo==='obra').forEach(p=>{
      const row=obrasMap.get(p.nome)||{nome:p.nome,km:0,litros:0,custo:0,horas:0,maoObra:0,total:0};
      row.horas+=p.horas;row.maoObra+=p.custoMaoObra;obrasMap.set(p.nome,row);
    });
    const obras=[...obrasMap.values()].map(x=>({...x,total:x.custo+x.maoObra})).sort((a,b)=>b.total-a.total);
    summary.obra.horas=obras.reduce((sum,x)=>sum+x.horas,0);
    summary.obra.maoObra=obras.reduce((sum,x)=>sum+x.maoObra,0);
    const empresaPermanencias=permanencias.filter(x=>x.tipo==='empresa');
    summary.empresa.horas=empresaPermanencias.reduce((sum,x)=>sum+x.horas,0);
    summary.empresa.maoObra=empresaPermanencias.reduce((sum,x)=>sum+x.custoMaoObra,0);
    summary.maoObraTotal=summary.obra.maoObra+summary.empresa.maoObra;
    summary.totalGeral=summary.totalCustoCombustivel+summary.maoObraTotal;
    const porPlacaMap=new Map();
    ledger.forEach(x=>{
      if(x.placa==='—')return;
      const row=porPlacaMap.get(x.placa)||{placa:x.placa,responsavel:x.responsavel,km:0,custo:0};
      row.km+=x.km;row.custo+=x.custo;porPlacaMap.set(x.placa,row);
    });
    return {summary,items:ledger,ledger,permanencias,obras,porPlaca:[...porPlacaMap.values()].sort((a,b)=>b.km-a.km)};
  };
  F.geocode=async address=>{
    const cleaned=String(address||'').replace(/\bCNO\s*:[\s\S]*$/i,'').replace(/\s+/g,' ').trim();
    const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(cleaned)}`;
    const response=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!response.ok)throw new Error(`Falha ao localizar: ${address}`);
    const data=await response.json();
    return data[0]?{latitude:Number(data[0].lat),longitude:Number(data[0].lon),displayName:data[0].display_name}:null;
  };
  F.reverseGeocode=async(latitude,longitude)=>{
    const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
    const response=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!response.ok)return '';
    const data=await response.json();
    return String(data.display_name||'').trim();
  };
  global.GPSV4.Financeiro=F;
})(window);
