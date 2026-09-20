<?php
declare(strict_types=1);
require __DIR__.'/lib/Core.php';
require_once __DIR__.'/lib/AgendaStore.php';
require_once __DIR__.'/lib/AgendaJson.php';
require_once __DIR__.'/lib/AgendaDomain.php';
require_once __DIR__.'/lib/AgendaInstall.php';
require_once __DIR__.'/lib/Meeting.php';
require_once __DIR__.'/lib/AgendaTools.php';
require __DIR__.'/lib/AgendaOps.php';
require __DIR__.'/lib/AI.php';
require_once __DIR__.'/lib/Works.php';
require __DIR__.'/lib/Media.php';
require_once __DIR__.'/lib/MediaQueue.php';
require __DIR__.'/lib/Report.php';
require __DIR__.'/lib/Extensions.php';
use function GeorgeV09\{bootHttp,body,out,errorOut,actor,login,passwordRecoveryRequest,passwordRecoveryReset,cfg,storeRoot,record,recordDir,recordPath,newRecord,updateRecord,appendTurn,readJson,atomic,encode,locked,mediaCaps,mediaStart,receiveChunk,finishUpload,mediaStep,jobPublic,chatAnswer,permission,legacy};
use GeorgeV09\Failure;
try{
    bootHttp();
    $multipart=str_contains($_SERVER['CONTENT_TYPE']??'','multipart/form-data');$in=$multipart?$_POST:body();$action=(string)($in['action']??'');
    if($action==='session'){
        if(empty($_SESSION['user'])||($_SESSION['expires']??0)<time())out(['ok'=>true,'authenticated'=>false,'csrf'=>$_SESSION['csrf']]);
        $csrf=$_SESSION['csrf'];$u=actor(false);out(['ok'=>true,'authenticated'=>true,'user'=>$u,'csrf'=>$csrf]);
    }
    if($action==='login')out(login($in));
    if($action==='password_recovery_request')out(passwordRecoveryRequest($in));
    if($action==='password_recovery_reset')out(passwordRecoveryReset($in));
    if($action==='logout'){actor();session_start();$_SESSION=[];session_destroy();out(['ok'=>true]);}
    $u=actor();$id=(string)($in['record_id']??'');
    $boundWrites=['agenda_execute','agenda_rule_save','agenda_install','agenda_bootstrap_commit','agenda_activate_sql'];
    if($action!=='company_select'&&((isset($in['company_id'])&&(int)$in['company_id']!==(int)$u['company_id'])||(in_array($action,$boundWrites,true)&&!isset($in['company_id']))))throw new Failure('EMPRESA_ALTERADA','A empresa da sessão mudou ou não foi identificada. Atualize esta tela antes de operar.',409);
    if($action==='health'){
        legacy();$ctx=GeorgeV09\root().'/context';$contract=readJson(__DIR__.'/context/source_contract.json');$actual=hash_file('sha256',dirname(GeorgeV09\root()).'/assistant/common.php');
        out(['ok'=>true,'version'=>cfg()['version'],'user'=>$u,'media'=>mediaCaps(),
          'sources'=>['system_prompt'=>is_file($ctx.'/system_prompt.txt'),'context_master'=>is_file($ctx.'/context_master.json'),'official_adapter'=>function_exists('mobile_agenda_state_local'),'adapter_matches_uploaded_source'=>$actual===($contract['release_adapter_sha256']??$contract['source_files']['assistant/common.php']['sha256']??''),'raiox'=>is_file(__DIR__.'/context/raiox_agenda_v1.txt')],
          'config'=>['key_configured'=>(bool)(cfg()['openai_api_key']??''),'recording'=>cfg()['enable_recording']],
          'agenda_mode'=>'SERVICO_COMPARTILHADO','agenda_writes'=>['plano_composto','mover','copiar','colaborador_global','finalizar','undo','checkpoint'],'agenda_ops_version'=>'0.9.8-rc3','persistence'=>GeorgeV09\agendaHealth($u),'legacy_history_access'=>$u['admin']?'admin':'restricted',
          'legacy_history_count'=>$u['admin']?count(glob(GeorgeV09\root().'/storage/sessions/*.json')?:[]):null]);
    }
    if($action==='resume'){
        $key=hash('sha256',$u['company_id'].':'.$u['id']);$p=storeRoot().'/users/'.$key.'.json';
        $r=locked($p.'.lock',function()use($p,$u){$v=readJson($p,[]);$r=null;if(!empty($v['conversation'])){try{$r=record($v['conversation'],$u);}catch(Throwable $e){}}
            if(!$r||$r['status']!=='open'){$r=newRecord($u,'conversation');atomic($p,encode(['conversation'=>$r['id']]));}return $r;});
        $jobs=[];foreach(glob(storeRoot().'/records/*/record.json')?:[] as $f){$j=readJson($f);if($j['owner_id']===$u['id']&&$j['company_id']===$u['company_id']&&isset($j['job_state'])&&empty($j['meta']['source_record_id']))$jobs[]=jobPublic(record($j['id'],$u));}
        usort($jobs,fn($a,$b)=>strcmp($b['created_at'],$a['created_at']));
        $turns=array_slice($r['turns'],-240);$fallbackAt=$r['created_at']??date(DATE_ATOM);
        foreach($turns as &$turn){
            if(!empty($turn['at']))continue;
            foreach(['created_at','createdAt','timestamp','datetime','date_time','data_hora','time'] as $legacyKey){
                if(!empty($turn[$legacyKey])){$turn['at']=$turn[$legacyKey];break;}
            }
            if(empty($turn['at']))$turn['at']=$fallbackAt;
        }
        unset($turn);
        out(['ok'=>true,'record_id'=>$r['id'],'conversation_created_at'=>$fallbackAt,'turns'=>$turns,'total_turns'=>count($r['turns']),'draft'=>$r['meta']['draft']??'','module'=>$r['meta']['active_module']??'geral','jobs'=>$jobs]);
    }
    if($action==='conversation_new'){
        $key=hash('sha256',$u['company_id'].':'.$u['id']);$path=storeRoot().'/users/'.$key.'.json';
        $r=locked($path.'.lock',function()use($path,$u){$previous=readJson($path,[]);$r=newRecord($u,'conversation',['previous_record_id'=>$previous['conversation']??null]);atomic($path,encode(['conversation'=>$r['id']]));return $r;});out(['ok'=>true,'record_id'=>$r['id']]);
    }
    if($action==='module_select'){
        $module=(string)($in['module']??'');
        if(!in_array($module,['geral','agenda_dia'],true))throw new Failure('MODULO_INVALIDO','Esse módulo ainda não está disponível nesta versão.',422);
        $event=trim((string)($in['event_id']??''));$text=trim((string)($in['text']??''));
        $r=updateRecord($id,$u,function($r)use($module,$event,$text){
            $r['meta']['active_module']=$module;
            if($text!==''&&!array_filter($r['turns'],fn($t)=>($t['event_id']??'')===$event))$r['turns'][]=['role'=>'user','text'=>$text,'at'=>date(DATE_ATOM),'event_id'=>$event];
            return $r;
        });
        out(['ok'=>true,'module'=>$module,'revision'=>$r['revision']]);
    }
    if($action==='draft'){updateRecord($id,$u,function($r)use($in){$text=(string)($in['text']??'');if(strlen($text)>100000)throw new Failure('TEXTO_LONGO','O rascunho é muito grande.',413);$r['meta']['draft']=$text;return $r;});out(['ok'=>true]);}
    if($action==='chat')out(chatAnswer($id,$u,trim((string)($in['text']??'')),(string)($in['event_id']??bin2hex(random_bytes(12)))));
    if($action==='log'){$r=appendTurn($id,$u,'user',trim((string)($in['text']??'')),(string)($in['event_id']??''));out(['ok'=>true,'revision'=>$r['revision']]);}
    if($action==='log_turn'){
        $role=(string)($in['role']??'');
        if(!in_array($role,['user','assistant'],true))throw new Failure('ROLE_INVALIDO','Tipo de registro inválido.');
        $text=trim((string)($in['text']??''));
        if($text==='')throw new Failure('TEXTO_VAZIO','Não há conteúdo para registrar.');
        $r=appendTurn($id,$u,$role,$text,(string)($in['event_id']??bin2hex(random_bytes(12))));
        out(['ok'=>true,'revision'=>$r['revision']]);
    }
    if($action==='companies')out(['ok'=>true,'companies'=>GeorgeV09\agendaMemberships($u),'current'=>$u['company_id']]);
    if($action==='company_select'){
        $found=array_values(array_filter(GeorgeV09\agendaMemberships($u),fn($r)=>(int)$r['empresa_id']===(int)($in['company_id']??0)));
        if(count($found)!==1)throw new Failure('EMPRESA_NAO_AUTORIZADA','Vínculo com empresa não autorizado.',403);
        session_start();$u['company_id']=(int)$found[0]['empresa_id'];$u['company_name']=$found[0]['empresa_nome'];$_SESSION['user']=$u;session_write_close();out(['ok'=>true,'user'=>$u]);
    }
    if(in_array($action,['agenda_install_check','agenda_install','agenda_bootstrap_preview','agenda_bootstrap_commit','agenda_recover'],true)){
        if(!$u['admin'])throw new Failure('ADMIN_OBRIGATORIO','A instalação deve ser validada por administrador.',403);
        if($action==='agenda_install_check')out(GeorgeV09\agendaInstallDiagnostic($u));
        GeorgeV09\agendaDbActor($u);
        if($action==='agenda_install')out(GeorgeV09\agendaInstall(GeorgeV09\agendaDb()));
        if($action==='agenda_recover'){ $j=GeorgeV09\agendaRead($u);out(['ok'=>true,'verified'=>$j['verified'],'data'=>$j['data'],'revision'=>$j['revision']]); }
        out(GeorgeV09\agendaBootstrap($u,$action==='agenda_bootstrap_commit',$in['sha256']??null));
    }
    if($action==='agenda_activate_sql')out(GeorgeV09\agendaActivateSql($u));
    if($action==='document_works')out(GeorgeV09\worksForRecord($u,$id));
    if($action==='works_read')out(GeorgeV09\worksRead($u,$in));
    if($action==='agenda_read')out(GeorgeV09\agendaRead($u,$in['data']??null));
    if($action==='agenda_execute')out(GeorgeV09\agendaExecute($u,$in));
    if($action==='agenda_catalog'){permission($u,'atividades');out(['ok'=>true,'data'=>['colaboradores'=>GeorgeV09\agendaCatalog($u)]]);}
    if($action==='agenda_rules')out(GeorgeV09\agendaRules($u));
    if($action==='agenda_rule_save')out(GeorgeV09\agendaRuleSave($u,$in));
    if($action==='meeting_control')out(GeorgeV09\meetingControl($u,$in));
    if($action==='conversation_list')out(GeorgeV09\conversationList($u,$in));
    if($action==='document_create')out(GeorgeV09\documentCreate($u,$in));
    if($action==='derived_reset')out(GeorgeV09\derivedReset($u,$in));
    if($action==='derived_start')out(GeorgeV09\derivedStart($u,$in));
    if($action==='derived_finish')out(GeorgeV09\derivedFinish($u,$in));
    if($action==='meeting_review')out(GeorgeV09\meetingReviewDurable($u,$in));
    if($action==='media_queue')out(GeorgeV09\mediaQueue($u,$in));
    if($action==='media_queue_change')out(GeorgeV09\mediaQueueChange($u,$in));
    if($action==='media_start')out(mediaStart($u,$in));
    if($action==='upload_chunk'){
        $f=$_FILES['chunk']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name']))throw new Failure('UPLOAD_INVALIDO','O bloco não chegou corretamente. Confira os limites do PHP.',413);
        out(receiveChunk($id,$u,(int)($in['index']??-1),$f['tmp_name'],(int)$f['size']));
    }
    if($action==='upload_finish')out(finishUpload($id,$u,(int)($in['chunks']??0)));
    if($action==='step'){if(is_callable('set_time_limit'))@set_time_limit(190);out(mediaStep($id,$u));}
    if($action==='job')out(jobPublic(record($id,$u)));
    if($action==='record'){ $r=record($id,$u);out(['ok'=>true,'id'=>$id,'kind'=>$r['kind'],'turns'=>array_slice($r['turns']??[],-60),'attachments'=>$r['meta']['attachments']??[],'pending_question'=>$r['meta']['pending_question']??null,'documents'=>$r['meta']['documents']??[],'report'=>$r['report']??null,'job'=>isset($r['job_state'])?jobPublic($r):null]); }
    throw new Failure('ACAO_INVALIDA','Ação não disponível nesta versão.');
}catch(Throwable $e){errorOut($e);}
