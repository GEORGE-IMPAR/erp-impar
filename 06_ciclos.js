(function(global){
  'use strict';
  const Core={};
  Core.norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  Core.escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  Core.iso=d=>{const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
  Core.formatDate=d=>d.toLocaleDateString('pt-BR');
  Core.formatTime=d=>d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  Core.dayName=d=>d.toLocaleDateString('pt-BR',{weekday:'long'}).replace(/^./,c=>c.toUpperCase());
  Core.duration=ms=>{let m=Math.max(0,Math.round(ms/60000));const h=Math.floor(m/60);m%=60;return h?`${h}h ${m}min`:`${m} min`};
  Core.outsideWork=d=>{const h=d.getHours()+d.getMinutes()/60;return [0,6].includes(d.getDay())||h<7||h>=18};
  Core.plate=s=>{const t=String(s||'').trim();const m=t.match(/[A-Z]{3}[- ]?\d[A-Z0-9]\d{2}/i)||t.match(/[A-Z]{3}[- ]?\d{4}/i);return m?m[0].toUpperCase().replace(/([A-Z]{3})[- ]?([A-Z0-9]{4})/,'$1-$2'):t};
  Core.parseDateTime=v=>{
    if(v instanceof Date&&!isNaN(v))return v;
    if(typeof v==='number'&&global.XLSX){const p=XLSX.SSF.parse_date_code(v);if(p)return new Date(p.y,p.m-1,p.d,p.H||0,p.M||0,p.S||0)}
    const s=String(v??'').trim();let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0))}
    m=s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if(m)return new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));
    const d=new Date(s);return isNaN(d)?null:d;
  };
  global.GPSV4=global.GPSV4||{};global.GPSV4.Core=Core;
})(window);
