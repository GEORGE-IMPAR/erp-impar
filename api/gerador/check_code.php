<?php
// /api/gerador/check_code.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
  $codigo = isset($_GET['codigo']) ? $_GET['codigo'] : '';
  $codigo = preg_replace('/[^a-zA-Z0-9-_]/', '_', $codigo);
  if (!$codigo) throw new Exception('Código não informado.');

  // procura JSON salvo do documento
  $dirDocs = __DIR__ . DIRECTORY_SEPARATOR . 'docs';
  if (!is_dir($dirDocs)) mkdir($dirDocs, 0777, true);
  $jsonPath = $dirDocs . DIRECTORY_SEPARATOR . $codigo . '.json';

  $exists = file_exists($jsonPath);
  $row = null; $pdf = null;

  if ($exists) {
    $row = @json_decode(@file_get_contents($jsonPath), true) ?: null;
    $pdf = $row['arquivo_pdf'] ?? null;
  }

  echo json_encode([
    'exists' => $exists,
    'row'    => $row,
    'file'   => $pdf
  ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
  http_response_code(400);
  echo json_encode(['exists'=>false, 'error'=>$e->getMessage()]);
}

