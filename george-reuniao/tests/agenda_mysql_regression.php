<?php
declare(strict_types=1);

if ($argc !== 3) {
    fwrite(STDERR, "Uso: php agenda_mysql_regression.php <backend-v09> <schema.sql>\n");
    exit(2);
}

$backend=rtrim($argv[1],DIRECTORY_SEPARATOR);
$schema=$argv[2];

require dirname($backend,2).'/assistant/common.php';
require $backend.'/lib/Core.php';
require $backend.'/lib/AgendaOps.php';
require $backend.'/lib/AgendaStore.php';
require $backend.'/lib/AgendaInstall.php';

use GeorgeV09\Failure;

function must(bool $condition,string $message):void {
    if(!$condition)throw new RuntimeException($message);
}
function same(mixed $expected,mixed $actual,string $message):void {
    if($expected!==$actual)throw new RuntimeException($message.' esperado='.var_export($expected,true).' recebido='.var_export($actual,true));
}

$dsn=(string)getenv('AGENDA_TEST_DB_DSN');
$dbUser=(string)getenv('AGENDA_TEST_DB_USER');
$dbPass=(string)getenv('AGENDA_TEST_DB_PASSWORD');
if($dsn==='')throw new RuntimeException('AGENDA_TEST_DB_DSN não informado.');
$db=new PDO($dsn,$dbUser,$dbPass,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
$GLOBALS['agenda_test_pdo']=$db;

foreach(preg_split('/;\s*(?:\r?\n|$)/',(string)file_get_contents($schema),-1,PREG_SPLIT_NO_EMPTY) as $statement)$db->exec($statement);

$db->exec("INSERT INTO empresa (id,nome_fantasia,ativo) VALUES (1,'Empresa CI',1),(2,'Empresa Isolada',1)");
$db->exec("INSERT INTO usuario (id,email) VALUES (10,'agenda-ci@erpimpar.invalid')");
$db->exec("INSERT INTO usuario_empresa (usuario_id,empresa_id,ativo,empresa_padrao) VALUES (10,1,1,1)");
$db->exec("INSERT INTO colaborador (id,empresa_id,nome,status,funcao,cargo) VALUES (101,1,'Alice Silva','ATIVO','Execução','Técnica'),(102,1,'Alice Souza','ATIVO','Execução','Técnica'),(201,2,'Pessoa Isolada','ATIVO','Execução','Técnica')");
$db->exec("INSERT INTO colaborador_alias (empresa_id,colaborador_id,alias,ativo) VALUES (1,101,'Alicinha',1)");
$db->exec("INSERT INTO veiculo (id,empresa_id,placa) VALUES (501,1,'ABC1D23')");

$before=\GeorgeV09\agendaInstallCheck($db);
must($before['ok']===true,'O schema base deveria ser transacional e compatível.');
must(count($before['enum_extensions'])>0,'O instalador deveria detectar extensões de ENUM pendentes.');
$installed=\GeorgeV09\agendaInstall($db);
same(5,$installed['tables'],'O instalador deve criar as cinco tabelas de capacidade.');
$after=\GeorgeV09\agendaInstallCheck($db);
must($after['ok']===true&&$after['enum_extensions']===[]&&$after['non_transactional']===[],'O schema instalado deve ficar íntegro, transacional e sem migrações pendentes.');

$user=['id'=>'agenda-ci','nome'=>'Agenda CI','email'=>'agenda-ci@erpimpar.invalid','company_id'=>1,'company_name'=>'Empresa CI','admin'=>true,'modules'=>['admin','atividades']];
$actor=\GeorgeV09\agendaDbActor($user);
same(10,$actor['db_user_id'],'O usuário deve resolver para o vínculo SQL correto.');
try{\GeorgeV09\agendaDbActor(array_merge($user,['company_id'=>2]));throw new RuntimeException('Empresa sem vínculo foi autorizada.');}
catch(Failure $e){same('EMPRESA_NAO_AUTORIZADA',$e->status,'O isolamento por empresa deve ser obrigatório.');}

$exact=\GeorgeV09\agendaMasterResolve($db,$actor,'Alice Silva');
same(101,$exact['person']['id']??null,'A resolução exata de colaborador falhou.');
$alias=\GeorgeV09\agendaMasterResolve($db,$actor,'Alicinha');
same(101,$alias['person']['id']??null,'A resolução por alias falhou.');
$ambiguous=\GeorgeV09\agendaMasterResolve($db,$actor,'Alice');
same('COLABORADOR_AMBIGUO',$ambiguous['status']??null,'Nomes ambíguos não podem ser escolhidos silenciosamente.');

$draft=[
  'data'=>'2026-09-22','finalizado'=>false,'people'=>[
    ['name'=>'Alice Silva','colaborador_id'=>101,'role'=>'execucao','cargo'=>'Técnica'],
    ['name'=>'Alice Souza','colaborador_id'=>102,'role'=>'execucao','cargo'=>'Técnica'],
  ],
  'atividades'=>[
    ['id'=>'item-original','colaborador'=>'Alice Silva','obra'=>'Obra Central','local'=>'Setor A','atividade'=>'Montagem','viagem'=>false,'percentualExecutado'=>40,'operacaoOrigem'=>'ORIGINAL'],
    ['id'=>'item-copia','colaborador'=>'Alice Souza','obra'=>'Obra Central','local'=>'Setor A','atividade'=>'Montagem','viagem'=>false,'percentualExecutado'=>0,'operacaoOrigem'=>'COPY','copiadoDeItemId'=>'item-original'],
  ],
];

$db->beginTransaction();
$day=\GeorgeV09\agendaSyncSql($db,$actor,$draft,1,false);
\GeorgeV09\agendaVerifySql($db,$actor,$draft);
$db->commit();
$rows=\GeorgeV09\dbRows($db,'SELECT i.operacao_origem,i.item_origem_id,r.item_ref FROM agenda_dia_item i JOIN agenda_cap_item_ref r ON r.item_id=i.id AND r.empresa_id=i.empresa_id WHERE i.empresa_id=1 AND i.agenda_dia_id=? ORDER BY r.item_ref',[$day]);
same('COPIADA',$rows[0]['operacao_origem'],'A cópia deve ser identificada no banco.');
must((int)$rows[0]['item_origem_id']>0,'A cópia deve manter referência ao item original.');

$draft['finalizado']=true;
$db->beginTransaction();
\GeorgeV09\agendaSyncSql($db,$actor,$draft,2,true);
\GeorgeV09\agendaVerifySql($db,$actor,$draft);
$db->commit();
$status=\GeorgeV09\dbRows($db,'SELECT status,snapshot_json_sha256 FROM agenda_dia WHERE id=?',[$day])[0];
same('FINALIZADA',$status['status'],'A agenda finalizada deve ficar imutável no banco.');
must(strlen((string)$status['snapshot_json_sha256'])===64,'A finalização deve persistir a assinatura do snapshot.');
try{\GeorgeV09\agendaSyncSql($db,$actor,$draft,3,false);throw new RuntimeException('Uma agenda finalizada foi reaberta.');}
catch(Failure $e){same('HISTORICO_IMUTAVEL',$e->status,'A regravação do histórico deve ser bloqueada.');}

$db->beginTransaction();
\GeorgeV09\dbExec($db,"INSERT INTO agenda_cap_regra (empresa_id,chave,versao,texto,fonte,usuario_id,criado_em) VALUES (1,'empresa.rollback',1,'teste','CI',10,'2026-09-22T00:00:00-03:00')");
$db->rollBack();
same(0,(int)\GeorgeV09\dbRows($db,"SELECT COUNT(*) total FROM agenda_cap_regra WHERE chave='empresa.rollback'")[0]['total'],'Rollback SQL não preservou atomicidade.');

echo "PASS agenda-mysql-regression: schema, empresa, colaboradores, cópia, finalização e rollback verificados.\n";
