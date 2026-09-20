<?php
declare(strict_types=1);

/** Adaptador legado mínimo e isolado para os testes de domínio da Agenda. */
function mobile_agenda_data_dir(): string {
    $path=(string)getenv('GEORGE_AGENDA_DATA_DIR');
    if($path===''||(!is_dir($path)&&!mkdir($path,0700,true)))throw new RuntimeException('Diretório de Agenda CI ausente.');
    return $path;
}

function mobile_norm(string $value): string {
    $value=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$value)?:$value;
    return strtolower(trim(preg_replace('/\s+/',' ',$value)));
}

function mobile_agenda_is_cancelled(array $activity): bool {
    return !empty($activity['cancelado'])||!empty($activity['cancelled'])||str_contains(mobile_norm((string)($activity['status']??'')),'cancel');
}

function mobile_similarity(string $left,string $right): float {
    similar_text(mobile_norm($left),mobile_norm($right),$percent);
    return $percent/100;
}