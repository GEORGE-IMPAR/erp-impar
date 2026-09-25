<?php
declare(strict_types=1);
namespace GeorgeV09;
function mediaCaps():array {
    $run=is_callable('proc_open');
    return ['ffmpeg'=>$run&&is_executable((string)cfg()['ffmpeg']),'ffprobe'=>$run&&is_executable((string)cfg()['ffprobe']),
      'curl'=>function_exists('curl_init'),'max_upload_bytes'=>cfg()['max_upload_bytes'],'chunk_bytes'=>cfg()['upload_chunk_bytes'],
      'direct_transcription_formats'=>['mp3','mp4','mpeg','mpga','m4a','wav','webm','ogg','opus','aac'],'direct_transcription_max_bytes'=>24*1024*1024,'max_audio_seconds'=>cfg()['max_audio_seconds'],'video_analysis'=>'AUDIO_AND_SAMPLED_FRAMES','browser_preparation'=>true,'whatsapp_zip'=>class_exists('ZipArchive'),'template'=>'ERP_IMPAR_ATA_EXECUTIVA_V1'];
}
function mediaExt(string $name,string $mime):string {
    $ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));
    $ok=['pdf','png','jpg','jpeg','webp','gif','docx','xlsx','pptx','mp3','mp4','m4a','mpeg','mpga','wav','webm','mov','mkv','ogg','aac','txt','md','csv','json'];
    if(!preg_match('/^[a-z0-9]{2,5}$/D',$ext))$ext='bin'; // Mesmo anexo não interpretável é preservado como original privado.
    return $ext;
}
function storageUsed(array $u):int {
    $n=0;foreach(glob(storeRoot().'/records/*/record.json')?:[] as $p){$r=readJson($p);if($r['owner_id']!==$u['id'])continue;
        $it=new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(dirname($p),\FilesystemIterator::SKIP_DOTS));foreach($it as $f)if($f->isFile())$n+=$f->getSize();}
    return $n;
}
function mediaStart(array $u,array $in):array {
    $name=basename(str_replace('\\','/',(string)($in['name']??'arquivo.mp4')));$mime=(string)($in['mime']??'');$ext=mediaExt($name,$mime);
    $parent=(string)($in['parent_record_id']??'');if($parent!==''){$p=record($parent,$u);if(!in_array($p['kind'],['conversation','meeting','kickoff'],true)||$p['owner_id']!==$u['id'])throw new Failure('CONVERSA_INCOMPATIVEL','Selecione sua própria conversa ou reunião para anexar.',403);}
    $live=(bool)($in['live']??false);if($live&&!cfg()['enable_recording'])throw new Failure('GRAVACAO_DESABILITADA','Gravação ao vivo desabilitada na configuração.',403);$size=(int)($in['size']??0);
    if(!$live&&($size<=0||$size>cfg()['max_upload_bytes']))throw new Failure('TAMANHO_INVALIDO','Arquivo vazio ou acima do limite configurado.',413);
    if(storageUsed($u)+max($size,1)>cfg()['max_user_storage_bytes'])throw new Failure('COTA_ARMAZENAMENTO','A cota de armazenamento do usuário precisa ser revisada.',507);
    $isText=in_array($ext,['txt','md','csv','json'],true);
    if($isText&&$size>5*1024*1024)throw new Failure('TEXTO_MUITO_GRANDE','Textos devem ter até 5 MB.',413);
    $kind=$ext==='zip'?'whatsapp':(in_array($in['kind']??'', ['meeting','kickoff'],true)?$in['kind']:($isText?'text':'media'));
    $r=newRecord($u,$kind,['name'=>$name,'mime'=>$mime,'ext'=>$ext,'size'=>$size,'live'=>$live,'parent_record_id'=>$parent,'meeting_date'=>trim((string)($in['meeting_date']??'')),'document_format'=>$ext==='zip'?'minutes':(in_array($ext,['pdf','png','jpg','jpeg','webp','gif','docx','xlsx','pptx','txt','md','csv','json'],true)?'document':'minutes')]);
    $r['status']='uploading';$r['chunks']=[];$r['bytes_received']=0;$r['job_state']='uploading';atomic(recordPath($r['id']),encode($r));
    if($parent!=='')updateRecord($parent,$u,function($p)use($r,$name){$p['meta']['attachments'][]=['id'=>$r['id'],'name'=>$name,'at'=>date(DATE_ATOM)];return $p;});
    return ['ok'=>true,'record_id'=>$r['id'],'chunk_bytes'=>cfg()['upload_chunk_bytes']];
}
function receiveChunk(string $id,array $u,int $index,string $tmp,int $size):array {
    if($index<0||$index>15000||$size<=0||$size>cfg()['upload_chunk_bytes'])throw new Failure('BLOCO_INVALIDO','Bloco de upload inválido.',413);
    $r=updateRecord($id,$u,function($r)use($id,$index,$tmp,$size,$u){
        if($r['job_state']!=='uploading')throw new Failure('UPLOAD_FECHADO','Este upload já foi concluído.',409);
        $hash=hash_file('sha256',$tmp);$key=(string)$index;
        if(isset($r['chunks'][$key])){if($r['chunks'][$key]['sha256']!==$hash)throw new Failure('BLOCO_DIVERGENTE','Tentativa de substituir um bloco recebido.',409);return $r;}
        if($r['bytes_received']+$size>cfg()['max_upload_bytes'])throw new Failure('LIMITE_ARQUIVO','Limite de arquivo excedido.',413);
        if(storageUsed($u)+$size>cfg()['max_user_storage_bytes'])throw new Failure('COTA_ARMAZENAMENTO','Cota de armazenamento excedida.',507);
        $p=recordDir($id).'/chunks/'.sprintf('%06d',$index).'.part';atomic($p,(string)file_get_contents($tmp));
        $r['chunks'][$key]=['size'=>$size,'sha256'=>$hash];$r['bytes_received']+=$size;return $r;
    });return ['ok'=>true,'received'=>$r['bytes_received'],'index'=>$index];
}
function finishUpload(string $id,array $u,int $count):array {
    return locked(recordDir($id).'/process.lock',function()use($id,$u,$count){
        $r=record($id,$u);if($r['job_state']!=='uploading')return ['ok'=>true,'record_id'=>$id,'state'=>$r['job_state']];
        if($count<=0||count($r['chunks'])!==$count)throw new Failure('UPLOAD_INCOMPLETO','Faltam blocos do arquivo. O upload ainda não foi confirmado.',409);
        if(!$r['meta']['live']&&$r['bytes_received']!==$r['meta']['size'])throw new Failure('TAMANHO_DIVERGENTE','O tamanho recebido não corresponde ao arquivo.',409);
        $target=recordDir($id).'/source.'.$r['meta']['ext'];$tmp=$target.'.assembling';$out=fopen($tmp,'wb');
        if(!$out)throw new Failure('SEM_ESPACO','Não foi possível montar o arquivo.',507);
        try{for($i=0;$i<$count;$i++){
            $p=recordDir($id).'/chunks/'.sprintf('%06d',$i).'.part';
            if(!isset($r['chunks'][(string)$i])||!is_file($p)||hash_file('sha256',$p)!==$r['chunks'][(string)$i]['sha256'])throw new Failure('BLOCO_AUSENTE','Há um bloco ausente ou divergente.',409);
            $in=fopen($p,'rb');if(!$in)throw new Failure('BLOCO_ILEGIVEL','Não foi possível ler o bloco.',422);
            try{if(stream_copy_to_stream($in,$out)!==$r['chunks'][(string)$i]['size'])throw new Failure('FALHA_MONTAGEM','Falha ao copiar o conteúdo do arquivo.',507);}finally{fclose($in);}
        }}catch(\Throwable $e){fclose($out);@unlink($tmp);throw $e;}
        fclose($out);if(filesize($tmp)!==$r['bytes_received'])throw new Failure('ARQUIVO_INCOMPLETO','Arquivo montado incompleto.',422);
        if(!rename($tmp,$target))throw new Failure('FALHA_MONTAGEM','Falha ao confirmar o arquivo.',507);chmod($target,0600);
        $hash=hash_file('sha256',$target);
        $r=updateRecord($id,$u,function($r)use($target,$hash){$r['source_file']=basename($target);$r['source_sha256']=$hash;$r['status']='processing';$r['job_state']='uploaded';return $r;});
        // Depois da confirmação atômica, os blocos são redundantes. O original é mantido.
        foreach(glob(recordDir($id).'/chunks/*.part')?:[] as $p)@unlink($p);
        return ['ok'=>true,'record_id'=>$id,'state'=>$r['job_state'],'source_sha256'=>$hash];
    });
}
function processExec(array $args,int $seconds=75):string {
    if(!is_callable('proc_open'))throw new Failure('EXECUCAO_INDISPONIVEL','A hospedagem precisa permitir FFmpeg/FFprobe para extrair o áudio.',503);
    $process=proc_open($args,[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,null,['bypass_shell'=>true]);
    if(!is_resource($process))throw new Failure('FFMPEG_INDISPONIVEL','Não foi possível iniciar o processamento de mídia.',503);
    fclose($pipes[0]);stream_set_blocking($pipes[1],false);stream_set_blocking($pipes[2],false);$stdout='';$stderr='';$start=microtime(true);$exit=-1;
    try{while(true){$stdout.=stream_get_contents($pipes[1]);$stderr.=stream_get_contents($pipes[2]);if(strlen($stdout)>2000000||strlen($stderr)>2000000)throw new Failure('MIDIA_INVALIDA','A mídia produziu uma saída inesperada.',422);
        $s=proc_get_status($process);if(!$s['running']){$exit=$s['exitcode'];break;}
        if(microtime(true)-$start>$seconds){proc_terminate($process,9);throw new Failure('MIDIA_TIMEOUT','O processamento excedeu o tempo desta etapa. O original está preservado.',504);}usleep(40000);
    }$stdout.=stream_get_contents($pipes[1]);$stderr.=stream_get_contents($pipes[2]);}
    catch(\Throwable $e){proc_terminate($process,9);throw $e;}
    finally{fclose($pipes[1]);fclose($pipes[2]);$end=proc_close($process);}
    if($exit!==0&&$end!==0){error_log('George V09 media '.substr($stderr,-1800));throw new Failure('MIDIA_NAO_DECODIFICADA','Não foi possível ler a faixa de áudio deste arquivo. O original está preservado.',422);}
    return $stdout;
}
function mediaDemuxer(array $r):string {
    // Nunca autodetectar playlists/concat disfarçados de vídeo. Restringir contêiner e protocolos.
    return match($r['meta']['ext']) {
        'mp4','m4a','mov'=>'mov', 'webm','mkv'=>'matroska', 'mp3','mpga'=>'mp3',
        'wav'=>'wav','ogg','opus'=>'ogg','aac'=>'aac','mpeg'=>'mpeg','avi'=>'avi','3gp'=>'mov',
        default=>throw new Failure('FORMATO_INVALIDO','Contêiner de mídia não autorizado.',415)
    };
}
function inspectMedia(array $r):array {
    $caps=mediaCaps();
    if(!$caps['ffmpeg']||!$caps['ffprobe']){
        $p=recordDir($r['id']).'/'.$r['source_file'];
        if(in_array($r['meta']['ext'],$caps['direct_transcription_formats'],true)&&filesize($p)<=$caps['direct_transcription_max_bytes']){
            // Endpoint de transcrição aceita MP4/WEBM diretamente. Não analisa frames.
            // Sem FFprobe não se declara duração nem presença de áudio antes da resposta do serviço.
            return ['duration'=>null,'segments'=>1,'audio_source'=>null,'direct_transcription'=>true];
        }
        throw new Failure('FFMPEG_NECESSARIO','O original está salvo. Use Preparar neste aparelho para extrair trechos de áudio e imagens sem FFmpeg no servidor. O navegador precisa conseguir reproduzir este formato.',503);
    }
    $src=recordDir($r['id']).'/'.$r['source_file'];
    $raw=processExec([cfg()['ffprobe'],'-v','error','-protocol_whitelist','file,pipe','-f',mediaDemuxer($r),'-select_streams','a','-show_entries','format=duration:stream=index,codec_type,duration','-of','json',$src],15);
    $j=json_decode($raw,true);if(empty($j['streams']))throw new Failure('VIDEO_SEM_AUDIO','O vídeo não contém faixa de áudio. Não há fala para transcrever.',422);
    $duration=(float)($j['format']['duration']??$j['streams'][0]['duration']??0);
    $audioSource=null;
    if($duration<=0){
        // MediaRecorder/WEBM pode não gravar Duration no cabeçalho. Remuxar sem recodificar,
        // preservando o original, cria um arquivo buscável antes de dividir por tempo.
        $normalized=recordDir($r['id']).'/audio_seekable.mka';
        if(!is_file($normalized)){
            $tmp=$normalized.'.tmp';
            processExec([cfg()['ffmpeg'],'-nostdin','-v','error','-y','-protocol_whitelist','file,pipe','-f',mediaDemuxer($r),'-i',$src,'-map','0:a:0','-vn','-sn','-dn','-c:a','copy','-f','matroska',$tmp],90);
            if(!rename($tmp,$normalized))throw new Failure('FALHA_REMUX','Não foi possível confirmar o áudio normalizado.',507);
            chmod($normalized,0600);
        }
        $probe=processExec([cfg()['ffprobe'],'-v','error','-protocol_whitelist','file,pipe','-f','matroska','-select_streams','a','-show_entries','format=duration:stream=duration','-of','json',$normalized],15);
        $p=json_decode($probe,true);$duration=(float)($p['format']['duration']??$p['streams'][0]['duration']??0);$audioSource=basename($normalized);
    }
    if($duration<=0)throw new Failure('DURACAO_DESCONHECIDA','Não foi possível determinar a duração; o arquivo foi preservado para verificação.',422);
    if($duration>cfg()['max_audio_seconds'])throw new Failure('DURACAO_LIMITE','A gravação excede o limite configurado de duração.',413);
    return ['duration'=>$duration,'segments'=>(int)ceil($duration/cfg()['segment_seconds']),'audio_source'=>$audioSource];
}
function extractSegment(array $r,int $i):string {
    if(!empty($r['direct_transcription']))return recordDir($r['id']).'/'.$r['source_file'];
    $src=recordDir($r['id']).'/'.($r['audio_source']??$r['source_file']);$demux=!empty($r['audio_source'])?'matroska':mediaDemuxer($r);$out=recordDir($r['id']).'/audio_'.sprintf('%04d',$i).'.mp3';if(is_file($out)&&filesize($out)>0)return $out;$tmp=$out.'.tmp';
    $start=$i*cfg()['segment_seconds'];$length=min(cfg()['segment_seconds'],$r['duration']-$start);
    processExec([cfg()['ffmpeg'],'-nostdin','-v','error','-y','-protocol_whitelist','file,pipe','-ss',(string)$start,'-f',$demux,'-i',$src,'-t',(string)$length,'-map','0:a:0','-vn','-sn','-dn','-ac','1','-ar','16000','-c:a','libmp3lame','-b:a','48k','-f','mp3',$tmp],90);
    if(!is_file($tmp)||filesize($tmp)===0)throw new Failure('AUDIO_VAZIO','A extração de áudio retornou arquivo vazio.',422);if(!rename($tmp,$out))throw new Failure('AUDIO_NAO_SALVO','Falha ao salvar o trecho.',507);chmod($out,0600);return $out;
}
function transcribeFile(string $path):string {
    if(filesize($path)>24*1024*1024)throw new Failure('TRECHO_GRANDE','O trecho excede o tamanho de transcrição.',413);
    if(!class_exists('\CURLFile')&&!cfg()['test_mode'])throw new Failure('CURL_AUSENTE','A extensão cURL precisa estar ativa.',503);
    $mime=match(strtolower(pathinfo($path,PATHINFO_EXTENSION))){'mp4'=>'video/mp4','webm'=>'video/webm','m4a'=>'audio/mp4','wav'=>'audio/wav','ogg','opus'=>'audio/ogg','aac'=>'audio/aac','mpeg'=>'video/mpeg',default=>'audio/mpeg'};
    $file=class_exists('\CURLFile')?new \CURLFile($path,$mime,basename($path)):$path;
    $p=['model'=>cfg()['file_transcription_model'],'file'=>$file,'response_format'=>'json'];
    if(cfg()['file_transcription_model']==='gpt-transcribe'){$p['languages[]']='pt';$p['keywords[]']='ERP ÍMPAR';$p['prompt']='Conversa de escritório em português brasileiro sobre obras, colaboradores, atividades, horários e percentuais. Vocabulário possível: ERP ÍMPAR, George, Jorge, Tubarão, São Sebastião, climatização. Preserve a fala e não preencha silêncio.';}else{$p['language']='pt';}
    // Contexto só ajuda grafia; nunca se inventa uma fala para preencher silêncio.
    if(str_starts_with(cfg()['file_transcription_model'],'gpt-4o'))$p['prompt']='ERP ÍMPAR, George, climatização, Araranguá, Tubarão, Tramandaí, refnet, vácuo, startup.';
    $j=aiRequest('audio/transcriptions',$p,true,150);
    if(!is_string($j['text']??null))throw new Failure('TRANSCRICAO_INVALIDA','O serviço não retornou uma transcrição válida.',502);
    return trim($j['text']);
}
function mediaStep(string $id,array $u):array {
    return locked(recordDir($id).'/process.lock',function()use($id,$u){
        $r=record($id,$u);$state=$r['job_state']??'';
        if(in_array($state,['cancelled','deleted'],true))return jobPublic($r);
        if($state==='ready')return jobPublic($r);
        if($state==='uploading')throw new Failure('UPLOAD_INCOMPLETO','Conclua o upload antes de processar.',409);
        if($r['kind']==='whatsapp' || str_starts_with($state,'whatsapp_')){
            $r=whatsappBatchStep($r,$u);
        }elseif($state==='uploaded' && !empty($r['derived_manifest'])){
            $r=derivedStep($r,$u);
        }elseif($state==='derived_processing'){
            $r=derivedStep($r,$u);
        }elseif($state==='uploaded'){
            if(in_array($r['meta']['ext'],['pdf','png','jpg','jpeg','webp','gif','docx','xlsx','pptx'],true)){
                $text=attachmentText($r);atomic(recordDir($id).'/transcript.txt',$text);$r['transcript_sha256']=hash('sha256',$text);$r['job_state']='transcription_ready';
            }elseif(in_array($r['meta']['ext'],['txt','md','csv','json'],true)){
                $text=(string)file_get_contents(recordDir($id).'/'.$r['source_file']);
                if(!preg_match('//u',$text))$text=iconv('Windows-1252','UTF-8',$text)?:'';
                if(trim($text)==='')throw new Failure('SEM_CONTEUDO','O arquivo não contém texto.',422);
                atomic(recordDir($id).'/transcript.txt',$text);$r['job_state']='transcription_ready';$r['transcript_sha256']=hash('sha256',$text);
            }else{$m=inspectMedia($r);$r+=$m;$r['next_segment']=0;$r['segment_texts']=[];$r['job_state']='transcribing';}
        }elseif($state==='transcribing'){
            $i=$r['next_segment'];$file=extractSegment($r,$i);$cache=recordDir($id).'/transcript_'.sprintf('%04d',$i).'.txt';
            $text=is_file($cache)?(string)file_get_contents($cache):transcribeFile($file);if(!is_file($cache))atomic($cache,$text);
            $r['segment_texts'][$i]=['start'=>$i*cfg()['segment_seconds'],'end'=>isset($r['duration'])?min(($i+1)*cfg()['segment_seconds'],$r['duration']):null,'file'=>basename($cache),'sha256'=>hash('sha256',$text)];$r['next_segment']++;
            if($r['next_segment']>=$r['segments']){
                $all=[];foreach($r['segment_texts'] as $s)$all[]=($s['end']===null?"[Arquivo integral — duração não medida no servidor]\n":'[Trecho '.gmdate('H:i:s',(int)$s['start']).' – '.gmdate('H:i:s',(int)$s['end'])."]\n").file_get_contents(recordDir($id).'/'.$s['file']);
                $full=implode("\n\n",$all);$speech=implode('',array_map(fn($s)=>trim((string)file_get_contents(recordDir($id).'/'.$s['file'])),$r['segment_texts']));
                if($speech==='')throw new Failure('SEM_FALA_IDENTIFICADA','Nenhuma fala foi identificada. Não será criada uma ata fictícia.',422);
                atomic(recordDir($id).'/transcript.txt',$full);$r['transcript_sha256']=hash('sha256',$full);$r['job_state']='transcription_ready';
            }
        }elseif($state==='transcription_ready'&&!empty($r['meta']['transcribe_only'])){
            $r['job_state']='ready';$r['status']='closed';$r['finished_at']=date(DATE_ATOM);
        }else{$r=reportStep($r,$u);}
        if(is_file(recordDir($id).'/queue-stop.json'))return jobPublic(record($id,$u));
        unset($r['last_error']);$r['revision']++;$r['updated_at']=date(DATE_ATOM);atomic(recordPath($id),encode($r));return jobPublic($r);
    });
}
function jobPublic(array $r):array {
    return ['ok'=>true,'record_id'=>$r['id'],'state'=>$r['job_state']??$r['status'],'live'=>!empty($r['meta']['live']),'created_at'=>$r['created_at'],'name'=>$r['meta']['name']??'',
      'received'=>$r['bytes_received']??0,'duration'=>$r['duration']??null,'segments_done'=>$r['next_segment']??0,'segments_total'=>$r['segments']??0,
      'report_parts_done'=>count($r['report_parts']??[]),'report_parts_total'=>count($r['report_inputs']??[]),
      'batch_stage'=>$r['batch_stage']??null,'batch_done'=>$r['batch_done']??0,'batch_total'=>$r['batch_total']??0,'batch_failed'=>$r['batch_failed']??0,'batch_current'=>$r['batch_current']??'',
      'transcript_ready'=>is_file(recordDir($r['id']).'/transcript.txt'),'pdf_ready'=>is_file(recordDir($r['id']).'/report.pdf')&&($r['job_state']??'')==='ready'];
}
