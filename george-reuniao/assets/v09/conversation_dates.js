/* ERP ÍMPAR — George — agrupamento determinístico do histórico por data. */
(() => {
  'use strict';
  const pad=value=>String(value).padStart(2,'0');
  function now(){
    const d=new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function date(value){
    const raw=String(value??'').trim();let d=null,m;
    if(/^\d{4}-\d{2}-\d{2}/.test(raw))d=new Date(raw.includes('T')?raw:raw.replace(' ','T'));
    else if((m=raw.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})(?:[, ]+(\d{2}):(\d{2})(?::(\d{2}))?)?/)))d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||0),Number(m[5]||0),Number(m[6]||0));
    else if(/^\d{10,13}$/.test(raw)){const stamp=Number(raw);d=new Date(raw.length===10?stamp*1000:stamp);}
    return d&&!Number.isNaN(d.getTime())?d:new Date();
  }
  function dayKey(value){
    const raw=String(value??'').trim();let m;
    if((m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/)))return `${m[1]}-${m[2]}-${m[3]}`;
    if((m=raw.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})/)))return `${m[3]}-${m[2]}-${m[1]}`;
    const d=date(value);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function time(value){return !value||!/^\d{4}-\d{2}-\d{2}/.test(String(value))?value||new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
  function turnTimestamp(turn,fallback=''){
    if(!turn||typeof turn!=='object')return fallback||now();
    for(const key of ['at','created_at','createdAt','timestamp','datetime','date_time','data_hora','time']){
      const value=turn[key];if(value!==undefined&&value!==null&&String(value).trim()!=='')return value;
    }
    return fallback||now();
  }
  function groupTurns(turns,fallback=''){
    const groups=[];
    for(const turn of turns||[]){const at=turnTimestamp(turn,fallback),key=dayKey(at);let group=groups.at(-1);if(!group||group.day!==key){group={day:key,turns:[]};groups.push(group);}group.turns.push({...turn,at});}
    return groups;
  }
  window.GeorgeConversationDates=Object.freeze({now,date,dayKey,time,turnTimestamp,groupTurns});
})();
