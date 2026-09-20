<?php
declare(strict_types=1);
require __DIR__.'/lib/Core.php';
require_once __DIR__.'/lib/AgendaStore.php';
require_once __DIR__.'/lib/AgendaDomain.php';
require_once __DIR__.'/lib/AgendaInstall.php';
require_once __DIR__.'/lib/Meeting.php';
require_once __DIR__.'/lib/AgendaTools.php';
use function GeorgeV09\{bootHttp,actor,cfg,errorOut};
use GeorgeV09\Failure;
try{
    bootHttp();$u=actor();
    if(!function_exists('curl_init'))throw new Failure('CURL_AUSENTE','cURL indisponível.',503);
    $sdp=(string)file_get_contents('php://input');if(strlen($sdp)>100000||!str_starts_with(trim($sdp),'v=0'))throw new Failure('SDP_INVALIDO','Oferta de áudio inválida.');
    $c=cfg();$key=(string)($c['openai_api_key']??'');if($key==='')throw new Failure('SEM_CHAVE','Configuração de IA indisponível.',503);
    // Preserva modelo, voz e transcrição da configuração existente. Realtime é a camada de áudio,
    // não um segundo agente operacional. As respostas factuais vêm do chat com ferramentas.
    $session=['type'=>'realtime','model'=>(string)($c['realtime_model']??'gpt-realtime-2.1'),
       'instructions'=>'Você é a voz do George, do ERP ÍMPAR. Fale português brasileiro com pronúncia brasileira natural, ritmo de conversa de escritório, voz acolhedora e sem imitar sotaque americano. Respeite pontuação e nomes próprios; não soletre textos comuns. Transcreva continuamente a entrada, inclusive quando houver fala humana durante a reprodução. Não interrompa nem responda automaticamente: o aplicativo reconhecerá somente o chamado George ou Jorge, decidirá se deve pausar e enviará TEXTO_VALIDADO_PARA_LEITURA. Leia apenas esse texto. Não invente fatos, atividades, resultados ou explicações adicionais.',
       'output_modalities'=>['audio'],'audio'=>[
           'input'=>['transcription'=>['model'=>'gpt-live-transcribe','languages'=>['pt'],'delay'=>'low','keywords'=>['George','Jorge','ERP ÍMPAR','climatização','Araranguá','Tubarão','Tramandaí','refnet','RDO','AS Araranguá','Fábio','Pablo','Nicolas','Leandro','Henrique','Neri','Valdeci','frigorígena']],
             'turn_detection'=>['type'=>'semantic_vad','eagerness'=>'low','create_response'=>false,'interrupt_response'=>false]],
           'output'=>['voice'=>(string)($c['realtime_voice']??'marin')]],'max_output_tokens'=>'inf'];
    $ch=curl_init('https://api.openai.com/v1/realtime/calls');curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>15,CURLOPT_TIMEOUT=>65,
      CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'OpenAI-Safety-Identifier: '.hash('sha256',$u['id'])],
      CURLOPT_POSTFIELDS=>['sdp'=>$sdp,'session'=>GeorgeV09\encode($session)]]);
    $raw=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($raw===false||$code<200||$code>=300){error_log('George V09 realtime HTTP '.$code);throw new Failure('FALHA_VOZ','Não foi possível iniciar a voz. O chat por escrita continua disponível.',502);}
    header('Content-Type: application/sdp');echo $raw;
}catch(Throwable $e){errorOut($e);}
