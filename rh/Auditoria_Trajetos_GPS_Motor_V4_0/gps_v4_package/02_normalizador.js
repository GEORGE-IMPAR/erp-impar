(function(global){
  'use strict';
  const {Core,Normalizer}=global.GPSV4;
  function run(ciclos,trechos){
    const permanencias=[];
    const porPlacaDia=new Map();
    ciclos.forEach(ciclo=>{
      const chave=`${ciclo.placa}|${Core.iso(ciclo.inicio)}`;
      if(!porPlacaDia.has(chave))porPlacaDia.set(chave,[]);
      porPlacaDia.get(chave).push(ciclo);
    });
    porPlacaDia.forEach(lista=>{
      lista.sort((a,b)=>a.inicio-b.inicio);
      for(let i=0;i<lista.length-1;i++){
        const anterior=lista[i],posterior=lista[i+1];
        const trechoAnterior=[...trechos].reverse().find(t=>t.idCiclo===anterior.idCiclo)||null;
        const trechoPosterior=trechos.find(t=>t.idCiclo===posterior.idCiclo)||null;
        permanencias.push(Object.freeze({
          idPermanencia:Normalizer.stableId('PE',[anterior.idCiclo,posterior.idCiclo]),
          placa:anterior.placa,idCicloAnterior:anterior.idCiclo,idCicloPosterior:posterior.idCiclo,
          idTrechoAnterior:trechoAnterior?.idTrecho||null,idTrechoPosterior:trechoPosterior?.idTrecho||null,
          local:anterior.end?.endereco||anterior.end?.address||'',inicio:anterior.fim,fim:posterior.inicio,
          duracao:posterior.inicio-anterior.fim
        }));
      }
    });
    return {permanencias};
  }
  global.GPSV4.StayBuilder={run};
})(window);
