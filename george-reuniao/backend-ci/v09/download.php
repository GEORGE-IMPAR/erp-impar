<?php
declare(strict_types=1);
require __DIR__.'/lib/Core.php';
require_once __DIR__.'/lib/AgendaStore.php';
require_once __DIR__.'/lib/AgendaDomain.php';
require_once __DIR__.'/lib/AgendaInstall.php';
require_once __DIR__.'/lib/Meeting.php';
require_once __DIR__.'/lib/AgendaTools.php';
use function GeorgeV09\{bootHttp,actor,record,recordDir,errorOut};
use GeorgeV09\Failure;
try{
    bootHttp(['GET']);$u=actor(false);$id=(string)($_GET['record_id']??'');$r=record($id,$u);$kind=(string)($_GET['kind']??'pdf');
    if(($r['job_state']??'')==='deleted')throw new Failure('ARQUIVO_EXCLUIDO','Este arquivo foi excluído.',410);
    $files=['pdf'=>['report.pdf','application/pdf','Ata_Executiva_ERP_IMPAR_George.pdf'],
      'text'=>['transcript.txt','text/plain; charset=utf-8','Transcricao_George.txt'],
      'json'=>['report.json','application/json; charset=utf-8','Ata_Executiva_George.json']];
    if($kind==='source'){
        $f=(string)($r['source_file']??'');
        if(!preg_match('/^source\.[a-z0-9]{2,5}$/D',$f))throw new Failure('ORIGINAL_NAO_CONFIRMADO','O original ainda não foi confirmado.',409);
        $files['source']=[$f,'application/octet-stream','Original_George.'.pathinfo($f,PATHINFO_EXTENSION)];
    }
    if(!isset($files[$kind]))throw new Failure('ARQUIVO_INVALIDO','Tipo de arquivo não autorizado.');
    [$name,$type,$download]=$files[$kind];$p=recordDir($id).'/'.$name;
    if(!is_file($p))throw new Failure('ARQUIVO_NAO_PRONTO','O arquivo ainda não está pronto.',409);
    if($kind==='pdf'&&($r['job_state']??'')!=='ready')throw new Failure('PDF_NAO_CONFIRMADO','O PDF ainda não foi confirmado.',409);
    if($kind==='pdf'){$head=file_get_contents($p,false,null,0,5);$hash=hash_file('sha256',$p);if($head!=='%PDF-'||filesize($p)<100||empty($r['report_sha256'])||!hash_equals($r['report_sha256'],$hash))throw new Failure('PDF_DIVERGENTE','O documento precisa ser gerado novamente antes de abrir.',409);header('X-George-SHA256: '.$hash);header('X-George-Record: '.$id);header('X-George-Bytes: '.filesize($p));}
    header('Content-Type: '.$type);header('Content-Disposition: attachment; filename="'.$download.'"');header('Content-Length: '.filesize($p));header('Access-Control-Expose-Headers: Content-Disposition, Content-Length, X-George-SHA256, X-George-Record, X-George-Bytes');readfile($p);
}catch(Throwable $e){errorOut($e);}
