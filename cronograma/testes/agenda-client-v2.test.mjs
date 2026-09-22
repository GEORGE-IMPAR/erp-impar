import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,'../agenda_client_v2.js'),'utf8');
const memory=new Map([['ERPIMPAR_USER',JSON.stringify({email:'teste@erpimpar.invalid',company_id:1})]]);
const storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value))};
const calls=[];
let uuid=0;

const context={
  console,
  JSON,
  Date,
  Promise,
  Headers,
  crypto:{randomUUID:()=>`copy-${++uuid}`},
  location:{protocol:'https:',href:'https://erpimpar.invalid/cronograma/agenda_do_dia_novo.html'},
  sessionStorage:storage,
  localStorage:storage,
  people:[
    {id:1,colaborador_id:1,name:'Alice Silva',role:'execucao'},
    {id:2,colaborador_id:2,name:'Bruno Souza',role:'execucao'}
  ],
  schedule:{
    '1_0':[{id:'weekly-1',obra:'Obra A',atividade:'Montagem',origemSemanal:true}],
    '2_0':[]
  },
  roomLinks:[],
  __AGENDA_DIA_ACTIVE_RECORD__:{data:'2026-09-21',date:'2026-09-21',atividades:[]},
  renderAll:()=>{},
  fetch:async(url,options={})=>{
    calls.push({url:String(url),options});
    const body=String(url).endsWith('cadastros_agenda_novo.php')
      ? {ok:true,data:{colaboradores:[{id:3,name:'Carla Lima',role:'execucao'}]}}
      : {ok:true};
    return {ok:true,status:200,text:async()=>JSON.stringify(body)};
  }
};
context.window=context;
context.top=context;

vm.createContext(context);
new vm.Script(source,{filename:'agenda_client_v2.js'}).runInContext(context);
const client=context.AgendaDiaClient;

for(const method of ['read','apply','flush','catalog','plan','saveVisible','undo','close']){
  assert.equal(typeof client[method],'function',`Método obrigatório ausente: ${method}`);
}

await client.plan([{operacao:'copiar',origem_colaborador:'Alice Silva',destinos:['Bruno Souza'],atividade_ids:['weekly-1']}]);
assert.equal(context.schedule['1_0'].length,1,'Copiar deve preservar a origem.');
assert.equal(context.schedule['2_0'].length,1,'Copiar deve criar o destino.');
assert.equal(context.schedule['2_0'][0].originalItemId,'weekly-1','A cópia deve rastrear o item original.');
assert.equal(context.schedule['2_0'][0].operacaoOrigem,'COPIAR','A cópia deve registrar a operação.');

await client.plan([{operacao:'mover',origem_colaborador:'Bruno Souza',destinos:['Alice Silva'],atividade_ids:['copy-1']}]);
assert.equal(context.schedule['2_0'].length,0,'Mover deve retirar o item da origem.');
assert.equal(context.schedule['1_0'].length,2,'Mover deve criar o item no destino.');
assert.equal(context.schedule['1_0'][1].operacaoOrigem,'MOVER','O destino deve registrar a movimentação.');

await client.plan([{operacao:'vincular_colaborador',colaborador:'id:3'}]);
assert.ok(context.people.some(person=>person.name==='Carla Lima'),'Vincular deve usar o cadastro central.');

await client.plan([{operacao:'remover_colaborador',colaborador:'id:3',confirmar_remocao_atividades:false}]);
assert.ok(!context.people.some(person=>person.name==='Carla Lima'),'Remover do dia não deve manter o vínculo diário.');

await client.flush();
assert.ok(calls.some(call=>call.url.endsWith('salvar_atividade_dia.php')),'As alterações devem ser persistidas pelo endpoint oficial.');

console.log('PASS agenda-client-v2: copiar, mover, vincular, remover, rastrear e persistir.');
