(function(global){
  'use strict';
  const {Core}=global.GPSV4;
  function run(eventos){
    const grupos=new Map();
    eventos.forEach(evento=>{
      const chave=`${evento.placa}|${Core.iso(evento.dataHora)}`;
      if(!grupos.has(chave))grupos.set(chave,{idGrupo:chave,placa:evento.placa,data:Core.iso(evento.dataHora),eventos:[]});
      grupos.get(chave).eventos.push(evento);
    });
    const resultado=[...grupos.values()];
    resultado.forEach(grupo=>grupo.eventos.sort((a,b)=>(a.dataHora-b.dataHora)||(a.rawIndex-b.rawIndex)));
    resultado.sort((a,b)=>(a.eventos[0].dataHora-b.eventos[0].dataHora)||a.placa.localeCompare(b.placa,'pt-BR'));
    return {grupos:resultado};
  }
  global.GPSV4.Grouper={run};
})(window);
