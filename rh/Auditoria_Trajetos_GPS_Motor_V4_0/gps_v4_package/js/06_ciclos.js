(function(global){
  'use strict';
  function run(rascunhos,eventos){
    const porId=new Map(eventos.map(evento=>[evento.idEvento,evento]));
    const ciclos=rascunhos.map(item=>{
      const eventosCiclo=item.idsEventos.map(id=>porId.get(id)).filter(Boolean);
      const primeiro=porId.get(item.idPrimeiroEvento)||eventosCiclo[0];
      const ultimo=porId.get(item.idUltimoEvento)||eventosCiclo[eventosCiclo.length-1]||primeiro;
      return Object.freeze({
        idCiclo:item.idCiclo,id:item.idCiclo,placa:item.placa,plate:item.placa,data:item.inicio,date:item.inicio,
        idPrimeiroEvento:item.idPrimeiroEvento,idUltimoEvento:item.idUltimoEvento,eventos:Object.freeze(eventosCiclo),
        eventIds:Object.freeze([...item.idsEventos]),inicio:item.inicio,fim:item.fim,start:primeiro,end:ultimo,
        duration:item.fim-item.inicio,rawEvents:item.recebidos,recebidos:item.recebidos,
        discarded:item.descartados,descartados:item.descartados,incomplete:item.incompleto,incompleto:item.incompleto,
        points:Object.freeze(eventosCiclo)
      });
    });
    ciclos.sort((a,b)=>(a.inicio-b.inicio)||a.placa.localeCompare(b.placa,'pt-BR'));
    return {ciclos};
  }
  global.GPSV4.CycleBuilder={run};
})(window);
