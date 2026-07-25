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
      const dataSheetName=wb.SheetNames.includes('Base_GPS')?'Base_GPS':wb.SheetNames.includes('Dados')?'Dados':wb.SheetNames[0];
      const ws=wb.Sheets[dataSheetName];
      let tracker='';
      if(wb.Sheets.Pesquisa){
        const pesquisa=XLSX.utils.sheet_to_json(wb.Sheets.Pesquisa,{defval:'',raw:true});
        tracker=String(pesquisa[0]?.Rastreavel||pesquisa[0]?.Rastreável||'').trim();
      }
      const devicePlateMap={
        '354522183818959':'RXL-6H17',
        '357789644126671':'RXO-8A58',
        '357789644658434':'QHQ-8009',
        '357789649384341':'QII-5E96',
        '869731054278080':'IZH-2A86',
        '869731057063703':'QIQ-3921'
      };
      const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true});
      const cadastroCarros=[],cadastroObras=[];
      if(wb.Sheets.Cadastro_Carros_Valor_h_h){
        const matrix=XLSX.utils.sheet_to_json(wb.Sheets.Cadastro_Carros_Valor_h_h,{header:1,defval:'',raw:true});
        const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
        const headers=(matrix[0]||[]).map(norm);
        const enderecoIndex=headers.findIndex(header=>['ENDERECO','ENDERECO RESIDENCIAL','ENDERECO DA RESIDENCIA','RESIDENCIA','ENDERECO COLABORADOR'].includes(header));
        const equipes={};
        matrix.slice(1).forEach(row=>{
          const placa=String(row[6]||'').trim().toUpperCase(),nome=String(row[7]||'').trim();
          if(placa&&nome)(equipes[placa]??=[]).push({nome,valorHora:Number(row[8])||0});
        });
        matrix.slice(1).forEach(row=>{
          const placa=String(row[0]||'').trim().toUpperCase();
          if(placa){
            const equipe=equipes[placa]||[];
            const valorInformado=Number(row[2]);
            cadastroCarros.push({placa,responsavel:String(row[1]||'').trim(),valorHora:Number.isFinite(valorInformado)?valorInformado:equipe.reduce((total,item)=>total+item.valorHora,0),horasDia:Number(row[3])||0,equipe,enderecoResidencial:enderecoIndex>=0?String(row[enderecoIndex]||'').trim():''});
          }
        });
      }
      if(wb.Sheets.Cadastro_Obras){
        XLSX.utils.sheet_to_json(wb.Sheets.Cadastro_Obras,{defval:'',raw:true}).forEach((row,index)=>{
          const nome=String(row.OBRA||row.Obra||'').trim(),endereco=String(row['ENDEREÇO']||row.ENDERECO||row.Endereco||'').trim();
          if(nome)cadastroObras.push({idObra:`OB-${String(index+1).padStart(3,'0')}`,nome,endereco});
        });
      }
      readFile.lastMetadata={dataSheetName,cadastroCarros,cadastroObras};
      const devices=new Set(rows.map(row=>String(row['Id Dispositivo']||row.Dispositivo||'').trim()).filter(Boolean));
      const trackerRelatorioUnico=devices.size===1?tracker:'';
      return rows.map((row,index)=>{
        const device=String(row['Id Dispositivo']||row.Dispositivo||'').trim();
        const plateLike=/^[A-Z]{3}[- ]?\d[A-Z0-9]\d{2}$/i.test(device)?device:'';
        return {...row,__linhaOrigem:index+2,__rastreavelRelatorio:devicePlateMap[device]||plateLike||trackerRelatorioUnico};
      });
    }
    return parseText(await file.text());
  }
  global.GPSV4=global.GPSV4||{};
  global.GPSV4.Importer={readFile,parseText};
})(window);
