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
    const deslocamentos=F.deslocamentos(result,metadata,{kmLitro,precoLitro,raio});
    return {summary,items,permanencias,obras:obrasResumo,carros:groupBy('placa',x=>x.categoria==='particular'),deslocamentos};
  };
  F.deslocamentos=(result,metadata,params)=>{
    const kmLitro=Math.max(.1,Number(params.kmLitro)||10),precoLitro=Math.max(0,Number(params.precoLitro)||0),raio=Math.max(10,Number(params.raio)||500);
    const residencias=metadata.residencias||[],sede=metadata.sede,carros=metadata.cadastroCarros||[];
    const segments=[],byKey=new Map();
    (result.rotas||[]).forEach(route=>route.positions.slice(1).forEach((point,index)=>{
      const prev=route.positions[index],delta=Number.isFinite(point.odometro)&&Number.isFinite(prev.odometro)?point.odometro-prev.odometro:distance(prev,point)/1000;
      if(point.dt.toDateString()!==prev.dt.toDateString()||delta<0||delta>=100)return;
      const key=`${route.plate}|${prev.dt.getTime()}|${point.dt.getTime()}`,seg={key,placa:route.plate,prev,point,km:delta,commute:false};
      segments.push(seg);byKey.set(key,seg);
    }));
    (result.cycles||[]).forEach(cycle=>{
      const home=residencias.find(x=>x.placa===cycle.plate&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));
      if(!home||!sede||!Number.isFinite(sede.latitude))return;
      const start=cycle.points[0],end=cycle.points.at(-1);
      const h2e=distance(start,home)<=raio&&distance(end,sede)<=raio,e2h=distance(start,sede)<=raio&&distance(end,home)<=raio;
      if(!h2e&&!e2h)return;
      segments.forEach(seg=>{if(seg.placa===cycle.plate&&seg.prev.dt>=start.dt&&seg.point.dt<=end.dt)seg.commute=true});
    });
    const rows=new Map(),totalSegmentado=segments.reduce((s,x)=>s+x.km,0);
    segments.forEach(seg=>{
      const day=seg.prev.dt.getDay(),hour=seg.prev.dt.getHours()+seg.prev.dt.getMinutes()/60;
      const categoria=seg.commute?'commute':[0,6].includes(day)?'weekend':(hour<6||hour>=20)?'offhours':'operacional';
      let row=rows.get(seg.placa);
      if(!row){const carro=carros.find(x=>x.placa===seg.placa);row={placa:seg.placa,responsavel:carro?.responsavel||'',commuteKm:0,weekendKm:0,offhoursKm:0,totalKm:0,custo:0};rows.set(seg.placa,row)}
      if(categoria==='commute')row.commuteKm+=seg.km;
      if(categoria==='weekend')row.weekendKm+=seg.km;
      if(categoria==='offhours')row.offhoursKm+=seg.km;
    });
    const porPlaca=[...rows.values()].map(row=>{row.commuteLitros=row.commuteKm/kmLitro;row.commuteCusto=row.commuteLitros*precoLitro;row.totalKm=row.commuteKm+row.weekendKm+row.offhoursKm;row.custo=row.totalKm/kmLitro*precoLitro;return row}).sort((a,b)=>b.totalKm-a.totalKm);
    const sum=field=>porPlaca.reduce((s,x)=>s+x[field],0),total=result.dashboard?.totalKm||totalSegmentado,combined=sum('totalKm');
    return {
      commute:{km:sum('commuteKm'),custo:sum('commuteKm')/kmLitro*precoLitro},
      weekend:{km:sum('weekendKm'),custo:sum('weekendKm')/kmLitro*precoLitro},
      offhours:{km:sum('offhoursKm'),custo:sum('offhoursKm')/kmLitro*precoLitro},
      km:combined,custo:combined/kmLitro*precoLitro,percentual:total?combined/total*100:0,
      naoClassificadoKm:Math.max(0,total-totalSegmentado),porPlaca
    };
  };
  F.geocode=async address=>{
    const cleaned=String(address||'').replace(/\\bCNO\\s*:[\\s\\S]*$/i,'').replace(/\\s+/g,' ').trim();
    const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(cleaned)}`;
    const response=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!response.ok)throw new Error(`Falha ao localizar: ${address}`);
    const data=await response.json();
    return data[0]?{latitude:Number(data[0].lat),longitude:Number(data[0].lon),displayName:data[0].display_name}:null;
  };
  F.reverseGeocode=async(latitude,longitude)=>{
    const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
    const response=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!response.ok)return '';
    const data=await response.json();
    return String(data.display_name||'').trim();
  };
  global.GPSV4.Financeiro=F;
})(window);
