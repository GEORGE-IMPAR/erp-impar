<?php
header('Access-Control-Allow-Origin: *');
$fname = isset($_GET['f']) ? basename($_GET['f']) : '';
$path = __DIR__ . DIRECTORY_SEPARATOR . 'docs' . DIRECTORY_SEPARATOR . $fname;
if(!$fname || !preg_match('/\.pdf$/i', $fname) || !file_exists($path)){
  http_response_code(404);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'Arquivo não encontrado';
  exit;
}
header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="'. $fname .'"');
header('Content-Length: ' . filesize($path));
readfile($path);
