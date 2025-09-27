<?php
// api/gerador/common.php
require __DIR__ . '/config.php';

function respond($arr, $code=200){
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

function check_auth(){
  $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  $token = null;
  if (preg_match('/Bearer\s+(.*)$/i', $auth, $m)) $token = trim($m[1]);
  if (!$token && isset($_POST['token'])) $token = $_POST['token'];
  if (!$token && isset($_GET['token'])) $token = $_GET['token'];
  if ($token !== API_TOKEN) respond(['ok'=>false,'error'=>'unauthorized'],401);
}

function ensure_storage(){
  foreach ([PDF_DIR, dirname(CSV_FILE), JSONL_DIR] as $dir){
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    if (!is_dir($dir)) respond(['ok'=>false,'error'=>'storage_not_writable','dir'=>$dir],500);
  }
  if (!file_exists(CSV_FILE)){
    $f = fopen(CSV_FILE, 'w');
    fputcsv($f, $GLOBALS['CSV_HEADERS']);
    fclose($f);
  }
}
