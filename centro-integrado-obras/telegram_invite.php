<?php
// Inclua este arquivo no telegram_webhook.php depois do config.php.
if (!defined('CIGO_BOT_USERNAME')) define('CIGO_BOT_USERNAME', 'ERPImparRDOBot');
function cigo_inv_jread($file,$def=[]){ if(function_exists('cigo_read_json_file')) return cigo_read_json_file($file,$def); if(!file_exists($file)) return $def; $j=json_decode(file_get_contents($file),true); return is_array($j)?$j:$def; }
function cigo_inv_jwrite($file,$data){ if(function_exists('cigo_write_json_file')) return cigo_write_json_file($file,$data); if(!is_dir(dirname($file))) @mkdir(dirname($file),0775,true); return file_put_contents($file,json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT),LOCK_EX)!==false; }
function cigo_inv_digits($s){ return preg_replace('/\D+/', '', (string)$s); }
function cigo_convite_processar_start($chatId, $texto, $autor=''){
  $texto = trim((string)$texto);
  if(!preg_match('/^\/start\s+(RDO_[A-F0-9]+)/i', $texto, $m)) return false;
  $token = strtoupper($m[1]);
  $convFile = __DIR__ . '/data/convites.json';
  $partFile = __DIR__ . '/data/participantes.json';
  $vincFile = function_exists('cigo_tg_vinculos_file') ? cigo_tg_vinculos_file() : (__DIR__ . '/data/telegram_vinculos.json');
  $convites = cigo_inv_jread($convFile, ['items'=>[]]);
  $parts = cigo_inv_jread($partFile, ['items'=>[]]);
  if(!isset($parts['items'])) $parts=['items'=>array_values($parts)];
  $conv=null; $ci=-1;
  foreach(($convites['items']??[]) as $i=>$c){ if(strtoupper($c['token']??'')===$token){ $conv=$c; $ci=$i; break; } }
  if(!$conv){ cigo_tg_send($chatId, "Convite não encontrado. Peça ao administrador para reenviar."); return true; }
  if(!empty($conv['expira_em']) && strtotime($conv['expira_em']) < time()){ cigo_tg_send($chatId, "Este convite expirou. Peça ao administrador para reenviar."); return true; }
  $pid = $conv['participante_id'] ?? '';
  $p=null; $pi=-1;
  foreach($parts['items'] as $i=>$it){ if(($it['id']??'')===$pid){ $p=$it; $pi=$i; break; } }
  if(!$p){ cigo_tg_send($chatId, "Participante não encontrado no convite. Peça ao administrador para reenviar."); return true; }
  $p['telegram_chat_id']=(string)$chatId; $p['ativo']=true; $p['ativado_em']=date('c'); $p['atualizado_em']=date('c');
  $parts['items'][$pi]=$p; cigo_inv_jwrite($partFile,$parts);
  $convites['items'][$ci]['status']='ativado'; $convites['items'][$ci]['ativado_em']=date('c'); $convites['items'][$ci]['chat_id']=(string)$chatId; cigo_inv_jwrite($convFile,$convites);
  $v = cigo_inv_jread($vincFile, []);
  $v[(string)$chatId] = [
    'chat_id'=>(string)$chatId,
    'nome'=>$p['nome'] ?? $autor,
    'telefone'=>cigo_inv_digits($p['telefone'] ?? ''),
    'perfil'=>$p['perfil'] ?? 'coordenador',
    'todas'=>false,
    'obras'=>array_values($p['obras'] ?? []),
    'atualizado_em'=>date('c')
  ];
  cigo_inv_jwrite($vincFile,$v);
  if(function_exists('cigo_tg_set_sessao')) cigo_tg_set_sessao($chatId, ['obra'=>'','modo'=>'escolher_obra']);
  $obrasTxt = implode("\n• ", $p['obras'] ?? []);
  cigo_tg_send($chatId, "✅ Acesso ativado!\n\nOlá, <b>".htmlspecialchars($p['nome']??$autor,ENT_QUOTES,'UTF-8')."</b>.\n\nObras liberadas:\n• ".htmlspecialchars($obrasTxt ?: '—',ENT_QUOTES,'UTF-8')."\n\nEnvie /start para escolher a obra e iniciar o RDO.");
  return true;
}
