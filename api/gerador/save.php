<?php

// === PATCH MINIMO: aceitar XLSX sem afetar o fluxo atual de PDF ===
// Este bloco detecta upload de Excel e salva com extensão .xlsx no mesmo diretório.
// Se não for Excel, o script continua normalmente (fluxo original de PDF).
try {
    $nomeArquivoReq = isset($_POST['nome_arquivo']) ? trim($_POST['nome_arquivo']) : '';
    $opReq          = isset($_POST['op']) ? trim($_POST['op']) : '';
    $forcarXlsx     = (strcasecmp($opReq, 'upload_excel') === 0) || (preg_match('/\.xlsx$/i', $nomeArquivoReq));

    // Descobrir código e data (tentativas leves sem quebrar o fluxo atual)
    $codigo = isset($_POST['codigo']) ? preg_replace('/[^A-Za-z0-9_\-]/', '_', $_POST['codigo']) : '';
    if (!$codigo) { $codigo = 'DOC'; }
    $ymd = date('Ymd');

    // Detecta arquivo enviado em qualquer chave comum
    $arquivoTmp = null;
    if (isset($_FILES['file']['tmp_name']) && is_uploaded_file($_FILES['file']['tmp_name'])) {
        $arquivoTmp = $_FILES['file']['tmp_name'];
    } elseif (isset($_FILES['pdf']['tmp_name']) && is_uploaded_file($_FILES['pdf']['tmp_name'])) {
        $arquivoTmp = $_FILES['pdf']['tmp_name'];
    } elseif (isset($_FILES['file_excel']['tmp_name']) && is_uploaded_file($_FILES['file_excel']['tmp_name'])) {
        $arquivoTmp = $_FILES['file_excel']['tmp_name'];
    }

    if ($forcarXlsx && $arquivoTmp) {
        // Diretório padrão onde os PDFs já são salvos (ajuste se precisar)
        $baseDir = __DIR__ . '/../storage/docs/';
        if (!is_dir($baseDir)) { @mkdir($baseDir, 0775, true); }
        $destino = $baseDir . $codigo . '_' . $ymd . '.xlsx';
        if (!@move_uploaded_file($arquivoTmp, $destino)) {
            http_response_code(500);
            echo json_encode(['ok'=>false,'error'=>'Falha ao mover XLSX para destino.','dest'=>$destino]);
            exit;
        }
        echo json_encode(['ok'=>true,'ext'=>'xlsx','path'=>$destino]);
        exit;
    }
} catch (\Throwable $___e) {
    // Silencioso: não quebra o fluxo original se algo der errado aqui.
}
/* === FIM DO PATCH MINIMO (XLSX) === */


// CORS seguro para front erpimpar.com.br
$allowed = ['https://erpimpar.com.br', 'https://www.erpimpar.com.br'];
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed, true)) {
  header('Access-Control-Allow-Origin: ' . $origin);
} else {
  header('Access-Control-Allow-Origin: https://www.erpimpar.com.br'); // fallback
}
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require __DIR__ . '/common.php';
check_auth();
ensure_storage();

// Garante cabeçalho do CSV e BOM UTF-8 (para Excel reconhecer acentos)
if (!file_exists(CSV_FILE) || filesize(CSV_FILE) === 0) {
  $h = fopen(CSV_FILE, 'w');
  if ($h) {
    // BOM UTF-8: faz o Excel ler em UTF-8
    fwrite($h, "\xEF\xBB\xBF");
    if (defined('CSV_HEADERS') && is_array(CSV_HEADERS)) {
      fputcsv($h, CSV_HEADERS);
    }
    fclose($h);
    @chmod(CSV_FILE, 0644);
  }
}

// ---- Helpers (não mexem no fluxo) -----------------------------------------
/** Normaliza chaves de um array (remove acentos, minúsculo, [a-z0-9_]) */
function norm_keys(array $a): array {
  $out = [];
  foreach ($a as $k => $v) {
    $kk = iconv('UTF-8', 'ASCII//TRANSLIT', (string)$k);
    $kk = strtolower(preg_replace('/[^a-z0-9_]+/', '', $kk));
    $out[$kk] = $v;
  }
  return $out;
}
/** Espelha condicoes <-> condicoes_pagamento */
function mirror_condicoes(array $d): array {
  if (empty($d['condicoes']) && !empty($d['condicoespagamento'])) {
    $d['condicoes'] = $d['condicoespagamento'];
  }
  if (empty($d['condicoespagamento']) && !empty($d['condicoes'])) {
    $d['condicoespagamento'] = $d['condicoes'];
  }
  return $d;
}

// ---- Entrada ----------------------------------------------------------------
if (!isset($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
  respond(['ok'=>false, 'error'=>'pdf_missing_or_error'], 400);
}

// Lê "dados" de multipart ou JSON bruto (fallback)
$dados = [];
if (isset($_POST['dados'])) {
  $tmp = json_decode($_POST['dados'], true);
  if (is_array($tmp)) $dados = $tmp;
}
if (!$dados) {
  $ct = $_SERVER['CONTENT_TYPE'] ?? '';
  if (stripos($ct, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $tmp = json_decode($raw, true);
    if (is_array($tmp)) $dados = $tmp['dados'] ?? $tmp;
  }
}

// Normalização (tolerante a acentos/nome alternativo)
$dN = norm_keys($dados);
$dN = mirror_condicoes($dN);

// Nome do PDF (aceita tanto "codigo" quanto "código")
$codigoRaw = $dados['codigo'] ?? ($dN['codigo'] ?? 'DOC');
$codigo = preg_replace('/[^A-Za-z0-9_\-]/', '_', (string)$codigoRaw);
$ymd = date('Ymd');
$basename = ($codigo ?: 'DOC') . '_' . $ymd . '.pdf';
$target = PDF_DIR . '/' . $basename;

// Move PDF
if (!move_uploaded_file($_FILES['pdf']['tmp_name'], $target)) {
  if (!@copy($_FILES['pdf']['tmp_name'], $target)) {
    respond(['ok'=>false, 'error'=>'move_failed'], 500);
  }
}
@chmod($target, 0644);

$pdfUrl = rtrim(PDF_BASE_URL, '/') . '/' . $basename;

// Extrai campos (tolerante a nomes com acento)
$ctt = $dados['contratante'] ?? (is_array($dN['contratante'] ?? null) ? $dN['contratante'] : []);
$cta = $dados['contratada'] ?? (is_array($dN['contratada'] ?? null) ? $dN['contratada'] : []);
$op  = $dados['operador']    ?? (is_array($dN['operador']    ?? null) ? $dN['operador']    : []);

// Normaliza também chaves internas
$cttN = is_array($ctt) ? norm_keys($ctt) : [];
$ctaN = is_array($cta) ? norm_keys($cta) : [];
$opN  = is_array($op)  ? norm_keys($op)  : [];

// Campos principais
$servico      = $dados['servico']      ?? ($dN['servico']      ?? '');
$enderecoObra = $dados['enderecoObra'] ?? ($dN['enderecoobra'] ?? '');
$valor        = $dados['valor']        ?? ($dN['valor']        ?? '');
$valorExtenso = $dados['valorExtenso'] ?? ($dN['valorextenso'] ?? '');
$prazo        = $dados['prazo']        ?? ($dN['prazo']        ?? '');
$dataExtenso  = $dados['dataExtenso']  ?? ($dN['dataextenso']  ?? '');

// Contato/empresa (suporta chaves com/sem acento)
$ctt_nome     = $ctt['nome']     ?? ($cttN['nome']     ?? '');
$ctt_doc      = $ctt['cpfCnpj']  ?? ($cttN['cpfcnpj']  ?? '');
$ctt_end      = $ctt['endereco'] ?? ($cttN['endereco'] ?? '');
$ctt_contato  = $ctt['contato']  ?? ($cttN['contato']  ?? '');
$ctt_tel      = $ctt['telefone'] ?? ($cttN['telefone'] ?? '');
$ctt_email    = $ctt['email']    ?? ($cttN['email']    ?? '');

$cta_nome     = $cta['nome']     ?? ($ctaN['nome']     ?? '');
$cta_doc      = $cta['cpfCnpj']  ?? ($ctaN['cpfcnpj']  ?? '');
$cta_end      = $cta['endereco'] ?? ($ctaN['endereco'] ?? '');
$cta_contato  = $cta['contato']  ?? ($ctaN['contato']  ?? '');
$cta_tel      = $cta['telefone'] ?? ($ctaN['telefone'] ?? '');
$cta_email    = $cta['email']    ?? ($ctaN['email']    ?? '');

$op_nome      = $op['nome']      ?? ($opN['nome']      ?? '');
$op_email     = $op['email']     ?? ($opN['email']     ?? '');

// Info de requisição
$ip  = $_SERVER['REMOTE_ADDR']     ?? '';
$ua  = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Linha CSV (mantém cabeçalho original — sem novas colunas)
$row = [
  date('Y-m-d H:i:s'),
  (string)$codigoRaw,
  $servico,
  $enderecoObra,
  $ctt_nome, $ctt_doc, $ctt_end, $ctt_contato, $ctt_tel, $ctt_email,
  $cta_nome, $cta_doc, $cta_end, $cta_contato, $cta_tel, $cta_email,
  $valor, $valorExtenso, $prazo, $dataExtenso,
  $op_nome, $op_email,
  $basename, $pdfUrl, $ip, $ua
];

// Grava CSV (com cabeçalho se não existir)
$needHeader = !file_exists(CSV_FILE) || filesize(CSV_FILE) === 0;
$f = fopen(CSV_FILE, 'a');
if ($needHeader) {
  fputcsv($f, CSV_HEADERS);     // usa o cabeçalho oficial
}
fputcsv($f, $row);
fclose($f);

// Grava CSV
$f = fopen(CSV_FILE, 'a');
fputcsv($f, $row);
fclose($f);

// Grava JSONL (um por dia) – linha única, com lock para evitar “mix”
 $fn = JSONL_DIR . '/' . $ymd . '.jsonl';
 $payload = ['row' => $row, 'dados' => $dados, 'pdf' => $basename, 'url' => $pdfUrl];
 $line = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
 file_put_contents($fn, $line . PHP_EOL, FILE_APPEND | LOCK_EX);

// Resposta limpa
respond(['ok'=>true,'pdfUrl'=>$pdfUrl,'file'=>$basename]);
