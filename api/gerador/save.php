<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

function ensure_dir($path){ if(!is_dir($path)){ mkdir($path, 0777, true); } }

try {
  $base = __DIR__;
  $dirDocs = $base . DIRECTORY_SEPARATOR . 'docs';
  $dirUploads = $base . DIRECTORY_SEPARATOR . 'uploads';
  $dirData = $base . DIRECTORY_SEPARATOR . 'data';
  $csvPath = $dirData . DIRECTORY_SEPARATOR . 'contratos.csv';
  ensure_dir($dirDocs); ensure_dir($dirUploads); ensure_dir($dirData);

  $dadosJson = null;
  if (isset($_POST['dados'])) $dadosJson = $_POST['dados'];
  if (!$dadosJson && isset($_FILES['dados'])) $dadosJson = file_get_contents($_FILES['dados']['tmp_name']);
  if (!$dadosJson) throw new Exception('Campo "dados" não recebido.');
  $dados = json_decode($dadosJson, true);
  if (!$dados) throw new Exception('JSON inválido.');

  $codigo = preg_replace('/[^a-zA-Z0-9-_]/', '_', $dados['codigo'] ?? 'DOC');
  if (!$codigo) $codigo = 'DOC';

  $metaPath = $dirDocs . DIRECTORY_SEPARATOR . $codigo . '.json';
  if (file_exists($metaPath)) { echo json_encode(['success'=>false, 'error'=>'Código já existente.']); exit; }

  if (!isset($_FILES['pdf'])) throw new Exception('PDF não recebido.');
  $pdfName = basename($_FILES['pdf']['name']);
  $pdfPath = $dirDocs . DIRECTORY_SEPARATOR . $pdfName;
  if (!move_uploaded_file($_FILES['pdf']['tmp_name'], $pdfPath)) throw new Exception('Falha ao salvar PDF.');

  $anexoSaved = null;
  if (isset($_FILES['anexo'])) {
    $name = basename($_FILES['anexo']['name']);
    $dest = $dirUploads . DIRECTORY_SEPARATOR . $codigo . '__' . $name;
    if (!move_uploaded_file($_FILES['anexo']['tmp_name'], $dest)) throw new Exception('Falha ao salvar anexo.');
    $anexoSaved = basename($dest);
  }

  $dados['arquivo_pdf'] = $pdfName;
  $dados['anexo'] = $anexoSaved;
  $dados['criado_em'] = date('c');
  file_put_contents($metaPath, json_encode($dados, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));

  $new = [];
  $new[] = $dados['codigo'] ?? '';
  $new[] = $dados['servico'] ?? '';
  $new[] = $dados['enderecoObra'] ?? '';
  $new[] = $dados['valor'] ?? '';
  $new[] = $dados['valorExtenso'] ?? '';
  $new[] = $dados['prazo'] ?? '';
  $new[] = $dados['dataExtenso'] ?? '';
  $new[] = $dados['contratante']['razao'] ?? '';
  $new[] = $dados['contratante']['cnpj'] ?? '';
  $new[] = $dados['contratada']['razao'] ?? '';
  $new[] = $dados['contratada']['cnpj'] ?? '';
  $new[] = $dados['clausulas'] ?? '';
  $new[] = $dados['condicoes'] ?? '';
  $new[] = $pdfName;
  $new[] = $dados['anexo'] ?? '';
  $new[] = date('c');

  $isNew = !file_exists($csvPath);
  $fp = fopen($csvPath, 'a');
  if($isNew){
    fputcsv($fp, ['codigo','servico','endereco','valor','valor_extenso','prazo','data_extenso','contratante_razao','contratante_doc','contratada_razao','contratada_doc','clausulas','condicoes','pdf','anexo','criado_em']);
  }
  fputcsv($fp, $new);
  fclose($fp);

  echo json_encode(['success'=>true, 'codigo'=>$codigo, 'pdf'=>$pdfName]);
} catch (Exception $e) {
  http_response_code(400);
  echo json_encode(['success'=>false, 'error'=>$e->getMessage()]);
}
