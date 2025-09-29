<?php
// /www/api/gerador/pdf.php
// Serve PDFs salvos em /www/storage/docs

// Sobe 2 níveis a partir de /www/api/gerador -> /www, e aponta para /storage/docs
$base = realpath(dirname(__DIR__, 2) . '/storage/docs');

if (!$base) {
  http_response_code(500);
  echo 'Base path not found';
  exit;
}

$fname = basename($_GET['f'] ?? '');
$path  = $fname ? realpath($base . '/' . $fname) : false;

// segurança + existência
if (!$fname || !$path || strpos($path, $base) !== 0 || !is_file($path)) {
  http_response_code(404);
  echo 'File not found.';
  exit;
}

$download = isset($_GET['dl']); // use ?dl=1 para forçar download

header('Content-Type: application/pdf');
header('Content-Length: ' . filesize($path));
header('Content-Disposition: ' . ($download ? 'attachment' : 'inline') . '; filename="' . $fname . '"');

readfile($path);
exit;
