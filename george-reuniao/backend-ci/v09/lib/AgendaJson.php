<?php
declare(strict_types=1);
namespace GeorgeV09;

/** Same domain operations, using the existing server files until SQL is explicitly activated. */
function agendaSqlMarkerPath(int $companyId):string {return storeRoot().'/companies/'.$companyId.'/agenda-sql-active.json';}
function agendaBackendJson(?array $u=null):bool {
    if((cfg()['agenda_backend']??'json')==='sql')return false;
    $companyId=(int)($u['company_id']??cfg()['company_id']);
    return !is_file(agendaSqlMarkerPath($companyId));
}
function agendaActivateSql(array $u):array {
    if(!$u['admin'])throw new Failure('ADMIN_OBRIGATORIO','Somente um administrador pode ativar o Banco V2.',403);
    $u=agendaDbActor($u);
    $verified=agendaReadSql($u);
    if(empty($verified['verified'])||($verified['persistence']??'')!=='SQL_E_JSON_VERIFICADOS')throw new Failure('BANCO_NAO_VERIFICADO','O Banco V2 ainda não está pronto para assumir a Agenda.',409);
    atomic(agendaSqlMarkerPath((int)$u['company_id']),encode(['version'=>'hf6','company_id'=>$u['company_id'],'revision'=>$verified['revision'],'active_date'=>$verified['data'],'activated_at'=>date(DATE_ATOM),'activated_by'=>$u['id']]));
    $final=agendaReadSql($u);
    return ['ok'=>true,'verified'=>true,'module'=>'agenda_dia','persistence'=>$final['persistence'],'active_date'=>$final['data'],'revision'=>$final['revision']];
}
function agendaFileActor(array $u):void {
    if((int)$u['company_id']!==(int)cfg()['company_id'])throw new Failure('EMPRESA_NAO_AUTORIZADA','Esta empresa não está habilitada neste servidor.',403);
}
final class AgendaFileCatalog {
    public function __construct(public array $data){}
    public function people():array {
        $out=[];$ids=[];
        foreach($this->data['colaboradores']??[] as $r){if(($r['active']??$r['ativo']??true)===false)continue;
            $id=(int)($r['id']??0);$name=trim((string)($r['name']??$r['nome']??''));
            if($id<1||$name===''||isset($ids[$id]))throw new Failure('CADASTRO_GLOBAL_INVALIDO','Confira os identificadores e nomes do cadastro global de colaboradores.',409);
            $ids[$id]=true;$out[]=['id'=>$id,'name'=>$name,'nome'=>$name,'role'=>$r['role']??$r['funcao']??'','cargo'=>$r['cargo']??'','cadastro_status'=>$r['cadastro_status']??'CADASTRADO'];
        }return $out;
    }
    public function aliases():array {
        $out=[];foreach($this->data['colaboradores']??[] as $r)foreach($r['aliases']??[] as $a)$out[]=['colaborador_id'=>(int)$r['id'],'alias'=>$a];return $out;
    }
    public function fleet():array {
        // Existing official Agenda fleet, copied verbatim from its registered options.
        $plates=$this->data['veiculos']??['RXO8A58','RXL6H17','IZH2A86','QIQ3921','QHQ8009','QII5E96','QIE6I52','QJO3249'];
        $out=[];foreach($plates as $i=>$p)$out[]=['id'=>is_array($p)?(int)($p['id']??($i+1)):$i+1,'placa'=>is_array($p)?$p['placa']:$p];return $out;
    }
    public function create(string $name):int {
        $id=1;foreach($this->data['colaboradores']??[] as $r)$id=max($id,(int)$r['id']+1);
        $this->data['colaboradores'][]=['id'=>$id,'name'=>$name,'role'=>'','cargo'=>'','active'=>true,'car'=>null,'cadastro_status'=>'PENDENTE_COMPLEMENTACAO','origem'=>'AGENDA_DO_DIA'];return $id;
    }
}
function agendaJsonPath(array $u):string {agendaFileActor($u);return storeRoot().'/companies/'.$u['company_id'].'/agenda-state.json';}
function agendaJsonProject(array $u,array &$state):void {
    if(empty($state['outbox']))return;$dir=agendaDataDir($u);
    // Guard old writers under the same lock before exposing the committed projection.
    atomic($dir.'/.agenda_rc2_active',encode(['version'=>'098rc3','backend'=>'json','company_id'=>$u['company_id']]));
    foreach($state['outbox']['write'] as $name=>$value){
        if(!preg_match('/^(cadastros_agenda_novo|agenda_draft_20\d{2}-\d{2}-\d{2}|historico_atividade_dia_20\d{2}-\d{2}-\d{2})\.json$/D',$name))throw new \LogicException('Invalid projection name');
        $path=$dir.'/'.$name;
        if(str_starts_with($name,'historico_')&&is_file($path)&&agendaHash(readJson($path))!==agendaHash($value))throw new Failure('HISTORICO_DIVERGENTE','O histórico existente precisa ser conferido antes de concluir.',409);
        agendaFault('before_json');atomic($path,encode($value));
        if(agendaHash(readJson($path))!==agendaHash($value))throw new Failure('PROJECAO_PENDENTE','A atualização ainda está sendo concluída. Retome o pedido para conferir o resultado.',503);
    }
    foreach($state['outbox']['delete'] as $name){if(!preg_match('/^agenda_draft_20\d{2}-\d{2}-\d{2}\.json$/D',$name))throw new \LogicException('Invalid projection delete');if(is_file($dir.'/'.$name)&&!unlink($dir.'/'.$name))throw new Failure('PROJECAO_PENDENTE','Falta concluir a abertura do próximo dia. Retome o pedido.',503);}
    $state['outbox']=null;atomic(agendaJsonPath($u),encode($state));
}
function agendaJsonLoad(array $u):array {
    $path=agendaJsonPath($u);$dir=agendaDataDir($u);
    $files=glob($dir.'/agenda_draft_*.json')?:[];if(count($files)!==1)throw new Failure('DRAFT_NAO_UNICO','É necessário ter um único rascunho da Agenda do Dia aberto. Nenhum dia foi criado ou substituído.',409);
    $raw=readJson($files[0]);if(!empty($raw['finalizado']))throw new Failure('DIA_FECHADO','O arquivo aberto está finalizado. Confira o rascunho ativo.',409);
    // O rascunho oficial aberto e sempre a verdade atual. O estado interno
    // conserva somente apoio operacional (eventos, undo e auditoria) e nunca
    // pode bloquear, reconstruir ou sobrescrever uma gravacao feita pelo ERP.
    $catalog=readJson($dir.'/cadastros_agenda_novo.json');$db=new AgendaFileCatalog($catalog);$draft=agendaNormalize($db,$u,$raw);
    if(is_file($path)){
        $state=readJson($path);$internal=$state['draft']??[];
        $revision=max(1,(int)($state['revision']??0),(int)($draft['_revision']??0));
        if(agendaHash($internal)!==agendaHash($draft))$state['undo']=[];
        $draft['_revision']=$revision;$state['revision']=$revision;$state['draft']=$draft;$state['catalog']=$catalog;$state['outbox']=null;
        return $state;
    }
    $revision=max(1,(int)($draft['_revision']??0));$draft['_revision']=$revision;$sha=hash_file('sha256',$files[0]);
    atomic(storeRoot().'/bootstrap/'.$u['company_id'].'/'.$sha.'.json',encode(['draft'=>$raw,'catalog'=>$catalog]));
    $state=['format'=>1,'company_id'=>$u['company_id'],'revision'=>$revision,'draft'=>$draft,'catalog'=>$catalog,'undo'=>[],'rules'=>[],'events'=>[],'histories'=>[], 'source_sha256'=>$sha,'outbox'=>null];
    atomic($path,encode($state));return $state;
}
function agendaRead(array $u,?string $date=null):array {
    if(!agendaBackendJson($u))return agendaReadSql($u,$date);permission($u,'atividades');agendaFileActor($u);
    if($date!==null&&$date!==''&&!preg_match('/^20\d{2}-\d{2}-\d{2}$/D',$date))throw new Failure('DATA_INVALIDA','Data inválida.');
    return agendaWithLock($u,function()use($u,$date){$s=agendaJsonLoad($u);$draft=$s['draft'];$dir=agendaDataDir($u);
        if($date&&$date!==$draft['data']){$p=$dir.'/historico_atividade_dia_'.$date.'.json';$draft=readJson($p);if(empty($draft['finalizado'])&&($draft['tipo']??'')!=='historico')throw new Failure('HISTORICO_INVALIDO','Não encontrei um histórico finalizado para a data.',409);if(isset($s['histories'][$date])&&!hash_equals($s['histories'][$date],hash_file('sha256',$p)))throw new Failure('HISTORICO_DIVERGENTE','O histórico foi modificado após a finalização.',409);}
        $hist=[];foreach(glob($dir.'/historico_atividade_dia_*.json')?:[] as $p)if(preg_match('/(20\d{2}-\d{2}-\d{2})\.json$/D',$p,$m))$hist[]=['data'=>$m[1]];usort($hist,fn($a,$b)=>strcmp($b['data'],$a['data']));
        return ['ok'=>true,'verified'=>true,'source'=>'Fonte operacional da Agenda do Dia','persistence'=>'ARQUIVOS_VERIFICADOS','data'=>$draft['data'],'status'=>!empty($draft['finalizado'])?'Histórico':'Rascunho','atividades'=>$draft['atividades'],'draft'=>$draft,'revision'=>$s['revision'],'historicos'=>$hist];
    });
}
function agendaCatalog(array $u):array {
    permission($u,'atividades');if(!agendaBackendJson($u)){agendaDbActor($u);return agendaMaster(agendaDb(),$u);}agendaFileActor($u);
    return agendaWithLock($u,fn()=>(new AgendaFileCatalog(readJson(agendaDataDir($u).'/cadastros_agenda_novo.json')))->people());
}
function agendaExecute(array $u,array $request):array {
    if(!agendaBackendJson($u))return agendaExecuteSql($u,$request);permission($u,'atividades');agendaFileActor($u);
    if(isset($request['company_id'])&&(int)$request['company_id']!==(int)$u['company_id'])throw new Failure('EMPRESA_ALTERADA','Atualize a tela para a empresa ativa antes de operar.',409);
    $event=(string)($request['event_id']??'');if($event===''||strlen($event)>120)throw new Failure('EVENTO_INVALIDO','Identificador da operação ausente.');
    $key=hash('sha256',$u['company_id'].':'.$u['id'].':'.$event);$hash=hash('sha256',encode($request));
    return agendaWithLock($u,function()use($u,$request,$event,$key,$hash){
        $s=agendaJsonLoad($u);$rev=$s['revision'];$before=$s['draft'];$draft=$before;$db=new AgendaFileCatalog($s['catalog']);
        if(isset($s['events'][$key])){$old=$s['events'][$key];if(!hash_equals($old['hash'],$hash))throw new Failure('EVENTO_REUTILIZADO','O identificador do pedido foi reutilizado com outro conteúdo.',409);return array_merge($old['reply'],['cached'=>true,'original_revision'=>$old['reply']['revision'],'revision'=>$rev,'draft'=>$draft]);}
        // A revisao e somente auditoria; nao bloqueia a ultima gravacao valida.
        if(!empty($request['data'])&&$request['data']!==$draft['data'])throw new Failure('DIA_NAO_EDITAVEL','Somente o rascunho aberto pode ser alterado.',409);
        $tx=agendaOpsTx();$mode=(string)($request['operation']??'plan');$results=[];$history=null;
        if($mode==='undo'||$mode==='undo_all'){$stack=$s['undo']??[];if(!$stack)throw new Failure('SEM_UNDO','Não há alterações depois do último Salvar.',409);$entry=$mode==='undo_all'?$stack[0]:array_pop($stack);$draft=$entry['draft'];$s['undo']=$mode==='undo_all'?[]:$stack;}
        elseif($mode==='checkpoint'){$s['undo']=[];$s['checkpoint_at']=agendaOpsNow();}
        elseif($mode==='replace_visible')$draft=agendaVisible($db,$u,$draft,$request['draft']??[],$tx);
        elseif($mode==='plan'){
            $steps=$request['steps']??[];if(!is_array($steps)||count($steps)<1||count($steps)>40)throw new Failure('PLANO_INVALIDO','Envie de 1 a 40 operações por pedido.');
            foreach($steps as $index=>$step){if(!is_array($step))throw new Failure('PLANO_INVALIDO','Operação inválida.');
                if(($step['operacao']??'')==='finalizar'){
                    if($index!==count($steps)-1)throw new Failure('FINALIZACAO_ULTIMA','Finalizar deve ser a última etapa do pedido.');
                    foreach($step['excecoes']??[] as $i=>$e)if(!empty($e['colaborador'])){$r=agendaPersonInDay($db,$u,$draft,(string)$e['colaborador']);if(empty($r['ok']))return $r+['step_index'=>$index,'atomic'=>true,'written'=>false,'revision'=>$rev];$step['excecoes'][$i]['colaborador']=$r['person']['name'];}
                    $r=agendaCloseValues($draft,$step);if(!empty($r['ok'])){$history=$draft;$history['finalizado']=true;$history['tipo']='historico';$history['status']='historico';$history['finalizedAt']=agendaOpsNow();agendaRebuildSchedule($history);$draft=agendaNextDay($db,$u,$draft);}
                }else $r=agendaApplyStep($db,$u,$draft,$step,$tx);
                if(empty($r['ok']))return $r+['step_index'=>$index,'atomic'=>true,'written'=>false,'revision'=>$rev];$results[]=$r;
            }
        }else throw new Failure('OPERACAO_INVALIDA','Operação não disponível.');
        $draft=agendaNormalize($db,$u,$draft);
        if($mode==='replace_visible'&&empty($request['checkpoint'])&&agendaHash($draft)===agendaHash($before))return ['ok'=>true,'verified'=>true,'noop'=>true,'revision'=>$rev,'data'=>$draft['data'],'draft'=>$draft,'source'=>'Fonte operacional da Agenda do Dia'];
        $newRev=$rev+1;$draft['_revision']=$newRev;$savedAt=agendaOpsNow();$savedBy=['id'=>$u['id'],'nome'=>$u['nome']??'','email'=>$u['email']??'','salvoEm'=>$savedAt,'operacao'=>$mode];
        $draft['updatedAt']=$savedAt;$draft['serverSavedAt']=$savedAt;$draft['usuarioAtualizacao']=$savedBy;
        if($history){$history=agendaNormalize($db,$u,$history);$history['_revision']=$newRev;$history['updatedAt']=$savedAt;$history['serverSavedAt']=$savedAt;$history['usuarioAtualizacao']=$savedBy;$s['undo']=[];$s['histories'][$history['data']]=hash('sha256',encode($history));}
        elseif($mode==='replace_visible'&&!empty($request['checkpoint'])){$s['undo']=[];$s['checkpoint_at']=agendaOpsNow();}
        elseif(!in_array($mode,['undo','undo_all','checkpoint'],true))$s['undo'][]=['draft'=>$before,'tx'=>$tx,'user'=>$u['id'],'at'=>agendaOpsNow()];
        $s['draft']=$draft;$s['catalog']=$db->data;$s['revision']=$newRev;
        $out=['write'=>['agenda_draft_'.$draft['data'].'.json'=>$draft,'cadastros_agenda_novo.json'=>$db->data],'delete'=>[]];if($history){$out['write']['historico_atividade_dia_'.$history['data'].'.json']=$history;$out['delete'][]='agenda_draft_'.$before['data'].'.json';}
        $reply=['ok'=>true,'verified'=>true,'atomic'=>true,'source'=>'Fonte operacional da Agenda do Dia','persistence'=>'ARQUIVOS_VERIFICADOS','transaction_id'=>$tx,'revision'=>$newRev,'data'=>$draft['data'],'finalized_date'=>$history['data']??null,'results'=>$results,'draft'=>$draft];
        $s['events'][$key]=['hash'=>$hash,'event'=>$event,'at'=>agendaOpsNow(),'user'=>$u['id'],'request'=>$request,'before'=>$before,'after'=>$history??$draft,'reply'=>$reply];$s['outbox']=$out;
        // One rename commits all operations, global links, undo and recoverable projections.
        agendaFault('before_commit');atomic(agendaJsonPath($u),encode($s));
        try{agendaJsonProject($u,$s);}catch(\Throwable $e){throw new Failure('PROJECAO_PENDENTE','O pedido ficou registrado, mas a atualização da tela ainda precisa ser concluída. Retome o mesmo pedido; ele não será duplicado.',503);}
        return $reply;
    });
}
function agendaRules(array $u):array {
    if(!agendaBackendJson($u))return agendaRulesSql($u);permission($u,'atividades');agendaFileActor($u);
    $all=readJson(storeRoot().'/companies/'.$u['company_id'].'/rules.json',['versions'=>[]]);$rows=[];foreach($all['versions'] as $versions)if($versions)$rows[]=end($versions);
    return ['ok'=>true,'company_id'=>$u['company_id'],'company_rules'=>$rows,'core_source'=>'Raio-X Agenda do Dia V1','core'=>(string)file_get_contents(dirname(__DIR__).'/context/raiox_agenda_v1.txt')];
}
function agendaRuleSave(array $u,array $in):array {
    if(!agendaBackendJson($u))return agendaRuleSaveSql($u,$in);permission($u,'atividades');agendaFileActor($u);if(!$u['admin'])throw new Failure('REGRA_REQUER_ADMIN','Somente um administrador pode registrar regras da empresa.',403);
    $key=(string)($in['key']??'');$text=trim((string)($in['text']??''));$source=trim((string)($in['source']??''));if(!preg_match('/^empresa\.[a-z0-9_]{1,60}$/D',$key)||$text===''||strlen($text)>12000||$source==='')throw new Failure('REGRA_INVALIDA','Informe a regra e a referência da aprovação.');
    $p=storeRoot().'/companies/'.$u['company_id'].'/rules.json';return locked($p.'.lock',function()use($u,$in,$key,$text,$source,$p){$all=readJson($p,['versions'=>[]]);$v=count($all['versions'][$key]??[]);if(!isset($in['expected_version'])||(int)$in['expected_version']!==$v)throw new Failure('REGRA_DESATUALIZADA','A regra mudou. Consulte a versão atual.',409);$all['versions'][$key][]=['empresa_id'=>$u['company_id'],'chave'=>$key,'versao'=>$v+1,'texto'=>$text,'fonte'=>$source,'usuario_id'=>$u['id'],'criado_em'=>agendaOpsNow()];atomic($p,encode($all));return ['ok'=>true,'verified'=>true,'key'=>$key,'version'=>$v+1,'company_id'=>$u['company_id']];});
}
function agendaEventReceipt(array $u,string $event):?array {
    if(!agendaBackendJson($u))return null;agendaFileActor($u);$path=agendaJsonPath($u);if(!is_file($path))return null;$key=hash('sha256',$u['company_id'].':'.$u['id'].':'.$event);$peek=readJson($path);if(!isset($peek['events'][$key]))return null;
    return agendaWithLock($u,function()use($u,$event){$state=agendaJsonLoad($u);$key=hash('sha256',$u['company_id'].':'.$u['id'].':'.$event);return $state['events'][$key]['reply']??null;});
}
