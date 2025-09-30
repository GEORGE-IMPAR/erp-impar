<?php
/**
 * /api/gerador/list.php
 * Retorna os contratos do CSV em JSON.
 * Filtro opcional: ?codigo=AC00025
 * Autorização:     ?token=SEU_TOKEN
 */

/* =========================
   CONFIG
========================= */
define('APP_TOKEN', '8cce9abb2fd53b1cceaa93b9cecfd5384b2ea6fb931e8882c543cbd7d3663b77'); // <<< TROQUE PELO SEU TOKEN
$ROOT = dirname(__DIR__);                         // …/api
$CSV  = $ROOT . '/../storage/data/contratos.csv'; // …/storage/data/contratos.csv
$DOCS = $ROOT . '/../storage/docs/';              // …/storage/docs/

/* =========================
   CORS (sem duplicar headers)
========================= */
function allow_cors() {
  $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
  // Libere só o seu front. Se preferir, use "*".
  $allowed = [
    'https://erpimpar.com.br',
    'https://www.erpimpar.com.br'
  ];
  if (in_array($origin, $allowed)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
  } else {
    // Em último caso: comente as 2 linhas acima e descomente abaixo
    // header('Access-Control-Allow-Origin: *');
  }
  header('Access-Control-Allow-Methods: GET, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');
  header('Access-Control-Max-Age: 86400');
}
allow_cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

/* =========================
   Saída JSON helper
========================= */
header('Content-Type: application/json; charset=utf-8');
function jexit($arr, $code=200) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

/* =========================
   Autorização por token
========================= */
$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if ($token === '' || $token !== APP_TOKEN) {
  jexit(['ok'=>false,'error'=>'Unauthorized'], 401);
}

/* =========================
   Util: CSV (;) UTF-8
========================= */
function csv_rows($file) {
  if (!file_exists($file)) return [];
  $h = fopen($file, 'r');
  if (!$h) return [];
  $rows = [];
  $headers = null;
  while (($data = fgetcsv($h, 0, ';')) !== false) {
    // Remove BOM na primeira célula (se houver)
    if ($headers === null) {
      if (isset($data[0])) $data[0] = preg_replace('/^\xEF\xBB\xBF/', '', $data[0]);
      $headers = $data;
      continue;
    }
    // Garante o mesmo número de colunas
    $row = [];
    foreach ($headers as $i => $key) {
      $row[$key] = isset($data[$i]) ? $data[$i] : '';
    }
    $rows[] = $row;
  }
  fclose($h);
  return $rows;
}

/* =========================
   Lê CSV e filtra
========================= */
if (!file_exists($CSV)) {
  jexit(['ok'=>true,'rows'=>[]]); // sem arquivo ainda
}

$all = csv_rows($CSV);
$codigoFiltro = isset($_GET['codigo']) ? trim($_GET['codigo']) : '';

$host = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
      . '://' . $_SERVER['HTTP_HOST'];
$apiBase = rtrim($host, '/') . '/gerador/'; // …/api/gerador/

$out = [];
foreach ($all as $r) {
  // Colunas esperadas no CSV (cabecalho):
  // saved_at;codigo;servico;enderecoObra;valor;valorExtenso;prazo;dataExtenso;
  // contratante_nome;contratante_doc;contratada_nome;contratada_doc;clausulas;condicoes;pdf
  $codigo = $r['codigo'] ?? '';
  if ($codigoFiltro !== '' && strcasecmp($codigoFiltro, $codigo) !== 0) continue;

  $pdfFile = $r['pdf'] ?? '';
  $pdfUrl  = $pdfFile ? ($apiBase . 'pdf.php?f=' . rawurlencode($pdfFile) . '&token=' . rawurlencode($token)) : null;

  $out[] = [
    'codigo'            => $codigo,
    'servico'           => $r['servico'] ?? '',
    'enderecoObra'      => $r['enderecoObra'] ?? '',
    'valor'             => $r['valor'] ?? '',
    'valorExtenso'      => $r['valorExtenso'] ?? '',
    'prazo'             => $r['prazo'] ?? '',
    'dataExtenso'       => $r['dataExtenso'] ?? '',
    'contratante_nome'  => $r['contratante_nome'] ?? '',
    'contratada_nome'   => $r['contratada_nome'] ?? '',
    'pdf_file'          => $pdfFile,
    'pdf_url'           => $pdfUrl,
  ];
}

/* =========================
   Resposta
========================= */
jexit(['ok'=>true, 'rows'=>$out]);

