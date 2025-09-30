<?php
// CORS básico e preflight
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
$allowed = ['https://erpimpar.com.br', 'https://erpmpar.com.br', 'https://www.erpimpar.com.br'];
if (in_array($origin, $allowed)) {
  header('Access-Control-Allow-Origin: ' . $origin);
} else {
  header('Access-Control-Allow-Origin: https://erpimpar.com.br');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json; charset=utf-8');

// ====== CONFIG ======
$API_TOKEN = 'SEU_TOKEN_AQUI'; // MESMO TOKEN usado no front/patch

// pastas
$BASE = __DIR__ . '/../storage';
$DIR_DATA = $BASE . '/data';
$DIR_DOCS = $BASE . '/docs';
$CSV = $DIR_DATA . '/contratos.csv';

// ====== TOKEN ======
$token = isset($_GET['token']) ? $_GET['token'] : '';
if (!$token || $token !== $API_TOKEN) {
  http_response_code(401);
  echo json_encode(['ok'=>false, 'error'=>'unauthorized']);
  exit;
}

// ====== PARÂMETRO OPCIONAL ======
$filtroCodigo = isset($_GET['codigo']) ? trim($_GET['codigo']) : '';

// ====== GARANTE PASTAS ======
if (!is_dir($DIR_DATA)) @mkdir($DIR_DATA, 0777, true);
if (!is_dir($DIR_DOCS)) @mkdir($DIR_DOCS, 0777, true);

// ====== SE CSV NÃO EXISTE, RESPONDE VAZIO ======
if (!file_exists($CSV)) {
  echo json_encode(['ok'=>true, 'rows'=>[]]);
  exit;
}

// ====== LÊ CSV ======
// Cabeçalho esperado:
// saved_at;codigo;servico;enderecoObra;valor;valorExtenso;prazo;dataExtenso;contratante_nome;contratante_doc;contratada_nome;contratada_doc;clausulas;condicoes;pdf
$fh = fopen($CSV, 'r');
$header = fgetcsv($fh, 0, ';');
$rows = [];
while (($r = fgetcsv($fh, 0, ';')) !== false) {
  if (!count($r)) continue;
  $linha = array_combine($header, array_pad($r, count($header), ''));
  if (!$linha) continue;
  if ($filtroCodigo && strcasecmp($linha['codigo'], $filtroCodigo) !== 0) continue;

  // monta nome do PDF (compatível com pdf.php?f=)
  $pdf_file = trim($linha['pdf']);
  $rows[] = [
    'codigo'            => $linha['codigo'],
    'contratante_nome'  => $linha['contratante_nome'],
    'pdf_file'          => $pdf_file,
  ];
}
fclose($fh);

echo json_encode(['ok'=>true, 'rows'=>$rows]);

