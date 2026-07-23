(function(global){
  'use strict';
  const MapUI={};let map,routeLayers=[],marker,timer,animationPoints=[],animationIndex=0;
  function ensure(){
    if(map||!global.L)return;
    map=L.map('mapa').setView([-27.59,-48.61],10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  }
  MapUI.render=result=>{
    ensure();if(!map)return;
    routeLayers.forEach(layer=>map.removeLayer(layer));routeLayers=[];animationPoints=[];
    const colors=['#6d28d9','#0891b2','#16a34a','#ea580c','#dc2626','#2563eb'];
    (result.rotas||[]).forEach((route,i)=>{
      const pts=route.positions.map(p=>[p.latitude,p.longitude]);
      if(pts.length<2)return;
      const line=L.polyline(pts,{color:colors[i%colors.length],weight:5,opacity:.85}).addTo(map);
      line.bindPopup(`<strong>${route.plate}</strong><br>${route.date.toLocaleDateString('pt-BR')}<br>${route.km.toFixed(2).replace('.',',')} km`);
      routeLayers.push(line);animationPoints.push(...route.positions);
    });
    if(routeLayers.length)map.fitBounds(L.featureGroup(routeLayers).getBounds(),{padding:[20,20]});
    document.getElementById('mapInfo').textContent=`${(result.rotas||[]).length} rota(s) • ${result.dashboard.totalKm.toFixed(2).replace('.',',')} km`;
    setTimeout(()=>map.invalidateSize(),50);
  };
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
