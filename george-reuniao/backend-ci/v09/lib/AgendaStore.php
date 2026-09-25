<?php
declare(strict_types=1);
namespace GeorgeV09;

/* SQL transactions are authoritative. JSON is a verified, recoverable projection.
 * Never fall back to a successful JSON-only write when SQL is unavailable. */
function agendaDb():\PDO {
    if(cfg()['test_mode']&&isset($GLOBALS['agenda_test_pdo']))return $GLOBALS['agenda_test_pdo'];
    static $pdo=null;if($pdo)return $pdo;
    $path=dirname(root()).'/db-v2/config.local.php';
    if(!is_file($path))throw new Failure('BANCO_NAO_CONFIGURADO','Configure o banco V2 no servidor antes de ativar a Agenda integrada.',503);
    $c=require $path;if(!is_array($c))throw new Failure('BANCO_CONFIG_INVALIDA','Configuração do banco V2 inválida.',503);
    try{$pdo=new \PDO('mysql:host='.($c['host']??$c['db_host']??'localhost').';port='.($c['port']??$c['db_port']??3306).';dbname='.($c['database']??$c['dbname']??$c['db_name']??'').';charset=utf8mb4',
        $c['user']??$c['username']??$c['db_user']??'', $c['password']??$c['pass']??$c['db_pass']??'',
        [\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::ATTR_DEFAULT_FETCH_MODE=>\PDO::FETCH_ASSOC,\PDO::ATTR_EMULATE_PREPARES=>false]);}
    catch(\Throwable $e){throw new Failure('BANCO_INDISPONIVEL','Não foi possível conectar ao banco V2. Nenhuma escrita foi confirmada.',503);}return $pdo;
}
function dbRows(\PDO $db,string $sql,array $args=[]):array {$s=$db->prepare($sql);$s->execute($args);return $s->fetchAll(\PDO::FETCH_ASSOC);}
function dbExec(\PDO $db,string $sql,array $args=[]):void {$s=$db->prepare($sql);$s->execute($args);}
function dbInsert(\PDO $db,string $table,array $values):int {
    $keys=array_keys($values);dbExec($db,'INSERT INTO '.$table.' ('.implode(',',$keys).') VALUES ('.implode(',',array_fill(0,count($keys),'?')).')',array_values($values));return (int)$db->lastInsertId();
}
function dbUpdate(\PDO $db,string $table,array $values,string $where,array $args):void {
    dbExec($db,'UPDATE '.$table.' SET '.implode(',',array_map(fn($k)=>$k.'=?',array_keys($values))).' WHERE '.$where,[...array_values($values),...$args]);
}
function dbColumns(\PDO $db,string $table):array {
    if(!preg_match('/^[a-z_]+$/D',$table))throw new \LogicException('Invalid table');
    if($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='sqlite')return array_column(dbRows($db,'PRAGMA table_info('.$table.')'),'name');
    return array_column(dbRows($db,'SHOW COLUMNS FROM '.$table),'Field');
}
function agendaDbMemberships(array $u):array {
    return dbRows(agendaDb(),'SELECT u.id AS usuario_id,ue.empresa_id,e.nome_fantasia AS empresa_nome FROM usuario u JOIN usuario_empresa ue ON ue.usuario_id=u.id JOIN empresa e ON e.id=ue.empresa_id WHERE LOWER(TRIM(u.email))=? AND ue.ativo=1 AND e.ativo=1 ORDER BY ue.empresa_padrao DESC,ue.empresa_id',[strtolower($u['email'])]);
}
function agendaMemberships(array $u):array {
    if(agendaBackendJson($u)){agendaFileActor($u);return [['usuario_id'=>$u['id'],'empresa_id'=>$u['company_id'],'empresa_nome'=>$u['company_name']??cfg()['company_name']]];}
    return agendaDbMemberships($u);
}
function agendaDbActor(array $u):array {
    $found=array_values(array_filter(agendaDbMemberships($u),fn($r)=>(int)$r['empresa_id']===(int)$u['company_id']));
    if(count($found)!==1)throw new Failure('EMPRESA_NAO_AUTORIZADA','O usuário autenticado não possui vínculo único e ativo com esta empresa.',403);
    return $u+['db_user_id'=>(int)$found[0]['usuario_id']];
}
function agendaDataDir(array $u):string {
    $id=(int)$u['company_id'];
    if($id===(int)cfg()['company_id']){legacy();return \mobile_agenda_data_dir();}
    return storeRoot().'/companies/'.$id.'/agenda';
}
function agendaSchema():array {
    return [
      'CREATE TABLE IF NOT EXISTS agenda_cap_estado (empresa_id BIGINT PRIMARY KEY, revisao BIGINT NOT NULL, data_ativa VARCHAR(10) NOT NULL, estado_json LONGTEXT NOT NULL, outbox_json LONGTEXT NULL)',
      'CREATE TABLE IF NOT EXISTS agenda_cap_evento (chave VARCHAR(64) PRIMARY KEY, empresa_id BIGINT NOT NULL, usuario_id BIGINT NOT NULL, evento_ref VARCHAR(120) NOT NULL, pedido_hash VARCHAR(64) NOT NULL, resposta_json LONGTEXT NOT NULL, ocorrido_em VARCHAR(32) NOT NULL)',
      'CREATE TABLE IF NOT EXISTS agenda_cap_item_ref (empresa_id BIGINT NOT NULL, agenda_dia_id BIGINT NOT NULL, item_ref VARCHAR(120) NOT NULL, item_id BIGINT NOT NULL, PRIMARY KEY(empresa_id,agenda_dia_id,item_ref))',
      'CREATE TABLE IF NOT EXISTS agenda_cap_pessoa (empresa_id BIGINT NOT NULL, colaborador_id BIGINT NOT NULL, cadastro_status VARCHAR(40) NOT NULL, origem VARCHAR(30) NOT NULL, funcao VARCHAR(180) NULL, cargo VARCHAR(180) NULL, PRIMARY KEY(empresa_id,colaborador_id))',
      'CREATE TABLE IF NOT EXISTS agenda_cap_regra (empresa_id BIGINT NOT NULL, chave VARCHAR(80) NOT NULL, versao BIGINT NOT NULL, texto LONGTEXT NOT NULL, fonte LONGTEXT NOT NULL, usuario_id BIGINT NOT NULL, criado_em VARCHAR(32) NOT NULL, PRIMARY KEY(empresa_id,chave,versao))',
    ];
}
function agendaSchemaCheck(\PDO $db):array {
    $required=[
      'empresa'=>['id','nome_fantasia','ativo'],'usuario'=>['id','email'],'usuario_empresa'=>['empresa_id','usuario_id','ativo','empresa_padrao'],
      'colaborador'=>['id','empresa_id','nome','status'],'colaborador_alias'=>['empresa_id','colaborador_id','alias','ativo'],
      'veiculo'=>['id','empresa_id','placa'],
      'agenda_dia'=>['id','empresa_id','data_agenda','status','versao_rascunho','snapshot_json_path','snapshot_json_sha256'],
      'agenda_dia_colaborador'=>['id','empresa_id','agenda_dia_id','colaborador_id','ordem','ativo'],
      'agenda_dia_item'=>['id','empresa_id','agenda_dia_id','agenda_dia_colaborador_id','origem_tipo','operacao_origem','obra_texto','local_texto','atividade_texto','viagem','status_item','status_execucao','percentual_realizado','motivo_nao_conclusao','motivo_cancelamento','ordem','ativo'],
      'agenda_dia_evento'=>['empresa_id','agenda_dia_id','usuario_id','origem_acao','transacao_id','versao_rascunho','tipo_evento','entidade_tipo','entidade_id','dados_json'],
    ];$missing=[];
    foreach($required as $t=>$cols){try{$actual=dbColumns($db,$t);}catch(\Throwable $e){$actual=[];}$diff=array_values(array_diff($cols,$actual));if($diff)$missing[$t]=$diff;}
    return ['ok'=>!$missing,'missing'=>$missing];
}
function agendaStateRow(\PDO $db,int $company,bool $lock=false):array {
    $suffix=$lock&&$db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?' FOR UPDATE':'';
    $rows=dbRows($db,'SELECT * FROM agenda_cap_estado WHERE empresa_id=?'.$suffix,[$company]);
    if(count($rows)!==1)throw new Failure('BOOTSTRAP_NECESSARIO','Importe e valide o rascunho atual com o instalador RC2 antes de operar a Agenda.',409);return $rows[0];
}
function agendaHash(array $state):string {unset($state['_revision']);return hash('sha256',encode($state));}
function agendaFault(string $stage):void {if(cfg()['test_mode']&&isset($GLOBALS['agenda_test_fault']))($GLOBALS['agenda_test_fault'])($stage);}

/** SQL commit and file rename cannot share ACID; outbox replays exact bytes after failure. */
function agendaProject(\PDO $db,array $u,array $row):void {
    if((int)$u['company_id']===(int)cfg()['company_id']&&!is_file(agendaDataDir($u).'/.agenda_rc2_active'))atomic(agendaDataDir($u).'/.agenda_rc2_active',encode(['version'=>'097rc2','company_id'=>$u['company_id']]));
    if(empty($row['outbox_json']))return;
    $out=json_decode($row['outbox_json'],true,512,JSON_THROW_ON_ERROR);$dir=agendaDataDir($u);
    foreach($out['write'] as $name=>$state){
        if(!preg_match('/^(agenda_draft_|historico_atividade_dia_)20\d{2}-\d{2}-\d{2}\.json$/D',$name))throw new \LogicException('Invalid projection');
        $path=$dir.'/'.$name;
        if(str_starts_with($name,'historico_')&&is_file($path)&&agendaHash(readJson($path))!==agendaHash($state))throw new Failure('HISTORICO_DIVERGENTE','O histórico existente diverge do banco. Verifique a origem antes de continuar.',409);
        agendaFault('before_json');atomic($path,encode($state));
        if(agendaHash(readJson($path))!==agendaHash($state))throw new Failure('PROJECAO_DIVERGENTE','A cópia JSON não conferiu com o banco.',503);
    }
    foreach($out['delete'] as $name){if(!preg_match('/^agenda_draft_20\d{2}-\d{2}-\d{2}\.json$/D',$name))throw new \LogicException('Invalid projection deletion');if(is_file($dir.'/'.$name)&&!unlink($dir.'/'.$name))throw new Failure('PROJECAO_PENDENTE','O banco foi gravado; falta concluir a projeção do rascunho.',503);}
    dbExec($db,'UPDATE agenda_cap_estado SET outbox_json=NULL WHERE empresa_id=? AND revisao=?',[$u['company_id'],$row['revisao']]);
}
function agendaProjectionCheck(array $u,array $draft):void {
    $dir=agendaDataDir($u);$files=glob($dir.'/agenda_draft_*.json')?:[];
    if(count($files)!==1||basename($files[0])!=='agenda_draft_'.$draft['data'].'.json'||agendaHash(readJson($files[0]))!==agendaHash($draft))throw new Failure('FONTE_EXTERNA_DIVERGIU','A Agenda foi alterada por uma versão antiga ou a projeção está ausente. Atualize a tela e confira a origem antes de continuar; nenhuma alteração foi sobrescrita.',409);
}
function agendaVerifySql(\PDO $db,array $u,array $draft):void {
    $days=dbRows($db,'SELECT id,status FROM agenda_dia WHERE empresa_id=? AND data_agenda=?',[$u['company_id'],$draft['data']]);
    if(count($days)!==1||$days[0]['status']!==(!empty($draft['finalizado'])?'FINALIZADA':'RASCUNHO'))throw new Failure('BANCO_DIVERGIU','O registro do dia no banco diverge do estado validado.',409);
    $day=$days[0]['id'];$rows=dbRows($db,'SELECT i.*,r.item_ref,c.colaborador_id FROM agenda_dia_item i LEFT JOIN agenda_cap_item_ref r ON r.empresa_id=i.empresa_id AND r.agenda_dia_id=i.agenda_dia_id AND r.item_id=i.id JOIN agenda_dia_colaborador c ON c.id=i.agenda_dia_colaborador_id AND c.empresa_id=i.empresa_id WHERE i.empresa_id=? AND i.agenda_dia_id=? AND i.ativo=1',[$u['company_id'],$day]);
    $people=array_column($draft['people'],'colaborador_id','name');$map=array_column($rows,null,'item_ref');
    if(count($rows)!==count($draft['atividades']))throw new Failure('BANCO_DIVERGIU','A quantidade de atividades mudou fora do serviço compartilhado.',409);
    foreach($draft['atividades'] as $a){$r=$map[(string)$a['id']]??null;
        if(!$r||(int)$r['colaborador_id']!==(int)$people[$a['colaborador']]||$r['status_item']!==(legacyBoolCancelled($a)?'CANCELADA':'ATIVA'))throw new Failure('BANCO_DIVERGIU','Uma atividade mudou fora da transação validada.',409);
        foreach(['obra'=>'obra_texto','atividade'=>'atividade_texto','local'=>'local_texto','motivoExecucao'=>'motivo_nao_conclusao','motivoCancelamento'=>'motivo_cancelamento'] as $from=>$to)if((string)($a[$from]??'')!==(string)($r[$to]??''))throw new Failure('BANCO_DIVERGIU','Um campo da atividade diverge entre estado e banco: '.$to,409);
        if((bool)($a['viagem']??false)!==(bool)$r['viagem']||($a['percentualExecutado']??null)!==null&&abs((float)$a['percentualExecutado']-(float)$r['percentual_realizado'])>0.001)throw new Failure('BANCO_DIVERGIU','A execução da atividade diverge do banco.',409);
    }
    $links=dbRows($db,'SELECT colaborador_id FROM agenda_dia_colaborador WHERE empresa_id=? AND agenda_dia_id=? AND ativo=1',[$u['company_id'],$day]);
    $actual=array_map('intval',array_column($links,'colaborador_id'));$expected=array_map('intval',array_values($people));sort($actual);sort($expected);
    if($actual!==$expected)throw new Failure('BANCO_DIVERGIU','Os vínculos de colaboradores divergem do estado validado.',409);
}
function agendaWithLock(array $u,callable $fn):mixed {
    $dir=agendaDataDir($u);if(!is_dir($dir))mkdir($dir,0700,true);
    return locked($dir.'/.atividade_dia.lock',$fn);
}
function agendaReadSql(array $u,?string $date=null):array {
    permission($u,'atividades');$u=agendaDbActor($u);$db=agendaDb();
    return agendaWithLock($u,function()use($u,$db,$date){
        $row=agendaStateRow($db,(int)$u['company_id']);agendaProject($db,$u,$row);$state=json_decode($row['estado_json'],true,512,JSON_THROW_ON_ERROR);$draft=$state['draft'];
        agendaProjectionCheck($u,$draft);agendaVerifySql($db,$u,$draft);
        if($date&&$date!==$draft['data']){
            $rows=dbRows($db,'SELECT snapshot_json_path,status FROM agenda_dia WHERE empresa_id=? AND data_agenda=?',[$u['company_id'],$date]);
            $path=agendaDataDir($u).'/historico_atividade_dia_'.$date.'.json';
            if(count($rows)!==1||$rows[0]['status']!=='FINALIZADA'||!is_file($path))throw new Failure('HISTORICO_NAO_ENCONTRADO','Não encontrei histórico finalizado para esta data.',404);
            $draft=readJson($path);
            $sha=dbRows($db,'SELECT snapshot_json_sha256 FROM agenda_dia WHERE empresa_id=? AND data_agenda=?',[$u['company_id'],$date])[0]['snapshot_json_sha256'];
            if($sha!==hash_file('sha256',$path))throw new Failure('HISTORICO_DIVERGENTE','O histórico não confere com a versão finalizada no banco.',409);
        }
        $hist=dbRows($db,"SELECT data_agenda AS data FROM agenda_dia WHERE empresa_id=? AND status='FINALIZADA' ORDER BY data_agenda DESC",[$u['company_id']]);
        return ['ok'=>true,'verified'=>true,'source'=>'Banco V2 + JSON verificado','persistence'=>'SQL_E_JSON_VERIFICADOS','data'=>$draft['data'],'status'=>!empty($draft['finalizado'])?'Histórico':'Rascunho','atividades'=>$draft['atividades'],'draft'=>$draft,'revision'=>(int)$row['revisao'],'historicos'=>$hist];
    });
}

function agendaMaster(object $db,array $u):array {
    if($db instanceof AgendaFileCatalog)return $db->people();
    $rows=dbRows($db,"SELECT * FROM colaborador WHERE empresa_id=? AND status='ATIVO' ORDER BY nome,id",[$u['company_id']]);
    $extras=dbRows($db,'SELECT * FROM agenda_cap_pessoa WHERE empresa_id=?',[$u['company_id']]);$extra=array_column($extras,null,'colaborador_id');
    $legacyRoles=[];if((int)$u['company_id']===(int)cfg()['company_id']){$catalog=readJson(agendaDataDir($u).'/cadastros_agenda_novo.json',[]);foreach($catalog['colaboradores']??[] as $p)$legacyRoles[norm($p['name']??$p['nome']??'')]=$p['role']??$p['funcao']??'';}
    return array_map(function($r)use($extra,$legacyRoles){$x=$extra[$r['id']]??[];$role=$r['funcao']??$x['funcao']??$legacyRoles[norm($r['nome'])]??'';return ['id'=>(int)$r['id'],'name'=>$r['nome'],'nome'=>$r['nome'],'role'=>$role,'cargo'=>$r['cargo']??$x['cargo']??null,'cadastro_status'=>$r['cadastro_status']??$x['cadastro_status']??'CADASTRADO'];},$rows);
}
function agendaMasterResolve(object $db,array $u,string $query):array {
    $n=norm($query);if($n===''||in_array($n,['voce','vc','george','jorge','mim'],true))return ['ok'=>false,'needs_choice'=>true,'status'=>'COLABORADOR_NECESSARIO','message'=>'Qual colaborador deve receber as atividades? Informe o nome.'];
    $all=agendaMaster($db,$u);$exact=array_values(array_filter($all,fn($p)=>norm($p['name'])===$n||'id:'.$p['id']===$n));
    if(!$exact){$aliases=$db instanceof AgendaFileCatalog?$db->aliases():dbRows($db,'SELECT colaborador_id,alias FROM colaborador_alias WHERE empresa_id=? AND ativo=1',[$u['company_id']]);$ids=[];foreach($aliases as $a)if(norm($a['alias'])===$n)$ids[]=(int)$a['colaborador_id'];$exact=array_values(array_filter($all,fn($p)=>in_array($p['id'],$ids,true)));}
    $matches=$exact?:array_values(array_filter($all,fn($p)=>str_starts_with(norm($p['name']),$n.' ')));
    if(count($matches)===1)return ['ok'=>true,'person'=>$matches[0]];
    return ['ok'=>false,'needs_choice'=>true,'status'=>$matches?'COLABORADOR_AMBIGUO':'COLABORADOR_NAO_ENCONTRADO','message'=>$matches?'Qual destes colaboradores?':'Não encontrei este colaborador. Deseja cadastrá-lo no cadastro global?','candidates'=>$matches];
}

/** Existing V2 normalized tables remain the structured operational representation. */
function agendaSyncSql(\PDO $db,array $u,array $draft,int $revision,bool $final=false):int {
    $company=(int)$u['company_id'];$rows=dbRows($db,'SELECT * FROM agenda_dia WHERE empresa_id=? AND data_agenda=?',[$company,$draft['data']]);
    if(count($rows)>1)throw new Failure('DIA_DUPLICADO','Há mais de um registro do dia no banco.',409);
    if($rows&&$rows[0]['status']==='FINALIZADA')throw new Failure('HISTORICO_IMUTAVEL','O histórico finalizado é somente leitura.',409);
    $columns=dbColumns($db,'agenda_dia');$fields=['empresa_id'=>$company,'data_agenda'=>$draft['data'],'status'=>$final?'FINALIZADA':'RASCUNHO','versao_rascunho'=>$revision,'origem_agenda_semanal_ref'=>$draft['arquivoFonteAgendaSemanal']??null];
    if($final)$fields+=['finalizado_em'=>date('Y-m-d H:i:s'),'finalizado_por_usuario_id'=>$u['db_user_id'],'snapshot_json_path'=>'historico_atividade_dia_'.$draft['data'].'.json','snapshot_json_sha256'=>hash('sha256',encode($draft))];
    $fields=array_intersect_key($fields,array_flip($columns));
    if($rows){$day=(int)$rows[0]['id'];dbUpdate($db,'agenda_dia',$fields,'id=? AND empresa_id=?',[$day,$company]);}else $day=dbInsert($db,'agenda_dia',$fields);
    dbExec($db,'UPDATE agenda_dia_colaborador SET ativo=0 WHERE empresa_id=? AND agenda_dia_id=?',[$company,$day]);
    dbExec($db,'UPDATE agenda_dia_item SET ativo=0 WHERE empresa_id=? AND agenda_dia_id=?',[$company,$day]);
    $links=[];$linkCols=array_flip(dbColumns($db,'agenda_dia_colaborador'));$itemCols=array_flip(dbColumns($db,'agenda_dia_item'));
    foreach($draft['people'] as $order=>$p){
        $master=(int)$p['colaborador_id'];$same=dbRows($db,'SELECT id FROM agenda_dia_colaborador WHERE empresa_id=? AND agenda_dia_id=? AND colaborador_id=?',[$company,$day,$master]);
        if(count($same)>1)throw new Failure('VINCULO_DUPLICADO','Há vínculos duplicados do colaborador neste dia.',409);
        $values=array_intersect_key(['empresa_id'=>$company,'agenda_dia_id'=>$day,'colaborador_id'=>$master,'cargo_snapshot'=>$p['cargo']??null,'funcao_snapshot'=>$p['role']??null,'ordem'=>$order,'ativo'=>1,'removido_em'=>null],$linkCols);
        if($same){$link=(int)$same[0]['id'];dbUpdate($db,'agenda_dia_colaborador',$values,'id=? AND empresa_id=?',[$link,$company]);}else $link=dbInsert($db,'agenda_dia_colaborador',$values);
        $links[norm($p['name'])]=$link;
    }
    $ids=[];
    foreach($draft['atividades'] as $order=>$a){
        $ref=(string)$a['id'];$map=dbRows($db,'SELECT item_id FROM agenda_cap_item_ref WHERE empresa_id=? AND agenda_dia_id=? AND item_ref=?',[$company,$day,$ref]);
        $values=array_intersect_key(['empresa_id'=>$company,'agenda_dia_id'=>$day,'agenda_dia_colaborador_id'=>$links[norm($a['colaborador'])],
            'origem_tipo'=>agendaOpsWeekly($a)?'SEMANAL':'MANUAL','operacao_origem'=>'ORIGINAL','origem_agenda_semanal_ref'=>agendaOpsWeekly($a)?($draft['arquivoFonteAgendaSemanal']??null):null,
            'obra_texto'=>$a['obra']??'','local_texto'=>$a['local']??'','atividade_texto'=>$a['atividade']??'','viagem'=>!empty($a['viagem'])?1:0,'veiculo_id'=>$a['veiculo_id']??null,'cronograma_existe'=>!empty($a['semCronogramaAtivo'])?0:1,
            'status_item'=>legacyBoolCancelled($a)?'CANCELADA':'ATIVA','status_execucao'=>$final?(legacyBoolCancelled($a)?'PENDENTE':((float)($a['percentualExecutado']??0)>=100?'CONCLUIDA':'PARCIAL')):'PENDENTE',
            'percentual_realizado'=>$a['percentualExecutado']??null,'motivo_nao_conclusao'=>$a['motivoExecucao']??null,'motivo_cancelamento'=>$a['motivoCancelamento']??null,'ordem'=>$order,'ativo'=>1],$itemCols);
        // Operation and execution enums are checked against the real schema by the installer.
        $values['operacao_origem']=str_starts_with($a['operacaoOrigem']??'','MOVE')?'MOVIDA':(str_starts_with($a['operacaoOrigem']??'','COPY')?'COPIADA':'ORIGINAL');
        if($map){$item=(int)$map[0]['item_id'];dbUpdate($db,'agenda_dia_item',$values,'id=? AND empresa_id=?',[$item,$company]);}
        else{$item=dbInsert($db,'agenda_dia_item',$values);dbInsert($db,'agenda_cap_item_ref',['empresa_id'=>$company,'agenda_dia_id'=>$day,'item_ref'=>$ref,'item_id'=>$item]);}$ids[$ref]=$item;
    }
    if(isset($itemCols['item_origem_id']))foreach($draft['atividades'] as $a){$source=$a['copiadoDeItemId']??null;if($source&&isset($ids[$source]))dbExec($db,'UPDATE agenda_dia_item SET item_origem_id=? WHERE id=? AND empresa_id=?',[$ids[$source],$ids[(string)$a['id']],$company]);}
    return $day;
}
