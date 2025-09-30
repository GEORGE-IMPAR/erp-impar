<?php
/**
 * /api/gerador/list.php
 * Lista contratos do CSV em JSON, agora com clausulas e condicoes.
 * Filtros: ?codigo=AC00025
 * Auth:    ?token=SEU_TOKEN
 */

define('APP_TOKEN', '8cce9abb2fd53b1cceaa93b9cecfd5384b2ea6fb931e8882c543cbd7d3663b77'); // <<< TROQUE
$ROOT = dirname(__DIR__);                         // …/api
$CSV  = $ROOT . '/../storage/data/contratos.csv'; // …/storage/data/contratos.csv

/* ===== CORS ===== */
function allow_cors() {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  $allowed = ['https://erpimpar.com.br','https://www.erpimpar.com.br'];
  if (in_array($origin, $allowed)) {
    header('Access-Control-Allow-Origin: '.$origin);
    header('Vary: Origin');
  } else {
    // Se preferir, use wildcard:
    // header('Access-Control-Allow-Origin: *');
  }
  header('Access-Control-Allow-Methods: GET, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');
  header('Access-Control-Max-Age: 86400');
}
allow_cors();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json; charset=utf-8');
function jexit($data,$code=200){ http_response_code($code); echo json_encode($data,JSON_UNESCAPED_UNICODE); exit; }

/* ===== Auth ===== */
$token = trim($_GET['token'] ?? '');
if ($token === '' || $token !== APP_TOKEN) jexit(['ok'=>false,'error'=>'Unauthorized'],401);

/* ===== CSV helper ===== */
function csv_rows($file){
  if (!file_exists($file)) return [];
  $h=fopen($file,'r'); if(!$h) return [];
  $rows=[]; $headers=null;
  while(($data=fgetcsv($h,0,';'))!==false){
    if($headers===null){ if(isset($data[0])) $data[0]=preg_replace('/^\xEF\xBB\xBF/','',$data[0]); $headers=$data; continue; }
    $row=[]; foreach($headers as $i=>$k){ $row[$k]=$data[$i]??''; }
    $rows[]=$row;
  }
  fclose($h); return $rows;
}

/* ===== Lê e filtra ===== */
if(!file_exists($CSV)) jexit(['ok'=>true,'rows'=>[]]);

$codigoFiltro = trim($_GET['codigo'] ?? '');
$host  = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS']==='on' ? 'https':'http').'://'.$_SERVER['HTTP_HOST'];
$api   = rtrim($host,'/').'/gerador/';   // …/api/gerador/
$rows  = csv_rows($CSV);
$out   = [];

foreach($rows as $r){
  // Cabeçalho esperado:
  // saved_at;codigo;servico;enderecoObra;valor;valorExtenso;prazo;dataExtenso;
  // contratante_nome;contratante_doc;contratada_nome;contratada_doc;clausulas;condicoes;pdf
  $codigo = $r['codigo'] ?? '';
  if ($codigoFiltro!=='' && strcasecmp($codigoFiltro,$codigo)!==0) continue;

  $pdfFile = $r['pdf'] ?? '';
  $pdfUrl  = $pdfFile ? ($api.'pdf.php?f='.rawurlencode($pdfFile).'&token='.rawurlencode($token)) : null;

  $out[] = [
    'codigo'            => $codigo,
    'servico'           => $r['servico'] ?? '',
    'enderecoObra'      => $r['enderecoObra'] ?? '',
    'valor'             => $r['valor'] ?? '',
    'valorExtenso'      => $r['valorExtenso'] ?? '',
    'prazo'             => $r['prazo'] ?? '',
    'dataExtenso'       => $r['dataExtenso'] ?? '',
    'contratante_nome'  => $r['contratante_nome'] ?? '',
    'contratante_doc'   => $r['contratante_doc'] ?? '',
    'contratada_nome'   => $r['contratada_nome'] ?? '',
    'contratada_doc'    => $r['contratada_doc'] ?? '',
    // >>> adicionados:
    'clausulas'         => $r['clausulas'] ?? '',
    'condicoes'         => $r['condicoes'] ?? '',
    // arquivos
    'pdf_file'          => $pdfFile,
    'pdf_url'           => $pdfUrl,
  ];
}

/* ===== Resposta ===== */
jexit(['ok'=>true,'rows'=>$out]);

