(function(global){
  'use strict';
  const {Core}=global.GPSV4;
  function findField(obj,names){const map={};Object.keys(obj).forEach(k=>map[Core.norm(k)]=k);for(const n of names){const k=map[Core.norm(n)];if(k!==undefined)return obj[k]}return ''}
  function mapRows(rows){
    return rows.map((r,index)=>{
      const dt=Core.parseDateTime(findField(r,['Data/Hora','Data Hora','Data e Hora','Data']));
      const tracker=findField(r,['Rastreável','Rastreavel','Veículo','Veiculo','Placa','Placas']);
      return {rawIndex:index+1,dt,tracker:String(tracker||'').trim(),plate:Core.plate(tracker),driver:String(findField(r,['Motorista','Condutor'])||'').trim(),type:String(findField(r,['Tipo','Evento'])||'').trim(),status:String(findField(r,['Status'])||'').trim(),address:String(findField(r,['Endereço','Endereco','Local'])||'').trim(),reference:String(findField(r,['Referencia','Referência'])||'').trim()};
    }).filter(x=>x.dt&&x.tracker);
  }
  function parseText(text){
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());if(!lines.length)return [];
    const sep=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
    function parseLine(line){const out=[];let acc='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){acc+='"';i++}else quoted=!quoted}else if(c===sep&&!quoted){out.push(acc);acc=''}else acc+=c}out.push(acc);return out}
    const headers=parseLine(lines[0]).map(x=>x.trim());return lines.slice(1).map(line=>{const values=parseLine(line),obj={};headers.forEach((h,i)=>obj[h]=values[i]??'');return obj});
  }
  async function readFile(file){
    const ext=file.name.split('.').pop().toLowerCase();
    if(['xlsx','xls'].includes(ext)){
      if(!global.XLSX)throw new Error('A biblioteca XLSX não carregou. Verifique a conexão com a internet.');
      const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];return mapRows(XLSX.utils.sheet_to_json(ws,{defval:'',raw:true}));
    }
    return mapRows(parseText(await file.text()));
  }
  global.GPSV4.Importer={readFile};
})(window);
