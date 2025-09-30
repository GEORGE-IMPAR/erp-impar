<?php
// === CORS (deixe só aqui OU no .htaccess, não nos dois!) ====================
$allowed_origin = 'https://www.erpimpar.com.br'; // origem do front em produção
header('Vary: Origin');
header('Access-Control-Allow-Origin: ' . $allowed_origin);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// === Segurança básica (token opcional) =======================================
$TOKEN_OK = true; // coloque aqui uma verificação real, se quiser
if (isset($_GET['token'])) {
  $token = trim($_GET['token']);
  // $TOKEN_OK = hash_equals(getenv('GERADOR_TOKEN') ?: 'seu_token', $token);
}
if (!$TOKEN_OK) {
  http_response_code(401);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['ok'=>false,'error'=>'unauthorized']);
  exit;
}

header('Content-Type: application/json; charset=utf-8');

// === Origem dos dados ========================================================
// 1) Se você usa CSV:  storage/data/contratos.csv
// 2) Se você salva 1 JSON por código em storage/docs/*.json
$base = __DIR__ . '/../storage';
$csv  = $base . '/data/contratos.csv';
$docs = $base . '/docs';

// filtro
$filtroCodigo = isset($_GET['codigo']) ? trim($_GET['codigo']) : '';

// helper
function normaliza($s){ return is_string($s) ? trim($s) : $s; }

$rows = [];

// Preferência: CSV
if (is_file($csv)) {
  if (($h = fopen($csv, 'r')) !== false) {
    // cabeçalhos esperados no CSV:
    // saved_at;codigo;servico;enderecoObra;valor;valorExtenso;prazo;dataExtenso;
    // contratante_nome;contratante_doc;contratada_nome;contratada_doc;clausulas;condicoes;pdf
    $header = fgetcsv($h, 0, ';');
    while (($r = fgetcsv($h, 0, ';')) !== false) {
      $o = array_combine($header, $r);
      if (!$o) continue;
      $o = array_map('normaliza', $o);
      if ($filtroCodigo && strcasecmp($o['codigo'] ?? '', $filtroCodigo) !== 0) continue;

      $rows[] = [
        'codigo'            => $o['codigo'] ?? '',
        'contratante_nome'  => $o['contratante_nome'] ?? '',
        'file'              => basename($o['pdf'] ?? ''), // pode vir nome do PDF
        'pdf_file'          => basename($o['pdf'] ?? ''),
        'servico'           => $o['servico'] ?? '',
        'created_at'        => $o['saved_at'] ?? '',
      ];
    }
    fclose($h);
  }
}

// Se não achou no CSV, tenta JSONs em /docs
if (!$rows && is_dir($docs)) {
  foreach (glob($docs . '/*.json') as $jpath) {
    $data = json_decode(file_get_contents($jpath), true);
    if (!$data) continue;
    if ($filtroCodigo && strcasecmp($data['codigo'] ?? '', $filtroCodigo) !== 0) continue;

    $rows[] = [
      'codigo'           => $data['codigo'] ?? '',
      'contratante_nome' => $data['contratante']['nome'] ?? ($data['contratante_nome'] ?? ''),
      'file'             => basename($data['arquivo_pdf'] ?? ($data['file'] ?? '')),
      'pdf_file'         => basename($data['arquivo_pdf'] ?? ($data['file'] ?? '')),
      'servico'          => $data['servico'] ?? '',
      'created_at'       => $data['criado_em'] ?? '',
    ];
  }
}

echo json_encode(['ok'=>true, 'rows'=>$rows], JSON_UNESCAPED_UNICODE);
