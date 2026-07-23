(function(global){
  'use strict';
  const M=global.GPSV4;
  function run(eventos,options={}){
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
