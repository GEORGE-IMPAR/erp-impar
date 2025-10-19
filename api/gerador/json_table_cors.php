<?php
// CORS - permitir chamadas do front hospedado em domínio diferente
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Vary: Origin'); // para caches respeitarem origem
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, *');
header('Content-Type: application/json; charset=utf-8');

// Pré‑flight (OPTIONS) sai antes sem processar
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// ===== json_table.php (com CORS) =====
// Operações: op=list | op=get | op=upsert
// Armazena em ../storage/data/documentos.jsonl (formato JSON Lines)
// Segurança: pode reutilizar o mesmo TOKEN do save.php (opcional).
// RISCO ZERO: arquivo novo; não altera nada do fluxo já existente.

// --- CONFIG ---
$BASE_DIR = __DIR__ . '/../storage/data/';
$FILE_JSONL = $BASE_DIR . 'documentos.jsonl';

// --- TOKEN (opcional) ---
// Se quiser exigir token, preencha aqui (ou inclua um arquivo que o defina).
// Deixe vazio para aceitar sem token.
$ENV_TOKEN = '';

$REQ_TOKEN = isset($_POST['token']) ? $_POST['token'] : (isset($_GET['token']) ? $_GET['token'] : '');
if ($ENV_TOKEN !== '' && $REQ_TOKEN !== $ENV_TOKEN) {
  http_response_code(401);
  echo json_encode(['ok'=>false, 'error'=>'unauthorized']);
  exit;
}

// --- Inputs ---
$op = isset($_REQUEST['op']) ? $_REQUEST['op'] : '';
$codigo = isset($_REQUEST['codigo']) ? trim($_REQUEST['codigo']) : '';

// --- Helpers ---
function ensure_dir($d) { if (!is_dir($d)) { @mkdir($d, 0775, true); } }
function read_all_jsonl($path) {
  $rows = [];
  if (!file_exists($path)) return $rows;
  $fh = fopen($path, 'r');
  if (!$fh) return $rows;
  while (($line = fgets($fh)) !== false) {
    $line = trim($line);
    if ($line === '') continue;
    $j = json_decode($line, true);
    if (is_array($j)) $rows[] = $j;
  }
  fclose($fh);
  return $rows;
}
function write_all_jsonl_unique_by_codigo($path, $rows) {
  $map = [];
  foreach ($rows as $r) {
    if (!isset($r['codigo'])) continue;
    $map[$r['codigo']] = $r;
  }
  $fh = fopen($path, 'w');
  foreach ($map as $r) {
    fwrite($fh, json_encode($r, JSON_UNESCAPED_UNICODE) . "\n");
  }
  fclose($fh);
}

// --- Exec ---
ensure_dir($BASE_DIR);

if ($op === 'list') {
  $rows = read_all_jsonl($FILE_JSONL);
  $out = [];
  foreach ($rows as $r) {
    $out[] = [
      'codigo' => isset($r['codigo']) ? $r['codigo'] : '',
      'data_criacao' => isset($r['data_criacao']) ? $r['data_criacao'] : '',
      'nomeContratante' => isset($r['nomeContratante']) ? $r['nomeContratante'] : '',
    ];
  }
  echo json_encode(['ok'=>true, 'items'=>$out]);
  exit;
}

if ($op === 'get') {
  if ($codigo === '') { echo json_encode(['ok'=>false,'error'=>'codigo_required']); exit; }
  $rows = read_all_jsonl($FILE_JSONL);
  foreach ($rows as $r) {
    if (isset($r['codigo']) && $r['codigo'] === $codigo) {
      echo json_encode(['ok'=>true, 'item'=>$r]);
      exit;
    }
  }
  echo json_encode(['ok'=>false, 'error'=>'not_found']);
  exit;
}

if ($op === 'upsert') {
  $payload = null;
  $raw = file_get_contents('php://input');
  if ($raw) {
    $tmp = json_decode($raw, true);
    if (is_array($tmp)) $payload = $tmp;
  }
  if (!$payload) $payload = $_POST;

  if (!is_array($payload)) { echo json_encode(['ok'=>false,'error'=>'invalid_payload']); exit; }
  if (!isset($payload['codigo']) || trim($payload['codigo'])==='') { echo json_encode(['ok'=>false,'error'=>'codigo_required']); exit; }

  // Normaliza PK
  $payload['codigo'] = preg_replace('/[^A-Za-z0-9_\-]/', '_', $payload['codigo']);

  // Salva/atualiza por PK
  $rows = read_all_jsonl($FILE_JSONL);
  $map = [];
  foreach ($rows as $r) { if (isset($r['codigo'])) $map[$r['codigo']] = $r; }
  $map[$payload['codigo']] = $payload;

  $fh = fopen($FILE_JSONL, 'w');
  foreach ($map as $r) { fwrite($fh, json_encode($r, JSON_UNESCAPED_UNICODE) . "\n"); }
  fclose($fh);

  echo json_encode(['ok'=>true]);
  exit;
}

echo json_encode(['ok'=>false,'error'=>'op_required']);
