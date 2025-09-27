<?php
// api/gerador/list.php  — lê o CSV e devolve JSON (com filtro simples)
header('Access-Control-Allow-Origin: https://www.erpimpar.com.br');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require __DIR__ . '/common.php';
check_auth();
ensure_storage();

$codigo = isset($_GET['codigo']) ? trim($_GET['codigo']) : '';
$limit = isset($_GET['limit']) ? max(1, min(2000, intval($_GET['limit']))) : 500;

$out = [];
if (($f = fopen(CSV_FILE, 'r')) !== false){
  $headers = fgetcsv($f) ?: $GLOBALS['CSV_HEADERS'];
  while (($row = fgetcsv($f)) !== false){
    $rec = array_combine($headers, $row);
    if ($codigo && stripos($rec['codigo'] ?? '', $codigo) === false) continue;
    $out[] = $rec;
    if (count($out) >= $limit) break;
  }
  fclose($f);
}
echo json_encode(['ok'=>true,'items'=>$out], JSON_UNESCAPED_UNICODE);
