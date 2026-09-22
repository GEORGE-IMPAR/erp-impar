import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const tests=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(tests,'../assets/v09/agenda_report_bridge.js'),'utf8');
const gradient={addColorStop(){}};
const context2d=new Proxy({
  measureText(text){return {width:String(text).length*12};},
  createLinearGradient(){return gradient;},
  roundRect(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},fill(){},stroke(){},
  fillRect(){},fillText(){},drawImage(){}
},{get(target,key){return key in target?target[key]:'';},set(target,key,value){target[key]=value;return true;}});
const document={
  currentScript:{src:'https://erpimpar.com.br/george-reuniao/assets/v09/agenda_report_bridge.js'},
  createElement(name){
    assert.equal(name,'canvas');
    return {width:0,height:0,getContext(){return context2d;},toDataURL(){return 'data:image/jpeg;base64,/9j/2Q==';}};
  }
};
const window={};
const sandbox={window,document,URL,Blob,TextEncoder,Uint8Array,Map,Set,Promise,setTimeout,clearTimeout,atob,fetch:async()=>({ok:false}),Image:class{}};
vm.runInNewContext(source,sandbox,{filename:'agenda_report_bridge.js'});

const atividades=[
  {id:'a1',colaborador:'Pablo',obra:'Mercosul',atividade:'Visita técnica',carro:'RXO8A58'},
  {id:'a2',colaborador:'Pablo',obra:'Restaurante San Tropeiro',atividade:'Visita técnica',carro:'RXO8A58'},
  {id:'a3',colaborador:'Fabio',obra:'Residência João Lhon',atividade:'Gestão da obra',carro:'IZH2A86'}
];
const operationalResponse={ok:true,verified:true,source:'Fonte operacional oficial da Agenda do Dia',data:'2026-09-21',draft:{data:'2026-09-21',atividades},atividades};
const payload=window.GeorgeAgendaReport.fromAgenda(operationalResponse);
assert.equal(payload.summary.colaboradores,2);
assert.equal(payload.summary.atividades,3);
assert.equal(payload.summary.horas,16);
const result=await window.GeorgeAgendaReport.build('Gera o relatório em PDF',payload);
assert.equal(result.ok,true);
assert.equal(await result.blob.slice(0,5).text(),'%PDF-');
assert.ok(result.blob.size>100);
assert.equal(result.filename,'agenda_do_dia_2026-09-21.pdf');

console.log('PASS agenda-report-pdf-regression: fonte operacional convertida em PDF válido.');
