<?php
// make_contract.php — Gera um .docx a partir de um template com placeholders iniciados por #
// RISCO ZERO: arquivo novo; não altera rotinas existentes.
// Uso: /api/gerador/make_contract.php?codigo=AC05225
// Saída: {"ok":true,"file":"CONTRATO_AC05225_Cliente X.docx","url":"/api/storage/docs/CONTRATO_AC05225_Cliente X.docx"}

require_once __DIR__ . '/vendor/autoload.php';

use PhpOffice\PhpWord\TemplateProcessor;

header('Content-Type: application/json; charset=utf-8');

// ====================== CONFIG ======================
// Caminho absoluto para o template .docx
$TEMPLATE = __DIR__ . '/templates/Template-Contrato.docx';
// Pasta de destino (mesma do Excel)
$SAVE_DIR = realpath(__DIR__ . '/../storage/docs');
// Endpoint já existente de JSON (usado para buscar os dados do código)
$JSON_API = __DIR__ . '/json_table_cors.php';
// Mesmo token que você já usa no sistema
$TOKEN    = '8ce29ab4b2d531b0eca93b9cfc4538042a6b9f3a8882e543cbad73663b77';

// ====================== INPUT ======================
$codigo = isset($_GET['codigo']) ? trim($_GET['codigo']) : '';
if ($codigo === '') {
  http_response_code(400);
  echo json_encode(['ok'=>false,'msg'=>'Parâmetro "codigo" é obrigatório']);
  exit;
}

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
// Para cada campo do JSON, criamos um placeholder com #nomeCampo
$replacements = [];
foreach ($item as $k => $v) {
  $replacements['#'.$k] = is_scalar($v) ? (string)$v : '';
}

// Campo derivado útil: data por extenso (se o template usar #dataExtenso)
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

// ====================== PROCESSA O .DOCX (ZIP) ======================
// Copia template para área temporária
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

// Abre o zip
$zip = new ZipArchive();
if ($zip->open($workDocx) !== true) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'msg'=>'Falha abrindo o template como ZIP']);
  @unlink($workDocx);
  @rmdir($tmpBase);
  exit;
}

// Lê o XML principal do documento
$xmlPath = 'word/document.xml';
$xml = $zip->getFromName($xmlPath);
if ($xml === false) {
  $zip->close();
  http_response_code(500);
  echo json_encode(['ok'=>false,'msg'=>'document.xml não encontrado no template']);
  @unlink($workDocx);
  @rmdir($tmpBase);
  exit;
}

// Substitui os placeholders por valores escapados para XML
$replaced = $xml;
foreach ($replacements as $needle => $value) {
  $value = htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
  $replaced = str_replace($needle, $value, $replaced);
}

// Atualiza o XML no ZIP e fecha
$zip->addFromString($xmlPath, $replaced);
$zip->close();

// ====================== GRAVA SAÍDA ======================
$nomeContratante = isset($item['nomeContratante']) ? $item['nomeContratante'] : 'CONTRATANTE';
$nomeSeguro = preg_replace('/[^\w\-\.\s]+/u', '', $nomeContratante);
$finalName = 'CONTRATO_' . $codigo . '_' . $nomeSeguro . '.docx';
$finalPath = $SAVE_DIR . DIRECTORY_SEPARATOR . $finalName;

if (!@copy($workDocx, $finalPath)) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'msg'=>'Falha ao salvar o arquivo final']);
  @unlink($workDocx);
  @rmdir($tmpBase);
  exit;
}

// Limpa temporários
@unlink($workDocx);
@rmdir($tmpBase);

// URL pública para download (ajuste se seu prefixo for diferente)
$publicUrl = '/api/storage/docs/' . rawurlencode($finalName);

echo json_encode(['ok'=>true,'file'=>$finalName,'url'=>$publicUrl]);
