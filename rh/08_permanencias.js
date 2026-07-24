(function(global){
  'use strict';
  const {Core,Normalizer}=global.GPSV4;
  function run(ciclos){
    const trechos=[];
    ciclos.forEach(ciclo=>{
      for(let i=0;i<ciclo.eventos.length-1;i++){
        const origem=ciclo.eventos[i],destino=ciclo.eventos[i+1];
        if(Core.norm(origem.endereco)===Core.norm(destino.endereco))continue;
        const idTrecho=Normalizer.stableId('TR',[ciclo.idCiclo,origem.idEvento,destino.idEvento]);
        trechos.push(Object.freeze({
          idTrecho,id:idTrecho,idCiclo:ciclo.idCiclo,cycleId:ciclo.idCiclo,placa:ciclo.placa,plate:ciclo.placa,
          idEventoOrigem:origem.idEvento,idEventoDestino:destino.idEvento,
          origem:origem.endereco,origin:origem.endereco,destino:destino.endereco,destination:destino.endereco,
          saida:origem.dataHora,departure:origem.dataHora,chegada:destino.dataHora,arrival:destino.dataHora,
          data:origem.dataHora,date:origem.dataHora,duracao:destino.dataHora-origem.dataHora,duration:destino.dataHora-origem.dataHora,
          km:null,fonteKm:'PENDENTE_GOOGLE_DIRECTIONS'
        }));
      }
    });
    return {trechos};
  }
  global.GPSV4.SegmentBuilder={run};
})(window);
