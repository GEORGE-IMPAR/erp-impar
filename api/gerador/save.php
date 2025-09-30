<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://erpimpar.com.br');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

/**
 * save.php — ERP Ímpar
 * - Grava PDF em /storage/docs
 * - Grava metadados JSON em /storage/docs/{codigo}.json
 * - Acrescenta/atualiza linha em /storage/data/contratos.csv
 * - Bloqueia duplicidade de código (a menos que venha update=1)
 *
 * CSV: saved_at;codigo;servico;enderecoObra;valor;valorExtenso;prazo;dataExtenso;
 *      contratante_nome;contratante_doc;contratada_nome;contratada_doc;clausulas;condicoes;pdf
 */

try {
  // Pastas
  $root    = dirname(__FILE__, 2);           // /www (raiz do subdomínio)
  $docsDir = $root . '/storage/docs';
  $dataDir = $root . '/storage/data';
  $csvPath = $dataDir . '/contratos.csv';

  if (!is_dir($docsDir)) @mkdir($docsDir, 0775, true);
  if (!is_dir($dataDir)) @mkdir($dataDir, 0775, true);

  // Arquivo PDF obrigatório
  if (!isset($_FILES['pdf'])) throw new Exception('PDF não enviado.');
  $nomePdfOrig = basename($_FILES['pdf']['name']);
  $pdfTmp      = $_FILES['pdf']['tmp_name'];

  // JSON "dados" obrigatório (pode vir como campo normal em multipart)
  if (!isset($_POST['dados'])) throw new Exception('JSON "dados" não enviado.');
  $dados = json_decode($_POST['dados'], true);
  if (!is_array($dados)) throw new Exception('JSON "dados" inválido.');

  // Normalizações
  $codigo = preg_replace('/[^A-Za-z0-9_-]/', '_', $dados['codigo'] ?? '');
  if ($codigo === '') throw new Exception('Código vazio.');

  // Aceita tanto "condicoes" quanto "condicoesPagamento"
  $clausulas = isset($dados['clausulas']) ? (string)$dados['clausulas'] : '';
  $condicoes = '';
  if (isset($dados['condicoes'])) {
    $condicoes = (string)$dados['condicoes'];
  } elseif (isset($dados['condicoesPagamento'])) {
    $condicoes = (string)$dados['condicoesPagamento'];
  }

  // Caminhos de saída
  $jsonPath = $docsDir . '/' . $codigo . '.json';
  $pdfPath  = $docsDir . '/' . $nomePdfOrig;

  // Flag de atualização
  $isUpdate = isset($_POST['update']) && ($_POST['update'] == '1');

  // Bloqueia duplicidade (a menos que seja atualização explícita)
  if (file_exists($jsonPath) && !$isUpdate) {
    echo json_encode(['ok' => false, 'error' => 'Código já cadastrado']);
    exit;
  }

  // Move PDF
  if (!move_uploaded_file($pdfTmp, $pdfPath)) {
    throw new Exception('Falha ao gravar PDF.');
  }

  // Salva metadados JSON (incluindo clausulas/condicoes)
  $dados['pdf_file']            = basename($pdfPath);
  $dados['saved_at']            = date('c');
  $dados['clausulas']           = $clausulas;
  $dados['condicoes']           = $condicoes;                     // garante esta chave
  $dados['condicoesPagamento']  = $condicoes;                     // e esta também (espelhadas)

  file_put_contents($jsonPath, json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

  // Logo opcional (compatível com front já publicado)
  if (!empty($_FILES['logo']['tmp_name'])) {
    $ext = pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION);
    @move_uploaded_file($_FILES['logo']['tmp_name'], $docsDir . '/' . $codigo . '_logo.' . $ext);
  }

  // CSV — cabeçalho se não existir
  if (!file_exists($csvPath) || filesize($csvPath) === 0) {
    $header = 'saved_at;codigo;servico;enderecoObra;valor;valorExtenso;prazo;dataExtenso;'
            . 'contratante_nome;contratante_doc;contratada_nome;contratada_doc;'
            . 'clausulas;condicoes;pdf' . "\n";
    file_put_contents($csvPath, $header);
  }

  // Monta linha do CSV com saneamento
  $line = [
    date('Y-m-d H:i:s'),
    $codigo,
    $dados['servico']        ?? '',
    // Alguns fronts mandam "endereco" — mantemos compat retro
    $dados['enderecoObra']   ?? ($dados['endereco'] ?? ''),
    $dados['valor']          ?? '',
    $dados['valorExtenso']   ?? '',
    (string)($dados['prazo'] ?? ''),
    $dados['dataExtenso']    ?? '',
    $dados['contratante']['nome']    ?? '',
    $dados['contratante']['cpfCnpj'] ?? '',
    $dados['contratada']['nome']     ?? '',
    $dados['contratada']['cpfCnpj']  ?? '',
    $clausulas,
    $condicoes,
    basename($pdfPath),
  ];

  // Limpa quebras de linha e troca ";" por ","
  $line = array_map(function($v){
    $v = (string)$v;
    $v = str_replace(["\r", "\n"], ' ', $v);
    $v = str_replace(';', ',', $v);
    return $v;
  }, $line);

  // Append no CSV
  file_put_contents($csvPath, implode(';', $line) . "\n", FILE_APPEND);

  echo json_encode([
    'ok'     => true,
    'pdfUrl' => 'https://api.erpimpar.com.br/storage/docs/' . basename($pdfPath),
    'file'   => basename($pdfPath),
    'update' => $isUpdate ? 1 : 0
  ]);
} catch (Exception $e) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
