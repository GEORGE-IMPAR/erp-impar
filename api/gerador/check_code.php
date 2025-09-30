<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
  $codigo = isset($_GET['codigo']) ? $_GET['codigo'] : '';
  $codigo = preg_replace('/[^a-zA-Z0-9-_]/', '_', $codigo);
  if (!$codigo) throw new Exception('Código não informado.');

  $dirDocs = __DIR__ . DIRECTORY_SEPARATOR . 'docs';
  if (!is_dir($dirDocs)) mkdir($dirDocs, 0777, true);

  $exists = file_exists($dirDocs . DIRECTORY_SEPARATOR . $codigo . '.json');
  echo json_encode(['exists'=>$exists]);
} catch (Exception $e) {
  http_response_code(400);
  echo json_encode(['exists'=>false, 'error'=>$e->getMessage()]);
}
