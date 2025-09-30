<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
  // === paths ===
  $raiz     = dirname(__DIR__, 2);         // Raiz/
  $dirDocs  = $raiz . '/storage/docs';
  $dirData  = $raiz . '/storage/data';
  $dirLogs  = $raiz . '/storage/logs';
  foreach ([$dirDocs,$dirData,$dirLogs] as $d) if (!is_dir($d)) mkdir($d, 0777, true);

  // === dados (JSON) ===
  $dadosJson = $_POST['dados'] ?? (isset($_FILES['dados']) ? file_get_contents($_FILES['dados']['tmp_name']) : null);
  if (!$dadosJson) throw new Exception('Campo "dados" não recebido.');
  $dados = json_decode($dadosJson, true);
  if (!$dados) throw new Exception('JSON inválido em "dados".');

  $codigo = preg_replace('/[^a-zA-Z0-9-_]/', '_', $dados['codigo'] ?? 'DOC');
  if (!$codigo) $codigo = 'DOC';

  // === unicidade: se já existe, recusa ===
  $metaPath = $dirDocs . "/{$codigo}.json";
  if (file_exists($metaPath)) {
    echo json_encode(['success'=>false,'error'=>'Código já existente.']);
    exit;
  }

  // === pdf obrigatório ===
  if (!isset($_FILES['pdf'])) throw new Exception('PDF gerado não recebido.');
  $pdfName = basename($_FILES['pdf']['name']);
  $pdfPath = $dirDocs . '/' . $pdfName;
  if (!move_uploaded_file($_FILES['pdf']['tmp_name'], $pdfPath)) {
    throw new Exception('Falha ao salvar PDF.');
  }

  // === anexo opcional (logo/anexo) ===
  $anexoSaved = null;
  foreach (['anexo','logo'] as $fld) {
    if (isset($_FILES[$fld])) {
      $name = basename($_FILES[$fld]['name']);
      $dest = $dirDocs . '/' . $codigo . '__' . $name;
      if (move_uploaded_file($_FILES[$fld]['tmp_name'], $dest)) {
        $anexoSaved = basename($dest);
      }
      break;
    }
  }

  // === salva JSON (metadata) ===
  $dados['arquivo_pdf'] = $pdfName;
  $dados['anexo']       = $anexoSaved;
  $dados['criado_em']   = date('c');
  file_put_contents($metaPath, json_encode($dados, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));

  // === CSV (contratos.csv) ===
  $csv  = $dirData . '/contratos.csv';
  $head = [
    'codigo','servico','enderecoObra',
    'contratante_nome','contratante_cpfCnpj','contratante_email','contratante_telefone',
    'contratada_nome','contratada_cpfCnpj','contratada_email','contratada_telefone',
    'valor','valorExtenso','prazo','dataExtenso',
    'clausulas','condicoes',
    'arquivo_pdf','anexo','criado_em'
  ];
  $row = [
    $dados['codigo'] ?? '',
    $dados['servico'] ?? '',
    $dados['enderecoObra'] ?? ($dados['endereco'] ?? ''),
    $dados['contratante']['nome'] ?? ($dados['contratante']['razao'] ?? ''),
    $dados['contratante']['cpfCnpj'] ?? ($dados['contratante']['cnpj'] ?? ($dados['contratante']['cpf'] ?? '')),
    $dados['contratante']['email'] ?? '',
    $dados['contratante']['telefone'] ?? '',
    $dados['contratada']['nome'] ?? ($dados['contratada']['razao'] ?? ''),
    $dados['contratada']['cpfCnpj'] ?? ($dados['contratada']['cnpj'] ?? ($dados['contratada']['cpf'] ?? '')),
    $dados['contratada']['email'] ?? '',
    $dados['contratada']['telefone'] ?? '',
    $dados['valor'] ?? '',
    $dados['valorExtenso'] ?? '',
    $dados['prazo'] ?? '',
    $dados['dataExtenso'] ?? '',
    $dados['clausulas'] ?? '',
    ($dados['condicoes'] ?? $dados['condicoesPagamento'] ?? ''),
    $pdfName,
    $anexoSaved ?? '',
    $dados['criado_em']
  ];
  // tira quebras de linha de campos longos
  $row = array_map(function($v){ return str_replace(["\r","\n"], ' ', (string)$v); }, $row);
  $fp = fopen($csv, file_exists($csv)? 'a' : 'w');
  if (ftell($fp) === 0) fputcsv($fp, $head, ';');
  fputcsv($fp, $row, ';');
  fclose($fp);

  // URL pública do PDF (se /storage é público, como no seu print)
  $pdfUrl = '/storage/docs/' . $pdfName;

  echo json_encode(['success'=>true,'codigo'=>$codigo,'pdf'=>$pdfName,'pdfUrl'=>$pdfUrl]);
} catch (Exception $e) {
  http_response_code(400);
  echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
