<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://erpimpar.com.br');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

try {
  // pastas
  $root      = dirname(__FILE__,2);               // /www
  $docsDir   = $root.'/storage/docs';
  $dataDir   = $root.'/storage/data';
  $csvPath   = $dataDir.'/contratos.csv';

  if (!is_dir($docsDir)) @mkdir($docsDir, 0775, true);
  if (!is_dir($dataDir)) @mkdir($dataDir, 0775, true);

  // dados + pdf
  if (!isset($_FILES['pdf'])) throw new Exception('PDF não enviado.');
  $nomePdfOrig = basename($_FILES['pdf']['name']);
  $pdfTmp      = $_FILES['pdf']['tmp_name'];

  if (!isset($_POST['dados'])) throw new Exception('JSON "dados" não enviado.');
  $dados = json_decode($_POST['dados'], true);
  if (!is_array($dados)) throw new Exception('JSON "dados" inválido.');

  $codigo = preg_replace('/[^A-Za-z0-9_-]/','_', $dados['codigo'] ?? '');
  if ($codigo==='') throw new Exception('Código vazio.');

  $jsonPath = $docsDir.'/'.$codigo.'.json';
  $pdfPath  = $docsDir.'/'.$nomePdfOrig;

  $isUpdate = isset($_POST['update']) && ($_POST['update'] == '1');

  // bloqueia duplicidade
  if (file_exists($jsonPath) && !$isUpdate) {
    echo json_encode(['ok'=>false,'error'=>'Código já cadastrado']);
    exit;
  }

  // move PDF
  if (!move_uploaded_file($pdfTmp, $pdfPath)) throw new Exception('Falha ao gravar PDF.');

  // salva metadados JSON
  $dados['pdf_file']   = basename($pdfPath);
  $dados['saved_at']   = date('c');
  file_put_contents($jsonPath, json_encode($dados, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));

  // anexo opcional (logo) — mantém compatibilidade com o front já publicado
  if (!empty($_FILES['logo']['tmp_name'])) {
    $ext  = pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION);
    @move_uploaded_file($_FILES['logo']['tmp_name'], $docsDir.'/'.$codigo.'_logo.'.$ext);
  }

  // CSV (cria cabeçalho se não existir)
  if (!file_exists($csvPath) || filesize($csvPath)===0) {
    $header = 'saved_at;codigo;servico;enderecoObra;valor;valorExtenso;prazo;dataExtenso;'.
              'contratante_nome;contratante_doc;contratada_nome;contratada_doc;'.
              'clausulas;condicoes;pdf'."\n";
    file_put_contents($csvPath, $header);
  }

  // linha CSV
  $linha = [
    date('Y-m-d H:i:s'),
    $codigo,
    $dados['servico'] ?? '',
    $dados['enderecoObra'] ?? '',
    $dados['valor'] ?? '',
    $dados['valorExtenso'] ?? '',
    $dados['prazo'] ?? '',
    $dados['dataExtenso'] ?? '',
    $dados['contratante']['nome'] ?? '',
    $dados['contratante']['cpfCnpj'] ?? '',
    $dados['contratada']['nome'] ?? '',
    $dados['contratada']['cpfCnpj'] ?? '',
    isset($dados['clausulas']) ? preg_replace('/\s+/',' ', $dados['clausulas']) : '',
    isset($dados['condicoesPagamento']) ? preg_replace('/\s+/',' ', $dados['condicoesPagamento']) : '',
    basename($pdfPath),
  ];
  // escapa ; e quebras
  $linha = array_map(function($v){ $v=str_replace(["\r","\n"],' ',$v); return str_replace(';', ',', $v); }, $linha);
  file_put_contents($csvPath, implode(';',$linha)."\n", FILE_APPEND);

  echo json_encode([
    'ok'=>true,
    'pdfUrl'=>'https://api.erpimpar.com.br/storage/docs/'.basename($pdfPath),
    'file'=>basename($pdfPath)
  ]);
} catch (Exception $e) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);
}

}
