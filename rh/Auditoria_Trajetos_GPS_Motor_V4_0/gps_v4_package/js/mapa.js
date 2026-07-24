(function(global){
  'use strict';
  const MapUI={};let map,routeLayers=[],locationLayers=[],marker,timer,animationPoints=[],animationIndex=0,lastResult=null;
  function fitOverview(){
    ensure();if(!map)return;
    const layers=[...routeLayers,...locationLayers];
    if(layers.length)map.fitBounds(L.featureGroup(layers).getBounds(),{padding:[35,35],maxZoom:14});
    setTimeout(()=>map.invalidateSize(),50);
  }
  function ensure(){
    if(map||!global.L)return;
    map=L.map('mapa').setView([-27.59,-48.61],10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  }
  MapUI.render=result=>{
    ensure();if(!map)return;lastResult=result;
    routeLayers.forEach(layer=>map.removeLayer(layer));routeLayers=[];animationPoints=[];
    const colors=['#6d28d9','#0891b2','#16a34a','#ea580c','#dc2626','#2563eb'];
    (result.rotas||[]).forEach((route,i)=>{
      const pts=route.positions.map(p=>[p.latitude,p.longitude]);
      if(pts.length<2)return;
      const line=L.polyline(pts,{color:colors[i%colors.length],weight:5,opacity:.85}).addTo(map);
      line.bindPopup(`<strong>${route.plate}</strong><br>${route.date.toLocaleDateString('pt-BR')}<br>${route.km.toFixed(2).replace('.',',')} km`);
      line.bindTooltip(`${route.plate} • ${route.date.toLocaleDateString('pt-BR')}`,{sticky:true});
      routeLayers.push(line);animationPoints.push(...route.positions);
    });
    if(routeLayers.length)map.fitBounds(L.featureGroup(routeLayers).getBounds(),{padding:[20,20],maxZoom:15});
    document.getElementById('mapInfo').textContent=`${(result.rotas||[]).length} rota(s) • ${result.dashboard.totalKm.toFixed(2).replace('.',',')} km`;
    setTimeout(()=>map.invalidateSize(),50);
  };
  MapUI.renderLocations=(metadata,radius)=>{
    ensure();if(!map)return;
    locationLayers.forEach(layer=>map.removeLayer(layer));locationLayers=[];
    const locations=[...(metadata.cadastroObras||[]).map(x=>({...x,tipo:'Obra'})),...(metadata.sede?[{...metadata.sede,tipo:'Empresa'}]:[]),...(metadata.residencias||[]).map(x=>({...x,nome:`Residência operacional ${x.placa}`,tipo:'Residência'}))];
    locations.forEach(x=>{
      if(!Number.isFinite(x.latitude)||!Number.isFinite(x.longitude))return;
      const color=x.tipo==='Empresa'?'#0f4c81':x.tipo==='Residência'?'#f2a43b':'#15a06f';
      const circle=L.circle([x.latitude,x.longitude],{radius:Number(radius)||500,color,fillColor:color,fillOpacity:.12,weight:2}).addTo(map);
      circle.bindPopup(`<strong>${x.tipo}: ${x.nome||'Sede'}</strong><br>${x.endereco||''}<br>Raio: ${Number(radius)||500} m`);
      const point=L.circleMarker([x.latitude,x.longitude],{radius:x.tipo==='Empresa'?9:7,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).addTo(map);
      point.bindTooltip(`${x.tipo.toUpperCase()} • ${x.nome||'Sede'}`,{permanent:true,direction:'top',className:`location-label ${x.tipo==='Empresa'?'company':x.tipo==='Residência'?'home':'work'}`});
      point.bindPopup(`<strong>${x.tipo}: ${x.nome||'Sede'}</strong><br>${x.endereco||''}`);
      locationLayers.push(circle,point);
    });
  };
  MapUI.fitOverview=fitOverview;
  function stop(){clearInterval(timer);timer=null;if(marker&&map){map.removeLayer(marker);marker=null}animationIndex=0}
  MapUI.play=()=>{
    ensure();stop();if(!animationPoints.length)return;
    marker=L.circleMarker([animationPoints[0].latitude,animationPoints[0].longitude],{radius:9,color:'#fff',weight:3,fillColor:'#ef4444',fillOpacity:1}).addTo(map);
    timer=setInterval(()=>{
      if(animationIndex>=animationPoints.length){stop();return}
      const p=animationPoints[animationIndex++];
      marker.setLatLng([p.latitude,p.longitude]);map.panTo(marker.getLatLng(),{animate:true,duration:.2});
      document.getElementById('mapInfo').textContent=`${p.plate} • ${p.dt.toLocaleString('pt-BR')} • ${p.velocidade} km/h • ${p.address||''}`;
    },180);
  };
  MapUI.stop=stop;
  global.GPSV4.MapUI=MapUI;
})(window);
