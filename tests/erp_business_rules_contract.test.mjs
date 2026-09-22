import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const requires=(source,patterns,label)=>{
  for(const pattern of patterns)assert.match(source,pattern,`${label}: regra ausente: ${pattern}`);
};

const login=read('login_novo.html');
requires(login,[
  /ERPIMPAR_USER/,
  /localStorage\.removeItem\(KEY\)/,
  /sessionStorage\.removeItem\(KEY\)/,
  /function usuarioAtivo\(/,
  /if\(!usuarioAtivo\(user\)\)/,
  /String\(user\.senha\|\|""\)!==String\(senha\)/
],'Login');

const shell=read('menu_novo.html');
requires(shell,[
  /usuario_por_email/,
  /podeAcessarPagina/,
  /login_novo\.html\?logout=1/,
  /ERPIMPAR_USER/
],'Shell');

const weekly=read('cronograma/agenda_semanal_novo.html');
requires(weekly,[
  /e\.ctrlKey\?"copy":"move"/,
  /congelar_agenda_novo\.php/,
  /acao:'finalizar'/,
  /tipo!=='historico'/,
  /alterados que ainda não foram gravados/,
  /Semanas vigentes ou históricas não podem ser alteradas/
],'Agenda Semanal');

const daily=read('cronograma/agenda_do_dia_novo.html');
requires(daily,[
  /e\.ctrlKey\?"copy":"move"/,
  /Justificativas obrigatórias/,
  /motivoCancelamento/,
  /motivoReplanejamento/,
  /Planejar o próximo dia/,
  /próximo dia útil/,
  /atividade_dia_estado_novo\.php/,
  /carregar_agenda_novo\.php/,
  /Resposta inválida do servidor/,
  /ERPIMPAR_USER/
],'Agenda do Dia');

const schedule=read('cronograma/cronograma_novo.html');
requires(schedule,[
  /function weightedPlannedPercentAt\(/,
  /function weightedRealPercent\(/,
  /function recalculateWeightsFromDurations\(/,
  /real>=plan\?"Em andamento":"Atrasado"/,
  /function calculateSchedule\(/,
  /predecess/i,
  /addEventListener\("dblclick"/
],'Cronograma');

const works=read('obras/gestao_obras_novo.html');
requires(works,[
  /project_list/,
  /project_get/,
  /project_save/,
  /document_list/,
  /document_get/,
  /file_delete/,
  /upload/
],'Vida da Obra');

const measurement=read('medicao-empreiteiro/medicao_empreiteiro.html');
requires(measurement,[
  /medicoes\/api\.php/,
  /medicoes\/upload\.php/,
  /previewConfirm/,
  /confirmSend/,
  /summaryPrint/,
  /summaryShare/
],'Medição');

const documents=read('documentos/gestão_documental_novo.html');
requires(documents,[
  /viacep\.com\.br/,
  /btnImportContractorExcel/,
  /btnGerarPrevia/,
  /btnSalvarFinal/,
  /btnImprimirFinal/,
  /btnCompartilharFinal/,
  /Backend indisponível[\s\S]*Nada foi salvo/
],'Documentos');

const materials=read('materiais/solicitacao_materiais_novo.html');
requires(materials,[
  /btnSalvarRascunho/,
  /btnEnviar/,
  /btnHistorico/,
  /btnRelatorio/,
  /deleteDraft/,
  /exportHistoryExcel/,
  /exportReportExcel/
],'Solicitações');

const travel=read('rh/viagens/atualizacao_viagens_novo.html');
requires(travel,[
  /ERPIMPAR_USER/,
  /btnSalvar/,
  /btnNova/,
  /btnRel/,
  /btnExcel/,
  /btnFinalizar/,
  /JSON\.parse\(t\)/
],'Viagens');

const admin=read('administracao/index.html');
requires(admin,[
  /listar/,
  /salvar_usuario/,
  /excluir_usuario/,
  /salvar_perfis/,
  /salvar_workflows/,
  /ERPIMPAR_USER/
],'Administração');

const george=read('george-reuniao/assets/v09/app.js');
const georgeApi=read('george-reuniao/backend-ci/v09/api.php');
const report=read('george-reuniao/backend-ci/v09/lib/Report.php');
requires(george,[
  /resposta inválida \(HTTP \$\{r\.status\}\)/,
  /agenda_live_read/,
  /meeting_close_review/,
  /scheduleReconnect/,
  /reconnectAttempt<5/,
  /document_create/,
  /Compartilhar PDF/
],'George navegador');
requires(georgeApi,[/agenda_execute/,/agenda_live_read/,/meeting_control/,/meeting_close_review/,/document_create/,/media_start/],'George API');
requires(report,[/%PDF-/,/PDF_INVALIDO/],'George PDF');

console.log('PASS erp-business-rules-contract: contratos críticos de 12 áreas preservados.');
