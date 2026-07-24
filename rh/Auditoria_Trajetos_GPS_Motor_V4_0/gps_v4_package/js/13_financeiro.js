(function(global){
  'use strict';
  const F={};
  const distance=(a,b)=>{
    const r=6371000,toRad=x=>x*Math.PI/180;
    const dLat=toRad(b.latitude-a.latitude),dLon=toRad(b.longitude-a.longitude);
    const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLon/2)**2;
    return 2*r*Math.asin(Math.sqrt(q));
  };
  const cycleKm=cycle=>{
    const pts=cycle.points||[],odos=pts.filter(p=>Number.isFinite(p.odometro));
    if(odos.length>1){
      const delta=odos.at(-1).odometro-odos[0].odometro;
      if(delta>=0&&delta<1000)return delta;
    }
    return pts.slice(1).reduce((sum,p,i)=>{
      const prev=pts[i],km=distance(prev,p)/1000;
      return sum+(km<5?km:0);
    },0);
  };
  function nearest(points,locations,radius){
    let best=null;
    (locations||[]).forEach(location=>{
      if(!Number.isFinite(location.latitude)||!Number.isFinite(location.longitude))return;
      points.forEach(point=>{
        if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude))return;
        const meters=distance(point,location);
        if(meters<=radius&&(!best||meters<best.meters))best={location,meters};
      });
    });
    return best;
  }
  F.run=(result,metadata,params)=>{
    const kmLitro=Math.max(.1,Number(params.kmLitro)||10),precoLitro=Math.max(0,Number(params.precoLitro)||0),raio=Math.max(10,Number(params.raio)||500);
    const sede=metadata.sede?[metadata.sede]:[],obras=metadata.cadastroObras||[],carros=metadata.cadastroCarros||[];
    const items=(result.cycles||[]).map(cycle=>{
      const km=cycleKm(cycle),obra=nearest(cycle.points,obras,raio),empresa=nearest(cycle.points,sede,raio);
      const dt=cycle.start.dt,particular=[0,6].includes(dt.getDay())||dt.getHours()<6||dt.getHours()>=20;
      const categoria=obra?'obra':empresa?'empresa':particular?'particular':'empresa';
      const nome=categoria==='obra'?obra.location.nome:categoria==='particular'?'Uso particular':'Empresa';
      const carro=carros.find(x=>x.placa===cycle.plate);
      return {ciclo:cycle.id,placa:cycle.plate,responsavel:carro?.responsavel||'',inicio:dt,categoria,nome,km,litros:km/kmLitro,custo:km/kmLitro*precoLitro};
    });
    const classified=items.reduce((s,x)=>s+x.km,0),total=result.dashboard?.totalKm||classified;
    if(total>classified+.001){
      const km=total-classified;
      items.push({ciclo:'AJUSTE',placa:'—',responsavel:'',inicio:null,categoria:'empresa',nome:'Empresa — posições fora de ciclos',km,litros:km/kmLitro,custo:km/kmLitro*precoLitro});
    }
    const permanencias=[];
    const pointLocation=point=>{
      const obra=nearest([point],obras,raio);
      if(obra)return {tipo:'obra',nome:obra.location.nome};
      const empresa=nearest([point],sede,raio);
      return empresa?{tipo:'empresa',nome:'Empresa'}:null;
    };
    (result.rotas||[]).forEach(route=>{
      const carro=carros.find(x=>x.placa===route.plate),valorHora=Number(carro?.valorHora)||0;
      route.positions.slice(1).forEach((point,index)=>{
        const anterior=route.positions[index],a=pointLocation(anterior),b=pointLocation(point);
        const horas=(point.dt-anterior.dt)/3600000;
        if(!a||!b||a.tipo!==b.tipo||a.nome!==b.nome||horas<=0||horas>12)return;
        permanencias.push({placa:route.plate,responsavel:carro?.responsavel||'',tipo:a.tipo,nome:a.nome,horas,valorHora,custoMaoObra:horas*valorHora});
      });
    });
    const summary={totalKm:total,totalLitros:total/kmLitro,totalCustoCombustivel:total/kmLitro*precoLitro,kmLitro,precoLitro,raio};
    ['obra','empresa','particular'].forEach(cat=>{
      const group=items.filter(x=>x.categoria===cat);
      summary[cat]={km:group.reduce((s,x)=>s+x.km,0),litros:group.reduce((s,x)=>s+x.litros,0),custo:group.reduce((s,x)=>s+x.custo,0)};
    });
    const permanenciaObras=permanencias.filter(x=>x.tipo==='obra'),permanenciaEmpresa=permanencias.filter(x=>x.tipo==='empresa');
    summary.obra.horas=permanenciaObras.reduce((s,x)=>s+x.horas,0);
    summary.obra.maoObra=permanenciaObras.reduce((s,x)=>s+x.custoMaoObra,0);
    summary.empresa.horas=permanenciaEmpresa.reduce((s,x)=>s+x.horas,0);
    summary.empresa.maoObra=permanenciaEmpresa.reduce((s,x)=>s+x.custoMaoObra,0);
    summary.maoObraTotal=summary.obra.maoObra+summary.empresa.maoObra;
    summary.totalGeral=summary.totalCustoCombustivel+summary.maoObraTotal;
    const groupBy=(key,filter)=>{
      const map=new Map();
      items.filter(filter).forEach(x=>{
        const id=x[key]||'Não identificado',row=map.get(id)||{nome:id,km:0,litros:0,custo:0,responsavel:x.responsavel||''};
        row.km+=x.km;row.litros+=x.litros;row.custo+=x.custo;map.set(id,row);
      });
      return [...map.values()].sort((a,b)=>b.km-a.km);
    };
    const obrasResumo=groupBy('nome',x=>x.categoria==='obra');
    permanenciaObras.forEach(p=>{
      let row=obrasResumo.find(x=>x.nome===p.nome);
      if(!row){row={nome:p.nome,km:0,litros:0,custo:0,responsavel:''};obrasResumo.push(row)}
      row.horas=(row.horas||0)+p.horas;row.maoObra=(row.maoObra||0)+p.custoMaoObra;
    });
    obrasResumo.forEach(row=>row.total=(row.custo||0)+(row.maoObra||0));
    obrasResumo.sort((a,b)=>b.total-a.total);
    return {summary,items,permanencias,obras:obrasResumo,carros:groupBy('placa',x=>x.categoria==='particular')};
  };
  F.geocode=async address=>{
    const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`;
    const response=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!response.ok)throw new Error(`Falha ao localizar: ${address}`);
    const data=await response.json();
    return data[0]?{latitude:Number(data[0].lat),longitude:Number(data[0].lon),displayName:data[0].display_name}:null;
  };
  global.GPSV4.Financeiro=F;
})(window);
