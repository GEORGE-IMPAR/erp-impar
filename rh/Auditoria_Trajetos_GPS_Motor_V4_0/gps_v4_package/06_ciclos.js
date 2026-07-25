(function(global){
  'use strict';
  const {Core}=global.GPSV4;
  const TECHNICAL=['off line','offline','aceleracao','frenagem','movimento indevido','fonte de energia','dispositivo violado','removendo fonte'];
  const isOn=event=>{const n=Core.norm(event.tipo);return n.includes('ligou ignicao')&&!n.includes('desligou ignicao')};
  const isOff=event=>Core.norm(event.tipo).includes('desligou ignicao');
  const isTechnical=event=>TECHNICAL.some(term=>Core.norm(event.tipo).includes(term));
  const audit=(event,status,motivo,idCiclo=null)=>({...event,statusAuditoria:status,motivoAuditoria:motivo,auditStatus:status,auditReason:motivo,cycleId:idCiclo||''});
  function run(grupos,{showTechnical=false}={}){
    const auditoria=[],consolidados=[];
    grupos.forEach(grupo=>{
      const vistos=new Set(),eventos=[];
      grupo.eventos.forEach(evento=>{
        const chave=[evento.placa,evento.dataHora.getTime(),Core.norm(evento.endereco),Core.norm(evento.tipo)].join('|');
        if(vistos.has(chave)){auditoria.push(audit(evento,'DESCARTADO_DUPLICADO','Desligou/Ligou duplicado: placa, data/hora, endereço e tipo idênticos.'));return}
        vistos.add(chave);
        if(!showTechnical&&isTechnical(evento)){auditoria.push(audit(evento,'DESCARTADO_TECNICO','Evento técnico ocultado pela configuração.'));return}
        if(!showTechnical&&!isOn(evento)&&!isOff(evento)){auditoria.push(audit(evento,'DESCARTADO_NAO_IGNICAO','Evento não pertence à reconstrução de ignição.'));return}
        eventos.push(evento);
      });
      consolidados.push({...grupo,eventos});
    });
    return {grupos:consolidados,auditoria};
  }
  global.GPSV4.Consolidator={run,isOn,isOff,isTechnical,audit};
})(window);
