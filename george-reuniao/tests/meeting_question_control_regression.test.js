const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packaged = fs.existsSync(path.join(root, 'FRONTEND_GITHUB'));
const frontend = packaged ? path.join(root, 'FRONTEND_GITHUB') : root;
const backend = packaged ? path.join(root, 'BACKEND_KINGHOST') : path.join(root, 'backend-ci/v09');
const app = fs.readFileSync(path.join(frontend, 'assets/v09/app.js'), 'utf8');
const api = fs.readFileSync(path.join(backend, 'api.php'), 'utf8');
const meeting = fs.readFileSync(path.join(backend, 'lib/Meeting.php'), 'utf8');
const report = fs.readFileSync(path.join(backend, 'lib/Report.php'), 'utf8');
const html = fs.readFileSync(path.join(frontend, 'george_v09.html'), 'utf8');
const sw = fs.readFileSync(path.join(frontend, 'sw.js'), 'utf8');

test('the browser routes meeting close through the checklist', () => {
  assert.match(app, /prepareMeetingClose\('Fechar reunião pelo botão'\)/);
  assert.match(app, /meeting_close_review/);
  assert.match(app, /meeting_close_confirm/);
  assert.match(app, /Confirmar e fechar/);
});

test('the backend supports silent question capture and explicit release', () => {
  assert.match(meeting, /'mute','unmute'/);
  assert.match(meeting, /question_mode'\]='muted'/);
  assert.match(meeting, /meeting_questions/);
  assert.match(meeting, /Vou apenas gravar e guardar minhas dúvidas/);
  assert.match(meeting, /Perguntas liberadas/);
});

test('closing review is mandatory and covers the ata checklist', () => {
  for (const field of ['data_reuniao', 'participantes', 'topicos', 'decisoes', 'pendencias', 'duvidas', 'perguntas']) {
    assert.match(meeting, new RegExp("'" + field + "'"));
  }
  assert.match(meeting, /REVISAO_OBRIGATORIA/);
  assert.match(report, /conferencia_fechamento/);
});

test('API and cache expose the same release', () => {
  assert.match(api, /meeting_close_review/);
  assert.match(api, /meeting_close_confirm/);
  assert.match(html, /hf21-george-regression-20260922/);
  assert.match(sw, /hf21-george-regression-20260922/);
});
