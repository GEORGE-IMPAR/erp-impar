<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
try{
  $dirDocs = __DIR__ . DIRECTORY_SEPARATOR . 'docs';
  if(!is_dir($dirDocs)) { echo json_encode(['rows'=>[]]); exit; }
  $rows = [];
  foreach (glob($dirDocs . DIRECTORY_SEPARATOR . '*.json') as $jfile){
    $j = json_decode(file_get_contents($jfile), true);
    if(!$j) continue;
    $rows[] = [
      'codigo' => $j['codigo'] ?? basename($jfile, '.json'),
      'contratante_nome' => $j['contratante']['razao'] ?? '',
      'pdf_file' => $j['arquivo_pdf'] ?? ''
    ];
  }
  echo json_encode(['rows'=>$rows]);
}catch(Exception $e){
  http_response_code(400);
  echo json_encode(['rows'=>[], 'error'=>$e->getMessage()]);
}
