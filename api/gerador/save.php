<?php
/**
 * save.php — ERP Ímpar (KingHost)
 * - Impede código duplicado (chave do sistema)
 * - Salva PDF e JSON em /storage/docs
 * - Opcionalmente salva LOGO em /storage/docs/logos
 * - Acrescenta linha no CSV /storage/data/contratos.csv
 * - Retorno padronizado: { ok, pdfUrl, file } | { ok:false, code_exists } | { ok:false, error }
 */

header('Content-Type: application/json; charset=utf-8');
// Libere CORS se necessário (frente hospedada em outro subdomínio)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

/* =========================
   CONFIGURAÇÕES RÁPIDAS
   ========================= */
$TOKEN = 'TROQUE_AQUI_PELO_TOKEN_DO_PATCH'; // <<< coloque o mesmo SAVE_TOKEN usado no JS

// Descobre caminhos baseado em /api/gerador/save.php
$ROOT     = realpath(__DIR__ . '/../../');          // raiz do site
$STORAGE  = $ROOT . '/storage';
$DIR_DATA = $STORAGE . '/data';
$DIR_DOCS = $STORAGE . '/docs';
$DIR_LOGS = $STORAGE . '/logs';
$DIR_LOGOS = $DIR_DOCS . '/logos';

// URL pública p/ montar o link do PDF (ajuste o domínio se necessário)
$PUBLIC_BASE = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') .
               ($_SERVER['HTTP_HOST'] ?? 'localhost');
$PDF_PUBLIC_BASE = $PUBLIC_BASE . '/storage/docs/';

// Garante diretórios
@mkdir($DIR_DATA, 0775, true);
@mkdir($DIR_DOCS, 0775, true);
@mkdir($DIR_LOGS, 0775, true);
@mkdir($DIR_LOGOS, 0775, true);

// Arquivo CSV
$CSV_PATH   = $DIR_DATA . '/contratos.csv';
$CSV_HEADER = 'saved_at;codigo;servico;enderecoObra;valor;valorExtenso;prazo;dataExtenso;contratante_nome;contratante_doc;contratada_nome;contratada_doc;clausulas;condicoes;pdf' . PHP_EOL;

/* =========================
   HELPERS
   ========================= */
function jexit($arr, $status = 200) {
  http_response_code($status);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}
function log_err($msg) {
  global $DIR_LOGS;
  @file_put_contents($DIR_LOGS . '/save.log', '['.date('c')."] ".$msg.PHP_EOL, FILE_APPEND);
}
function bearer_token() {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if (!$h) return null;
  if (stripos($h, 'Bearer ') === 0) return trim(substr($h, 7));
  return null;
}
function sanitize_filename($name) {
  $name = preg_replace('/[^a-zA-Z0-9\.\-_]/', '_', $name);
  return trim($name, '_');
}
function normalize_codigo($v) {
  $v = trim($v ?? '');
  $v = preg_replace('/[^a-zA-Z0-9\-_]/', '_', $v);
  return strtoupper($v);
}
function csv_has_code($csvPath, $codigo, &$lastFile = null) {
  $lastFile = null;
  if (!is_file($csvPath)) return false;
  $h = fopen($csvPath, 'r');
  if (!$h) return false;
  while (($line = fgets($h)) !== false) {
    $line = trim($line);
    if ($line === '' || str_starts_with($line, 'saved_at;')) continue;
    $cols = explode(';', $line);
    if (count($cols) >= 15) {
      // colunas: 0:saved_at 1:codigo ... 14:pdf
      if (strtoupper($cols[1]) === strtoupper($codigo)) {
        $lastFile = $cols[14] ?? null;
        fclose($h);
        return true;
      }
    }
  }
  fclose($h);
  return false;
}
function csv_append_line($csvPath, $header, array $cols) {
  if (!file_exists($csvPath)) {
    file_put_contents($csvPath, $header);
  }
  // sanitiza ; \r \n para não quebrar o CSV
  $cols = array_map(function($v){
    $v = (string)$v;
    $v = str_replace(["\r","\n",";"], [' ',' ',' '], $v);
    return $v;
  }, $cols);
  file_put_contents($csvPath, implode(';', $cols) . PHP_EOL, FILE_APPEND);
}

/* =========================
   AUTENTICAÇÃO (TOKEN)
   ========================= */
$tok = $_POST['token'] ?? bearer_token();
if (!$TOKEN || $tok !== $TOKEN) {
  jexit(['ok'=>false, 'error'=>'unauthorized'], 401);
}

/* =========================
   ENTRADA (FormData)
   - pdf: File (obrigatório)
   - dados: JSON (obrigatório)
   - logo: File (opcional)
   ========================= */
if (empty($_FILES['pdf']['tmp_name'])) {
  jexit(['ok'=>false, 'error'=>'PDF não enviado (campo "pdf").'], 400);
}
$dadosJson = $_POST['dados'] ?? null;
if (!$dadosJson && !empty($_FILES['dados']['tmp_name'])) {
  $dadosJson = file_get_contents($_FILES['dados']['tmp_name']);
}
if (!$dadosJson) {
  jexit(['ok'=>false, 'error'=>'JSON não enviado (campo "dados").'], 400);
}
$dados = json_decode($dadosJson, true);
if (!is_array($dados)) {
  jexit(['ok'=>false, 'error'=>'JSON inválido em "dados".'], 400);
}

/* =========================
   MAPA DE CAMPOS (tolerante)
   ========================= */
$codigo         = normalize_codigo($dados['codigo'] ?? '');
$servico        = $dados['servico']        ?? '';
$enderecoObra   = $dados['enderecoObra']   ?? ($dados['endereco'] ?? '');
$valor          = $dados['valor']          ?? '';
$valorExtenso   = $dados['valorExtenso']   ?? '';
$prazo          = $dados['prazo']          ?? '';
$dataExtenso    = $dados['dataExtenso']    ?? '';
$clausulas      = $dados['clausulas']      ?? '';
$condicoes      = $dados['condicoes']      ?? ($dados['condicoesPagamento'] ?? '');

$contratante    = $dados['contratante']    ?? [];
$contratada     = $dados['contratada']     ?? [];

$contratante_nome = $contratante['nome'] ?? $contratante['razao'] ?? '';
$contratante_doc  = $contratante['cpfCnpj'] ?? $contratante['cnpj'] ?? $contratante['cpf'] ?? '';
$contratada_nome  = $contratada['nome'] ?? $contratada['razao'] ?? '';
$contratada_doc   = $contratada['cpfCnpj'] ?? $contratada['cnpj'] ?? $contratada['cpf'] ?? '';

if (!$codigo) {
  jexit(['ok'=>false, 'error'=>'Código não informado.'], 400);
}

/* =========================
   DUPLICIDADE (chave do sistema)
   ========================= */
$existingFile = null;
if (csv_has_code($CSV_PATH, $codigo, $existingFile)) {
  $url = $existingFile ? ($PDF_PUBLIC_BASE . sanitize_filename($existingFile)) : null;
  jexit(['ok'=>false, 'code_exists'=>true, 'file'=>$existingFile, 'pdfUrl'=>$url], 200);
}

/* =========================
   SALVA PDF
   ========================= */
$stamp   = date('YmdHis');
$pdfName = sanitize_filename($codigo . '_' . $stamp . '.pdf');
$pdfPath = $DIR_DOCS . '/' . $pdfName;

if (!move_uploaded_file($_FILES['pdf']['tmp_name'], $pdfPath)) {
  log_err('Falha ao mover PDF para ' . $pdfPath);
  jexit(['ok'=>false, 'error'=>'Falha ao salvar o PDF.'], 500);
}

/* =========================
   SALVA LOGO (opcional)
   ========================= */
$logoName = null;
if (!empty($_FILES['logo']['tmp_name'])) {
  $logoName = sanitize_filename($codigo . '__' . ($_FILES['logo']['name'] ?? 'logo'));
  $logoPath = $DIR_LOGOS . '/' . $logoName;
  if (!move_uploaded_file($_FILES['logo']['tmp_name'], $logoPath)) {
    // Não é crítico — apenas registra log
    log_err('Falha ao salvar LOGO: ' . $logoPath);
    $logoName = null;
  }
}

/* =========================
   SALVA JSON DE METADADOS
   ========================= */
$meta = [
  'codigo'            => $codigo,
  'servico'           => $servico,
  'enderecoObra'      => $enderecoObra,
  'valor'             => $valor,
  'valorExtenso'      => $valorExtenso,
  'prazo'             => $prazo,
  'dataExtenso'       => $dataExtenso,
  'contratante_nome'  => $contratante_nome,
  'contratante_doc'   => $contratante_doc,
  'contratada_nome'   => $contratada_nome,
  'contratada_doc'    => $contratada_doc,
  'clausulas'         => $clausulas,
  'condicoes'         => $condicoes,
  'pdf'               => $pdfName,
  'logo'              => $logoName,
  'criado_em'         => date('c')
];
file_put_contents($DIR_DOCS . '/' . $codigo . '.json', json_encode($meta, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));

/* =========================
   ESCREVE CSV (com cabeçalho)
   ========================= */
if (!file_exists($CSV_PATH)) {
  file_put_contents($CSV_PATH, $CSV_HEADER);
}
csv_append_line($CSV_PATH, $CSV_HEADER, [
  date('c'),
  $codigo,
  $servico,
  $enderecoObra,
  $valor,
  $valorExtenso,
  $prazo,
  $dataExtenso,
  $contratante_nome,
  $contratante_doc,
  $contratada_nome,
  $contratada_doc,
  $clausulas,
  $condicoes,
  $pdfName
]);

/* =========================
   RESPOSTA
   ========================= */
jexit([
  'ok'     => true,
  'file'   => $pdfName,
  'pdfUrl' => $PDF_PUBLIC_BASE . $pdfName
], 200);
