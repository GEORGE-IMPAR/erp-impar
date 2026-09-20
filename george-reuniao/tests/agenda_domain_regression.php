<?php
declare(strict_types=1);

if ($argc !== 3) {
    fwrite(STDERR, "Uso: php agenda_domain_regression.php <backend-v09> <fixtures>\n");
    exit(2);
}

$backend = rtrim($argv[1], DIRECTORY_SEPARATOR);
$fixtures = rtrim($argv[2], DIRECTORY_SEPARATOR);

require dirname($backend, 2).'/assistant/common.php';
require $backend.'/lib/Core.php';
require $backend.'/lib/AgendaStore.php';
require $backend.'/lib/AgendaJson.php';
require $backend.'/lib/AgendaDomain.php';
require $backend.'/lib/AgendaInstall.php';
require $backend.'/lib/AgendaTools.php';
require $backend.'/lib/AgendaOps.php';

use GeorgeV09\Failure;

function fixture(string $fixtures, string $name): array {
    $path=$fixtures.'/'.$name;
    $value=json_decode((string)file_get_contents($path),true,512,JSON_THROW_ON_ERROR);
    if(!is_array($value))throw new RuntimeException('Fixture inválida: '.$name);
    return $value;
}

function expect(bool $condition, string $message): void {
    if(!$condition)throw new RuntimeException($message);
}

function expectSame(mixed $expected, mixed $actual, string $message): void {
    if($expected!==$actual)throw new RuntimeException($message.' esperado='.var_export($expected,true).' recebido='.var_export($actual,true));
}

function executeAgenda(array $user, array $request): array {
    $result=\GeorgeV09\agendaExecute($user,$request);
    expect(($result['ok']??false)===true,'Operação não confirmada: '.json_encode($result,JSON_UNESCAPED_UNICODE));
    expect(($result['verified']??false)===true,'Operação sem verified=true: '.json_encode($result,JSON_UNESCAPED_UNICODE));
    return $result;
}

$user=[
    'id'=>'agenda-ci-user',
    'nome'=>'Usuário Agenda CI',
    'email'=>'agenda-ci@erpimpar.invalid',
    'company_id'=>1,
    'company_name'=>'Empresa Agenda CI',
    'admin'=>true,
    'modules'=>['admin','atividades']
];
$agendaDir=\GeorgeV09\agendaDataDir($user);
if(!is_dir($agendaDir)&&!mkdir($agendaDir,0700,true))throw new RuntimeException('Não foi possível criar a pasta da fixture.');

copy($fixtures.'/agenda_catalog.json',$agendaDir.'/cadastros_agenda_novo.json');
copy($fixtures.'/agenda_draft_friday.json',$agendaDir.'/agenda_draft_2026-09-18.json');
copy($fixtures.'/agenda_weekly_next.json',$agendaDir.'/agenda_semanal_historico_2026-09-21.json');

$passed=0;
$run=function(string $id, callable $test)use(&$passed):void{
    try{$test();$passed++;echo "PASS {$id}\n";}
    catch(Throwable $e){fwrite(STDERR,"FAIL {$id}: {$e->getMessage()}\n");exit(1);}
};

$run('AD-001',function()use($user):void{
    $result=executeAgenda($user,[
        'company_id'=>1,'event_id'=>'ad-001-nascimento','data'=>'2026-09-18','operation'=>'plan',
        'steps'=>[['operacao'=>'finalizar','percentual_padrao'=>100]]
    ]);
    expectSame('2026-09-18',$result['finalized_date'],'O dia de sexta deve ser finalizado.');
    expectSame('2026-09-21',$result['data'],'O nascimento deve abrir a segunda-feira seguinte.');
    expect(count($result['draft']['atividades'])===2,'O novo dia deve importar as duas atividades da semanal.');
    expect(is_file(\GeorgeV09\agendaDataDir($user).'/historico_atividade_dia_2026-09-18.json'),'O dia anterior deve virar histórico.');
});

$run('AD-002',function()use($user):void{
    $weekly=\GeorgeV09\agendaDataDir($user).'/agenda_semanal_historico_2026-09-21.json';
    $source=json_decode((string)file_get_contents($weekly),true,512,JSON_THROW_ON_ERROR);
    $source['payload']['agenda']['Alice Silva']['dias'][0][0]['atividadeNome']='Alteração posterior da semanal';
    file_put_contents($weekly,json_encode($source,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    $state=\GeorgeV09\agendaRead($user);
    expectSame('2026-09-21',$state['data'],'A leitura deve preservar a data ativa.');
    $activities=array_column($state['atividades'],'atividade');
    expect(in_array('Montagem',$activities,true),'O dia criado deve permanecer independente da fonte semanal alterada.');
    expect(!in_array('Alteração posterior da semanal',$activities,true),'A fonte semanal não deve reconstruir o dia já criado.');
});

$run('AD-003',function()use($user):void{
    $state=\GeorgeV09\agendaRead($user);
    $activity=array_values(array_filter($state['atividades'],fn(array $item):bool=>$item['atividade']==='Montagem'))[0]??null;
    expect(is_array($activity),'A fixture do novo dia deve conter a atividade de Montagem.');
    $result=executeAgenda($user,[
        'company_id'=>1,'event_id'=>'ad-003-alterar','data'=>'2026-09-21','operation'=>'plan',
        'steps'=>[[
            'operacao'=>'alterar','origem_colaborador'=>'Alice Silva','atividade_id'=>$activity['id'],
            'alteracoes'=>['local'=>'Araranguá','viagem'=>true,'carro'=>'ABC1D23']
        ]]
    ]);
    $activity=$result['draft']['atividades'][0];
    expectSame('Araranguá',$activity['local'],'A edição deve persistir o local.');
    expectSame(true,$activity['viagem'],'A edição deve persistir viagem=true.');
    expectSame('ABC1D23',$activity['carro'],'O veículo deve ser resolvido pelo catálogo.');
    expectSame(201,$activity['veiculo_id'],'O identificador do veículo deve vir do catálogo.');
});

$run('AD-004',function()use($user):void{
    $before=\GeorgeV09\agendaRead($user);
    $beforeHistoryNames=array_values(array_map('strval',array_column($before['historicos'],'data')));
    echo 'AD-004 históricos antes: '.count($beforeHistoryNames).' ['.implode(', ',$beforeHistoryNames)."]\n";
    $result=executeAgenda($user,[
        'company_id'=>1,'event_id'=>'ad-004-checkpoint','data'=>'2026-09-21','operation'=>'checkpoint','steps'=>[]
    ]);
    expectSame('2026-09-21',$result['data'],'Checkpoint não deve navegar para outro dia.');
    expectSame(null,$result['finalized_date'],'Checkpoint não deve finalizar o dia.');
    $after=\GeorgeV09\agendaRead($user);
    $afterHistoryNames=array_values(array_map('strval',array_column($after['historicos'],'data')));
    echo 'AD-004 históricos depois: '.count($afterHistoryNames).' ['.implode(', ',$afterHistoryNames)."]\n";
    expectSame($before['data'],$after['data'],'Checkpoint não deve alterar a data ativa.');
    expectSame($before['atividades'],$after['atividades'],'Checkpoint não deve alterar as atividades.');
    expectSame(count($beforeHistoryNames),count($afterHistoryNames),'Checkpoint não deve alterar a quantidade de históricos.');
    expectSame($beforeHistoryNames,$afterHistoryNames,'Checkpoint não deve alterar a lista de históricos.');
    expect(in_array('2026-09-18',$afterHistoryNames,true),'O histórico 2026-09-18 criado pelo AD-001 deve permanecer.');
    expect(!in_array('2026-09-21',$afterHistoryNames,true),'Checkpoint não deve criar histórico para 2026-09-21.');
});

$run('AD-005',function()use($user):void{
    $result=executeAgenda($user,[
        'company_id'=>1,'event_id'=>'ad-005-finalizar','data'=>'2026-09-21','operation'=>'plan',
        'steps'=>[['operacao'=>'finalizar','percentual_padrao'=>100]]
    ]);
    expectSame('2026-09-21',$result['finalized_date'],'A finalização deve congelar o dia encerrado.');
    expectSame('2026-09-22',$result['data'],'A finalização deve abrir o próximo dia.');
    expect(is_file(\GeorgeV09\agendaDataDir($user).'/historico_atividade_dia_2026-09-21.json'),'O histórico finalizado deve ser projetado.');
    $current=\GeorgeV09\agendaRead($user);
    expectSame('2026-09-22',$current['data'],'O próximo dia deve ser o dia ativo.');
});

$run('AD-006',function()use($user):void{
    $historical=\GeorgeV09\agendaRead($user,'2026-09-18');
    expectSame('2026-09-18',$historical['data'],'A consulta histórica deve carregar a data solicitada.');
    expectSame('Histórico',$historical['status'],'O dia finalizado deve ser somente histórico.');
    expect(($historical['draft']['finalizado']??false)===true,'O snapshot histórico deve estar finalizado.');
    try{
        \GeorgeV09\agendaExecute($user,[
            'company_id'=>1,'event_id'=>'ad-006-write-history','data'=>'2026-09-18','operation'=>'plan',
            'steps'=>[['operacao'=>'alterar','origem_colaborador'=>'Alice Silva','atividade_id'=>'sem_2026-09-18_001','alteracoes'=>['local'=>'Não permitido']]]
        ]);
        throw new RuntimeException('A escrita em data histórica deveria ser bloqueada.');
    }catch(Failure $e){
        expectSame('DIA_NAO_EDITAVEL',$e->status,'A escrita histórica deve retornar DIA_NAO_EDITAVEL.');
    }
    $current=\GeorgeV09\agendaRead($user);
    expectSame('2026-09-22',$current['data'],'Consultar histórico não deve mudar o dia operacional.');
});

echo "Agenda domain regression: {$passed} cenários AD-001..AD-006 aprovados\n";