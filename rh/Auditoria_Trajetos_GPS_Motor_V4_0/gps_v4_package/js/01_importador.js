(function(global){
  'use strict';
  function parseText(text){
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
    if(!lines.length)return [];
    const sep=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
    function parseLine(line){
      const out=[];let acc='',quoted=false;
      for(let i=0;i<line.length;i++){
        const c=line[i];
        if(c==='"'){if(quoted&&line[i+1]==='"'){acc+='"';i++}else quoted=!quoted}
        else if(c===sep&&!quoted){out.push(acc);acc=''}
        else acc+=c;
      }
      out.push(acc);return out;
    }
    const headers=parseLine(lines[0]).map(x=>x.trim());
    return lines.slice(1).map((line,index)=>{
      const values=parseLine(line),row={__linhaOrigem:index+2};
      headers.forEach((header,i)=>row[header]=values[i]??'');
      return row;
    });
  }
  async function readFile(file){
    const ext=file.name.split('.').pop().toLowerCase();
    if(['xlsx','xls'].includes(ext)){
      if(!global.XLSX)throw new Error('A biblioteca XLSX não carregou. Verifique a conexão com a internet.');
      const data=await file.arrayBuffer();
      const wb=XLSX.read(data,{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames.includes('Dados')?'Dados':wb.SheetNames[0]];
      let tracker='';
      if(wb.Sheets.Pesquisa){
        const pesquisa=XLSX.utils.sheet_to_json(wb.Sheets.Pesquisa,{defval:'',raw:true});
        tracker=String(pesquisa[0]?.Rastreavel||pesquisa[0]?.Rastreável||'').trim();
      }
      return XLSX.utils.sheet_to_json(ws,{defval:'',raw:true}).map((row,index)=>({...row,__linhaOrigem:index+2,__rastreavelRelatorio:tracker}));
    }
    return parseText(await file.text());
  }
  global.GPSV4=global.GPSV4||{};
  global.GPSV4.Importer={readFile,parseText};
})(window);
