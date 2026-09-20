<?php
declare(strict_types=1);
require __DIR__.'/lib/Core.php';
use function GeorgeV09\{bootHttp,actor,body,cfg,encode,errorOut};
use GeorgeV09\Failure;
try {
    bootHttp();$u=actor();$in=body();$text=trim((string)($in['text']??''));
    if($text===''||mb_strlen($text,'UTF-8')>3500)throw new Failure('FALA_INVALIDA','O trecho de fala está vazio ou muito longo.');
    $c=cfg();$key=(string)($c['openai_api_key']??'');if($key===''||!function_exists('curl_init'))throw new Failure('VOZ_INDISPONIVEL','A voz não está disponível agora.',503);
    $payload=['model'=>$c['speech_model']??'gpt-4o-mini-tts','voice'=>$c['speech_voice']??'cedar','input'=>$text,'response_format'=>'mp3',
      'instructions'=>'Fale como um colega brasileiro em uma conversa de escritório. Português brasileiro nativo, voz calorosa e descontraída, ritmo ágil mas confortável, entonação variada e pequenas pausas naturais. Sem voz de locutor, sem solenidade ou cadência robótica. Leia somente o texto fornecido, sem acrescentar palavras. Pronuncie nomes de pessoas e cidades do Brasil naturalmente.'];
    $ch=curl_init('https://api.openai.com/v1/audio/speech');curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>60,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Content-Type: application/json','OpenAI-Safety-Identifier: '.hash('sha256',(string)$u['id'])],CURLOPT_POSTFIELDS=>encode($payload)]);
    $raw=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$type=(string)curl_getinfo($ch,CURLINFO_CONTENT_TYPE);curl_close($ch);
    if($code<200||$code>=300||!is_string($raw)||strlen($raw)<100||!str_starts_with($type,'audio/')){error_log('George speech HTTP '.$code);throw new Failure('FALHA_VOZ','Não consegui falar agora. Minha resposta está na conversa.',502);}
    header('Content-Type: audio/mpeg');header('Content-Length: '.strlen($raw));echo $raw;
}catch(Throwable $e){errorOut($e);}
