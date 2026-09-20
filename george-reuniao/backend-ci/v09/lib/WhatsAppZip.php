<?php
declare(strict_types=1);
namespace GeorgeV09;

function whatsappKind(string $name):?array {
    $ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));
    if($ext==='txt')return ['stage'=>'texto','priority'=>1,'kind'=>'text'];
    if(in_array($ext,['opus','ogg','mp3','m4a','wav','aac','mpeg','mpga','webm'],true))return ['stage'=>'audio','priority'=>2,'kind'=>'media'];
    if(in_array($ext,['mp4','mov','mkv','avi','3gp'],true))return ['stage'=>'video','priority'=>3,'kind'=>'media'];
    return null;
}

function whatsappExtract(array $r,array $u):array {
    if(!class_exists('ZipArchive'))throw new Failure('ZIP_INDISPONIVEL','O servidor ainda não está com a leitura de ZIP habilitada. O arquivo original foi preservado.',503);
    $source=recordDir($r['id']).'/'.$r['source_file'];$zip=new \ZipArchive();
    if($zip->open($source)!==true)throw new Failure('ZIP_INVALIDO','Não foi possível abrir a exportação do WhatsApp. O original foi preservado.',422);
    try{
        if($zip->numFiles<1||$zip->numFiles>500)throw new Failure('ZIP_QUANTIDADE_INVALIDA','A exportação deve conter entre 1 e 500 arquivos.',413);
        $selected=[];$total=0;
        for($i=0;$i<$zip->numFiles;$i++){
            $stat=$zip->statIndex($i);if(!is_array($stat))continue;$raw=(string)($stat['name']??'');
            if($raw===''||str_ends_with($raw,'/')||str_contains($raw,"\0"))continue;
            $name=basename(str_replace('\\','/',$raw));$type=whatsappKind($name);if(!$type)continue;
            $size=(int)($stat['size']??0);if($size<=0||$size>(int)cfg()['max_upload_bytes'])continue;
            $total+=$size;if($total>(int)cfg()['max_upload_bytes'])throw new Failure('ZIP_CONTEUDO_GRANDE','Texto, áudios e vídeos ultrapassam o limite de processamento.',413);
            $selected[]=['index'=>$i,'name'=>$name,'size'=>$size]+$type;
        }
        usort($selected,fn($a,$b)=>[$a['priority'],$a['index']]<=>[$b['priority'],$b['index']]);
        if(!$selected)throw new Failure('ZIP_SEM_CONVERSA','O ZIP não contém texto, áudio ou vídeo do WhatsApp.',422);
        if(storageUsed($u)+$total>(int)cfg()['max_user_storage_bytes'])throw new Failure('COTA_ARMAZENAMENTO','Não há espaço suficiente para preparar o conteúdo da conversa. O ZIP original foi preservado.',507);
        $items=[];
        foreach($selected as $item){
            $ext=strtolower(pathinfo($item['name'],PATHINFO_EXTENSION));
            $child=newRecord($u,$item['kind'],['name'=>$item['name'],'mime'=>'','ext'=>$ext,'size'=>$item['size'],'live'=>false,'parent_record_id'=>$r['meta']['parent_record_id']??'','source_record_id'=>$r['id'],'transcribe_only'=>true,'whatsapp_stage'=>$item['stage'],'document_format'=>'minutes']);
            $dir=recordDir($child['id']);$target=$dir.'/source.'.$ext;$tmp=$target.'.extracting';$in=$zip->getStream((string)$zip->getNameIndex($item['index']));$out=fopen($tmp,'wb');
            if(!$in||!$out){if(is_resource($in))fclose($in);if(is_resource($out))fclose($out);throw new Failure('ZIP_EXTRACAO_FALHOU','Não foi possível preparar um arquivo da conversa.',507);}
            $written=stream_copy_to_stream($in,$out);fclose($in);fclose($out);
            if($written!==$item['size']||!rename($tmp,$target))throw new Failure('ZIP_EXTRACAO_FALHOU','Um arquivo da conversa ficou incompleto.',507);
            chmod($target,0600);$child['source_file']=basename($target);$child['source_sha256']=hash_file('sha256',$target);$child['bytes_received']=$item['size'];$child['job_state']='uploaded';$child['status']='processing';atomic(recordPath($child['id']),encode($child));
            $items[]=['record_id'=>$child['id'],'name'=>$item['name'],'stage'=>$item['stage'],'state'=>'pending'];
        }
    }finally{$zip->close();}
    $r['batch_items']=$items;$r['batch_total']=count($items);$r['batch_done']=0;$r['batch_failed']=0;$r['batch_stage']=$items[0]['stage'];$r['batch_current']=$items[0]['name'];$r['job_state']='whatsapp_processing';
    return $r;
}

function whatsappBatchStep(array $r,array $u):array {
    if(($r['job_state']??'')==='uploaded')return whatsappExtract($r,$u);
    if(($r['job_state']??'')!=='whatsapp_processing')return reportStep($r,$u);
    $index=null;foreach($r['batch_items'] as $i=>$item)if(($item['state']??'pending')==='pending'){$index=$i;break;}
    if($index===null){
        $parts=[];foreach($r['batch_items'] as $item)if(($item['state']??'')==='done'){
            $p=recordDir($item['record_id']).'/transcript.txt';if(is_file($p))$parts[]="[{$item['stage']} — {$item['name']}]\n".file_get_contents($p);
        }
        if(!$parts)throw new Failure('WHATSAPP_SEM_CONTEUDO','Nenhum texto, áudio ou vídeo pôde ser lido. O ZIP original foi preservado.',422);
        $header="EXPORTAÇÃO DE GRUPO DO WHATSAPP. Identifique separadamente atividades concluídas e atividades pendentes. Preserve responsáveis, obras, datas e prazos quando estiverem explícitos. A ordem das fontes é texto, áudios e vídeos.\n\n";
        atomic(recordDir($r['id']).'/transcript.txt',$header.implode("\n\n",$parts));$r['transcript_sha256']=hash_file('sha256',recordDir($r['id']).'/transcript.txt');$r['job_state']='transcription_ready';$r['batch_stage']='consolidacao';$r['batch_current']='';return $r;
    }
    $item=$r['batch_items'][$index];$r['batch_stage']=$item['stage'];$r['batch_current']=$item['name'];
    try{
        $job=mediaStep($item['record_id'],$u);
        if(($job['state']??'')==='ready'){$r['batch_items'][$index]['state']='done';$r['batch_done']++;}
    }catch(\Throwable $e){
        $r['batch_items'][$index]['state']='failed';$r['batch_items'][$index]['error']=$e instanceof Failure?$e->status:'ERRO_INTERNO';$r['batch_done']++;$r['batch_failed']++;
    }
    return $r;
}
