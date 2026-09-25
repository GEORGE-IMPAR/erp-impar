<?php
declare(strict_types=1);
namespace GeorgeV09;

final class Failure extends \RuntimeException {
    public function __construct(public string $status, string $message, public int $http=400) {parent::__construct($message);}
}
function root(): string {return dirname(__DIR__,2);}
function cfg(): array {
    static $c=null;if($c!==null)return $c;
    $path=root().'/config.local.php';
    if(!is_file($path))$path=root().'/config.example.php';
    $old=is_file($path)?require $path:[];
    $c=array_merge(is_array($old)?$old:[],[
        'version'=>'0.9.8-rc3-hf7','storage_dir'=>root().'/storage/v09',
        'agenda_backend'=>'json', 'company_id'=>1,'company_code'=>'IMPAR_CLIMATIZACAO',
        'company_name'=>'ÍMPAR Climatização e Sistemas',
        'file_transcription_model'=>'gpt-transcribe',
        'ffmpeg'=>'/usr/bin/ffmpeg','ffprobe'=>'/usr/bin/ffprobe',
        'max_upload_bytes'=>512*1024*1024,'upload_chunk_bytes'=>1024*1024,
        'max_audio_seconds'=>14400,'segment_seconds'=>300,
        'max_user_storage_bytes'=>2*1024*1024*1024,
        'legacy_history_admin_only'=>true,'enable_recording'=>true,
        'max_transcript_chars_per_report_part'=>28000,
        'allowed_origins'=>['https://www.erpimpar.com.br','https://erpimpar.com.br'],
        'test_mode'=>false,
    ]);
    $extra=dirname(__DIR__).'/settings.local.php';
    if(is_file($extra)){ $x=require $extra;if(is_array($x))$c=array_merge($c,$x); }
    $c['version']='0.9.8-rc3-hf7';return $c;
}
function storeRoot(): string {
    $p=(string)cfg()['storage_dir'];
    if(!is_dir($p)&&!mkdir($p,0700,true))throw new Failure('STORAGE_INDISPONIVEL','Não foi possível preparar o armazenamento.',503);
    $deny=$p.'/.htaccess';if(!is_file($deny))file_put_contents($deny,"Require all denied\nDeny from all\n");
    return $p;
}
function encode(mixed $v): string {return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function atomic(string $file,string $bytes): void {
    $dir=dirname($file);if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new Failure('STORAGE_INDISPONIVEL','Falha ao criar pasta de armazenamento.',503);
    $tmp=$file.'.tmp.'.bin2hex(random_bytes(6));
    if(file_put_contents($tmp,$bytes,LOCK_EX)===false)throw new Failure('FALHA_GRAVACAO','Falha ao gravar arquivo.',503);
    chmod($tmp,0600);if(!rename($tmp,$file)){@unlink($tmp);throw new Failure('FALHA_GRAVACAO','Falha ao confirmar gravação.',503);}
}
function readJson(string $p,?array $default=null): array {
    if(!is_file($p)){if($default!==null)return $default;throw new Failure('NAO_ENCONTRADO','Registro não encontrado.',404);}
    $x=json_decode((string)file_get_contents($p),true,512,JSON_THROW_ON_ERROR);
    if(!is_array($x))throw new Failure('JSON_INVALIDO','Formato do registro inválido.',422);return $x;
}
function locked(string $p,callable $fn): mixed {
    if(!is_dir(dirname($p)))mkdir(dirname($p),0700,true);
    $f=fopen($p,'c');if(!$f||!flock($f,LOCK_EX|LOCK_NB))throw new Failure('PROCESSANDO','Este registro já está sendo processado. Aguarde.',409);
    try{return $fn();}finally{flock($f,LOCK_UN);fclose($f);}
}
function norm(string $s):string {$s=strtr($s,array_combine(preg_split('//u','áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',-1,PREG_SPLIT_NO_EMPTY),str_split('aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN')));return strtolower(trim(preg_replace('/\s+/u',' ',iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$s)?:$s)));}
function validId(string $id):string {if(!preg_match('/^g09_[a-f0-9]{32}$/D',$id))throw new Failure('ID_INVALIDO','Identificador inválido.');return $id;}
function recordPath(string $id):string{return storeRoot().'/records/'.validId($id).'/record.json';}
function recordDir(string $id):string{return dirname(recordPath($id));}
function newRecord(array $user,string $kind,array $meta=[]):array {
    if(!in_array($kind,['conversation','meeting','kickoff','media','text'],true))throw new Failure('TIPO_INVALIDO','Tipo de registro inválido.');
    $id='g09_'.bin2hex(random_bytes(16));
    $r=['id'=>$id,'kind'=>$kind,'company_id'=>$user['company_id'],'owner_id'=>$user['id'],'created_at'=>date(DATE_ATOM),'status'=>'open','revision'=>0,'turns'=>[],'meta'=>$meta];
    atomic(recordPath($id),encode($r));return $r;
}
function record(string $id,array $user):array {
    $r=readJson(recordPath($id));
    if((int)$r['company_id']!==(int)$user['company_id']||((string)$r['owner_id']!==(string)$user['id']&&!$user['admin']))throw new Failure('ACESSO_NEGADO','Você não tem acesso a este registro.',403);
    $stopped=readJson(recordDir($id).'/queue-stop.json',[]);if(!$stopped&&!empty($r['meta']['source_record_id']))$stopped=readJson(recordDir($r['meta']['source_record_id']).'/queue-stop.json',[]);if($stopped){$r['job_state']=($stopped['operation']??'')==='delete'?'deleted':'cancelled';$r['status']='closed';}
    return $r;
}
function updateRecord(string $id,array $u,callable $fn):array {
    return locked(recordDir($id).'/write.lock',function()use($id,$u,$fn){$r=record($id,$u);$r=$fn($r);$r['revision']++;$r['updated_at']=date(DATE_ATOM);atomic(recordPath($id),encode($r));return $r;});
}
function appendTurn(string $id,array $u,string $role,string $text,string $eventId=''):array {
    if(!in_array($role,['user','assistant','system'],true))throw new Failure('PAPEL_INVALIDO','Papel inválido.');
    if(strlen($text)>120000)throw new Failure('TEXTO_MUITO_LONGO','Envie textos longos como anexo.',413);
    return updateRecord($id,$u,function($r)use($role,$text,$eventId){
        if(!in_array($r['status'],['open','uploading'],true))throw new Failure('REGISTRO_FECHADO','Este registro já está fechado.',409);
        foreach($r['turns'] as $t)if($eventId!==''&&($t['event_id']??'')===$eventId)return $r;
        if(trim($text)!=='')$r['turns'][]=['role'=>$role,'text'=>$text,'at'=>date(DATE_ATOM),'event_id'=>$eventId?:bin2hex(random_bytes(8))];
        return $r;
    });
}
function legacy():void {
    static $loaded=false;if($loaded)return;
    $p=dirname(root()).'/assistant/common.php';
    if(!is_file($p))throw new Failure('ADAPTER_OFICIAL_AUSENTE','O arquivo assistant/common.php enviado como referência não foi encontrado no servidor.',503);
    require_once $p;$loaded=true;
}
function userFromMaster(string $email):?array {
    legacy();if(!function_exists('mobile_users_rows'))throw new Failure('CADASTRO_INCOMPATIVEL','O adaptador de usuários precisa ser conferido.',503);
    $found=[];foreach(\mobile_users_rows() as $r)if(strtolower(trim((string)($r['email']??'')))===strtolower(trim($email)))$found[]=$r;
    if(count($found)!==1)return null;return $found[0];
}
function masterUsersDocument():array {
    $base=dirname(root());$candidates=[
        $base.'/admin/data/usuarios.json',$base.'/obras/usuarios_erp.json',$base.'/usuarios_erp.json',$base.'/admin/usuarios_erp.json'
    ];
    foreach($candidates as $path){
        if(!is_file($path))continue;
        $doc=json_decode((string)file_get_contents($path),true);
        if(!is_array($doc)||!$doc)continue;
        if(array_is_list($doc))return ['path'=>$path,'doc'=>$doc,'key'=>null,'rows'=>$doc];
        foreach(['usuarios','data'] as $key)if(isset($doc[$key])&&is_array($doc[$key]))return ['path'=>$path,'doc'=>$doc,'key'=>$key,'rows'=>$doc[$key]];
    }
    throw new Failure('CADASTRO_INDISPONIVEL','O cadastro oficial de usuários não está disponível.',503);
}
function writeMasterUsersPassword(string $email,string $passwordHash):void {
    $source=masterUsersDocument();$path=$source['path'];
    locked($path.'.password.lock',function()use($path,$email,$passwordHash){
        $source=masterUsersDocument();
        if($source['path']!==$path)throw new Failure('CADASTRO_ALTERADO','O cadastro oficial mudou durante a operação. Tente novamente.',409);
        $rows=$source['rows'];$matches=[];
        foreach($rows as $i=>$row)if(is_array($row)&&strtolower(trim((string)($row['email']??'')))===strtolower(trim($email)))$matches[]=$i;
        if(count($matches)!==1)throw new Failure('RECUPERACAO_INVALIDA','Código inválido ou expirado.',422);
        $i=$matches[0];$field=array_key_exists('senha_hash',$rows[$i])&&!array_key_exists('senhaHash',$rows[$i])?'senha_hash':'senhaHash';
        $rows[$i][$field]=$passwordHash;
        if($source['key']===null)$doc=$rows;else{$doc=$source['doc'];$doc[$source['key']]=$rows;}
        $json=json_encode($doc,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_INVALID_UTF8_SUBSTITUTE);
        if($json===false)throw new Failure('FALHA_GRAVACAO','Não foi possível preparar a atualização da senha.',503);
        $mode=@fileperms($path);$tmp=$path.'.tmp.'.bin2hex(random_bytes(6));
        if(file_put_contents($tmp,$json.PHP_EOL,LOCK_EX)===false)throw new Failure('FALHA_GRAVACAO','Não foi possível gravar a nova senha.',503);
        if($mode!==false)@chmod($tmp,$mode&0777);
        if(!rename($tmp,$path)){@unlink($tmp);throw new Failure('FALHA_GRAVACAO','Não foi possível confirmar a nova senha.',503);}
    });
}
function passwordRecoveryMailConfig():array {
    // Fonte SMTP única e oficial: a mesma já utilizada pelo módulo de Materiais.
    // Com Core.php em /www/api/george-reuniao/v09/lib, este caminho resolve para
    // /www/api/materiais/smtp_config.php.
    $path=dirname(root()).'/materiais/smtp_config.php';
    if(!is_file($path))throw new \RuntimeException('Configuração de e-mail de Materiais não encontrada.');
    $local=require $path;
    if(!is_array($local))throw new \RuntimeException('Configuração de e-mail de Materiais inválida.');
    return [
        'host'=>$local['host']??'',
        'port'=>(int)($local['port']??587),
        'user'=>$local['user']??'',
        'pass'=>$local['pass']??'',
        'secure'=>strtolower((string)($local['secure']??'tls')),
        'from'=>$local['from']??$local['user']??''
    ];
}
function sendPasswordRecoveryEmail(string $to,string $code):void {
    $c=passwordRecoveryMailConfig();
    if(!$c['host']||!$c['user']||!$c['pass']||!$c['from'])throw new \RuntimeException('SMTP não configurado no KingHost.');
    foreach([$to,$c['from']] as $email)if(!filter_var($email,FILTER_VALIDATE_EMAIL))throw new \RuntimeException('Endereço de e-mail inválido.');
    $read=function($fp){$s='';while(($line=fgets($fp,515))!==false){$s.=$line;if(strlen($line)<4||$line[3]!=='-')break;}return $s;};
    $cmd=function($fp,$command,$ok)use($read){fwrite($fp,$command."\r\n");$response=$read($fp);$status=(int)substr($response,0,3);if(!in_array($status,(array)$ok,true))throw new \RuntimeException('Servidor de e-mail recusou a operação.');};
    $target=($c['secure']==='ssl'?'ssl://':'').$c['host'].':'.$c['port'];
    $fp=@stream_socket_client($target,$errno,$errstr,10);if(!$fp)throw new \RuntimeException('Não foi possível conectar ao servidor de e-mail.');
    try{
        stream_set_timeout($fp,10);$read($fp);$cmd($fp,'EHLO erpimpar.com.br',[250]);
        if($c['secure']==='tls'){$cmd($fp,'STARTTLS',[220]);if(!stream_socket_enable_crypto($fp,true,STREAM_CRYPTO_METHOD_TLS_CLIENT))throw new \RuntimeException('Falha na conexão segura com o e-mail.');$cmd($fp,'EHLO erpimpar.com.br',[250]);}
        $cmd($fp,'AUTH LOGIN',[334]);$cmd($fp,base64_encode($c['user']),[334]);$cmd($fp,base64_encode($c['pass']),[235]);
        $cmd($fp,'MAIL FROM:<'.$c['from'].'>',[250]);$cmd($fp,'RCPT TO:<'.$to.'>',[250,251]);$cmd($fp,'DATA',[354]);
        $subject='Código para recuperar sua senha — ERP ÍMPAR';
        $html='<div style="font-family:Arial,sans-serif;color:#17394b"><h2>Recuperação de senha</h2><p>Use o código abaixo para criar uma nova senha no George:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">'.htmlspecialchars($code,ENT_QUOTES,'UTF-8').'</p><p>O código vale por 15 minutos e pode ser usado uma única vez.</p><p>Se você não solicitou a recuperação, ignore esta mensagem.</p></div>';
        $headers=['From: ERP ÍMPAR <'.$c['from'].'>','To: '.$to,'MIME-Version: 1.0','Content-Type: text/html; charset=UTF-8','Subject: =?UTF-8?B?'.base64_encode($subject).'?='];
        $body=implode("\r\n",$headers)."\r\n\r\n".$html;$body=preg_replace('/(?m)^\./','..',$body);
        fwrite($fp,$body."\r\n.\r\n");$response=$read($fp);if((int)substr($response,0,3)!==250)throw new \RuntimeException('Servidor de e-mail não confirmou o envio.');
        $cmd($fp,'QUIT',[221]);
    }finally{@fclose($fp);}
}
function loginLimitPath(string $email):string {
    $key=hash('sha256',($_SERVER['REMOTE_ADDR']??'').':'.strtolower(trim($email)));
    return storeRoot().'/limits/'.$key.'.json';
}
function passwordRecoveryRequest(array $in):array {
    $email=strtolower(trim((string)($in['email']??'')));
    $generic=['ok'=>true,'message'=>'Se o e-mail estiver cadastrado, o código foi enviado.'];
    if(!filter_var($email,FILTER_VALIDATE_EMAIL))return $generic;
    $rateKey=hash('sha256',($_SERVER['REMOTE_ADDR']??'').':'.$email);$ratePath=storeRoot().'/password_recovery_limits/'.$rateKey.'.json';
    locked($ratePath.'.lock',function()use($ratePath){
        $now=time();$rate=readJson($ratePath,['count'=>0,'until'=>$now+1800]);
        if(($rate['until']??0)<$now)$rate=['count'=>0,'until'=>$now+1800];
        if(($rate['count']??0)>=3)throw new Failure('RECUPERACAO_LIMITE','Aguarde 30 minutos antes de solicitar outro código.',429);
        $rate['count']=(int)($rate['count']??0)+1;atomic($ratePath,encode($rate));
    });
    $user=userFromMaster($email);
    if(!$user||($user['ativo']??false)!==true)return $generic;
    $code=str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT);$path=storeRoot().'/password_resets/'.hash('sha256',$email).'.json';
    atomic($path,encode(['email'=>$email,'code_hash'=>password_hash($code,PASSWORD_DEFAULT),'expires_at'=>time()+900,'attempts'=>0,'used'=>false]));
    try{
        sendPasswordRecoveryEmail($email,$code);
    }catch(\Throwable $e){
        @unlink($path);
        error_log('George password recovery mail: '.$e->getMessage());
        throw new Failure(
            'RECUPERACAO_EMAIL_FALHOU',
            'Não foi possível enviar o código de recuperação. O servidor de e-mail não confirmou o envio.',
            503
        );
    }
    return $generic;
}
function passwordRecoveryReset(array $in):array {
    $email=strtolower(trim((string)($in['email']??'')));$code=trim((string)($in['code']??''));$password=(string)($in['password']??'');
    if(!filter_var($email,FILTER_VALIDATE_EMAIL)||!preg_match('/^\d{6}$/D',$code))throw new Failure('RECUPERACAO_INVALIDA','Código inválido ou expirado.',422);
    if(strlen($password)<8||strlen($password)>200)throw new Failure('SENHA_INVALIDA','A nova senha deve ter entre 8 e 200 caracteres.',422);
    $path=storeRoot().'/password_resets/'.hash('sha256',$email).'.json';
    locked($path.'.lock',function()use($path,$email,$code,$password){
        $record=readJson($path,[]);
        if(!$record||($record['used']??true)===true||($record['expires_at']??0)<time()||($record['attempts']??0)>=5)throw new Failure('RECUPERACAO_INVALIDA','Código inválido ou expirado.',422);
        if(!password_verify($code,(string)($record['code_hash']??''))){$record['attempts']=(int)($record['attempts']??0)+1;atomic($path,encode($record));throw new Failure('RECUPERACAO_INVALIDA','Código inválido ou expirado.',422);}
        $user=userFromMaster($email);if(!$user||($user['ativo']??false)!==true)throw new Failure('RECUPERACAO_INVALIDA','Código inválido ou expirado.',422);
        writeMasterUsersPassword($email,password_hash($password,PASSWORD_DEFAULT));
        $record['used']=true;$record['used_at']=date(DATE_ATOM);atomic($path,encode($record));
        $limitPath=loginLimitPath($email);locked($limitPath.'.lock',function()use($limitPath){atomic($limitPath,encode(['count'=>0,'until'=>time()+900]));});
    });
    return ['ok'=>true,'message'=>'Senha redefinida. Entre usando a nova senha.'];
}
function safeUser(array $r):array {
    $mods=is_array($r['modulos']??null)?$r['modulos']:[];
    return ['id'=>(string)($r['id']??hash('sha256',strtolower($r['email']))),'nome'=>(string)($r['nome']??''),'email'=>strtolower($r['email']),
        'modules'=>$mods,'admin'=>in_array('admin',$mods,true)||strtolower((string)($r['perfil']??''))==='administrador',
        'company_id'=>(int)cfg()['company_id'],'company_name'=>(string)cfg()['company_name']];
}
function bootHttp(array $methods=['POST']):void {
    date_default_timezone_set('America/Sao_Paulo');ini_set('display_errors','0');
    header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
    $o=$_SERVER['HTTP_ORIGIN']??'';
    if($o!==''&&!in_array($o,cfg()['allowed_origins'],true))throw new Failure('ORIGEM_NEGADA','Origem não autorizada.',403);
    if($o!==''){header('Access-Control-Allow-Origin: '.$o);header('Access-Control-Allow-Credentials: true');header('Vary: Origin');}
    header('Access-Control-Allow-Methods: '.implode(', ',[...$methods,'OPTIONS']));
    header('Access-Control-Allow-Headers: Content-Type, X-George-CSRF');
    if(($_SERVER['REQUEST_METHOD']??'GET')==='OPTIONS'){http_response_code(204);exit;}
    if(!in_array($_SERVER['REQUEST_METHOD']??'GET',$methods,true))throw new Failure('METODO_INVALIDO','Método não autorizado.',405);
    $local=cfg()['test_mode']&&in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'],true);
    if(!$local&&empty($_SERVER['HTTPS'])&&($_SERVER['HTTP_X_FORWARDED_PROTO']??'')!=='https')throw new Failure('HTTPS_OBRIGATORIO','Acesse esta versão por HTTPS.',403);
    session_name('GEORGEV09');session_set_cookie_params(['lifetime'=>43200,'path'=>'/george-reuniao/v09/','secure'=>!$local,'httponly'=>true,'samesite'=>'Lax']);
    ini_set('session.use_strict_mode','1');session_start();
    if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
}
function actor(bool $csrf=true):array {
    $u=$_SESSION['user']??null;if(!is_array($u)||($_SESSION['expires']??0)<time())throw new Failure('LOGIN_NECESSARIO','Entre com seu usuário do ERP para continuar.',401);
    if($csrf&&!hash_equals((string)$_SESSION['csrf'],(string)($_SERVER['HTTP_X_GEORGE_CSRF']??'')))throw new Failure('CSRF_INVALIDO','Reabra a sessão do George.',403);
    $master=userFromMaster($u['email']);
    if(!$master||($master['ativo']??false)!==true)throw new Failure('USUARIO_INATIVO','Usuário não autorizado.',403);
    $fresh=safeUser($master);if(isset($u['company_id'])){$fresh['company_id']=(int)$u['company_id'];$fresh['company_name']=(string)$u['company_name'];}session_write_close();return $fresh;
}
function login(array $in):array {
    $email=trim((string)($in['email']??''));$pass=(string)($in['password']??'');
    $key=hash('sha256',($_SERVER['REMOTE_ADDR']??'').':'.strtolower($email));$path=storeRoot().'/limits/'.$key.'.json';
    return locked($path.'.lock',function()use($path,$email,$pass){
        $d=readJson($path,['count'=>0,'until'=>time()+900]);if($d['until']<time())$d=['count'=>0,'until'=>time()+900];
        if($d['count']>=5)throw new Failure('AGUARDE_LOGIN','Aguarde 15 minutos antes de tentar novamente.',429);
        $r=filter_var($email,FILTER_VALIDATE_EMAIL)?userFromMaster($email):null;
        $hash=$r['senhaHash']??$r['senha_hash']??'';
        if(!$r||($r['ativo']??false)!==true||!is_string($hash)||$hash===''||!password_verify($pass,$hash)){
            $d['count']++;atomic($path,encode($d));throw new Failure('LOGIN_INVALIDO','E-mail ou senha não conferem com o cadastro do ERP.',401);
        }
        atomic($path,encode(['count'=>0,'until'=>time()+900]));session_regenerate_id(true);
        $_SESSION['user']=safeUser($r);$_SESSION['expires']=time()+43200;$_SESSION['csrf']=bin2hex(random_bytes(32));
        return ['ok'=>true,'user'=>$_SESSION['user'],'csrf'=>$_SESSION['csrf']];
    });
}
function permission(array $u,string $mod):void {if(!$u['admin']&&!in_array($mod,$u['modules'],true))throw new Failure('SEM_PERMISSAO','Seu usuário não tem acesso a este módulo.',403);}
function body():array {
    $raw=file_get_contents('php://input');if(strlen($raw)>500000)throw new Failure('PAYLOAD_GRANDE','Requisição muito grande.',413);
    try{$j=json_decode($raw,true,512,JSON_THROW_ON_ERROR);}catch(\Throwable $e){throw new Failure('JSON_INVALIDO','Requisição JSON inválida.');}
    if(!is_array($j))throw new Failure('JSON_INVALIDO','Requisição JSON inválida.');return $j;
}
function out(array $data,int $code=200):never{http_response_code($code);header('Content-Type: application/json; charset=utf-8');echo encode($data);exit;}
function errorOut(\Throwable $e):never {
    if($e instanceof Failure)out(['ok'=>false,'status'=>$e->status,'error'=>$e->getMessage()],$e->http);
    $id=bin2hex(random_bytes(5));error_log('George V09 '.$id.' '.$e->getMessage());out(['ok'=>false,'status'=>'ERRO_INTERNO','error'=>'Falha interna. Referência: '.$id],500);
}
