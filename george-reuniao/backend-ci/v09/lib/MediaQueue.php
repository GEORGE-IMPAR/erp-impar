<?php
declare(strict_types=1);
namespace GeorgeV09;
function mediaQueue(array $u,array $in=[]):array {
    $jobs=[];foreach(glob(storeRoot().'/records/*/record.json')?:[] as $p){$r=readJson($p);if((string)$r['owner_id']!==(string)$u['id']||(int)$r['company_id']!==(int)$u['company_id']||!isset($r['job_state'])||!empty($r['meta']['source_record_id']))continue;$r=record($r['id'],$u);if(in_array($r['job_state'],['deleted','ready'],true)||$r['job_state']==='cancelled'&&empty($in['include_removed']))continue;$jobs[]=jobPublic($r);}
    usort($jobs,fn($a,$b)=>strcmp($b['created_at'],$a['created_at']));return ['ok'=>true,'jobs'=>$jobs,'total'=>count($jobs)];
}
function mediaQueueChange(array $u,array $in):array {
    $ids=$in['record_ids']??[];$op=$in['operation']??'cancel';if(!is_array($ids)||!$ids||count($ids)>100||!in_array($op,['cancel','delete'],true))throw new Failure('FILA_PEDIDO_INVALIDO','Selecione os arquivos que deseja retirar da fila.');
    $ids=array_values(array_unique($ids));$records=[];
    foreach($ids as $id){$r=record((string)$id,$u);if((string)$r['owner_id']!==(string)$u['id']||!isset($r['job_state'])||!empty($r['meta']['source_record_id']))throw new Failure('FILA_ACESSO_NEGADO','Selecione seus próprios anexos ou gravações.',403);
        if(!empty($r['meta']['live'])&&($r['job_state']??'')==='uploading'&&strtotime($r['updated_at']??$r['created_at'])>time()-90)throw new Failure('CAPTURA_EM_ANDAMENTO','Encerre a gravação antes de retirá-la da fila.',409);
        if($op==='cancel'&&$r['job_state']==='ready')throw new Failure('DOCUMENTO_PRONTO','Este documento já está pronto. Escolha excluir arquivo se quiser apagá-lo.',409);$records[]=$r;
    }
    $changed=[];
    foreach($records as $r){$id=$r['id'];$mark=['operation'=>$op,'at'=>date(DATE_ATOM),'user'=>$u['id'],'company_id'=>$u['company_id']];atomic(recordDir($id).'/queue-stop.json',encode($mark));
        if($op==='delete'){
            // Cancellation is immediately visible to workers; deletion waits for the active step lock.
            locked(recordDir($id).'/process.lock',function()use($id,$u){
                foreach(glob(storeRoot().'/records/*/record.json')?:[] as $p){$child=readJson($p);if(($child['meta']['source_record_id']??'')===$id){atomic(dirname($p).'/queue-stop.json',encode(['operation'=>'delete','at'=>date(DATE_ATOM)]));mediaDeleteFiles($child['id']);}}
                mediaDeleteFiles($id);
            });
        }
        $r=updateRecord($id,$u,function($r)use($op){$r['job_state']=$op==='delete'?'deleted':'cancelled';$r['status']='closed';$r['meta']['queue_removed_at']=date(DATE_ATOM);if($op==='delete'){$r['turns']=[];unset($r['report'],$r['segment_texts'],$r['report_parts'],$r['report_inputs'],$r['source_file'],$r['source_sha256']);}return $r;});$changed[]=['record_id'=>$id,'name'=>$r['meta']['name']??'Arquivo','state'=>$r['job_state']];
    }
    return ['ok'=>true,'verified'=>true,'changed'=>$changed,'total'=>count($changed),'operation'=>$op];
}
function mediaDeleteFiles(string $id):void {
    locked(recordDir($id).'/write.lock',function()use($id){$dir=recordDir($id);$it=new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir,\FilesystemIterator::SKIP_DOTS),\RecursiveIteratorIterator::CHILD_FIRST);
        foreach($it as $f){$p=$f->getPathname();if($f->isLink())continue;if($f->isDir()){@rmdir($p);continue;}if(in_array($f->getFilename(),['record.json','queue-stop.json','.htaccess'],true)||str_ends_with($f->getFilename(),'.lock'))continue;if(!unlink($p))throw new Failure('EXCLUSAO_PENDENTE','O processamento foi cancelado; falta concluir a exclusão do arquivo. Tente novamente.',503);}
    });
}
function mediaQueueTools():array {
    return [
      ['type'=>'function','name'=>'consultar_fila_midias','description'=>'Lista seus anexos/gravações pendentes, inclusive uploads incompletos. Não significa que foram analisados.','parameters'=>['type'=>'object','properties'=>['include_removed'=>['type'=>'boolean']],'additionalProperties'=>false]],
      ['type'=>'function','strict'=>false,'name'=>'limpar_fila_midias','description'=>'Retira da fila SOMENTE os IDs recém-consultados que o usuário pediu. cancel preserva originais; delete apaga arquivos e derivados apenas após pedido explícito para excluir. Uma limpeza geral usa todos os IDs consultados, nunca adivinha. Não retirar captura em andamento.','parameters'=>['type'=>'object','properties'=>['record_ids'=>['type'=>'array','items'=>['type'=>'string']],'operation'=>['type'=>'string','enum'=>['cancel','delete']]],'required'=>['record_ids','operation'],'additionalProperties'=>false]]
    ];
}
