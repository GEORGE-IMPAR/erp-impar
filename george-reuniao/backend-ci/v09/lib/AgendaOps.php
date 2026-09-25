<?php
declare(strict_types=1);
namespace GeorgeV09;

/*
 * George V0.9.4 — operações de rascunho da Agenda do Dia.
 *
 * Ponte de transição para a fonte operacional atual (JSON em /api/agenda/data),
 * reaproveitando o adapter físico já consolidado em assistant/common.php.
 *
 * Regras habilitadas neste pacote:
 * - incluir atividade manual/replanejada (roxa)
 * - copiar atividade para outro colaborador (origem preservada, destino roxo)
 * - cancelar atividade (semanal permanece cancelada; manual/replanejada desaparece)
 * - restaurar atividade semanal cancelada
 *
 * Não habilita: mover, remover colaborador, finalizar, criar próximo dia.
 */

function agendaOpsUserMeta(array $u):array {
    return [
        'id'=>(string)($u['id']??''),
        'nome'=>(string)($u['nome']??''),
        'email'=>(string)($u['email']??''),
        'empresa_id'=>(int)($u['company_id']??0),
        'origem'=>'GEORGE_V09'
    ];
}
function agendaOpsNow():string {
    return (new \DateTimeImmutable('now',new \DateTimeZone('America/Sao_Paulo')))->format(\DateTimeInterface::ATOM);
}
function agendaOpsTx():string {return 'G09-'.date('YmdHis').'-'.strtoupper(substr(bin2hex(random_bytes(5)),0,10));}
function agendaOpsNorm(string $s):string {legacy();return \mobile_norm($s);}
function agendaOpsWeekly(array $a):bool {
    if(array_key_exists('origemSemanal',$a))return $a['origemSemanal']===true;
    return ($a['origemSemanal']??false)===true ||
           ($a['importedFromFrozenWeek']??false)===true ||
           trim((string)($a['chaveOriginal']??$a['__originalComparisonKey']??''))!=='';
}
function agendaOpsScheduleRemove(array &$draft,string $id):void {
    if(!is_array($draft['schedule']??null))return;
    foreach($draft['schedule'] as $key=>$items){
        if(!is_array($items))continue;
        foreach($items as $i=>$item){
            if(is_array($item)&&(string)($item['id']??'')===$id){array_splice($draft['schedule'][$key],$i,1);break 2;}
        }
    }
}
function agendaOpsScheduleReplace(array &$draft,string $id,array $replacement):void {
    if(!is_array($draft['schedule']??null))return;
    foreach($draft['schedule'] as $key=>$items){
        if(!is_array($items))continue;
        foreach($items as $i=>$item){
            if(is_array($item)&&(string)($item['id']??'')===$id){$draft['schedule'][$key][$i]=array_merge($item,$replacement);return;}
        }
    }
}
function agendaOpsPersonId(array $draft,string $name):?string {
    $n=agendaOpsNorm($name);
    foreach(($draft['people']??[]) as $p){
        if(!is_array($p))continue;
        if(agendaOpsNorm((string)($p['name']??$p['nome']??''))===$n){
            $id=(string)($p['id']??'');return $id!==''?$id:null;
        }
    }
    return null;
}
function agendaOpsPersonRole(array $draft,string $name):string {
    $n=agendaOpsNorm($name);
    foreach(($draft['people']??[]) as $p){
        if(!is_array($p))continue;
        if(agendaOpsNorm((string)($p['name']??$p['nome']??''))===$n)return (string)($p['role']??$p['funcao']??'execucao');
    }
    return 'execucao';
}
function agendaOpsScheduleAppend(array &$draft,string $personName,array $item):void {
    if(!is_array($draft['schedule']??null))return;
    $pid=agendaOpsPersonId($draft,$personName);
    if($pid===null)return;
    $key=$pid.'_0';
    if(!is_array($draft['schedule'][$key]??null))$draft['schedule'][$key]=[];
    $draft['schedule'][$key][]=$item;
}

function agendaOpsResolvePerson(string $query,array $draft):array {
    legacy();$r=\mobile_agenda_resolve_person($query,$draft);
    if(($r['status']??'')==='resolved')return ['ok'=>true,'name'=>(string)$r['name']];
    if(($r['status']??'')==='ambiguous')return ['ok'=>false,'status'=>'COLABORADOR_AMBIGUO','needs_choice'=>true,'candidates'=>array_map(fn($x)=>$x['name']??'',array_slice($r['candidates']??[],0,5))];
    return ['ok'=>false,'status'=>'COLABORADOR_NAO_ENCONTRADO','needs_choice'=>false,'message'=>'Não identifiquei o colaborador com segurança no cadastro atual.'];
}
function agendaOpsCandidatePublic(array $a):array {
    return [
        'id'=>(string)($a['id']??''),
        'colaborador'=>(string)($a['colaborador']??''),
        'obra'=>(string)($a['obra']??''),
        'atividade'=>(string)($a['atividade']??''),
        'horas'=>(float)($a['horas']??8),
        'viagem'=>(bool)($a['viagem']??false),
        'cancelada'=>legacyBoolCancelled($a),
        'origem'=>agendaOpsWeekly($a)?'SEMANAL':'MANUAL_REPLANEJADA'
    ];
}
function legacyBoolCancelled(array $a):bool {legacy();return \mobile_agenda_is_cancelled($a);}

function agendaOpsSelect(array $draft,string $person,string $obra='',string $atividade='',bool $cancelled=false,string $selectedId=''):array {
    $resolved=agendaOpsResolvePerson($person,$draft);
    if(empty($resolved['ok']))return $resolved;
    $name=$resolved['name'];$rows=[];
    $qObra=trim($obra);$qAtv=trim($atividade);
    foreach(($draft['atividades']??[]) as $a){
        if(!is_array($a))continue;
        if($selectedId!==''&&(string)($a['id']??'')!==$selectedId)continue;
        if(agendaOpsNorm((string)($a['colaborador']??''))!==agendaOpsNorm($name))continue;
        $isCancelled=legacyBoolCancelled($a);
        if($cancelled!==$isCancelled)continue;
        $score=1.0;
        if($qObra!=='')$score*=\mobile_similarity((string)($a['obra']??''),$qObra);
        if($qAtv!=='')$score*=\mobile_similarity((string)($a['atividade']??''),$qAtv);
        if(($qObra!==''||$qAtv!=='')&&$score<0.40)continue;
        $rows[]=['item'=>$a,'score'=>$score];
    }
    usort($rows,fn($a,$b)=>$b['score']<=>$a['score']);
    if(!$rows)return ['ok'=>false,'status'=>'ATIVIDADE_NAO_ENCONTRADA','message'=>'Não encontrei uma atividade correspondente no draft atual.'];
    if(count($rows)>1){
        $margin=$rows[0]['score']-($rows[1]['score']??0);
        $strong=($qObra!==''||$qAtv!=='') && $rows[0]['score']>=0.76 && $margin>=0.12;
        if(!$strong)return ['ok'=>false,'status'=>'ATIVIDADE_AMBIGUA','needs_choice'=>true,'candidates'=>array_map(fn($x)=>agendaOpsCandidatePublic($x['item']),array_slice($rows,0,5))];
    }
    return ['ok'=>true,'person'=>$name,'item'=>$rows[0]['item']];
}

function agendaOpsUndoPath(array $u,string $date):string {
    $key=hash('sha256',(string)$u['company_id'].':'.(string)$u['id'].':'.$date);
    return storeRoot().'/agenda_undo/'.$key.'.json';
}
function agendaOpsUndoRead(array $u,string $date):array {
    return readJson(agendaOpsUndoPath($u,$date),['date'=>$date,'stack'=>[],'checkpoint_at'=>null]);
}
function agendaOpsUndoWrite(array $u,string $date,array $journal):void {
    $journal['date']=$date;$journal['updated_at']=agendaOpsNow();
    atomic(agendaOpsUndoPath($u,$date),encode($journal));
}
function agendaOpsPrepareUndo(array $u,string $date,array $before,string $op,string $tx):array {
    $j=agendaOpsUndoRead($u,$date);$stack=is_array($j['stack']??null)?$j['stack']:[];
    $stack[]=['at'=>agendaOpsNow(),'operation'=>$op,'transaction_id'=>$tx,'draft'=>$before];
    if(count($stack)>25)$stack=array_slice($stack,-25);
    $j['stack']=$stack;return $j;
}

function agendaOpsReadLockedDraft():array {
    legacy();$dir=\mobile_agenda_data_dir();$files=glob($dir.'/agenda_draft_*.json')?:[];sort($files,SORT_STRING);
    if(count($files)!==1)throw new Failure('AGENDA_DRAFT_INVALIDO',count($files)===0?'Draft atual da Agenda do Dia não encontrado.':'Há mais de um draft da Agenda do Dia; nenhuma escrita foi feita.',409);
    $file=$files[0];$draft=\mobile_read_json_strict($file);
    if(!is_array($draft['atividades']??null))throw new Failure('AGENDA_INCOMPATIVEL','O draft atual não contém atividades no formato esperado.',422);
    $date=(string)($draft['data']??'');if(!preg_match('/^20\d{2}-\d{2}-\d{2}$/D',$date))throw new Failure('AGENDA_DATA_INVALIDA','O draft atual não possui data válida.',422);
    return [$file,$draft,$date];
}
function agendaOpsWriteLocked(string $current,array $draft,string $date,array $u):string {
    legacy();$now=agendaOpsNow();$target=\mobile_agenda_data_dir().'/agenda_draft_'.$date.'.json';
    $draft['data']=$date;$draft['tipo']='draft';$draft['status']='draft';$draft['finalizado']=false;
    $draft['updatedAt']=$now;$draft['serverSavedAt']=$now;$draft['serverPath']=basename($target);$draft['usuarioAtualizacao']=agendaOpsUserMeta($u);
    \mobile_write_json_atomic($target,$draft);if($current!==$target&&is_file($current))@unlink($current);return $target;
}
function agendaOpsHash(array $draft):string {return hash('sha256',json_encode($draft['atividades']??[],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));}

/** Executes one read-modify-write under the same physical Agenda lock used by the legacy adapter. */
function agendaOpsMutate(array $u,string $operation,callable $fn):array {
    permission($u,'atividades');legacy();$dir=\mobile_agenda_data_dir();
    $lock=@fopen($dir.'/.atividade_dia.lock','c+');
    if($lock===false||!@flock($lock,LOCK_EX))throw new Failure('AGENDA_OCUPADA','A Agenda do Dia está sendo gravada. Tente novamente.',409);
    try{
        [$file,$draft,$date]=agendaOpsReadLockedDraft();$before=$draft;$tx=agendaOpsTx();
        $result=$fn($draft,$date,$tx);
        if(!is_array($result))$result=[];
        if(($result['write']??true)!==true){
            if(($result['verified_noop']??false)===true){
                return array_merge([
                    'ok'=>true,'verified'=>true,'data'=>$date,'transaction_id'=>$tx,
                    'source'=>'assistant/common.php + /api/agenda/data/agenda_draft_'.$date.'.json',
                    'persistence'=>'FONTE_OPERACIONAL_ATUAL','v2_mirror'=>'DESABILITADO_ATE_BOOTSTRAP_VALIDADO',
                    'noop'=>true
                ],$result,['write'=>null,'verified_noop'=>null]);
            }
            return array_merge(['ok'=>false,'data'=>$date,'transaction_id'=>$tx],$result);
        }
        $journal=agendaOpsPrepareUndo($u,$date,$before,$operation,$tx);
        $target=agendaOpsWriteLocked($file,$draft,$date,$u);
        $verify=\mobile_read_json_strict($target);
        if(agendaOpsHash($verify)!==agendaOpsHash($draft)){
            // Restaura o estado anterior se a releitura não confere.
            agendaOpsWriteLocked($target,$before,$date,$u);
            throw new Failure('AGENDA_VERIFICACAO_FALHOU','A gravação não pôde ser confirmada; o estado anterior foi restaurado.',500);
        }
        try{agendaOpsUndoWrite($u,$date,$journal);}catch(\Throwable $e){
            agendaOpsWriteLocked($target,$before,$date,$u);
            throw new Failure('UNDO_INDISPONIVEL','A operação foi revertida porque o registro de desfazer não pôde ser criado.',500);
        }
        return array_merge([
            'ok'=>true,'verified'=>true,'data'=>$date,'transaction_id'=>$tx,
            'source'=>'assistant/common.php + /api/agenda/data/agenda_draft_'.$date.'.json',
            'persistence'=>'FONTE_OPERACIONAL_ATUAL','v2_mirror'=>'DESABILITADO_ATE_BOOTSTRAP_VALIDADO'
        ],$result,['write'=>null]);
    }finally{@flock($lock,LOCK_UN);@fclose($lock);}
}

function agendaOpsRequireCurrentDate(string $asked,string $actual):void {
    if($asked!==''&&$asked!==$actual)throw new Failure('AGENDA_DATA_NAO_EDITAVEL','Apenas o draft atualmente aberto ('.date('d/m/Y',strtotime($actual)).') pode ser alterado. Histórico continua somente leitura.',409);
}

function agendaOpsAdd(array $u,array $a):array {
    return agendaOpsMutate($u,'ADD',function(&$draft,$date,$tx)use($a){
        agendaOpsRequireCurrentDate(trim((string)($a['data']??'')),$date);
        $personQuery=trim((string)($a['colaborador']??''));$obra=trim((string)($a['obra']??''));$atividade=trim((string)($a['atividade']??''));
        if($personQuery===''||$obra===''||$atividade==='')return ['write'=>false,'status'=>'DADOS_INCOMPLETOS','missing'=>array_values(array_filter(['colaborador'=>$personQuery===''?'colaborador':null,'obra'=>$obra===''?'obra':null,'atividade'=>$atividade===''?'atividade':null]))];
        $pr=agendaOpsResolvePerson($personQuery,$draft);if(empty($pr['ok']))return ['write'=>false]+$pr;
        $person=$pr['name'];$now=agendaOpsNow();$id='dia_'.$date.'_'.substr(hash('sha256',$tx.'|'.$person.'|'.$obra.'|'.$atividade),0,14);
        $travel=$a['viagem']??false;$travel=$travel===true||in_array(agendaOpsNorm((string)$travel),['sim','true','1'],true);
        $hours=(float)($a['horas']??8);if($hours<=0)$hours=8;
        $item=[
            'id'=>$id,'colaborador'=>$person,'funcao'=>agendaOpsPersonRole($draft,$person),
            'obra'=>$obra,'atividade'=>$atividade,'local'=>trim((string)($a['local']??'')),'horas'=>$hours,
            'viagem'=>$travel,'carro'=>trim((string)($a['carro']??''))?:null,
            'cancelado'=>false,'cancelled'=>false,'status'=>'','auditStatus'=>'replanned','replanejado'=>true,
            'importedFromFrozenWeek'=>false,'origemSemanal'=>false,'chaveOriginal'=>null,
            'planejado'=>null,'executado'=>['obra'=>$obra,'atividade'=>$atividade,'viagem'=>$travel],
            'motivoReplanejamento'=>'','operacaoOrigem'=>'ADD','origemAcao'=>'GEORGE','transacaoId'=>$tx,
            'createdAt'=>$now,'updatedAt'=>$now
        ];
        $draft['atividades'][]=$item;agendaOpsScheduleAppend($draft,$person,$item);
        return ['status'=>'ATIVIDADE_ADICIONADA','atividade'=>agendaOpsCandidatePublic($item),'visual'=>'ROXA'];
    });
}

function agendaOpsExistingCopy(array $draft,string $sourceId,string $destName):?array {
    foreach(($draft['atividades']??[]) as $item){
        if(!is_array($item) || legacyBoolCancelled($item))continue;
        if(agendaOpsNorm((string)($item['colaborador']??''))!==agendaOpsNorm($destName))continue;
        if((string)($item['copiadoDeItemId']??'')===$sourceId)return $item;
    }
    return null;
}
function agendaOpsBuildCopy(array $draft,array $orig,string $sourceName,string $destName,string $date,string $tx,string $operation='COPY'):array {
    $now=agendaOpsNow();$copy=$orig;
    $copy['id']='dia_'.$date.'_'.substr(hash('sha256',$tx.'|'.$operation.'|'.($orig['id']??'').'|'.$destName),0,14);
    $copy['colaborador']=$destName;$copy['funcao']=agendaOpsPersonRole($draft,$destName);
    $copy['originalItemId']=$orig['originalItemId']??$orig['id']??null;
    $copy['copiadoDeItemId']=$orig['id']??null;$copy['copiadoDeColaborador']=$sourceName;
    $copy['cancelado']=false;$copy['cancelled']=false;$copy['status']='';$copy['auditStatus']='replanned';$copy['replanejado']=true;
    $copy['importedFromFrozenWeek']=false;$copy['origemSemanal']=false;$copy['chaveOriginal']=null;
    unset($copy['__originalComparisonKey'],$copy['sourceWeekDay'],$copy['cancelamento'],$copy['canceladoEm'],$copy['motivoCancelamento'],$copy['fechamentoPreenchido'],$copy['executada'],$copy['percentualExecutado'],$copy['motivoExecucao']);
    $copy['motivoReplanejamento']='';$copy['operacaoOrigem']=$operation;$copy['origemAcao']='GEORGE';$copy['transacaoId']=$tx;
    $copy['createdAt']=$now;$copy['updatedAt']=$now;
    return $copy;
}

function agendaOpsCopy(array $u,array $a):array {
    return agendaOpsMutate($u,'COPY',function(&$draft,$date,$tx)use($a){
        agendaOpsRequireCurrentDate(trim((string)($a['data']??'')),$date);
        $source=agendaOpsSelect($draft,trim((string)($a['origem_colaborador']??'')),trim((string)($a['obra']??'')),trim((string)($a['atividade']??'')),false,(string)($a['atividade_id']??''));
        if(empty($source['ok']))return ['write'=>false]+$source;
        $dest=agendaOpsResolvePerson(trim((string)($a['destino_colaborador']??'')),$draft);if(empty($dest['ok']))return ['write'=>false]+$dest;
        $sourceName=$source['person'];$destName=$dest['name'];
        if(agendaOpsNorm($sourceName)===agendaOpsNorm($destName))return ['write'=>false,'status'=>'DESTINO_IGUAL_ORIGEM','message'=>'Origem e destino são o mesmo colaborador.'];
        $orig=$source['item'];$sourceId=(string)($orig['id']??'');
        if($sourceId!=='' && ($existing=agendaOpsExistingCopy($draft,$sourceId,$destName))){
            return [
                'write'=>false,'verified_noop'=>true,'status'=>'COPIA_JA_EXISTE',
                'origem'=>agendaOpsCandidatePublic($orig),'destino'=>agendaOpsCandidatePublic($existing),
                'visual_destino'=>'ROXA','origem_preservada'=>true,
                'message'=>'A cópia desta atividade já existe para o colaborador de destino. Nenhuma duplicidade foi criada.'
            ];
        }
        $copy=agendaOpsBuildCopy($draft,$orig,$sourceName,$destName,$date,$tx,'COPY');
        $draft['atividades'][]=$copy;agendaOpsScheduleAppend($draft,$destName,$copy);
        return ['status'=>'ATIVIDADE_COPIADA','origem'=>agendaOpsCandidatePublic($orig),'destino'=>agendaOpsCandidatePublic($copy),'visual_destino'=>'ROXA','origem_preservada'=>true];
    });
}

function agendaOpsCopyMany(array $u,array $a):array {
    return agendaOpsMutate($u,'COPY_MANY',function(&$draft,$date,$tx)use($a){
        agendaOpsRequireCurrentDate(trim((string)($a['data']??'')),$date);
        $source=agendaOpsSelect(
            $draft,
            trim((string)($a['origem_colaborador']??'')),
            trim((string)($a['obra']??'')),
            trim((string)($a['atividade']??'')),
            false,(string)($a['atividade_id']??'')
        );
        if(empty($source['ok']))return ['write'=>false]+$source;

        $sourceName=$source['person'];$orig=$source['item'];$sourceId=(string)($orig['id']??'');
        $todos=($a['todos_outros']??false)===true;
        $destNames=[];

        if($todos){
            foreach(($draft['people']??[]) as $p){
                if(!is_array($p) || ($p['active']??$p['ativo']??true)===false)continue;
                $name=trim((string)($p['name']??$p['nome']??''));
                if($name==='' || agendaOpsNorm($name)===agendaOpsNorm($sourceName))continue;
                $destNames[]=$name;
            }
        }else{
            $raw=$a['destinos']??[];
            if(is_string($raw))$raw=preg_split('/[,;]+/u',$raw)?:[];
            if(!is_array($raw))$raw=[];
            foreach($raw as $query){
                $query=trim((string)$query);if($query==='')continue;
                $dest=agendaOpsResolvePerson($query,$draft);
                if(empty($dest['ok']))return ['write'=>false]+$dest+['destino_consultado'=>$query];
                if(agendaOpsNorm($dest['name'])===agendaOpsNorm($sourceName))continue;
                $destNames[]=$dest['name'];
            }
        }

        $unique=[];$seen=[];
        foreach($destNames as $name){
            $key=agendaOpsNorm($name);if($key===''||isset($seen[$key]))continue;
            $seen[$key]=true;$unique[]=$name;
        }
        $destNames=$unique;
        if(!$destNames)return ['write'=>false,'status'=>'DESTINOS_NAO_ENCONTRADOS','message'=>'Não encontrei outros colaboradores ativos na Agenda do Dia para receber a cópia.'];

        $created=[];$existing=[];
        foreach($destNames as $destName){
            if($sourceId!=='' && ($already=agendaOpsExistingCopy($draft,$sourceId,$destName))){
                $existing[]=agendaOpsCandidatePublic($already);
                continue;
            }
            $copy=agendaOpsBuildCopy($draft,$orig,$sourceName,$destName,$date,$tx,'COPY_MANY');
            $draft['atividades'][]=$copy;agendaOpsScheduleAppend($draft,$destName,$copy);
            $created[]=agendaOpsCandidatePublic($copy);
        }

        if(!$created){
            return [
                'write'=>false,'verified_noop'=>true,'status'=>'COPIAS_JA_EXISTEM',
                'origem'=>agendaOpsCandidatePublic($orig),'total_destinos'=>count($destNames),
                'copias_criadas'=>0,'copias_ja_existentes'=>count($existing),
                'destinos'=>array_values(array_map(fn($x)=>$x['colaborador'],$existing)),
                'message'=>'Todos os destinos já possuem esta cópia. Nenhuma duplicidade foi criada.',
                'undo_transacao_unica'=>true
            ];
        }

        return [
            'status'=>'ATIVIDADE_COPIADA_MULTIPLOS',
            'origem'=>agendaOpsCandidatePublic($orig),
            'total_destinos'=>count($destNames),
            'copias_criadas'=>count($created),
            'copias_ja_existentes'=>count($existing),
            'destinos_criados'=>array_values(array_map(fn($x)=>$x['colaborador'],$created)),
            'destinos_ja_existentes'=>array_values(array_map(fn($x)=>$x['colaborador'],$existing)),
            'visual_destino'=>'ROXA','origem_preservada'=>true,'undo_transacao_unica'=>true
        ];
    });
}

function agendaOpsCancel(array $u,array $a):array {
    return agendaOpsMutate($u,'CANCEL',function(&$draft,$date,$tx)use($a){
        agendaOpsRequireCurrentDate(trim((string)($a['data']??'')),$date);
        $sel=agendaOpsSelect($draft,trim((string)($a['colaborador']??'')),trim((string)($a['obra']??'')),trim((string)($a['atividade']??'')),false,(string)($a['atividade_id']??''));
        if(empty($sel['ok']))return ['write'=>false]+$sel;
        $id=(string)($sel['item']['id']??'');$weekly=agendaOpsWeekly($sel['item']);$now=agendaOpsNow();
        foreach($draft['atividades'] as $i=>$item){if(!is_array($item)||(string)($item['id']??'')!==$id)continue;
            if(!$weekly){array_splice($draft['atividades'],$i,1);agendaOpsScheduleRemove($draft,$id);return ['status'=>'ATIVIDADE_REMOVIDA','removed_id'=>$id,'visual'=>'DESAPARECE','origem'=>'MANUAL_REPLANEJADA'];}
            $item['__auditStatusBeforeCancel']=$item['auditStatus']??($item['replanejado']??false?'replanned':'planned');$item['__wasReplannedBeforeCancel']=(bool)($item['replanejado']??false);
            $item['cancelado']=true;$item['cancelled']=true;$item['status']='cancelado';$item['auditStatus']='cancelled';$item['canceladoEm']=$now;
            $motivo=trim((string)($a['motivo']??''));if($motivo!=='')$item['motivoCancelamento']=$motivo;elseif(!isset($item['motivoCancelamento']))$item['motivoCancelamento']='';
            $item['origemAcao']='GEORGE';$item['transacaoId']=$tx;$item['updatedAt']=$now;$draft['atividades'][$i]=$item;agendaOpsScheduleReplace($draft,$id,$item);
            return ['status'=>'ATIVIDADE_CANCELADA','atividade'=>agendaOpsCandidatePublic($item),'visual'=>'VERMELHA','motivo_pendente'=>$motivo===''];
        }
        return ['write'=>false,'status'=>'ATIVIDADE_NAO_ENCONTRADA'];
    });
}
function agendaOpsRestore(array $u,array $a):array {
    return agendaOpsMutate($u,'RESTORE',function(&$draft,$date,$tx)use($a){
        agendaOpsRequireCurrentDate(trim((string)($a['data']??'')),$date);
        $sel=agendaOpsSelect($draft,trim((string)($a['colaborador']??'')),trim((string)($a['obra']??'')),trim((string)($a['atividade']??'')),true,(string)($a['atividade_id']??''));
        if(empty($sel['ok']))return ['write'=>false]+$sel;
        $id=(string)($sel['item']['id']??'');if(!agendaOpsWeekly($sel['item']))return ['write'=>false,'status'=>'ATIVIDADE_NAO_RESTAURAVEL','message'=>'Somente atividade de origem semanal cancelada permanece disponível para restauração.'];
        foreach($draft['atividades'] as $i=>$item){if(!is_array($item)||(string)($item['id']??'')!==$id)continue;
            $item['cancelado']=false;$item['cancelled']=false;$item['status']='';$item['auditStatus']=$item['__auditStatusBeforeCancel']??(($item['replanejado']??false)?'replanned':'planned');$item['motivoCancelamento']='';
            unset($item['cancelamento'],$item['canceladoEm'],$item['__auditStatusBeforeCancel'],$item['__wasReplannedBeforeCancel']);
            $item['origemAcao']='GEORGE';$item['transacaoId']=$tx;$item['updatedAt']=agendaOpsNow();$draft['atividades'][$i]=$item;agendaOpsScheduleReplace($draft,$id,$item);
            return ['status'=>'ATIVIDADE_RESTAURADA','atividade'=>agendaOpsCandidatePublic($item),'visual'=>'NATURAL_VERDE_OU_LARANJA'];
        }
        return ['write'=>false,'status'=>'ATIVIDADE_NAO_ENCONTRADA'];
    });
}
function agendaOpsUndo(array $u,bool $all=false):array {
    permission($u,'atividades');legacy();$dir=\mobile_agenda_data_dir();$lock=@fopen($dir.'/.atividade_dia.lock','c+');if($lock===false||!@flock($lock,LOCK_EX))throw new Failure('AGENDA_OCUPADA','A Agenda do Dia está sendo gravada. Tente novamente.',409);
    try{
        [$file,$current,$date]=agendaOpsReadLockedDraft();$j=agendaOpsUndoRead($u,$date);$stack=is_array($j['stack']??null)?$j['stack']:[];
        if(!$stack)return ['ok'=>false,'status'=>'NADA_PARA_DESFAZER','data'=>$date,'message'=>'Não há alteração do George para desfazer desde o último checkpoint.'];
        $entry=$all?$stack[0]:end($stack);$target=$entry['draft']??null;if(!is_array($target))throw new Failure('UNDO_CORROMPIDO','O snapshot de desfazer não é válido.',500);
        $path=agendaOpsWriteLocked($file,$target,$date,$u);$verify=\mobile_read_json_strict($path);
        if(agendaOpsHash($verify)!==agendaOpsHash($target))throw new Failure('UNDO_NAO_CONFIRMADO','A restauração não pôde ser confirmada.',500);
        if($all)$stack=[];else array_pop($stack);$j['stack']=$stack;agendaOpsUndoWrite($u,$date,$j);
        return ['ok'=>true,'verified'=>true,'status'=>$all?'ALTERACOES_DESFEITAS':'ALTERACAO_DESFEITA','data'=>$date,'operation'=>$entry['operation']??'','transaction_id'=>$entry['transaction_id']??'','source'=>'George V0.9 undo + draft oficial'];
    }finally{@flock($lock,LOCK_UN);@fclose($lock);}
}
function agendaOpsCheckpoint(array $u):array {
    permission($u,'atividades');legacy();$dir=\mobile_agenda_data_dir();$lock=@fopen($dir.'/.atividade_dia.lock','c+');
    if($lock===false||!@flock($lock,LOCK_SH))throw new Failure('AGENDA_OCUPADA','A Agenda do Dia está sendo gravada. Tente novamente.',409);
    try{
        [,,$date]=agendaOpsReadLockedDraft();$j=agendaOpsUndoRead($u,$date);$j['stack']=[];$j['checkpoint_at']=agendaOpsNow();agendaOpsUndoWrite($u,$date,$j);
        return ['ok'=>true,'verified'=>true,'status'=>'RASCUNHO_SALVO_CHECKPOINT','data'=>$date,'checkpoint_at'=>$j['checkpoint_at'],'note'=>'O estado já estava persistido fisicamente; Salvar redefiniu o limite do Undo e não finalizou o dia.'];
    }finally{@flock($lock,LOCK_UN);@fclose($lock);}
}

function agendaOpsEdit(array $u,array $a):array {
    return agendaOpsMutate($u,'EDIT',function(&$draft,$date,$tx)use($a){
        agendaOpsRequireCurrentDate((string)($a['data']??''),$date);
        $sel=agendaOpsSelect($draft,(string)($a['colaborador']??''),(string)($a['obra']??''),(string)($a['atividade']??''),false,(string)($a['atividade_id']??''));
        if(empty($sel['ok']))return ['write'=>false]+$sel;
        $changes=$a['alteracoes']??[];$allowed=['obra','atividade','local','horas','viagem','carro'];
        if(!is_array($changes)||!count($changes)||array_diff(array_keys($changes),$allowed))return ['write'=>false,'status'=>'ALTERACOES_INVALIDAS'];
        foreach($changes as $key=>$value){if($key==='horas'&&(!is_numeric($value)||(float)$value<=0||(float)$value>24))return ['write'=>false,'status'=>'HORAS_INVALIDAS'];if($key==='viagem'&&!is_bool($value))return ['write'=>false,'status'=>'VIAGEM_INVALIDA'];if(!in_array($key,['horas','viagem'],true)&&(!is_string($value)||strlen($value)>2000||in_array($key,['obra','atividade'],true)&&trim($value)===''))return ['write'=>false,'status'=>'TEXTO_INVALIDO'];}
        $id=$sel['item']['id'];
        foreach($draft['atividades'] as $i=>$item){if(($item['id']??'')!==$id)continue;
            if(!isset($item['planejado'])||!is_array($item['planejado']))$item['planejado']=['obra'=>$item['obra']??'','atividade'=>$item['atividade']??'','viagem'=>$item['viagem']??false];
            foreach($changes as $key=>$value)$item[$key]=$key==='horas'?(float)$value:$value;
            $item['executado']=array_merge($item['executado']??[],array_intersect_key($changes,array_flip(['obra','atividade','viagem'])));
            $item['replanejado']=true;$item['auditStatus']='replanned';$item['motivoReplanejamento']='';$item['transacaoId']=$tx;$item['origemAcao']='GEORGE';$item['updatedAt']=agendaOpsNow();
            $draft['atividades'][$i]=$item;agendaOpsScheduleReplace($draft,$id,$item);return ['status'=>'ATIVIDADE_ALTERADA','atividade'=>agendaOpsCandidatePublic($item),'visual'=>'ROXA'];
        }return ['write'=>false,'status'=>'ATIVIDADE_NAO_ENCONTRADA'];
    });
}
