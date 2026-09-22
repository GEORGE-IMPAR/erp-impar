import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));

const shell=read('menu_novo.html');
const login=read('login_novo.html');
const modules={
  'Mesa de Projetos':'projetos/mesa_projetos.html',
  'Dashboard de Projetos':'projetos/dashboard_projetos.html',
  'Agenda Semanal':'cronograma/agenda_semanal_novo.html',
  'Agenda do Dia':'cronograma/agenda_do_dia_novo.html',
  'Dashboard Executivo de Obras':'cronograma/dashboard_executivo_obras_novo.html',
  'Cronograma':'cronograma/cronograma_novo.html',
  'Gestão de Obras':'obras/gestao_obras_novo.html',
  'Medição Empreiteiro':'medicao-empreiteiro/medicao_empreiteiro.html',
  'Documentos':'documentos/gestão_documental_novo.html',
  'Orçamentos':'orcamento_novo.html',
  'Solicitações':'materiais/solicitacao_materiais_novo.html',
  'Agenda de Viagens':'rh/viagens/atualizacao_viagens_novo.html',
  'Administração':'administracao/index.html'
};

for(const [label,file] of Object.entries(modules)){
  assert.equal(exists(file),true,`${label}: rota publicada pelo shell não existe: ${file}`);
  assert.match(shell,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),
    `${label}: módulo deixou de aparecer no contrato do shell.`);
  assert.match(shell,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),
    `${label}: shell deixou de apontar para ${file}.`);
}

assert.match(login,/ERPIMPAR_USER/,'Login deve manter a sessão SSO do ERP.');
assert.match(login,/usuarios_erp\.json/,'Login atual deve continuar carregando a fonte de usuários publicada.');
assert.match(shell,/ERPIMPAR_USER/,'Shell deve ler a mesma sessão criada pelo login.');
assert.match(shell,/usuario_por_email/,'Shell deve atualizar permissões do usuário no backend.');
assert.match(shell,/podeAcessarPagina/,'Shell deve bloquear módulos sem permissão.');
assert.match(shell,/login_novo\.html\?logout=1/,'Logout deve retornar ao login e limpar a sessão.');

const contracts={
  'projetos/mesa_projetos.html':['newBtn','consultBtn','planBtn','priorityBtn','generateWeekBtn','manageEstimatesBtn','teamDrop'],
  'projetos/dashboard_projetos.html':['newBtn','consultBtn','planBtn','priorityBtn','projectReportPrint','projectReportShare','projectReportCsv'],
  'cronograma/agenda_semanal_novo.html':['openPeople','weekPlanBtn','freezeWeekBtn','reportBtn','clearAll','saveMock','weekGrid','reportShare'],
  'cronograma/agenda_do_dia_novo.html':['openPeople','weekPlanBtn','freezeWeekBtn','reportBtn','weeklyConsultBtn','saveMock','weekGrid','dailyReportPrint'],
  'cronograma/dashboard_executivo_obras_novo.html':['filterObra','filterCoordinator','filterStatus','newBtn','pdfBtn','refreshBtn'],
  'cronograma/cronograma_novo.html':['obra','coordinator','startDate','endDate','draftBtn','addBtn','sheetBtn','reportBtn','ganttTable','saveActivityBtn'],
  'obras/gestao_obras_novo.html':['new','refresh','plist','view','timeline','repo','files','contractList','materialsList','auditList'],
  'medicao-empreiteiro/medicao_empreiteiro.html':['contracts','work','send','previewConfirm','confirmSend','summaryPrint','summaryShare'],
  'documentos/gestão_documental_novo.html':['newEmp','docWizardForm','gTemplate','gContratante','gContratada','gCodigo','gPrazo','gValor'],
  'orcamento_novo.html':['obra','data','responsavel','body','salvarOrcamento','totalFinalVenda'],
  'materiais/solicitacao_materiais_novo.html':['btnNova','btnAbrirFicha','btnSalvarRascunho','btnHistorico','btnRelatorio','btnEnviar'],
  'rh/viagens/atualizacao_viagens_novo.html':['agendaSel','btnSalvar','btnNova','btnRel','btnExcel','btnFinalizar','matrix'],
  'administracao/index.html':['newUser','profilesBtn','workflowsBtn','refreshBtn','userList','saveUser']
};

for(const [file,ids] of Object.entries(contracts)){
  const source=read(file);
  for(const id of ids){
    const present=source.includes(`id="${id}"`)||source.includes(`id='${id}'`)||source.includes(`${id}()`);
    assert.equal(present,true,`${file}: controle obrigatório ausente: ${id}`);
  }
}

const weekly=read('cronograma/agenda_semanal_novo.html');
for(const endpoint of ['carregar_agenda_novo.php','salvar_agenda_novo.php','congelar_agenda_novo.php','cadastros_agenda_novo.php','listar_obras_novo.php'])
  assert.match(weekly,new RegExp(endpoint.replace('.','\\.')),`Agenda Semanal perdeu o endpoint ${endpoint}.`);

const daily=read('cronograma/agenda_do_dia_novo.html');
for(const endpoint of ['carregar_atividade_dia.php','salvar_atividade_dia.php','finalizar_atividade_dia.php','cadastros_agenda_novo.php','listar_obras_novo.php'])
  assert.match(daily,new RegExp(endpoint.replace('.','\\.')),`Agenda do Dia perdeu o endpoint ${endpoint}.`);

const george=read('george-reuniao/assets/v09/app.js');
for(const capability of ['conversation_new','resume','chat','agenda_live_read','meeting_control','meeting_close_review','document_create','media_start'])
  assert.match(george,new RegExp(`['\"]${capability}['\"]`),`George perdeu a capability ${capability}.`);

const georgeApi=read('george-reuniao/backend-ci/v09/api.php');
for(const capability of ['agenda_read','agenda_live_read','agenda_execute','agenda_catalog','meeting_control','meeting_close_review','document_create','media_start'])
  assert.match(georgeApi,new RegExp(`['\"]${capability}['\"]`),`Backend do George perdeu a capability ${capability}.`);

console.log(`PASS erp-production-contract: login, shell, ${Object.keys(modules).length} módulos e integrações críticas preservados.`);
