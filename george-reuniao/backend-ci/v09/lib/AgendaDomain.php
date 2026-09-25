<?php
declare(strict_types=1);
namespace GeorgeV09;

function agendaMissing(string $message,string $status='DADOS_INCOMPLETOS',array $extra=[]):array {return ['ok'=>false,'needs_choice'=>true,'status'=>$status,'message'=>$message]+$extra;}
function agendaRebuildSchedule(array &$draft):void {
    $schedule=[];$ids=[];foreach($draft['people'] as $p){$ids[norm($p['name'])]=(string)$p['id'];$schedule[$p['id'].'_0']=[];}
    foreach($draft['atividades'] as $a){$pid=$ids[norm($a['colaborador'])]??null;if($pid===null)throw new Failure('COLABORADOR_SEM_CARD','Uma atividade ficou sem colaborador vinculado.',422);$schedule[$pid.'_0'][]=$a;}
    $draft['schedule']=$schedule;
}
function agendaNormalize(object $db,array $u,array $draft):array {
    if(!preg_match('/^20\d{2}-\d{2}-\d{2}$/D',(string)($draft['data']??''))||!is_array($draft['people']??null)||!is_array($draft['atividades']??null))throw new Failure('DRAFT_INVALIDO','Data, colaboradores e atividades são obrigatórios.',422);
    $dt=\DateTimeImmutable::createFromFormat('!Y-m-d',$draft['data']);if(!$dt||$dt->format('Y-m-d')!==$draft['data'])throw new Failure('DATA_INVALIDA','Data inválida.');
    $seen=[];$names=[];
    foreach($draft['people'] as &$p){
        $query=isset($p['colaborador_id'])?'id:'.$p['colaborador_id']:(string)($p['name']??$p['nome']??'');$r=agendaMasterResolve($db,$u,$query);
        if(empty($r['ok'])){
            // O rascunho oficial da Agenda do Dia e a verdade do dia. Um card ja
            // presente nele nao pode bloquear salvar ou finalizar apenas porque
            // o cadastro global ainda nao foi complementado.
            $oldName=trim((string)($p['name']??$p['nome']??''));
            if($oldName==='')throw new Failure('COLABORADOR_SEM_NOME','Um colaborador do rascunho está sem nome.',422);
            $rawId=$p['colaborador_id']??null;$personId=is_numeric($rawId)?(int)$rawId:null;
            $cardId=(string)($p['id']??($personId!==null?'c_'.$personId:'c_draft_'.substr(hash('sha256',norm($oldName)),0,16)));
            $seenKey=$personId!==null?'id:'.$personId:'nome:'.norm($oldName);
            if(isset($seen[$seenKey]))throw new Failure('COLABORADOR_DUPLICADO','Um colaborador aparece em mais de um card.',409);
            $seen[$seenKey]=true;$names[norm($oldName)]=$oldName;
            $p=array_merge($p,['id'=>$cardId,'colaborador_id'=>$personId,'name'=>$oldName,'role'=>(string)($p['role']??$p['funcao']??''),'cargo'=>(string)($p['cargo']??''),'cadastro_status'=>(string)($p['cadastro_status']??'PENDENTE_COMPLEMENTACAO')]);
            continue;
        }
        $master=$r['person'];$seenKey='id:'.$master['id'];if(isset($seen[$seenKey]))throw new Failure('COLABORADOR_DUPLICADO','Um colaborador aparece em mais de um card.',409);
        $seen[$seenKey]=true;$oldName=(string)($p['name']??$p['nome']??$master['name']);$names[norm($oldName)]=$master['name'];
        $p=array_merge($p,['id'=>$p['id']??'c_'.$master['id'],'colaborador_id'=>$master['id'],'name'=>$master['name'],'role'=>$master['role'],'cargo'=>$master['cargo'],'cadastro_status'=>$master['cadastro_status']]);
    }unset($p);
    $ids=[];$cars=[];$fleet=$db instanceof AgendaFileCatalog?$db->fleet():dbRows($db,'SELECT id,placa FROM veiculo WHERE empresa_id=?',[$u['company_id']]);
    foreach($draft['atividades'] as &$a){
        $id=(string)($a['id']??'');if($id===''||strlen($id)>120||isset($ids[$id]))throw new Failure('ITEM_ID_INVALIDO','Uma atividade não tem identificador único.',422);$ids[$id]=true;
        $a['colaborador']=$names[norm((string)($a['colaborador']??''))]??(string)($a['colaborador']??'');
        $p=null;foreach($draft['people'] as $candidate)if(norm($candidate['name'])===norm($a['colaborador'])){$p=$candidate;break;}
        if(!$p)throw new Failure('COLABORADOR_SEM_CARD','Atividade sem colaborador vinculado: '.$a['colaborador'],422);
        $a['colaborador']=$p['name'];$a['funcao']=$p['role'];$hours=$a['horas']??8;
        if(!is_numeric($hours)||(float)$hours<=0||(float)$hours>24)throw new Failure('HORAS_INVALIDAS','As horas da atividade devem estar entre 0 e 24, maiores que zero.',422);$a['horas']=(float)$hours;
        foreach(['obra','atividade','local'] as $field){if(isset($a[$field])&&!is_scalar($a[$field]))throw new Failure('TEXTO_INVALIDO','Descrição inválida.',422);if(strlen((string)($a[$field]??''))>4000)throw new Failure('TEXTO_LONGO','Descrição da atividade muito longa.',422);}
        $travel=$a['viagem']??false;$a['viagem']=$travel===true||in_array(norm((string)$travel),['1','true','sim'],true);
        $car=trim((string)($a['carro']??$a['car']??''));$a['veiculo_id']=null;
        if($car!==''&&!in_array(norm($car),['sem veiculo','nenhum'],true)){
            $matches=array_values(array_filter($fleet,fn($v)=>norm($v['placa'])===norm($car)||norm(str_replace('-','',$v['placa']))===norm(str_replace('-','',$car))));
            if(count($matches)!==1)throw new Failure('VEICULO_NAO_RESOLVIDO','Identifique a placa cadastrada do veículo “'.$car.'”. Nenhum veículo foi criado.',409);
            $a['veiculo_id']=(int)$matches[0]['id'];$a['carro']=$matches[0]['placa'];
            if(!legacyBoolCancelled($a)&&isset($cars[$a['veiculo_id']])&&$cars[$a['veiculo_id']]!==$p['colaborador_id'])throw new Failure('VEICULO_EM_USO','O mesmo veículo está alocado a dois colaboradores.',409);
            if(!legacyBoolCancelled($a))$cars[$a['veiculo_id']]=$p['colaborador_id'];
        }else $a['carro']=null;$a['car']=$a['carro'];
    }unset($a);agendaRebuildSchedule($draft);return $draft;
}
function agendaLink(object $db,array $u,array &$draft,array $step):array {
    $query=trim((string)($step['colaborador']??''));$r=agendaMasterResolve($db,$u,$query);
    if(empty($r['ok'])&&($step['criar_global']??false)===true&&$r['status']==='COLABORADOR_NAO_ENCONTRADO'){
        if(strlen($query)<3||strlen($query)>180)return agendaMissing('Informe o nome completo do novo colaborador.');
        if($db instanceof AgendaFileCatalog)$cid=$db->create($query);else {
        $values=['empresa_id'=>$u['company_id'],'nome'=>$query,'status'=>'ATIVO'];
        $cols=array_flip(dbColumns($db,'colaborador'));if(isset($cols['tipo']))$values['tipo']='PENDENTE';if(isset($cols['cadastro_status']))$values['cadastro_status']='PENDENTE_COMPLEMENTACAO';if(isset($cols['origem_cadastro']))$values['origem_cadastro']='AGENDA_DO_DIA';if(isset($cols['cargo']))$values['cargo']='';if(isset($cols['funcao']))$values['funcao']='';
        $cid=dbInsert($db,'colaborador',$values);
        dbInsert($db,'agenda_cap_pessoa',['empresa_id'=>$u['company_id'],'colaborador_id'=>$cid,'cadastro_status'=>'PENDENTE_COMPLEMENTACAO','origem'=>'AGENDA_DO_DIA']);
        }
        $r=agendaMasterResolve($db,$u,'id:'.$cid);
    }
    if(empty($r['ok']))return $r;$p=$r['person'];
    foreach($draft['people'] as $existing)if((int)$existing['colaborador_id']===$p['id'])return ['ok'=>true,'colaborador'=>$p,'already_linked'=>true];
    $draft['people'][]=['id'=>'c_'.$p['id'],'colaborador_id'=>$p['id'],'name'=>$p['name'],'role'=>$p['role'],'cargo'=>$p['cargo'],'cadastro_status'=>$p['cadastro_status']];
    return ['ok'=>true,'colaborador'=>$p,'card_vazio'=>true];
}
function agendaPersonInDay(object $db,array $u,array $draft,string $q):array {
    $needle=norm(trim($q));
    foreach($draft['people'] as $p){
        $id=(string)($p['id']??'');$collaboratorId=$p['colaborador_id']??null;
        $matchesCollaboratorId=$collaboratorId!==null&&$q===('id:'.(string)$collaboratorId);
        if($needle!==norm((string)($p['name']??''))&&$q!==$id&&!$matchesCollaboratorId)continue;
        return ['ok'=>true,'person'=>$p];
    }
    $r=agendaMasterResolve($db,$u,$q);if(empty($r['ok']))return $r;
    foreach($draft['people'] as $p)if((int)$p['colaborador_id']===$r['person']['id'])return ['ok'=>true,'person'=>$p];
    return agendaMissing('O colaborador '.$r['person']['name'].' não está vinculado ao dia. Inclua o card primeiro.','COLABORADOR_FORA_DO_DIA');
}
function agendaSelectMany(array $draft,string $name,array $step):array {
    $all=[];foreach($draft['atividades'] as $a)if(norm($a['colaborador'])===norm($name)&&legacyBoolCancelled($a)===(($step['canceladas']??false)===true))$all[]=$a;
    if(($step['todas']??false)===true)return $all?['ok'=>true,'items'=>$all]:agendaMissing('Não há atividades correspondentes para '.$name.'.','ATIVIDADE_NAO_ENCONTRADA');
    if(isset($step['ultimas'])){$n=(int)$step['ultimas'];if($n<1||$n>count($all))return agendaMissing('A quantidade de últimas atividades não confere com a lista ativa.');return ['ok'=>true,'items'=>array_slice($all,-$n)];}
    $ids=$step['atividade_ids']??[];if(!empty($step['atividade_id']))$ids[]=$step['atividade_id'];$numbers=$step['numeros']??[];
    if(!is_array($ids)||!is_array($numbers))return agendaMissing('Informe os números ou identificadores das atividades.');
    foreach($numbers as $n){if(!is_int($n)||$n<1||$n>count($all))return agendaMissing('O número '.$n.' não existe na lista ativa de '.$name.'.','NUMERO_INVALIDO');$ids[]=(string)$all[$n-1]['id'];}
    if($ids){$wanted=array_unique(array_map('strval',$ids));$selected=array_values(array_filter($all,fn($a)=>in_array((string)$a['id'],$wanted,true)));if(count($selected)!==count($wanted))return agendaMissing('Uma atividade mudou ou não pertence ao colaborador indicado. Consulte novamente.','SELECAO_DESATUALIZADA');return ['ok'=>true,'items'=>$selected];}
    foreach(['obra','atividade'] as $field)if(trim((string)($step[$field]??''))!=='')$all=array_values(array_filter($all,fn($a)=>norm((string)($a[$field]??''))===norm((string)$step[$field])));
    if(count($all)!==1)return agendaMissing($all?'Qual atividade de '.$name.'?':'Não encontrei a atividade indicada.',$all?'ATIVIDADE_AMBIGUA':'ATIVIDADE_NAO_ENCONTRADA',['candidates'=>array_map(fn($a)=>agendaOpsCandidatePublic($a),$all)]);
    return ['ok'=>true,'items'=>$all];
}
function agendaCancelItem(array &$draft,string $id,string $reason,string $tx):void {
    foreach($draft['atividades'] as $i=>$a){if((string)$a['id']!==$id)continue;
        if(agendaOpsWeekly($a)){$a['cancelado']=true;$a['cancelled']=true;$a['status']='cancelada';$a['auditStatus']='cancelled';$a['motivoCancelamento']=$reason;$a['transacaoId']=$tx;$draft['atividades'][$i]=$a;}
        else array_splice($draft['atividades'],$i,1);return;
    }
}
function agendaApplyStep(object $db,array $u,array &$draft,array $s,string $tx):array {
    $op=(string)($s['operacao']??'');
    if($op==='vincular_colaborador')return agendaLink($db,$u,$draft,$s);
    $source=agendaPersonInDay($db,$u,$draft,(string)($s['origem_colaborador']??$s['colaborador']??''));if(empty($source['ok']))return $source;$name=$source['person']['name'];
    if($op==='remover_colaborador'){
        $has=array_values(array_filter($draft['atividades'],fn($a)=>norm($a['colaborador'])===norm($name)));
        if($has&&($s['confirmar_remocao_atividades']??false)!==true)return agendaMissing('Remover '.$name.' do dia também retira '.count($has).' atividade(s) deste rascunho. Confirma essa remoção?','CONFIRMAR_REMOCAO_COLABORADOR');
        $draft['atividades']=array_values(array_filter($draft['atividades'],fn($a)=>norm($a['colaborador'])!==norm($name)));
        $draft['people']=array_values(array_filter($draft['people'],fn($p)=>norm($p['name'])!==norm($name)));return ['ok'=>true,'cadastro_global_preservado'=>true];
    }
    if($op==='adicionar'){
        if(trim((string)($s['obra']??''))===''||trim((string)($s['atividade']??''))==='')return agendaMissing('Qual obra e atividade devem ser incluídas?');
        if(function_exists(__NAMESPACE__.'\\agendaWorkCanonical')&&($u['admin']||in_array('cronograma',$u['modules'],true))){$w=agendaWorkCanonical($u,(string)$s['obra']);if(empty($w['ok']))return $w;$s['obra']=$w['name'];}
        $item=['id'=>'dia_'.bin2hex(random_bytes(12)),'colaborador'=>$name,'funcao'=>$source['person']['role'],'obra'=>$s['obra'],'atividade'=>$s['atividade'],'local'=>$s['local']??'','horas'=>$s['horas']??8,'viagem'=>$s['viagem']??false,'carro'=>$s['carro']??null,'replanejado'=>true,'auditStatus'=>'replanned','origemSemanal'=>false,'importedFromFrozenWeek'=>false,'motivoReplanejamento'=>'','operacaoOrigem'=>'ADD','transacaoId'=>$tx];
        $draft['atividades'][]=$item;return ['ok'=>true,'atividade'=>agendaOpsCandidatePublic($item)];
    }
    if(!in_array($op,['mover','copiar','cancelar','restaurar','alterar'],true))return ['ok'=>false,'status'=>'OPERACAO_INVALIDA','message'=>'Operação não reconhecida: '.$op];
    if($op==='restaurar')$s['canceladas']=true;$selected=agendaSelectMany($draft,$name,$s);if(empty($selected['ok']))return $selected;
    $destNames=[];
    if(in_array($op,['mover','copiar'],true)){
        $queries=($s['todos_outros']??false)===true?array_column($draft['people'],'name'):($s['destinos']??[$s['destino_colaborador']??'']);
        if(!is_array($queries)||!count($queries))return agendaMissing('Qual colaborador deve receber as atividades?');
        foreach($queries as $q){$r=agendaPersonInDay($db,$u,$draft,(string)$q);if(empty($r['ok']))return $r;$dest=$r['person']['name'];if(norm($dest)===norm($name)){if(!empty($s['todos_outros']))continue;return agendaMissing('Origem e destino são iguais. Informe outro colaborador.','DESTINO_IGUAL_ORIGEM');}$destNames[$dest]=true;}
        if(!$destNames)return agendaMissing('Não há outro colaborador vinculado para receber as atividades.');
        if($op==='mover'&&count($destNames)!==1)return agendaMissing('Mover exige um único destino. Para vários, use copiar.');
    }
    $out=[];
    foreach($selected['items'] as $a){
        $id=(string)$a['id'];
        if($op==='mover'||$op==='copiar'){
            foreach(array_keys($destNames) as $dest){$copy=agendaOpsBuildCopy($draft,$a,$name,$dest,$draft['data'],$tx,$op==='mover'?'MOVE':'COPY');$copy['carro']=null;$copy['car']=null;$copy['veiculo_id']=null;$draft['atividades'][]=$copy;$out[]=agendaOpsCandidatePublic($copy);}
            if($op==='mover')agendaCancelItem($draft,$id,(string)($s['motivo']??'Movida para '.implode(', ',array_keys($destNames))),$tx);
        }elseif($op==='cancelar')agendaCancelItem($draft,$id,(string)($s['motivo']??''),$tx);
        else foreach($draft['atividades'] as &$item){if((string)$item['id']!==$id)continue;
            if($op==='restaurar'){if(!agendaOpsWeekly($item))return agendaMissing('Só atividades semanais canceladas podem ser restauradas.');$item['cancelado']=false;$item['cancelled']=false;$item['status']='';$item['auditStatus']=!empty($item['replanejado'])?'replanned':'planned';$item['motivoCancelamento']='';}
            else{$changes=$s['alteracoes']??[];if(!is_array($changes)||!$changes)return agendaMissing('Quais campos deseja alterar?');$allowed=['obra','atividade','local','horas','viagem','carro'];if(array_diff(array_keys($changes),$allowed))return agendaMissing('Um campo solicitado não pode ser alterado diretamente.');
                if(!isset($item['planejado']))$item['planejado']=array_intersect_key($item,array_flip($allowed));$item=array_merge($item,$changes);$item['executado']=array_intersect_key($item,array_flip($allowed));$item['replanejado']=true;$item['auditStatus']='replanned';$item['motivoReplanejamento']='';}
            $item['transacaoId']=$tx;$out[]=agendaOpsCandidatePublic($item);
        }unset($item);
    }
    return ['ok'=>true,'operacao'=>$op,'colaborador'=>$name,'quantidade'=>count($selected['items']),'selecionadas'=>array_map(fn($a)=>agendaOpsCandidatePublic($a),$selected['items']),'destinos'=>$out];
}

/** UI submits its visible state through the same validation, transaction and undo service. */
function agendaVisible(object $db,array $u,array $before,array $visible,string $tx):array {
    if(($visible['data']??'')!==$before['data'])throw new Failure('DIA_NAO_EDITAVEL','Somente o dia aberto pode ser salvo.',409);
    $draft=$before;$draft['people']=$visible['people']??[];$draft['atividades']=$visible['atividades']??[];$draft['roomLinks']=$visible['roomLinks']??$before['roomLinks']??[];
    $old=array_column($before['atividades'],null,'id');$present=[];
    foreach($draft['atividades'] as &$a){$id=(string)($a['id']??'');$present[$id]=true;
        if(isset($old[$id])){$original=$old[$id];$incoming=$a;$a=$original;foreach(['obra','atividade','local','horas','viagem','carro','cancelado','cancelled','motivoCancelamento'] as $editable)if(array_key_exists($editable,$incoming))$a[$editable]=$incoming[$editable];if(norm((string)($incoming['colaborador']??''))!==norm($original['colaborador']))throw new Failure('USAR_MOVER','Use a operação mover para trocar o colaborador de uma atividade.',409);
            foreach(['origemSemanal','importedFromFrozenWeek','chaveOriginal','__originalComparisonKey','planejado','copiadoDeItemId','copiadoDeColaborador','operacaoOrigem'] as $f){unset($a[$f]);if(array_key_exists($f,$original))$a[$f]=$original[$f];}
            $changed=false;foreach(['obra','atividade','local','horas','viagem','carro'] as $f)if(($a[$f]??null)!==($original[$f]??null))$changed=true;
            if(legacyBoolCancelled($a)){$a['status']='cancelada';$a['auditStatus']='cancelled';}elseif(legacyBoolCancelled($original)){$a['status']='';$a['auditStatus']=!empty($a['replanejado'])?'replanned':'planned';}
            if($changed&&!legacyBoolCancelled($a)){$a['planejado']=$original['planejado']??array_intersect_key($original,array_flip(['obra','atividade','local','horas','viagem','carro']));$a['replanejado']=true;$a['auditStatus']='replanned';$a['executado']=array_intersect_key($a,array_flip(['obra','atividade','local','horas','viagem','carro']));}
        }else{$a=array_intersect_key($a,array_flip(['id','colaborador','obra','atividade','local','horas','viagem','carro']));$a['origemSemanal']=false;$a['importedFromFrozenWeek']=false;$a['chaveOriginal']=null;unset($a['__originalComparisonKey']);$a['replanejado']=true;$a['auditStatus']='replanned';$a['operacaoOrigem']='ADD';$a['transacaoId']=$tx;}
    }unset($a);
    $people=array_column($draft['people'],'name');
    if(count($draft['people'])!==count($before['people'])||array_diff(array_column($before['people'],'name'),$people))throw new Failure('USAR_COLABORADORES','Inclua ou remova colaboradores pelo cadastro do dia.',409);
    foreach($old as $id=>$a)if(!isset($present[(string)$id])&&agendaOpsWeekly($a)){$a['cancelado']=true;$a['cancelled']=true;$a['status']='cancelada';$a['auditStatus']='cancelled';$draft['atividades'][]=$a;}
    $draft['atividades']=array_values(array_filter($draft['atividades'],fn($a)=>!legacyBoolCancelled($a)||agendaOpsWeekly($a)));
    return agendaNormalize($db,$u,$draft);
}

function agendaNextDay(object $db,array $u,array $current):array {
    $date=new \DateTimeImmutable($current['data']);$friday=$date->format('N')==='5';do{$date=$date->modify('+1 day');}while((int)$date->format('N')>5);$next=$date->format('Y-m-d');$week=$date->modify('monday this week')->format('Y-m-d');
    $dir=agendaDataDir($u);$path=$dir.'/agenda_semanal_historico_'.$week.'.json';
    // Somente a Agenda Semanal finalizada pode originar um novo dia.
    if($friday&&!is_file($path))throw new Failure('SEMANAL_NAO_FINALIZADA','Para finalizar sexta-feira, finalize primeiro a Agenda Semanal da próxima semana. O dia continua aberto.',409);
    $nextDraft=['data'=>$next,'tipo'=>'draft','status'=>'draft','finalizado'=>false,'people'=>$current['people'],'atividades'=>[],'geradoAposFinalizacaoDe'=>$current['data'],'createdAt'=>agendaOpsNow(),'roomLinks'=>$current['roomLinks']??[]];
    if(is_file($path)){
        $raw=readJson($path);$payload=$raw['payload']??(is_array($raw['data']??null)?$raw['data']:$raw);$agenda=$payload['agenda']??$payload;$names=$payload['colaboradores']??array_keys($agenda);$idx=(int)$date->format('N')-1;
        foreach($names as $name){if(!is_string($name))throw new Failure('SEMANAL_FORMATO_INVALIDO','Formato de colaboradores da semanal não reconhecido.',422);$person=$agenda[$name]??$agenda[mb_strtoupper($name,'UTF-8')]??[];$day=$person['dias'][$idx]??[];$items=array_is_list($day)?$day:($day['alocacoes']??$day['atividades']??[]);
            if(!$items)continue;$link=agendaLink($db,$u,$nextDraft,['colaborador'=>$name]);if(empty($link['ok']))throw new Failure('SEMANAL_COLABORADOR_PENDENTE','Resolva '.$name.' no cadastro global antes de abrir o próximo dia.',409);
            foreach($items as $i=>$a){if(!is_array($a))continue;$obra=trim((string)($a['obra']??$a['obraNome']??$a['nomeObra']??''));if($obra==='')continue;
                $task=(string)($a['atividade']??$a['descricao']??$a['servico']??'');$travel=$a['viagem']??false;
                $nextDraft['atividades'][]=array_merge($a,['id'=>'sem_'.$next.'_'.substr(hash('sha256',$name.'|'.$i.'|'.($a['id']??'')),0,18),'colaborador'=>$link['colaborador']['name'],'obra'=>$obra,'atividade'=>$task,'viagem'=>$travel,'horas'=>$a['horas']??8,'carro'=>$a['carro']??$a['car']??null,'origemSemanal'=>true,'importedFromFrozenWeek'=>true,'cancelado'=>false,'cancelled'=>false,'replanejado'=>false,'planejado'=>['obra'=>$obra,'atividade'=>$task,'viagem'=>$travel],'executado'=>['obra'=>$obra,'atividade'=>$task,'viagem'=>$travel]]);
            }
        }
        if($friday&&!$nextDraft['atividades'])throw new Failure('SEGUNDA_SEM_ATIVIDADES','A semanal finalizada não contém atividades para segunda-feira. O dia continua aberto.',409);
        $nextDraft['arquivoFonteAgendaSemanal']=basename($path);$nextDraft['fonteAgendaSemanalSha256']=hash_file('sha256',$path);$nextDraft['fonteAgendaSemanalValida']=true;$nextDraft['agendaSemanalCongelada']=true;
        $nextDraft['snapshotFonteAgendaSemanal']=$raw; // read once; immutable source evidence for this day
    }else{$nextDraft['abertoSemAgendaSemanal']=true;$nextDraft['fonteAgendaSemanalValida']=false;}
    return agendaNormalize($db,$u,$nextDraft);
}
function agendaCloseValues(array &$draft,array $args):array {
    if(!$draft['atividades'])return agendaMissing('O dia não tem atividades para finalizar.');
    $defaults=$args['percentual_padrao']??null;$reason=$args['motivo_cancelamento_padrao']??'';$exceptions=$args['excecoes']??[];$missing=[];$matched=[];
    foreach($draft['atividades'] as &$a){$x=[];
        foreach($exceptions as $i=>$entry){$person=norm((string)($entry['colaborador']??''));$id=(string)($entry['atividade_id']??'');if(($id!==''&&(string)$a['id']===$id)||($id===''&&$person!==''&&norm($a['colaborador'])===$person)){$x=array_merge($x,$entry);$matched[$i]=true;}}
        if(legacyBoolCancelled($a)){$motivo=trim((string)($x['motivo_cancelamento']??$a['motivoCancelamento']??''));if($motivo==='')$motivo=trim((string)$reason);if($motivo==='')$missing[]=['atividade_id'=>$a['id'],'colaborador'=>$a['colaborador'],'campo'=>'motivo_cancelamento'];else $a['motivoCancelamento']=$motivo;continue;}
        // An explicit exception does not inherit 100% when only its reason was supplied.
        $pct=array_key_exists('percentual',$x)?$x['percentual']:($x?null:($defaults??$a['percentualExecutado']??null));
        $motivo=trim((string)($x['motivo']??$a['motivoExecucao']??''));
        if(!is_numeric($pct)||(float)$pct<0||(float)$pct>100){$missing[]=['atividade_id'=>$a['id'],'colaborador'=>$a['colaborador'],'campo'=>'percentual'];continue;}
        if((float)$pct<100&&$motivo===''){$missing[]=['atividade_id'=>$a['id'],'colaborador'=>$a['colaborador'],'campo'=>'motivo_nao_conclusao'];continue;}
        $a['percentualExecutado']=(float)$pct;$a['executada']=(float)$pct>0;$a['motivoExecucao']=$motivo;$a['fechamentoPreenchido']=true;
    }unset($a);
    foreach($exceptions as $i=>$entry)if(!isset($matched[$i]))$missing[]=['colaborador'=>$entry['colaborador']??'','atividade_id'=>$entry['atividade_id']??'','campo'=>'atividade_nao_encontrada'];
    if($missing)return agendaMissing('Faltam informações para finalizar. Informe somente os campos pendentes.','FECHAMENTO_INCOMPLETO',['missing'=>$missing]);
    return ['ok'=>true];
}

function agendaExecuteSql(array $u,array $request):array {
    permission($u,'atividades');if(isset($request['company_id'])&&(int)$request['company_id']!==(int)$u['company_id'])throw new Failure('EMPRESA_ALTERADA','Atualize a tela para a empresa ativa antes de operar.',409);$u=agendaDbActor($u);$db=agendaDb();
    $event=(string)($request['event_id']??'');if($event===''||strlen($event)>120)throw new Failure('EVENTO_INVALIDO','Identificador da operação ausente.');
    $key=hash('sha256',$u['company_id'].':'.$u['db_user_id'].':'.$event);$hash=hash('sha256',encode($request));
    return agendaWithLock($u,function()use($db,$u,$request,$event,$key,$hash){
        $row=agendaStateRow($db,(int)$u['company_id']);agendaProject($db,$u,$row);
        $saved=dbRows($db,'SELECT * FROM agenda_cap_evento WHERE chave=?',[$key]);
        if($saved){
            if($saved[0]['pedido_hash']!==$hash)throw new Failure('EVENTO_REUTILIZADO','A mesma solicitação foi reenviada com outro conteúdo. Consulte o resultado anterior.',409);
            $current=json_decode($row['estado_json'],true,512,JSON_THROW_ON_ERROR)['draft'];agendaProjectionCheck($u,$current);agendaVerifySql($db,$u,$current);
            $reply=json_decode($saved[0]['resposta_json'],true,512,JSON_THROW_ON_ERROR);$reply['original_revision']=$reply['revision'];$reply['revision']=(int)$row['revisao'];$reply['draft']=$current;$reply['cached']=true;return $reply;
        }
        $db->beginTransaction();$committed=false;
        try{
            $row=agendaStateRow($db,(int)$u['company_id'],true);$rev=(int)$row['revisao'];$state=json_decode($row['estado_json'],true,512,JSON_THROW_ON_ERROR);$draft=$state['draft'];$before=$draft;
            // A revisao e mantida apenas como sequencial de auditoria. A ultima
            // gravacao valida prevalece e nunca e bloqueada por versao anterior.
            if(!empty($request['data'])&&$request['data']!==$draft['data'])throw new Failure('DIA_NAO_EDITAVEL','Somente o rascunho aberto pode ser alterado.',409);
            agendaProjectionCheck($u,$draft);agendaVerifySql($db,$u,$draft);$tx=agendaOpsTx();$mode=(string)($request['operation']??'plan');$results=[];$history=null;
            if($mode==='undo'||$mode==='undo_all'){
                $stack=$state['undo']??[];if(!$stack)throw new Failure('SEM_UNDO','Não há alterações depois do último Salvar.',409);
                $entry=$mode==='undo_all'?$stack[0]:array_pop($stack);$draft=$entry['draft'];$state['undo']=$mode==='undo_all'?[]:$stack;
            }elseif($mode==='checkpoint'){$state['undo']=[];$state['checkpoint_at']=agendaOpsNow();}
            elseif($mode==='replace_visible'){$draft=agendaVisible($db,$u,$draft,$request['draft']??[],$tx);}
            elseif($mode==='plan'){
                $steps=$request['steps']??[];if(!is_array($steps)||count($steps)<1||count($steps)>40)throw new Failure('PLANO_INVALIDO','Envie de 1 a 40 operações por pedido.',422);
                foreach($steps as $index=>$step){if(!is_array($step))throw new Failure('PLANO_INVALIDO','Operação inválida.');
                    if(($step['operacao']??'')==='finalizar'){
                        if($index!==count($steps)-1)throw new Failure('FINALIZACAO_ULTIMA','Finalizar deve ser a última etapa do pedido.',422);
                        foreach(($step['excecoes']??[]) as $i=>$exception){
                            if(!empty($exception['colaborador'])){$resolved=agendaPersonInDay($db,$u,$draft,(string)$exception['colaborador']);if(empty($resolved['ok'])){$db->rollBack();return $resolved+['step_index'=>$index,'atomic'=>true,'written'=>false,'revision'=>$rev];}$step['excecoes'][$i]['colaborador']=$resolved['person']['name'];}
                        }
                        $result=agendaCloseValues($draft,$step);if(!empty($result['ok'])){$history=$draft;$history['finalizado']=true;$history['tipo']='historico';$history['status']='historico';$history['finalizedAt']=agendaOpsNow();agendaRebuildSchedule($history);$draft=agendaNextDay($db,$u,$draft);}
                    }else $result=agendaApplyStep($db,$u,$draft,$step,$tx);
                    if(empty($result['ok'])){$db->rollBack();return $result+['step_index'=>$index,'atomic'=>true,'written'=>false,'revision'=>$rev];}$results[]=$result;
                }
            }else throw new Failure('OPERACAO_INVALIDA','Operação não disponível.');
            $draft=agendaNormalize($db,$u,$draft);
            if($mode==='replace_visible'&&empty($request['checkpoint'])&&agendaHash($draft)===agendaHash($before)){$db->rollBack();return ['ok'=>true,'verified'=>true,'noop'=>true,'revision'=>$rev,'data'=>$draft['data'],'draft'=>$draft,'source'=>'Banco V2 + JSON verificado'];}
            $newRev=$rev+1;$draft['_revision']=$newRev;
            if($history){$history=agendaNormalize($db,$u,$history);$history['_revision']=$newRev;$state['undo']=[];}
            elseif($mode==='replace_visible'&&!empty($request['checkpoint'])){$state['undo']=[];$state['checkpoint_at']=agendaOpsNow();}
            elseif(!in_array($mode,['undo','undo_all','checkpoint'],true)){$state['undo'][]=['draft'=>$before,'tx'=>$tx,'user'=>$u['db_user_id'],'at'=>agendaOpsNow()];}
            $state['draft']=$draft;$oldDay=null;if($history)$oldDay=agendaSyncSql($db,$u,$history,$newRev,true);$day=agendaSyncSql($db,$u,$draft,$newRev);agendaVerifySql($db,$u,$draft);if($history)agendaVerifySql($db,$u,$history);
            if($mode==='checkpoint'||($mode==='replace_visible'&&!empty($request['checkpoint']))){ $cols=array_flip(dbColumns($db,'agenda_dia'));dbUpdate($db,'agenda_dia',array_intersect_key(['salvo_em'=>date('Y-m-d H:i:s'),'salvo_por_usuario_id'=>$u['db_user_id']],$cols),'id=? AND empresa_id=?',[$day,$u['company_id']]); }
            $out=['write'=>['agenda_draft_'.$draft['data'].'.json'=>$draft],'delete'=>[]];if($history){$out['write']['historico_atividade_dia_'.$history['data'].'.json']=$history;$out['delete'][]='agenda_draft_'.$before['data'].'.json';}
            $result=['ok'=>true,'verified'=>true,'atomic'=>true,'source'=>'Banco V2 + JSON verificado','persistence'=>'SQL_E_JSON_VERIFICADOS','transaction_id'=>$tx,'revision'=>$newRev,'data'=>$draft['data'],'finalized_date'=>$history['data']??null,'results'=>$results,'draft'=>$draft];
            dbUpdate($db,'agenda_cap_estado',['revisao'=>$newRev,'data_ativa'=>$draft['data'],'estado_json'=>encode($state),'outbox_json'=>encode($out)],'empresa_id=?',[$u['company_id']]);
            dbInsert($db,'agenda_cap_evento',['chave'=>$key,'empresa_id'=>$u['company_id'],'usuario_id'=>$u['db_user_id'],'evento_ref'=>$event,'pedido_hash'=>$hash,'resposta_json'=>encode($result),'ocorrido_em'=>agendaOpsNow()]);
            dbInsert($db,'agenda_dia_evento',['empresa_id'=>$u['company_id'],'agenda_dia_id'=>$oldDay??$day,'usuario_id'=>$u['db_user_id'],'origem_acao'=>($request['source']??'')==='UI'?'TELA':'GEORGE','transacao_id'=>$tx,'versao_rascunho'=>$newRev,'tipo_evento'=>'CAPABILITY_TRANSACAO','entidade_tipo'=>'AGENDA_DIA','entidade_id'=>$oldDay??$day,'dados_json'=>encode(['operation'=>$mode,'request'=>$request,'before'=>$before,'after'=>$history??$draft,'next_date'=>$history?$draft['data']:null])]);
            agendaFault('before_commit');$db->commit();$committed=true;
            try{agendaProject($db,$u,agendaStateRow($db,(int)$u['company_id']));agendaProjectionCheck($u,$draft);}catch(\Throwable $e){throw new Failure('PROJECAO_PENDENTE','A transação '.$tx.' está salva no banco. Falta confirmar a cópia JSON. Repita a mesma solicitação para concluir, sem duplicar a operação.',503);}
            return $result;
        }catch(\Throwable $e){if(!$committed&&$db->inTransaction())$db->rollBack();throw $e;}
    });
}
