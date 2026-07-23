(function(global){
  'use strict';
  const M=global.GPSV4;
  const haversine=(a,b)=>{
    const r=6371,toRad=x=>x*Math.PI/180;
    const dLat=toRad(b.latitude-a.latitude),dLon=toRad(b.longitude-a.longitude);
    const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLon/2)**2;
    return 2*r*Math.asin(Math.sqrt(q));
  };
  function runPositions(eventos){
    const ordered=[...eventos].sort((a,b)=>(a.dt-b.dt)||(a.rawIndex-b.rawIndex));
    const seen=new Set(),valid=[],auditTrail=[];
    ordered.forEach(e=>{
      const key=[e.idDispositivo||e.plate,e.dt.getTime(),e.latitude,e.longitude,e.type].join('|');
      if(seen.has(key)){auditTrail.push({...e,auditStatus:'DESCARTADO_DUPLICADO',auditReason:'Posição idêntica já recebida.',cycleId:''});return}
      seen.add(key);
      if(!Number.isFinite(e.latitude)||!Number.isFinite(e.longitude)){
        auditTrail.push({...e,auditStatus:'DESCARTADO_SEM_COORDENADA',auditReason:'Posição sem latitude/longitude válida.',cycleId:''});return;
      }
      valid.push(e);
      auditTrail.push({...e,auditStatus:'POSICAO_UTILIZADA_TRAJETORIA',auditReason:'Posição preservada na reconstrução cronológica.',cycleId:''});
    });
    const groups=new Map();
    valid.forEach(e=>{const key=`${e.plate}|${M.Core.iso(e.dt)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e)});
    const routes=[],cycles=[],segments=[],permanencias=[];let ci=0,tr=0,pe=0;
    groups.forEach((positions,key)=>{
      positions.sort((a,b)=>a.dt-b.dt);
      const odos=positions.filter(p=>Number.isFinite(p.odometro));
      let kmOdo=odos.length>1?odos[odos.length-1].odometro-odos[0].odometro:0;
      if(kmOdo<0)kmOdo=0;
      let kmGps=0,movingMinutes=0,maxSpeed=0;
      positions.forEach((p,i)=>{
        maxSpeed=Math.max(maxSpeed,p.velocidade||0);
        if(!i)return;
        const prev=positions[i-1],gap=p.dt-prev.dt,kmCoord=haversine(prev,p);
        if(kmCoord<5)kmGps+=kmCoord;
        if((prev.velocidade>0||p.velocidade>0)&&gap>0&&gap<=300000)movingMinutes+=gap/60000;
        tr++;
        const deltaOdo=Number.isFinite(p.odometro)&&Number.isFinite(prev.odometro)?Math.max(0,p.odometro-prev.odometro):null;
        segments.push({id:`TR${String(tr).padStart(5,'0')}`,idTrecho:`TR${String(tr).padStart(5,'0')}`,cycleId:key,idCiclo:key,plate:p.plate,placa:p.plate,date:p.dt,data:p.dt,departure:prev.dt,saida:prev.dt,arrival:p.dt,chegada:p.dt,origin:prev.address,origem:prev.address,destination:p.address,destino:p.address,duration:gap,duracao:gap,km:deltaOdo??kmCoord,origemPosicao:prev,destinoPosicao:p});
      });
      routes.push({idRota:key,plate:positions[0].plate,date:positions[0].dt,positions,km:kmOdo||kmGps,kmHodometro:kmOdo,kmGps,movingMinutes,maxSpeed});
      let current=null;
      positions.forEach((p,i)=>{
        if(p.ignicao&&!current){ci++;current={id:`CI${String(ci).padStart(4,'0')}`,idCiclo:`CI${String(ci).padStart(4,'0')}`,plate:p.plate,placa:p.plate,date:p.dt,start:p,end:p,points:[p],rawEvents:1,discarded:0,incomplete:true}}
        else if(current){current.points.push(p);current.rawEvents++;current.end=p;if(!p.ignicao){current.incomplete=false;cycles.push(current);current=null}}
        if(i&&p.velocidade===0&&positions[i-1].velocidade>0){pe++;permanencias.push({idPermanencia:`PE${String(pe).padStart(5,'0')}`,placa:p.plate,local:p.address,inicio:p.dt,fim:p.dt,duracao:0})}
      });
      if(current)cycles.push(current);
    });
    const totalKm=routes.reduce((sum,route)=>sum+route.km,0),maxSpeed=Math.max(0,...routes.map(route=>route.maxSpeed));
    const dashboard={eventosRecebidos:ordered.length,eventosValidos:valid.length,eventosDescartados:ordered.length-valid.length,ciclos:cycles.length,trechos:segments.length,permanencias:permanencias.length,totalKm,maxSpeed,movingPositions:valid.filter(p=>p.velocidade>0).length};
    return Object.freeze({positionMode:true,eventos:ordered,eventosConsolidados:valid,rotas:routes,ciclos:cycles,trechos:segments,permanencias,obras:[],custos:[],auditoria:auditTrail,dashboard,received:ordered,valid,cycles,segments,auditTrail});
  }
  function run(eventos,options={}){
    if(eventos.some(e=>Number.isFinite(e.latitude)&&Number.isFinite(e.longitude)))return runPositions(eventos);
    const agrupado=M.Grouper.run(eventos);
    const consolidado=M.Consolidator.run(agrupado.grupos,options);
    const eventosConsolidados=consolidado.grupos.flatMap(grupo=>grupo.eventos);
    const estados=M.StateMachine.run(consolidado.grupos,consolidado.auditoria);
    const ciclos=M.CycleBuilder.run(estados.rascunhosCiclos,eventosConsolidados).ciclos;
    const trechosBase=M.SegmentBuilder.run(ciclos).trechos;
    const trechos=M.GoogleMaps.run(trechosBase).trechos;
    const permanencias=M.StayBuilder.run(ciclos,trechos).permanencias;
    const obras=M.Worksites.run(trechos,permanencias,options.obras||[]).obras;
    const custos=M.Costs.run(obras,options.custos||{}).custos;
    const estruturas={eventos,eventosConsolidados,grupos:consolidado.grupos,auditoria:estados.auditoria,ciclos,trechos,permanencias,obras,custos};
    const dashboard=M.Dashboard.run(estruturas).dashboard;
    return Object.freeze({
      ...estruturas,dashboard,
      received:eventos,valid:eventosConsolidados,cycles:ciclos,segments:trechos,auditTrail:estados.auditoria
    });
  }
  M.MRT={run};
  M.Engine={run};
})(window);
