<?php
require_once __DIR__ . '/config.php';

if (!defined('CIGO_BOT_USERNAME')) define('CIGO_BOT_USERNAME', 'ERPImparRDOBot');
if (!defined('CIGO_API_PUBLIC_BASE')) define('CIGO_API_PUBLIC_BASE', 'https://api.erpimpar.com.br/centro-integrado-obras');
if (!defined('CIGO_FRONT_BASE')) define('CIGO_FRONT_BASE', 'https://www.erpimpar.com.br/centro-integrado-obras');

function cigo_out($arr, $status=200){
  if(function_exists('cigo_json_response')) cigo_json_response($arr, $status);
  http_response_code($status); header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT); exit;
}
function cigo_jread($file, $def=[]){
  if(function_exists('cigo_read_json_file')) return cigo_read_json_file($file, $def);
  if(!file_exists($file)) return $def;
  $j=json_decode(file_get_contents($file), true); return is_array($j)?$j:$def;
}
function cigo_jwrite($file, $data){
  if(function_exists('cigo_write_json_file')) return cigo_write_json_file($file, $data);
  $dir=dirname($file); if(!is_dir($dir)) @mkdir($dir,0775,true);
  return file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT), LOCK_EX)!==false;
}
function cigo_slugx($s){
  $s = strtoupper(trim((string)$s));
  $s = iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$s);
  $s = preg_replace('/[^A-Z0-9]+/','_',$s);
  return trim($s,'_');
}
function cigo_token(){ return 'RDO_' . strtoupper(bin2hex(random_bytes(10))); }
function cigo_only_digits($s){ return preg_replace('/\D+/', '', (string)$s); }
function cigo_part_file(){ return __DIR__ . '/data/participantes.json'; }
function cigo_conv_file(){ return __DIR__ . '/data/convites.json'; }
function cigo_depara_file(){ return __DIR__ . '/data/obra_depara.json'; }
function cigo_obras_depara(){
  $j = cigo_jread(cigo_depara_file(), []);
  $rows = $j['obras'] ?? $j;
  $out=[];
  foreach($rows as $k=>$r){
    if(is_array($r)) $obra = $r['obra'] ?? $r['nome'] ?? $r['nome_rdo'] ?? $k;
    else $obra = (string)$r;
    if($obra !== '') $out[] = $obra;
  }
  return array_values(array_unique($out));
}
function cigo_public_invite_url($token){ return rtrim(CIGO_API_PUBLIC_BASE,'/') . '/convite.php?t=' . rawurlencode($token); }
function cigo_telegram_url($token){ return 'https://t.me/' . CIGO_BOT_USERNAME . '?start=' . rawurlencode($token); }
function cigo_msg_convite($p, $conv){
  $nome = $p['nome'] ?? 'Olá';
  $obras = implode(', ', $p['obras'] ?? []);
  $link = cigo_public_invite_url($conv['token']);
  return "Olá, {$nome}!\n\nVocê foi convidado(a) para participar do RDO da ÍMPAR.\n\nObra(s): {$obras}\n\nClique no link para ativar seu acesso:\n{$link}\n\nSe ainda não tiver Telegram, instale o aplicativo. Depois toque em Abrir RDO no Telegram e inicie o bot para usar em campo.";
}
function cigo_pack_participante($p, $convites){
  $pid = $p['id'];
  $last = null;
  foreach($convites as $c){ if(($c['participante_id']??'')===$pid) $last=$c; }
  $p['ultimo_convite'] = $last;
  if($last){
    $p['links'] = [
      'convite' => cigo_public_invite_url($last['token']),
      'telegram' => cigo_telegram_url($last['token']),
      'whatsapp' => 'https://wa.me/' . cigo_only_digits($p['telefone'] ?? '') . '?text=' . rawurlencode(cigo_msg_convite($p,$last)),
      'email' => 'mailto:' . rawurlencode($p['email'] ?? '') . '?subject=' . rawurlencode('Convite RDO ÍMPAR') . '&body=' . rawurlencode(cigo_msg_convite($p,$last))
    ];
  }
  return $p;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '{}', true); if(!is_array($body)) $body=[];
if(!$action && isset($body['action'])) $action=$body['action'];

$parts = cigo_jread(cigo_part_file(), []);
$convites = cigo_jread(cigo_conv_file(), []);
if(!isset($parts['items'])) $parts=['items'=>is_array($parts)?array_values($parts):[]];
if(!isset($convites['items'])) $convites=['items'=>is_array($convites)?array_values($convites):[]];

if($action === 'obras') cigo_out(['ok'=>true,'obras'=>cigo_obras_depara()]);

if($action === 'list' || $action === ''){
  $out=[]; foreach($parts['items'] as $p) $out[] = cigo_pack_participante($p, $convites['items']);
  cigo_out(['ok'=>true,'items'=>$out,'obras'=>cigo_obras_depara()]);
}

if($action === 'save'){
  $p = $body['participante'] ?? $body;
  $id = trim((string)($p['id'] ?? '')) ?: ('P_' . date('YmdHis') . '_' . substr(bin2hex(random_bytes(3)),0,6));
  $novo = [
    'id'=>$id,
    'nome'=>trim((string)($p['nome'] ?? '')),
    'telefone'=>cigo_only_digits($p['telefone'] ?? ''),
    'email'=>trim((string)($p['email'] ?? '')),
    'perfil'=>trim((string)($p['perfil'] ?? 'coordenador')),
    'obras'=>array_values(array_filter(array_map('trim', $p['obras'] ?? []))),
    'ativo'=>array_key_exists('ativo',$p)?!!$p['ativo']:true,
    'telegram_chat_id'=>trim((string)($p['telegram_chat_id'] ?? '')),
    'atualizado_em'=>date('c')
  ];
  if($novo['nome']==='') cigo_out(['ok'=>false,'erro'=>'nome obrigatório'],400);
  $found=false;
  foreach($parts['items'] as &$it){ if(($it['id']??'')===$id){ $novo['criado_em']=$it['criado_em']??date('c'); $it=$novo; $found=true; break; } }
  unset($it);
  if(!$found){ $novo['criado_em']=date('c'); $parts['items'][]=$novo; }
  cigo_jwrite(cigo_part_file(), $parts);
  cigo_out(['ok'=>true,'participante'=>cigo_pack_participante($novo,$convites['items'])]);
}

if($action === 'remove'){
  $id = trim((string)($body['id'] ?? $_GET['id'] ?? ''));
  $parts['items'] = array_values(array_filter($parts['items'], fn($p)=>($p['id']??'')!==$id));
  cigo_jwrite(cigo_part_file(), $parts);
  cigo_out(['ok'=>true]);
}

if($action === 'invite' || $action === 'reenviar'){
  $id = trim((string)($body['id'] ?? $_GET['id'] ?? ''));
  $p = null;
  foreach($parts['items'] as $it){ if(($it['id']??'')===$id){ $p=$it; break; } }
  if(!$p) cigo_out(['ok'=>false,'erro'=>'participante não encontrado'],404);
  $conv = [
    'token'=>cigo_token(),
    'participante_id'=>$id,
    'nome'=>$p['nome'] ?? '',
    'telefone'=>$p['telefone'] ?? '',
    'email'=>$p['email'] ?? '',
    'perfil'=>$p['perfil'] ?? 'coordenador',
    'obras'=>$p['obras'] ?? [],
    'status'=>'pendente',
    'criado_em'=>date('c'),
    'expira_em'=>date('c', time()+60*60*24*30)
  ];
  $convites['items'][]=$conv;
  cigo_jwrite(cigo_conv_file(), $convites);
  $msg = cigo_msg_convite($p,$conv);
  cigo_out(['ok'=>true,'convite'=>$conv,'links'=>[
    'convite'=>cigo_public_invite_url($conv['token']),
    'telegram'=>cigo_telegram_url($conv['token']),
    'whatsapp'=>'https://wa.me/' . cigo_only_digits($p['telefone'] ?? '') . '?text=' . rawurlencode($msg),
    'email'=>'mailto:' . rawurlencode($p['email'] ?? '') . '?subject=' . rawurlencode('Convite RDO ÍMPAR') . '&body=' . rawurlencode($msg)
  ],'mensagem'=>$msg]);
}

cigo_out(['ok'=>false,'erro'=>'ação inválida'],400);
