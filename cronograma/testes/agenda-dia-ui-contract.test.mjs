import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const cronograma=path.resolve(here,'..');
const htmlPath=path.join(cronograma,'agenda_do_dia_novo.html');
const clientPath=path.join(cronograma,'agenda_client_v2.js');
const html=fs.readFileSync(htmlPath,'utf8');

assert.match(html,/<script src="agenda_client_v2\.js\?[^\"]+"><\/script>/,
  'A Agenda deve carregar o cliente integrado local.');
assert.ok(fs.existsSync(clientPath),
  'O pacote deve conter agenda_client_v2.js ao lado do HTML.');

for(const id of ['openPeople','weekPlanBtn','reportBtn','weeklyConsultBtn','saveMock']){
  assert.match(html,new RegExp(`id=["']${id}["']`),`Controle obrigatório ausente: ${id}`);
}

assert.match(html,/if\(!client\|\|typeof client\.flush!=="function"\|\|typeof client\.catalog!=="function"\)/,
  'A abertura de Colaboradores deve tolerar cliente integrado ausente.');
assert.match(html,/document\.getElementById\("peopleModal"\)\?\.classList\.add\("open"\)/,
  'A abertura de Colaboradores deve abrir o modal.');

const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match=>match[1]).filter(source=>source.trim());
for(const [index,source] of inlineScripts.entries()){
  try{new vm.Script(source,{filename:`agenda-inline-${index+1}.js`});}
  catch(error){throw new Error(`JavaScript inline inválido no bloco ${index+1}: ${error.message}`);}
}

console.log(`PASS agenda-dia-ui-contract: ${inlineScripts.length} blocos inline válidos; dependência e controles presentes.`);
