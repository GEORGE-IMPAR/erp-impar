<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
  $codigo = isset($_GET['codigo']) ? $_GET['codigo'] : '';
  $codigo = preg_replace('/[^a-zA-Z0-9-_]/', '_', $codigo);
  if (!$codigo) throw new Exception('Código não informado.');

  $raiz = dirname(__DIR__, 2);
  $meta = $raiz . '/storage/docs/' . $codigo . '.json';
  if (!file_exists($meta)) {
    http_response_code(404);
    echo json_encode(['ok'=>false,'error'=>'Documento não encontrado.']);
    exit;
  }

  $dados = json_decode(file_get_contents($meta), true);
  if (!$dados) $dados = [];

  echo json_encode(['ok'=>true,'doc'=>$dados]);
} catch (Exception $e) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);
}
