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
    const hour=date.getHours()+date.getMinutes()/60;
    return hour<6||hour>=20;
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
  function workVisits(pointZones){
    const visits=[];
    pointZones.forEach((zone,index)=>{
      if(zone?.tipo!=='obra')return;
      const previous=visits.at(-1);
      if(previous&&previous.nome===zone.nome&&index<=previous.end+1){previous.end=index;previous.center=(previous.start+previous.end)/2}
      else visits.push({nome:zone.nome,start:index,end:index,center:index});
    });
    return visits;
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
    const visits=workVisits(pointZones);
    visits.forEach((visit,visitIndex)=>{
      const previous=visits[visitIndex-1],next=visits[visitIndex+1];
      let previousAnchor=-1,nextAnchor=positions.length-1;
      for(let i=visit.start-1;i>=0;i--){
        if(['empresa','residencia'].includes(pointZones[i]?.tipo)){previousAnchor=i;break}
      }
      for(let i=visit.end+1;i<positions.length;i++){
        if(['empresa','residencia'].includes(pointZones[i]?.tipo)){nextAnchor=i;break}
      }
      /*
       * Uma passagem pela empresa encerra o translado residencial.
       * Ex.: casa → empresa → obra:
       *   casa → empresa = residencia_empresa
       *   empresa → obra = obra
       * Se não houver empresa no caminho, casa → obra permanece integralmente na obra.
       * Entre duas obras sem sede/residência intermediária, o ponto médio separa as visitas.
       */
      const previousWorkBoundary=previous?Math.floor((previous.center+visit.center)/2)+1:0;
      const nextWorkBoundary=next?Math.floor((visit.center+next.center)/2):positions.length-1;
      const left=previous&&previous.end>previousAnchor?previousWorkBoundary:Math.max(0,previousAnchor);
      const right=next&&next.start<nextAnchor?nextWorkBoundary:nextAnchor;
      for(let i=Math.max(0,left);i<Math.min(segments.length,right);i++){
        const current=segments[i];
        if(!current||current.categoria)continue;
        current.categoria='obra';current.obraNome=visit.nome;
        current.motivo=`Trajeto de ida/retorno vinculado à visita da obra ${visit.nome}.`;
      }
    });
    segments.forEach((segment,index)=>{
      if(!segment||segment.categoria)return;
      if(pointZones[index]?.tipo==='empresa'&&pointZones[index+1]?.tipo==='empresa'){
        segment.categoria='empresa';segment.motivo='Trecho integralmente dentro do raio da empresa.';
      }
    });
    const companyIndexes=pointZones.map((zone,index)=>zone?.tipo==='empresa'?index:-1).filter(index=>index>=0);
    if(companyIndexes.length){
      const firstCompany=companyIndexes[0],lastCompany=companyIndexes.at(-1);
      let idaStart=-1;
      for(let i=firstCompany-1;i>=0;i--){
        if(segments[i]?.categoria==='obra')break;
        if(pointZones[i]?.tipo==='residencia')idaStart=i;
      }
      if(idaStart>=0)for(let i=idaStart;i<firstCompany&&i<segments.length;i++){
        if(segments[i]&&!segments[i].categoria){segments[i].categoria='residencia_empresa';segments[i].motivo='Translado de residência(s) até a empresa, incluindo coleta de colegas.'}
      }
      let voltaEnd=-1;
      for(let i=lastCompany+1;i<pointZones.length;i++){
        if(segments[i-1]?.categoria==='obra')break;
        if(pointZones[i]?.tipo==='residencia')voltaEnd=i;
      }
      if(voltaEnd>=0)for(let i=lastCompany;i<voltaEnd&&i<segments.length;i++){
        if(segments[i]&&!segments[i].categoria){segments[i].categoria='empresa_residencia';segments[i].motivo='Translado da empresa até residência(s), incluindo entrega de colegas.'}
      }
    }
    segments.forEach(segment=>{
      if(!segment||segment.categoria)return;
      if(isWeekend(segment.prev.dt)){segment.categoria='fim_semana';segment.motivo='Trecho em sábado ou domingo ainda não vinculado às categorias anteriores.';return}
      if(isOffhours(segment.prev.dt)){segment.categoria='fora_horario';segment.motivo='Trecho antes das 06:00 ou após as 20:00 ainda não vinculado às categorias anteriores.';return}
      segment.categoria='nao_classificado';segment.motivo='Trecho sem vínculo com obra, empresa, translado, fim de semana ou fora do horário.';
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
    let ledger=[];
    (result.rotas||[]).forEach(route=>ledger.push(...classifyRoute(route,metadata,{raio})));
    ledger=ledger.map((segment,index)=>{
      const carro=carros.find(x=>x.placa===segment.plate),litros=segment.km/kmLitro;
      return {id:`KM-${String(index+1).padStart(6,'0')}`,ciclo:'SEGMENTO',placa:segment.plate,responsavel:carro?.responsavel||'',inicio:segment.prev.dt,fim:segment.point.dt,origem:segment.prev.address||'',destino:segment.point.address||'',categoria:segment.categoria,nome:segment.obraNome||'',motivo:segment.motivo,km:segment.km,litros,custo:litros*precoLitro};
    });
    const segmentedKm=ledger.reduce((sum,x)=>sum+x.km,0),dashboardKm=Number(result.dashboard?.totalKm);
    const total=Number.isFinite(dashboardKm)&&dashboardKm>=segmentedKm-.01?dashboardKm:segmentedKm;
    if(total>segmentedKm+.001){
      const km=total-segmentedKm;
      ledger.push({id:'KM-AJUSTE',ciclo:'AJUSTE',placa:'—',responsavel:'',inicio:null,fim:null,origem:'',destino:'',categoria:'nao_classificado',nome:'',motivo:'Diferença de fechamento entre o hodômetro total e os segmentos válidos.',km,litros:km/kmLitro,custo:km/kmLitro*precoLitro});
    }
    const categories=['obra','empresa','residencia_empresa','empresa_residencia','fim_semana','fora_horario','nao_classificado'];
    const summary={totalKm:total,totalLitros:total/kmLitro,totalCustoCombustivel:total/kmLitro*precoLitro,kmLitro,precoLitro,raio};
    categories.forEach(category=>{
      const rows=ledger.filter(x=>x.categoria===category);
      summary[category]={km:rows.reduce((sum,x)=>sum+x.km,0),litros:rows.reduce((sum,x)=>sum+x.litros,0),custo:rows.reduce((sum,x)=>sum+x.custo,0)};
    });
    const classified=categories.filter(x=>x!=='nao_classificado').reduce((sum,key)=>sum+summary[key].km,0);
    summary.nao_classificado.km=Math.max(0,total-classified);
    summary.nao_classificado.litros=summary.nao_classificado.km/kmLitro;
    summary.nao_classificado.custo=summary.nao_classificado.litros*precoLitro;
    const nonRows=ledger.filter(x=>x.categoria==='nao_classificado'),nonRaw=nonRows.reduce((sum,x)=>sum+x.km,0);
    if(nonRows.length&&Math.abs(nonRaw-summary.nao_classificado.km)>.001){
      const factor=nonRaw?summary.nao_classificado.km/nonRaw:0;
      nonRows.forEach(x=>{x.km*=factor;x.litros=x.km/kmLitro;x.custo=x.litros*precoLitro});
    }
    const permanencias=[];
    (result.rotas||[]).forEach(route=>{
      const carro=carros.find(x=>x.placa===route.plate),valorHora=Number(carro?.valorHora)||0;
      route.positions.slice(1).forEach((point,index)=>{
        const anterior=route.positions[index],a=pointLocation(anterior,metadata,raio),b=pointLocation(point,metadata,raio),horas=(point.dt-anterior.dt)/3600000;
        if(!a||!b||a.tipo!==b.tipo||a.nome!==b.nome||horas<=0||horas>12)return;
        permanencias.push({placa:route.plate,responsavel:carro?.responsavel||'',tipo:a.tipo,nome:a.nome,horas,valorHora,custoMaoObra:horas*valorHora});
      });
    });
    const obrasMap=new Map();
    ledger.filter(x=>x.categoria==='obra').forEach(x=>{
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
