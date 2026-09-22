import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tests=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(tests,'..');
const app=fs.readFileSync(path.join(root,'assets/v09/app.js'),'utf8');
const api=fs.readFileSync(path.join(root,'backend-ci/v09/api.php'),'utf8');
const ai=fs.readFileSync(path.join(root,'backend-ci/v09/lib/AI.php'),'utf8');
const tools=fs.readFileSync(path.join(root,'backend-ci/v09/lib/AgendaTools.php'),'utf8');

assert.match(app,/request\('agenda_live_read'\)/,
  'O relatório deve consultar a mesma fonte operacional exibida na conversa.');
assert.match(api,/\$action==='agenda_live_read'.*liveAgenda/s,
  'A API deve expor a mesma leitura operacional usada por consultar_agenda.');
assert.match(app,/response\?\.verified/,
  'O George não deve anunciar relatório sem resposta verificada.');
assert.match(api,/\$action==='agenda_read'.*agendaRead/s,
  'A API deve expor leitura da Agenda pelo domínio compartilhado.');
assert.match(api,/\$action==='agenda_execute'.*agendaExecute/s,
  'A API deve expor escrita da Agenda pelo domínio compartilhado.');
assert.match(tools,/name'=>'agenda_executar_plano'/,
  'O George deve executar alterações por um plano transacional único.');
assert.match(ai,/Só confirme sucesso quando verified=true/,
  'O contrato conversacional deve exigir confirmação verificada.');
assert.match(app,/scheduleReconnect\(\)/,
  'O áudio deve tentar restabelecer a sessão sem exigir novo toque.');
assert.match(app,/state\.lastOutput==='agenda_pdf_error'.*o que aconteceu/s,
  'Uma pergunta curta deve herdar o contexto da falha do relatório.');

console.log('PASS agenda-george-contract: leitura, escrita, plano e confirmação verificada conectados.');
