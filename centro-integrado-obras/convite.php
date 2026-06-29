<?php
require_once __DIR__ . '/config.php';
if (!defined('CIGO_BOT_USERNAME')) define('CIGO_BOT_USERNAME', 'ERPImparRDOBot');
function jr($f,$d=[]){ if(function_exists('cigo_read_json_file')) return cigo_read_json_file($f,$d); if(!file_exists($f)) return $d; $j=json_decode(file_get_contents($f),true); return is_array($j)?$j:$d; }
function jw($f,$d){ if(function_exists('cigo_write_json_file')) return cigo_write_json_file($f,$d); if(!is_dir(dirname($f))) @mkdir(dirname($f),0775,true); return file_put_contents($f,json_encode($d,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT),LOCK_EX)!==false; }
$t = trim((string)($_GET['t'] ?? ''));
$convFile = __DIR__ . '/data/convites.json';
$convites = jr($convFile, ['items'=>[]]);
$conv = null; $idx = -1;
foreach(($convites['items']??[]) as $i=>$c){ if(($c['token']??'')===$t){ $conv=$c; $idx=$i; break; } }
if($conv && $idx>=0){ $convites['items'][$idx]['visualizado_em'] = date('c'); jw($convFile,$convites); }
$ok = !!$conv;
$nome = $conv['nome'] ?? 'Participante';
$obras = $conv['obras'] ?? [];
$tg = 'https://t.me/' . CIGO_BOT_USERNAME . '?start=' . rawurlencode($t);
$install = 'https://telegram.org/dl';
?>
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Convite RDO ÍMPAR</title>
<style>body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#eef6ff;background:linear-gradient(135deg,#071d46,#0d3f72,#064b52);display:grid;place-items:center;padding:18px}.card{width:min(560px,100%);border:1px solid rgba(34,197,94,.45);background:rgba(2,6,23,.68);border-radius:24px;padding:22px;box-shadow:0 28px 80px rgba(0,0,0,.42)}.logo{width:56px;height:56px;border-radius:18px;background:conic-gradient(from 210deg,#22c55e,#38bdf8,#1d4ed8,#fb923c,#22c55e);margin-bottom:14px}.k{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#a3e635;font-weight:900}.h{font-size:28px;font-weight:950;line-height:1.05;margin:5px 0}.p{color:#cbd5e1;line-height:1.45}.box{border:1px solid rgba(255,255,255,.12);background:rgba(2,8,23,.42);border-radius:16px;padding:14px;margin:14px 0}.btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:0;border-radius:999px;padding:14px 18px;margin-top:10px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#031312;font-weight:950;text-decoration:none;text-transform:uppercase;letter-spacing:.08em}.btn.blue{background:linear-gradient(135deg,#60a5fa,#2563eb);color:#fff}.small{font-size:12px;color:#9fb3c8;margin-top:12px}</style>
</head><body><div class="card"><div class="logo"></div><div class="k">ERP ÍMPAR • RDO</div>
<?php if(!$ok): ?><div class="h">Convite inválido</div><p class="p">Este convite não foi encontrado ou expirou. Peça ao administrador para reenviar.</p>
<?php else: ?><div class="h">Você foi convidado</div><p class="p">Olá, <b><?=htmlspecialchars($nome)?></b>. Você recebeu acesso ao RDO da ÍMPAR.</p><div class="box"><b>Obras liberadas:</b><br><?=htmlspecialchars(implode(', ', $obras) ?: '—')?></div><a class="btn" href="<?=$tg?>">Abrir RDO no Telegram</a><a class="btn blue" href="<?=$install?>">Instalar Telegram</a><div class="small">Depois de abrir o Telegram, toque em <b>Iniciar</b>. O acesso será ativado automaticamente.</div><?php endif; ?></div></body></html>
