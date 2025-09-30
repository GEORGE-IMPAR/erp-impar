<?php
// api/gerador/get_doc.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
  $codigo = isset($_GET['codigo']) ? $_GET['codigo'] : '';
  $codigo = preg_replace('/[^a-zA-Z0-9-_]/', '_', $codigo);
  if ($codigo === '') throw new Exception('Código não informado.');

  $dirDocs = realpath(__DIR__ . '/../../storage/docs');
  if ($dirDocs === false) $dirDocs = __DIR__ . '/../../storage/docs';

  $metaPath = $dirDocs . DIRECTORY_SEPARATOR . $codigo . '.json';
  if (!file_exists($metaPath)) throw new Exception('Documento não encontrado.');

  $raw = file_get_contents($metaPath);
  $dados = json_decode($raw, true);
  if (!is_array($dados)) throw new Exception('JSON inválido.');

  echo json_encode(['success'=>true, 'dados'=>$dados]);
} catch (Exception $e) {
  http_response_code(404);
  echo json_encode(['success'=>false, 'error'=>$e->getMessage()]);
}
