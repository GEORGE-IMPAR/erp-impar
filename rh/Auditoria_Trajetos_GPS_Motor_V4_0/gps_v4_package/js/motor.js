(function(global){
  'use strict';
  const {Core}=global.GPSV4;
  const TECHNICAL=['off line','offline','aceleracao','frenagem','movimento indevido','fonte de energia','dispositivo violado','removendo fonte'];
  const AuditStatus={USED:'UTILIZADO',START:'INICIO_CICLO',INTERMEDIATE:'PONTO_INTERMEDIARIO',END:'FINAL_CICLO',DUPLICATE:'DESCARTADO_DUPLICADO',TECHNICAL:'DESCARTADO_TECNICO',NOT_IGNITION:'DESCARTADO_NAO_IGNICAO',NO_START:'DESCARTADO_SEM_LIGOU',REPLACED_ON:'SUBSTITUIDO_LIGOU',REPLACED_OFF:'SUBSTITUIDO_DESLIGOU'};
  const isOn=t=>{const n=Core.norm(t);return n.includes('ligou ignicao')&&!n.includes('desligou ignicao')};
  const isOff=t=>Core.norm(t).includes('desligou ignicao');
  const isTechnical=t=>TECHNICAL.some(x=>Core.norm(t).includes(x));
  const isIgnition=t=>isOn(t)||isOff(t);
  function audit(event,status,reason,cycleId=''){return {...event,auditStatus:status,auditReason:reason,cycleId}}

  function preprocess(events,{showTechnical=false}={}){
    const ordered=[...events].sort((a,b)=>(a.dt-b.dt)||(a.rawIndex-b.rawIndex));
    const accepted=[],auditTrail=[],seen=new Set();
    for(const event of ordered){
      const key=[event.plate,event.dt.getTime(),Core.norm(event.address),Core.norm(event.type)].join('|');
      if(seen.has(key)){auditTrail.push(audit(event,AuditStatus.DUPLICATE,'Duplicata exata de placa, data/hora, endereço e tipo.'));continue}
      seen.add(key);
      if(!showTechnical&&isTechnical(event.type)){auditTrail.push(audit(event,AuditStatus.TECHNICAL,'Evento técnico ocultado pela configuração.'));continue}
      if(!showTechnical&&!isIgnition(event.type)){auditTrail.push(audit(event,AuditStatus.NOT_IGNITION,'Evento não pertence ao ciclo de ignição.'));continue}
      accepted.push(event);
    }
    return {ordered,accepted,auditTrail};
  }

  function buildCycles(events,initialAudit=[]){
    const cycles=[];
    const auditTrail=[...initialAudit];
    let sequence=0;

    // Regra estrutural V4.0.1:
    // cada placa é processada em uma linha do tempo independente por dia.
    // Assim, eventos de outro veículo intercalados cronologicamente nunca
    // encerram, dividem ou contaminam o ciclo da placa que estava em análise.
    const streams=new Map();
    for(const event of events){
      const key=`${event.plate}|${Core.iso(event.dt)}`;
      if(!streams.has(key))streams.set(key,[]);
      streams.get(key).push(event);
    }

    const orderedStreams=[...streams.values()].sort((a,b)=>{
      const da=a[0]?.dt?.getTime?.()||0;
      const db=b[0]?.dt?.getTime?.()||0;
      if(da!==db)return da-db;
      return String(a[0]?.plate||'').localeCompare(String(b[0]?.plate||''),'pt-BR');
    });

    for(const stream of orderedStreams){
      stream.sort((a,b)=>(a.dt-b.dt)||(a.rawIndex-b.rawIndex));
      let current=null;
      let pendingOff=null;

      function newCycle(event){
        sequence++;
        const id=`C${String(sequence).padStart(4,'0')}`;
        current={id,plate:event.plate,date:event.dt,start:event,end:null,points:[event],rawEvents:1,discarded:0,incomplete:true};
        auditTrail.push(audit(event,AuditStatus.START,'Primeiro Ligou do ciclo.',id));
        pendingOff=null;
      }

      function closeCurrent(incomplete){
        if(!current)return;
        if(pendingOff){
          current.points.push(pendingOff);
          current.end=pendingOff;
          current.incomplete=false;
          auditTrail.push(audit(pendingOff,AuditStatus.END,'Último Desligou utilizado para encerrar o ciclo.',current.id));
        }else{
          current.end=current.points[current.points.length-1];
          current.incomplete=!!incomplete;
        }
        cycles.push(current);
        current=null;
        pendingOff=null;
      }

      for(const event of stream){
        if(!current){
          if(isOn(event.type))newCycle(event);
          else auditTrail.push(audit(event,AuditStatus.NO_START,'Desligou encontrado sem Ligou anterior.'));
          continue;
        }

        current.rawEvents++;

        if(isOn(event.type)){
          if(pendingOff){
            closeCurrent(false);
            newCycle(event);
            continue;
          }
          const last=current.points[current.points.length-1];
          if(last&&isOn(last.type)&&Core.norm(last.address)===Core.norm(event.address)){
            current.points[current.points.length-1]=event;
            current.discarded++;
            auditTrail.push(audit(last,AuditStatus.REPLACED_ON,'Ligou anterior no mesmo endereço foi substituído pelo registro mais recente.',current.id));
            auditTrail.push(audit(event,AuditStatus.INTERMEDIATE,'Ligou mais recente mantido no mesmo endereço.',current.id));
          }else{
            current.points.push(event);
            auditTrail.push(audit(event,AuditStatus.INTERMEDIATE,'Ligou com mudança de endereço mantido como ponto intermediário.',current.id));
          }
          continue;
        }

        if(isOff(event.type)){
          if(pendingOff){
            current.discarded++;
            auditTrail.push(audit(pendingOff,AuditStatus.REPLACED_OFF,'Desligou anterior substituído pelo desligamento mais recente.',current.id));
          }
          pendingOff=event;
          continue;
        }

        auditTrail.push(audit(event,AuditStatus.USED,'Evento técnico preservado para auditoria, sem alterar o estado do ciclo.',current.id));
      }

      if(current)closeCurrent(!pendingOff);
    }

    cycles.sort((a,b)=>(a.start.dt-b.start.dt)||a.plate.localeCompare(b.plate,'pt-BR'));
    auditTrail.sort((a,b)=>(a.dt-b.dt)||(a.rawIndex-b.rawIndex));
    return {cycles,auditTrail};
  }

  function buildSegments(cycles){
    const segments=[];let n=0;
    cycles.forEach(cycle=>{for(let i=0;i<cycle.points.length-1;i++){const a=cycle.points[i],b=cycle.points[i+1];if(Core.norm(a.address)===Core.norm(b.address))continue;n++;segments.push({id:`T${String(n).padStart(4,'0')}`,cycleId:cycle.id,plate:cycle.plate,date:cycle.date,departure:a.dt,origin:a.address,arrival:b.dt,destination:b.address,duration:b.dt-a.dt,km:null})}});
    return segments;
  }

  function run(events,options={}){const pre=preprocess(events,options);const built=buildCycles(pre.accepted,pre.auditTrail);const segments=buildSegments(built.cycles);return {received:pre.ordered,valid:pre.accepted,cycles:built.cycles,segments,auditTrail:built.auditTrail}}
  global.GPSV4.Engine={run,AuditStatus};
})(window);
