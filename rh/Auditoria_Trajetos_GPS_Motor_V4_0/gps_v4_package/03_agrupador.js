(function(global){
  'use strict';
  function run(trechos,permanencias,cadastro=[]){
    const obras=[];
    permanencias.forEach(permanencia=>{
      const local=String(permanencia.local||'').toLowerCase();
      const obra=cadastro.find(item=>(item.aliases||[item.endereco,item.nome]).filter(Boolean).some(alias=>local.includes(String(alias).toLowerCase())));
      if(!obra)return;
      const chegada=trechos.find(t=>t.idTrecho===permanencia.idTrechoAnterior);
      const saida=trechos.find(t=>t.idTrecho===permanencia.idTrechoPosterior);
      obras.push(Object.freeze({
        idObraVisita:`OV-${permanencia.idPermanencia}`,idObra:obra.id||obra.nome,nome:obra.nome,
        placa:permanencia.placa,idPermanencia:permanencia.idPermanencia,
        idTrechoChegada:chegada?.idTrecho||null,idTrechoSaida:saida?.idTrecho||null,
        inicio:permanencia.inicio,fim:permanencia.fim,tempoEmObra:permanencia.duracao,
        kmChegada:chegada?.km??null,kmSaida:saida?.km??null
      }));
    });
    return {obras};
  }
  global.GPSV4.Worksites={run};
})(window);
