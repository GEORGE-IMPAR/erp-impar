<?php
// api/gerador/save.php  — recebe PDF + JSON e grava em CSV + JSONL
header('Access-Control-Allow-Origin: https://www.erpimpar.com.br');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require __DIR__ . '/common.php';
check_auth();
ensure_storage();

if (!isset($_FILES['pdf']) || $_FILES['pdf']['error']!==UPLOAD_ERR_OK) {
  respond(['ok'=>false,'error'=>'pdf_missing_or_error'],400);
}

$dados = json_decode($_POST['dados'] ?? '{}', true);
if (!is_array($dados)) $dados = [];

// Nome do PDF
$codigo = preg_replace('/[^A-Za-z0-9_\-]/','_', $dados['codigo'] ?? 'DOC');
$ymd = date('Ymd');
$basename = ($codigo?:'DOC') . '_' . $ymd . '.pdf';
$target = PDF_DIR . '/' . $basename;

// Move PDF
if (!move_uploaded_file($_FILES['pdf']['tmp_name'], $target)) {
  if (!@copy($_FILES['pdf']['tmp_name'], $target)) {
    respond(['ok'=>false,'error'=>'move_failed'],500);
  }
}
@chmod($target, 0644);

$pdfUrl = rtrim(PDF_BASE_URL,'/') . '/' . $basename;

// Extrai campos
$ctt = $dados['contratante'] ?? [];
$cta = $dados['contratada'] ?? [];
$op  = $dados['operador'] ?? [];
$ip  = $_SERVER['REMOTE_ADDR'] ?? '';
$ua  = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Normaliza textos longos (mantém CSV em uma linha)
$clausulas = isset($dados['clausulas']) ? preg_replace('/\s+/', ' ', (string)$dados['clausulas']) : '';
$condicoes = isset($dados['condicoes']) ? preg_replace('/\s+/', ' ', (string)$dados['condicoes']) : '';

// Linha CSV
$row = [
  date('Y-m-d H:i:s'),
  $dados['codigo'] ?? '',
  $dados['servico'] ?? '',
  $dados['enderecoObra'] ?? '',
  $ctt['nome'] ?? '', $ctt['cpfCnpj'] ?? '', $ctt['endereco'] ?? '', $ctt['contato'] ?? '', $ctt['telefone'] ?? '', $ctt['email'] ?? '',
  $cta['nome'] ?? '', $cta['cpfCnpj'] ?? '', $cta['endereco'] ?? '', $cta['contato'] ?? '', $cta['telefone'] ?? '', $cta['email'] ?? '',
  $dados['valor'] ?? '', $dados['valorExtenso'] ?? '', $dados['prazo'] ?? '', $dados['dataExtenso'] ?? '',
  /* ▼ NOVAS COLUNAS ▼ */
  $clausulas, $condicoes,
  /* ▲ NOVAS COLUNAS ▲ */
  $op['nome'] ?? '', $op['email'] ?? '',
  $basename, $pdfUrl, $ip, $ua
];

// Grava CSV
$f = fopen(CSV_FILE, 'a');
fputcsv($f, $row);
fclose($f);

// Grava JSONL (um por dia)
$fn = JSONL_DIR . '/' . $ymd . '.jsonl';
file_put_contents(
  $fn,
  json_encode(['row'=>$row,'dados'=>$dados,'pdf'=>$basename,'url'=>$pdfUrl], JSON_UNESCAPED_UNICODE) . "\n",
  FILE_APPEND
);

respond(['ok'=>true,'pdfUrl'=>$pdfUrl,'file'=>$basename]);
