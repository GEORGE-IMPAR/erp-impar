<?php
require_once __DIR__.'/common.php';
ensure_dirs();

$codigo = isset($_GET['codigo']) ? preg_replace('/[^a-zA-Z0-9\-_]/','_', $_GET['codigo']) : '';
if (!$codigo) { header('Content-Type: application/json'); echo json_encode(['exists'=>false,'error'=>'codigo vazio']); exit; }

$exists = file_exists(DOCS_DIR . '/' . $codigo . '.json');
if (!$exists) {
  // fallback no CSV
  if (($fh = @fopen(CSV_FILE, 'r')) !== false) {
    $header = fgetcsv($fh);
    while (($r = fgetcsv($fh)) !== false) {
      $row = @array_combine($header, $r);
      if ($row && isset($row['codigo']) && $row['codigo'] === $codigo) { $exists = true; break; }
    }
    fclose($fh);
  }
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['exists'=>$exists], JSON_UNESCAPED_UNICODE);
