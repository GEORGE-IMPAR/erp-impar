(function(global){
  'use strict';
  async function enriquecer(trechos,provider){
    if(typeof provider!=='function')return trechos.map(trecho=>({...trecho}));
    const saida=[];
    for(const trecho of trechos){
      try{
        const rota=await provider({origem:trecho.origem,destino:trecho.destino,saida:trecho.saida});
        saida.push({...trecho,km:Number.isFinite(rota?.km)?rota.km:null,duracaoRota:rota?.duracao??null,fonteKm:'GOOGLE_DIRECTIONS'});
      }catch(error){saida.push({...trecho,km:null,fonteKm:'ERRO_GOOGLE_DIRECTIONS',erroRota:String(error?.message||error)})}
    }
    return saida;
  }
  function run(trechos){return {trechos:trechos.map(trecho=>Object.freeze({...trecho}))}}
  global.GPSV4.GoogleMaps={run,enriquecer};
})(window);
