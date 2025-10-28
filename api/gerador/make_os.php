<?php
// make_os.php — Gera uma Ordem de Serviço (.docx) a partir de um template com placeholders iniciados por #
// RISCO ZERO: cópia idêntica do make_contract.php, apenas ajustando nomes e rótulos

require_once __DIR__ . '/vendor/autoload.php'; 

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

use PhpOffice\PhpWord\TemplateProcessor;

header('Content-Type: application/json; charset=utf-8');

// ====================== CONFIG ======================
$TEMPLATE = __DIR__ . '/templates/Template_OS.docx';
$SAVE_DIR = realpath(__DIR__ . '/../storage/docs');
$JSON_API = __DIR__ . '/json_table_cors.php';
$TOKEN    = '8ce29ab4b2d531b0eca93b9cfc4538042a6b9f3a8882e543cbad73663b77';

// ====================== INPUT ======================
$codigo = isset($_GET['codigo']) ? trim($_GET['codigo']) : '';
if ($codigo === '') {
  http_response_code(400);
  echo json_encode(['ok'=>false,'msg'=>'Parâmetro "codigo" é obrigatório']);
  exit;
}

// Log próprio
file_put_contents(__DIR__.'/log_make_os.txt', "Start code={$codigo} ".date('Y-m-d H:i:s')."\n", FILE_APPEND);

// ====================== BUSCA DADOS NO JSON EXISTENTE ======================
$_GET = ['op'=>'get','codigo'=>$codigo,'token'=>$TOKEN];
ob_start();
include $JSON_API; // imprime JSON do seu endpoint
$json = ob_get_clean();
$data = @json_decode($json, true);
if (!$data || empty($data['ok']) || empty($data['item'])) {
  http_response_code(404);
  echo json_encode(['ok'=>false,'msg'=>'Registro não encontrado para o código informado']);
  exit;
}
$item = $data['item'];

// ====================== MAPEAMENTO DE PLACEHOLDERS ======================
$replacements = [];
foreach ($item as $k => $v) {
  $replacements['#'.$k] = is_scalar($v) ? (string)$v : '';
}

// Campo dataExtenso
if (!isset($replacements['#dataExtenso'])) {
  setlocale(LC_ALL, 'pt_BR.UTF-8', 'pt_BR', 'Portuguese_Brazil');
  $meses = [1=>'janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  $d = new DateTime();
  $replacements['#dataExtenso'] = $d->format('d') . ' de ' . $meses[(int)$d->format('n')] . ' de ' . $d->format('Y');
}

// ====================== VALIDAÇÃO DE AMBIENTE ======================
if (!file_exists($TEMPLATE)) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'msg'=>'Template não encontrado']);
  exit;
}
if ($SAVE_DIR === false || !is_dir($SAVE_DIR) || !is_writable($SAVE_DIR)) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'msg'=>'Diretório de saída inválido ou sem permissão de escrita']);
  exit;
}

// ====================== PROCESSA O .DOCX ======================
$tmpBase = sys_get_temp_dir() . '/docx_' . uniqid();
if (!@mkdir($tmpBase, 0700, true)) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'msg'=>'Falha ao criar diretório temporário']);
  exit;
}
$workDocx = $tmpBase . '/work.docx';
if (!@copy($TEMPLATE, $workDocx)) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'msg'=>'Falha ao preparar template']);
  @rmdir($tmpBase);
  exit;
}

$zip = new ZipArchive();
if ($zip->open($workDocx) !== true) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'msg'=>'Falha abrindo o template como ZIP']);
  @unlink($workDocx);
  @rmdir($tmpBase);
  exit;
}

// Substitui placeholders
$xmlPath = 'word/document.xml';
$xml = $zip->getFromName($xmlPath);
if ($xml === false) {
  $zip->close();
  http_response_code(500);
  echo json_encode(['ok'=>false,'msg'=>'document.xml não encontrado no template']);
  exit;
}

$replaced = $xml;
foreach ($replacements as $needle => $value) {
  $value = htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
  $replaced = str_replace($needle, $value, $replaced);
}

$zip->addFromString($xmlPath, $replaced);
$zip->close();

// ====================== GRAVA SAÍDA ======================
$nomeContratante = isset($item['nomeContratante']) ? $item['nomeContratante'] : 'CLIENTE';
$nomeSeguro = preg_replace('/[^\w\-\.\s]+/u', '', $nomeContratante);
$codigo = strtoupper(trim($codigo));

$finalName = 'OS_' . $codigo . '_' . $nomeSeguro . '.docx';
$finalPath = $SAVE_DIR . DIRECTORY_SEPARATOR . $finalName;
@copy($workDocx, $finalPath);

// URL pública
$publicUrl = '/api/storage/docs/' . rawurlencode($finalName);
echo json_encode(['ok'=>true,'file'=>$finalName,'url'=>$publicUrl]);
