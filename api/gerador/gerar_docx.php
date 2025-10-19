<?php
// /api/gerador/gerar_docx.php  (v2 - normaliza tokens quebrados e com espaços)
declare(strict_types=1);
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function clean($v) {
  if (is_null($v)) return '';
  if (is_bool($v)) return $v ? '1' : '0';
  return is_string($v) ? trim($v) : (string)$v;
}
function xml_entities($str) {
  return str_replace(['&','<','>'], ['&amp;','&lt;','&gt;'], $str);
}
function wml_text($str, $multiline=false) {
  $s = xml_entities(clean($str));
  if ($multiline) {
    $s = str_replace(["\r\n","\r"], "\n", $s);
    $s = str_replace("\n", '</w:t><w:br/><w:t>', $s);
  }
  return $s;
}

// Lê payload
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($contentType, 'application/json') !== false) {
  $input = file_get_contents('php://input');
  $data = json_decode($input, true) ?: [];
} else {
  $data = $_POST ?: [];
}

// Placeholders
$vars = [
  'codigo', 'servico', 'endereco_obra',
  'contratante_nome', 'contratante_endereco', 'contratante_doc', 'contratante_contato',
  'contratada_nome', 'contratada_endereco', 'contratada_doc',
  'clausulas', 'prazo_dias',
  'valor', 'valor_extenso', 'condicoes',
  'data_extenso',
  'contratante_CNPJ', 'contratada_CNPJ'
];

$baseDir = __DIR__;
$templateBase = $baseDir . '/templates/';
$persistDir  = $baseDir . '/tmp/' . date('Y-m'); // persistência mensal
if (!is_dir($persistDir)) { @mkdir($persistDir, 0775, true); }

$modelo = basename($data['modelo'] ?? '');
$templateFile = $modelo ? $templateBase . $modelo : $templateBase . 'Template-Contrato.docx';
if (!is_file($templateFile)) {
  http_response_code(404);
  echo json_encode(['ok'=>false,'error'=>'Template não encontrado: '.basename($templateFile)]);
  exit;
}

$codigo   = preg_replace('/[^0-9A-Za-z_\-]/', '_', (string)($data['codigo'] ?? 'DOC'));
$filename = 'CONTRATO_' . $codigo . '.docx';
$outPath  = $persistDir . '/' . $filename;

$multilineFields = ['clausulas','condicoes'];

// Normaliza tokens no XML para a forma canônica <<variavel>>
function normalize_tokens_in_xml($xml, $vars) {
  // 1) Colapsa tokens com espaços: <<  var  >> -> <<var>>
  // 2) Colapsa tokens quebrados em múltiplos <w:t> e outras tags
  foreach ($vars as $v) {
    // Monta regex permitindo tags/espacos entre cada caractere do nome
    $chars = preg_split('//u', $v, -1, PREG_SPLIT_NO_EMPTY);
    $namePattern = '';
    foreach ($chars as $ch) {
      $ch_esc = preg_quote($ch, '/');
      $namePattern .= '(?:\s*|<[^>]+>)*' . $ch_esc;
    }
    $pattern = '/<<(?:\s*|<[^>]+>)*' . $namePattern . '(?:\s*|<[^>]+>)*>>/u';
    $xml = preg_replace($pattern, '<<'.$v.'>>', $xml);
  }
  // Também normaliza quaisquer tokens genéricos com espaços internos: <<  abc_def  >> -> <<abc_def>>
  $xml = preg_replace('/<<\s*([A-Za-z0-9_]+)\s*>>/u', '<<$1>>', $xml);
  return $xml;
}

// ====== Tenta com PhpWord ======
$autoload = $baseDir . '/vendor/autoload.php';
$usedPhpWord = false;
if (is_file($autoload)) {
  try {
    require_once $autoload;
    if (class_exists('PhpOffice\\PhpWord\\TemplateProcessor')) {
      $tp = new PhpOffice\PhpWord\TemplateProcessor($templateFile);
      $ref = new ReflectionClass($tp);
      $prop = $ref->getProperty('tempDocumentMainPart');
      $prop->setAccessible(true);
      $main = $prop->getValue($tp);
      $xml  = (string)$main->getDocumentContent();
      $xml  = str_replace(["\r\n","\r"], "\n", $xml);
      $xml  = normalize_tokens_in_xml($xml, $vars);

      foreach ($vars as $v) {
        $xml = str_replace('<<'.$v.'>>', wml_text($data[$v] ?? '', in_array($v,$multilineFields,true)), $xml);
      }
      $main->setDocumentContent($xml);
      $tp->saveAs($outPath);
      $usedPhpWord = true;
    }
  } catch (\Throwable $e) {
    $usedPhpWord = false;
  }
}

// ====== Fallback ZipArchive ======
if (!$usedPhpWord) {
  $workPath = $persistDir . '/work_' . uniqid('', true) . '.docx';
  if (!copy($templateFile, $workPath)) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'Falha ao preparar arquivo temporário']);
    exit;
  }
  $zip = new ZipArchive();
  if ($zip->open($workPath) !== true) {
    @unlink($workPath);
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'Falha ao abrir DOCX (zip)']);
    exit;
  }
  $xmlPath = 'word/document.xml';
  $xml = $zip->getFromName($xmlPath);
  if ($xml === false) {
    $zip->close(); @unlink($workPath);
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'document.xml não encontrado no DOCX']);
    exit;
  }
  $xml = (string)$xml;
  $xml = str_replace(["\r\n","\r"], "\n", $xml);
  $xml = normalize_tokens_in_xml($xml, $vars);

  foreach ($vars as $v) {
    $val = (string)($data[$v] ?? '');
    $val = htmlspecialchars($val, ENT_XML1|ENT_COMPAT, 'UTF-8');
    if (in_array($v,$multilineFields,true)) {
      $val = str_replace("\n", '</w:t><w:br/><w:t>', $val);
    }
    $xml = str_replace('<<'.$v.'>>', $val, $xml);
  }

  $zip->addFromString($xmlPath, $xml);
  $zip->close();
  @rename($workPath, $outPath);
}

// ====== Download + persistência ======
if (!is_file($outPath)) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'Falha ao gerar arquivo final']);
  exit;
}

header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
header('Content-Disposition: attachment; filename="'.$filename.'"');
header('Content-Length: ' . filesize($outPath));
readfile($outPath);
// Mantém arquivo salvo no servidor
