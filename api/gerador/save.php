<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
  // Pastas de destino
  $base = __DIR__;
  $dirDocs = $base . DIRECTORY_SEPARATOR . 'docs';
  $dirUploads = $base . DIRECTORY_SEPARATOR . 'uploads';
  if (!is_dir($dirDocs)) mkdir($dirDocs, 0777, true);
  if (!is_dir($dirUploads)) mkdir($dirUploads, 0777, true);

  // Lê o JSON dos dados (vem via multipart em $_POST["dados"] ou $_FILES["dados"])
  $dadosJson = null;
  if (isset($_POST['dados'])) {
    $dadosJson = $_POST['dados'];
  } else if (isset($_FILES['dados'])) {
    $dadosJson = file_get_contents($_FILES['dados']['tmp_name']);
  }
  if (!$dadosJson) throw new Exception('Campo "dados" não recebido.');

  $dados = json_decode($dadosJson, true);
  if (!is_array($dados)) throw new Exception('JSON inválido em "dados".');

  $codigo = preg_replace('/[^a-zA-Z0-9-_]/', '_', $dados['codigo'] ?? 'DOC');
  if (!$codigo) $codigo = 'DOC';

  // Impede código duplicado (chave do sistema)
  $metaPath = $dirDocs . DIRECTORY_SEPARATOR . $codigo . '.json';
  if (file_exists($metaPath)) {
    echo json_encode(['success'=>false, 'error'=>'Código já existente.']);
    exit;
  }

  // Salva PDF gerado (obrigatório)
  if (!isset($_FILES['pdf'])) throw new Exception('PDF gerado não recebido.');
  $pdfName = basename($_FILES['pdf']['name']);
  $pdfPath = $dirDocs . DIRECTORY_SEPARATOR . $pdfName;
  if (!move_uploaded_file($_FILES['pdf']['tmp_name'], $pdfPath)) throw new Exception('Falha ao salvar PDF.');

  // Salva anexo opcional
  $anexoSaved = null;
  if (isset($_FILES['anexo'])) {
    $name = basename($_FILES['anexo']['name']);
    $dest = $dirUploads . DIRECTORY_SEPARATOR . $codigo . '__' . $name;
    if (!move_uploaded_file($_FILES['anexo']['tmp_name'], $dest)) throw new Exception('Falha ao salvar anexo.');
    $anexoSaved = basename($dest);
  }

  // Metadados (JSON)
  $dados['arquivo_pdf'] = $pdfName;
  $dados['anexo'] = $anexoSaved;
  $dados['criado_em'] = date('c');
  file_put_contents($metaPath, json_encode($dados, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));

  // ===== CSV (cláusulas + condições + metadados úteis) =====
  $csvPath = $dirDocs . DIRECTORY_SEPARATOR . 'contratos.csv';
  $isNewCsv = !file_exists($csvPath);
  $fp = fopen($csvPath, 'a');
  if (!$fp) throw new Exception('Não foi possível abrir/gerar o CSV.');

  if ($isNewCsv) {
    fputcsv($fp, [
      'codigo','servico','enderecoObra','valor','valorExtenso','prazo','dataExtenso',
      'contratante','contratada','operador','clausulas','condicoes','arquivo_pdf','anexo','criado_em'
    ], ';');
  }
  $cj = function($arr){ return json_encode($arr ?? new stdClass(), JSON_UNESCAPED_UNICODE); };
  fputcsv($fp, [
    $dados['codigo'] ?? '',
    $dados['servico'] ?? '',
    $dados['enderecoObra'] ?? '',
    $dados['valor'] ?? '',
    $dados['valorExtenso'] ?? '',
    $dados['prazo'] ?? '',
    $dados['dataExtenso'] ?? '',
    $cj($dados['contratante'] ?? []),
    $cj($dados['contratada'] ?? []),
    $cj($dados['operador'] ?? []),
    $dados['clausulas'] ?? '',
    $dados['condicoes'] ?? '',
    $pdfName,
    $anexoSaved ?? '',
    $dados['criado_em']
  ], ';');
  fclose($fp);
  // ===== fim CSV =====

  echo json_encode(['success'=>true, 'codigo'=>$codigo, 'pdf'=>$pdfName]);
} catch (Exception $e) {
  http_response_code(400);
  echo json_encode(['success'=>false, 'error'=>$e->getMessage()]);
}
