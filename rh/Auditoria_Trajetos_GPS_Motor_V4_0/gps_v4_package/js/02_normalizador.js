(function(global){
  'use strict';
  const {Core}=global.GPSV4;
  function field(row,names){
    const keys={};Object.keys(row).forEach(key=>keys[Core.norm(key)]=key);
    for(const name of names){const key=keys[Core.norm(name)];if(key!==undefined)return row[key]}
    return '';
  }
  function stableId(prefix,parts){
    let hash=2166136261;
    String(parts.join('|')).split('').forEach(char=>{hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)});
    return `${prefix}-${(hash>>>0).toString(36).toUpperCase().padStart(7,'0')}`;
  }
  function run(rows){
    const rejeitados=[];
    const eventos=rows.map((row,index)=>{
      const dt=Core.parseDateTime(field(row,['Data/Hora','Data Hora','Data e Hora','Data']));
      const tracker=String(field(row,['Rastreável','Rastreavel','Veículo','Veiculo','Placa','Placas'])||'').trim();
      const plate=Core.plate(tracker),type=String(field(row,['Tipo','Evento'])||'').trim();
      const address=String(field(row,['Endereço','Endereco','Local'])||'').trim();
      const rawIndex=Number(row.__linhaOrigem)||index+2;
      if(!dt||!tracker){rejeitados.push({linha:rawIndex,motivo:!dt?'DATA_HORA_INVALIDA':'RASTREAVEL_AUSENTE'});return null}
      const idEvento=stableId('EV',[plate,dt.getTime(),Core.norm(type),Core.norm(address),rawIndex]);
      return Object.freeze({
        idEvento,rawIndex,dt,dataHora:dt,tracker,plate,placa:plate,
        driver:String(field(row,['Motorista','Condutor'])||'').trim(),
        type,tipo:type,status:String(field(row,['Status'])||'').trim(),
        address,endereco:address,reference:String(field(row,['Referencia','Referência'])||'').trim(),
        statusAuditoria:'PENDENTE',motivoAuditoria:'',idCiclo:null
      });
    }).filter(Boolean);
    return {eventos,rejeitados};
  }
  global.GPSV4.Normalizer={run,stableId};
})(window);
