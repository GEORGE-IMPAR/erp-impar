(function(global){
  'use strict';
  function run(obras,parametros={}){
    const consumoKmLitro=Number(parametros.consumoKmLitro)||0;
    const precoLitro=Number(parametros.precoLitro)||0;
    const custoHora=Number(parametros.custoHora)||0;
    const custos=obras.map(visita=>{
      const km=[visita.kmChegada,visita.kmSaida].filter(Number.isFinite).reduce((a,b)=>a+b,0);
      const horas=visita.tempoEmObra/3600000;
      const combustivel=consumoKmLitro>0?(km/consumoKmLitro)*precoLitro:null;
      return Object.freeze({idCusto:`CU-${visita.idObraVisita}`,idObraVisita:visita.idObraVisita,obra:visita.nome,placa:visita.placa,km,horas,combustivel,custoHoras:horas*custoHora,total:(combustivel||0)+(horas*custoHora)});
    });
    return {custos};
  }
  global.GPSV4.Costs={run};
})(window);
