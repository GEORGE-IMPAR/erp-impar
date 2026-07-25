(function(global){
  'use strict';
  const {Core,Consolidator,Normalizer}=global.GPSV4;
  const {isOn,isOff,audit}=Consolidator;
  function run(grupos,auditoriaInicial=[]){
    const auditoria=[...auditoriaInicial],rascunhos=[];
    grupos.forEach(grupo=>{
      let atual=null,pendenteOff=null,sequencia=0;
      const fechar=incompleto=>{
        if(!atual)return;
        if(pendenteOff){
          atual.idsEventos.push(pendenteOff.idEvento);atual.idUltimoEvento=pendenteOff.idEvento;
          atual.fim=pendenteOff.dataHora;atual.enderecoFim=pendenteOff.endereco;atual.incompleto=false;
          auditoria.push(audit(pendenteOff,'FINAL_CICLO','Último Desligou do ciclo.',atual.idCiclo));
        }else atual.incompleto=!!incompleto;
        rascunhos.push(Object.freeze({...atual,idsEventos:Object.freeze([...atual.idsEventos])}));
        atual=null;pendenteOff=null;
      };
      const abrir=evento=>{
        sequencia++;
        const idCiclo=Normalizer.stableId('CI',[grupo.idGrupo,evento.idEvento,sequencia]);
        atual={idCiclo,placa:grupo.placa,data:grupo.data,idPrimeiroEvento:evento.idEvento,idUltimoEvento:null,idsEventos:[evento.idEvento],inicio:evento.dataHora,fim:evento.dataHora,enderecoInicio:evento.endereco,enderecoFim:evento.endereco,recebidos:1,descartados:0,incompleto:true};
        auditoria.push(audit(evento,'INICIO_CICLO','Primeiro Ligou do ciclo.',idCiclo));pendenteOff=null;
      };
      grupo.eventos.forEach(evento=>{
        if(!atual){
          if(isOn(evento))abrir(evento);
          else auditoria.push(audit(evento,'DESCARTADO_ORFAO','Evento órfão: Desligou sem Ligou anterior.'));
          return;
        }
        atual.recebidos++;
        if(isOn(evento)){
          if(pendenteOff){fechar(false);abrir(evento);return}
          const ultimoId=atual.idsEventos[atual.idsEventos.length-1];
          const ultimo=grupo.eventos.find(item=>item.idEvento===ultimoId);
          if(ultimo&&isOn(ultimo)&&Core.norm(ultimo.endereco)===Core.norm(evento.endereco)){
            atual.idsEventos[atual.idsEventos.length-1]=evento.idEvento;atual.descartados++;
            auditoria.push(audit(ultimo,'DESCARTADO_LIGOU_DUPLICADO','Ligou duplicado no mesmo endereço; mantido o registro mais recente.',atual.idCiclo));
            auditoria.push(audit(evento,'PONTO_INTERMEDIARIO','Ligou mais recente mantido no mesmo endereço.',atual.idCiclo));
          }else{
            atual.idsEventos.push(evento.idEvento);
            auditoria.push(audit(evento,'PONTO_INTERMEDIARIO','Ligou mudou endereço.',atual.idCiclo));
          }
          return;
        }
        if(isOff(evento)){
          if(pendenteOff){
            atual.descartados++;
            auditoria.push(audit(pendenteOff,'DESCARTADO_DESLIGOU_DUPLICADO','Desligou duplicado; mantido o último registro.',atual.idCiclo));
          }
          pendenteOff=evento;return;
        }
        auditoria.push(audit(evento,'UTILIZADO_TECNICO','Evento técnico preservado sem alterar o estado.',atual.idCiclo));
      });
      if(atual)fechar(!pendenteOff);
    });
    auditoria.sort((a,b)=>(a.dataHora-b.dataHora)||(a.rawIndex-b.rawIndex));
    return {rascunhosCiclos:rascunhos,auditoria};
  }
  global.GPSV4.StateMachine={run};
})(window);
