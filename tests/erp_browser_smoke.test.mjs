import {chromium} from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
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
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp4':'video/mp4'};
const emptyApi=()=>JSON.stringify({ok:true,data:[],items:[],projects:[],usuarios:[],coordenadores:[],atividades:[],exists:false});
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://local').pathname);
  const target=path.resolve(root,'.'+pathname);
  if(!target.startsWith(root)||!fs.existsSync(target)||fs.statSync(target).isDirectory()){
    if(pathname.endsWith('.json')||pathname.includes('/data/')){
      response.writeHead(200,{'content-type':'application/json; charset=utf-8'});response.end(emptyApi());return;
    }
    response.writeHead(404,{'content-type':'text/plain'});response.end('not found');return;
  }
  response.writeHead(200,{'content-type':mime[path.extname(target).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(target).pipe(response);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const failures=[];

try{
  for(const file of pages){
    const context=await browser.newContext();
    await context.addInitScript(()=>{
      localStorage.setItem('ERPIMPAR_USER',JSON.stringify({nome:'Teste Regressão',email:'regressao@erpimpar.com.br',modulos:['*']}));
      window.html2canvas=async()=>document.createElement('canvas');
      window.html2pdf=()=>({set(){return this},from(){return this},save(){return Promise.resolve()}});
      window.jspdf={jsPDF:class{save(){}}};
      window.JSZip=class{};
      window.XLSX={utils:{book_new:()=>({}),json_to_sheet:()=>({}),book_append_sheet:()=>{}},writeFile:()=>{}};
    });
    const page=await context.newPage();
    page.on('pageerror',error=>failures.push(`${file}: erro JavaScript: ${error.message}`));
    page.on('response',response=>{
      if(response.url().startsWith(origin)&&response.status()>=400)failures.push(`${file}: recurso HTTP ${response.status()}: ${response.url().slice(origin.length)}`);
    });
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      const type=route.request().resourceType();
      if(url.origin===origin&&url.pathname.endsWith('.php')){
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:[],items:[],projects:[],usuarios:[],coordenadores:[],atividades:[],exists:false})});return;
      }
      if(url.origin!==origin){
        if(type==='image'||type==='media'||type==='font'||type==='stylesheet'){
          await route.fulfill({status:204,body:''});return;
        }
        if(type==='script'){
          await route.fulfill({status:200,contentType:'text/javascript',body:'/* dependência externa simulada pelo smoke */'});return;
        }
        await route.fulfill({status:200,contentType:'application/json',body:emptyApi()});return;
      }
      await route.continue();
    });
    try{
      const response=await page.goto(`${origin}/${file}`,{waitUntil:'domcontentloaded',timeout:15000});
      if(!response||response.status()>=400)failures.push(`${file}: página não abriu (${response?.status()??'sem resposta'})`);
      await page.waitForTimeout(400);
      const body=await page.locator('body').count();
      if(body!==1)failures.push(`${file}: documento sem body único`);
    }catch(error){failures.push(`${file}: navegação falhou: ${error.message}`);}
    await context.close();
  }
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

if(failures.length){
  console.error(`FAIL erp-browser-smoke (${failures.length})\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`PASS erp-browser-smoke: ${pages.length} páginas abriram sem erro de recurso ou JavaScript.`);
