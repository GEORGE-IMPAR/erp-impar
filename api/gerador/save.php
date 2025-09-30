<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
  $storageBase = realpath(__DIR__ . '/../../storage');
  if ($storageBase === false) $storageBase = __DIR__ . '/../../storage';
  $dirDocs = $storageBase . DIRECTORY_SEPARATOR . 'docs';
  $dirData = $storageBase . DIRECTORY_SEPARATOR . 'data';
  $dirLogs = $storageBase . DIRECTORY_SEPARATOR . 'logs';
  if (!is_dir($dirDocs)) @mkdir($dirDocs, 0777, true);
  if (!is_dir($dirData)) @mkdir($dirData, 0777, true);
  if (!is_dir($dirLogs)) @mkdir($dirLogs, 0777, true);

  $dadosJson = null;
  if (isset($_POST['dados'])) {
    $dadosJson = $_POST['dados'];
  } elseif (isset($_FILES['dados'])) {
    $dadosJson = file_get_contents($_FILES['dados']['tmp_name']);
  } else {
    $raw = file_get_contents('php://input');
    if ($raw) $dadosJson = $raw;
  }
  if (!$dadosJson) throw new Exception('Campo \"dados\" não recebido.');

  $dados = json_decode($dadosJson, true);
  if (!is_array($dados)) throw new Exception('JSON inválido em \"dados\".');

  $codigo = preg_replace('/[^a-zA-Z0-9-_]/', '_', $dados['codigo'] ?? '');
  if ($codigo === '') throw new Exception('Código obrigatório.');

  $metaPath = $dirDocs . DIRECTORY_SEPARATOR . $codigo . '.json';
  if (file_exists($metaPath)) {
    echo json_encode(['success'=>false, 'error'=>'Código já existente.']);
    exit;
  }

  if (!isset($_FILES['pdf'])) throw new Exception('PDF não recebido.');
  $pdfName = basename($_FILES['pdf']['name']);
  $pdfPath = $dirDocs . DIRECTORY_SEPARATOR . $pdfName;
  if (!move_uploaded_file($_FILES['pdf']['tmp_name'], $pdfPath)) {
    throw new Exception('Falha ao salvar PDF.');
  }

  $anexoSaved = null;
  if (isset($_FILES['anexo'])) {
    $anexoName = basename($_FILES['anexo']['name']);
    $anexoSaved = $dirDocs . DIRECTORY_SEPARATOR . ($codigo . '__' . $anexoName);
    if (!move_uploaded_file($_FILES['anexo']['tmp_name'], $anexoSaved)) {
      throw new Exception('Falha ao salvar anexo.');
    }
    $anexoSaved = basename($anexoSaved);
  } elseif (isset($_FILES['logo'])) {
    $anexoName = basename($_FILES['logo']['name']);
    $anexoSaved = $dirDocs . DIRECTORY_SEPARATOR . ($codigo . '__' . $anexoName);
    if (!move_uploaded_file($_FILES['logo']['tmp_name'], $anexoSaved)) {
      throw new Exception('Falha ao salvar logo.');
    }
    $anexoSaved = basename($anexoSaved);
  }

  $dados['arquivo_pdf'] = $pdfName;
  $dados['anexo'] = $anexoSaved;
  $dados['criado_em'] = date('c');
  file_put_contents($metaPath, json_encode($dados, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));

  $csvPath = $dirData . DIRECTORY_SEPARATOR . 'contratos.csv';
  $novo = !file_exists($csvPath);
  $fp = fopen($csvPath, 'a');
  if (!$fp) throw new Exception('Não foi possível abrir o CSV em storage/data.');
  if ($novo) {
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

  echo json_encode(['success'=>true, 'codigo'=>$codigo, 'pdf'=>$pdfName]);
} catch (Exception $e) {
  http_response_code(400);
  echo json_encode(['success'=>false, 'error'=>$e->getMessage()]);
}
