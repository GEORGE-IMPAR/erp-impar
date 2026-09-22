import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pages=[
  'login_novo.html','menu_novo.html',
  'projetos/mesa_projetos.html','projetos/dashboard_projetos.html',
  'cronograma/agenda_semanal_novo.html','cronograma/agenda_do_dia_novo.html',
  'cronograma/dashboard_executivo_obras_novo.html','cronograma/cronograma_novo.html',
  'obras/gestao_obras_novo.html','medicao-empreiteiro/medicao_empreiteiro.html',
  'documentos/gestão_documental_novo.html','orcamento_novo.html',
  'materiais/solicitacao_materiais_novo.html','rh/viagens/atualizacao_viagens_novo.html',
  'administracao/index.html','george-reuniao/george_v09.html'
];

const missing=[];
const syntax=[];
const duplicated=[];
let scripts=0;

for(const file of pages){
  const absolute=path.join(root,file);
  assert.equal(fs.existsSync(absolute),true,`Página publicada ausente: ${file}`);
  const html=fs.readFileSync(absolute,'utf8');

  const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  const ids=[...markup.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match=>match[1]);
  const counts=new Map();
  for(const id of ids)counts.set(id,(counts.get(id)||0)+1);
  for(const [id,count] of counts)if(count>1)duplicated.push(`${file}: #${id} aparece ${count} vezes`);

  for(const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)["']/gi)){
    const reference=match[1].trim();
    if(!reference||reference.includes('${')||/^(?:[a-z]+:|\/\/|data:|javascript:)/i.test(reference))continue;
    const target=reference.startsWith('/')
      ? path.join(root,reference.replace(/^\/+/,''))
      : path.resolve(path.dirname(absolute),reference);
    if(!fs.existsSync(target))missing.push(`${file} -> ${reference}`);
  }

  let index=0;
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    index++;
    const attrs=match[1];
    const source=match[2].trim();
    if(!source||/\bsrc\s*=/i.test(attrs)||/\btype\s*=\s*["'](?:application\/json|text\/template)/i.test(attrs))continue;
    scripts++;
    try{new vm.Script(source,{filename:`${file}#script-${index}`});}
    catch(error){syntax.push(`${file}#script-${index}: ${error.message}`);}
  }
}

const failures=[];
if(missing.length)failures.push(`Referências locais quebradas:\n${missing.join('\n')}`);
if(syntax.length)failures.push(`JavaScript inline inválido:\n${syntax.join('\n')}`);
if(duplicated.length)failures.push(`IDs HTML duplicados:\n${duplicated.join('\n')}`);
assert.equal(failures.length,0,failures.join('\n\n'));

console.log(`PASS erp-static-integrity: ${pages.length} páginas e ${scripts} scripts inline verificados.`);
