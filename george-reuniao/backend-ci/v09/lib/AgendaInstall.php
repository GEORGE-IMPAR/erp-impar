<?php
declare(strict_types=1);
namespace GeorgeV09;

function agendaEnumExtensions(\PDO $db):array {
    if($db->getAttribute(\PDO::ATTR_DRIVER_NAME)!=='mysql')return [];
    $needed=['colaborador'=>['tipo'=>['PENDENTE'],'cadastro_status'=>['PENDENTE_COMPLEMENTACAO'],'origem_cadastro'=>['AGENDA_DO_DIA']],'agenda_dia'=>['status'=>['RASCUNHO','FINALIZADA']],
        'agenda_dia_item'=>['origem_tipo'=>['SEMANAL','MANUAL'],'operacao_origem'=>['ORIGINAL','COPIADA','MOVIDA'],'status_item'=>['ATIVA','CANCELADA'],'status_execucao'=>['PENDENTE','CONCLUIDA','PARCIAL']],
        'agenda_dia_evento'=>['origem_acao'=>['TELA','GEORGE','SISTEMA'],'tipo_evento'=>['CAPABILITY_TRANSACAO'],'entidade_tipo'=>['AGENDA_DIA']]];$sql=[];
    foreach($needed as $table=>$fields)foreach(dbRows($db,'SHOW COLUMNS FROM '.$table) as $col){$name=$col['Field'];if(!isset($fields[$name])||!str_starts_with(strtolower($col['Type']),'enum('))continue;
        preg_match_all("/'((?:[^'\\\\]|\\\\.)*)'/",$col['Type'],$matches);$values=array_map('stripcslashes',$matches[1]);$missing=array_diff($fields[$name],$values);if(!$missing)continue;
        $quoted=implode(',',array_map(fn($x)=>$db->quote($x),[...$values,...$missing]));
        $sql[]='ALTER TABLE '.$table.' MODIFY COLUMN '.$name.' ENUM('.$quoted.') '.($col['Null']==='YES'?'NULL':'NOT NULL').($col['Default']!==null?' DEFAULT '.$db->quote($col['Default']):'');
    }return $sql;
}
function agendaInstallCheck(\PDO $db):array {
    $check=agendaSchemaCheck($db);$check['enum_extensions']=$check['ok']?agendaEnumExtensions($db):[];$check['non_transactional']=[];
    if($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql')foreach(dbRows($db,"SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()") as $r){if((in_array($r['TABLE_NAME'],['agenda_dia','agenda_dia_colaborador','agenda_dia_item','agenda_dia_evento','agenda_cap_estado','agenda_cap_evento','agenda_cap_item_ref','agenda_cap_pessoa','agenda_cap_regra'],true)||in_array($r['TABLE_NAME'],['colaborador','colaborador_alias','veiculo'],true))&&strtoupper($r['ENGINE'])!=='INNODB')$check['non_transactional'][]=$r['TABLE_NAME'];}
    if($check['non_transactional'])$check['ok']=false;
    return $check;
}
function agendaInstallDiagnostic(array $u):array {
    try{
        agendaDbActor($u);
        return ['ok'=>true,'diagnostic'=>agendaInstallCheck(agendaDb())];
    }catch(Failure $e){throw $e;
    }catch(\Throwable $e){
        $ref=substr(hash('sha256',get_class($e).'|'.$e->getMessage().'|'.date('Y-m-d-H')),0,10);
        error_log('GEORGE Banco V2 diagnostic '.$ref.': '.get_class($e).': '.$e->getMessage());
        throw new Failure('BANCO_V2_DIAGNOSTICO_INDISPONIVEL','Não consegui consultar o Banco V2. Confira config.local.php, conexão, credenciais, nome do banco e permissão de leitura. Referência: '.$ref,503);
    }
}
function agendaInstall(\PDO $db):array {
    $check=agendaInstallCheck($db);if(!$check['ok'])throw new Failure('SCHEMA_INCOMPATIVEL','O schema V2 precisa dos campos/mecanismos indicados no diagnóstico. Nenhuma migração foi aplicada.',409);
    foreach($check['enum_extensions'] as $sql)$db->exec($sql);
    foreach(agendaSchema() as $sql)$db->exec($sql.($db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4':''));
    return ['ok'=>true,'migration'=>'010_agenda_compartilhada','tables'=>5,'enum_extensions'=>count($check['enum_extensions'])];
}
function agendaBootstrap(array $u,bool $commit=false,?string $expectedHash=null):array {
    $u=agendaDbActor($u);$db=agendaDb();return agendaWithLock($u,function()use($db,$u,$commit,$expectedHash){
        $existing=dbRows($db,'SELECT revisao FROM agenda_cap_estado WHERE empresa_id=?',[$u['company_id']]);
        if($existing)return ['ok'=>true,'already_initialized'=>true,'revision'=>(int)$existing[0]['revisao']];
        $files=glob(agendaDataDir($u).'/agenda_draft_*.json')?:[];if(count($files)!==1)throw new Failure('DRAFT_UNICO_OBRIGATORIO','É necessário exatamente um rascunho atual para importar.',409);
        $sourceHash=hash_file('sha256',$files[0]);$raw=readJson($files[0]);$draft=agendaNormalize($db,$u,$raw);
        $preview=['ok'=>true,'data'=>$draft['data'],'source_sha256'=>$sourceHash,'people'=>count($draft['people']),'items'=>count($draft['atividades']),'committed'=>false];
        if(!$commit)return $preview;
        if($expectedHash===null||!hash_equals($sourceHash,$expectedHash))throw new Failure('BOOTSTRAP_HASH_DIVERGENTE','O rascunho mudou desde a conferência. Gere nova prévia.',409);
        $draft['_revision']=1;$draft['bootstrap_source_sha256']=$sourceHash;
        // Source bytes remain available for rollback, outside the public Agenda directory.
        atomic(storeRoot().'/bootstrap/'.$u['company_id'].'/'.$sourceHash.'.json',(string)file_get_contents($files[0]));
        $db->beginTransaction();try{
            foreach($draft['people'] as $p){$extra=dbRows($db,'SELECT colaborador_id FROM agenda_cap_pessoa WHERE empresa_id=? AND colaborador_id=?',[$u['company_id'],$p['colaborador_id']]);if(!$extra)dbInsert($db,'agenda_cap_pessoa',['empresa_id'=>$u['company_id'],'colaborador_id'=>$p['colaborador_id'],'cadastro_status'=>$p['cadastro_status']??'CADASTRADO','origem'=>'BOOTSTRAP_CADASTRO_GLOBAL','funcao'=>$p['role']??null,'cargo'=>$p['cargo']??null]);}
            agendaSyncSql($db,$u,$draft,1);$out=['write'=>['agenda_draft_'.$draft['data'].'.json'=>$draft],'delete'=>[]];
            dbInsert($db,'agenda_cap_estado',['empresa_id'=>$u['company_id'],'revisao'=>1,'data_ativa'=>$draft['data'],'estado_json'=>encode(['draft'=>$draft,'undo'=>[],'bootstrap_source_sha256'=>$sourceHash]),'outbox_json'=>encode($out)]);
            // Import existing historical files as immutable snapshots without rewriting their bytes.
            foreach(glob(agendaDataDir($u).'/historico_atividade_dia_*.json')?:[] as $path){
                if(!preg_match('/historico_atividade_dia_(20\d{2}-\d{2}-\d{2})\.json$/D',$path,$m))continue;
                $old=dbRows($db,'SELECT id,status,snapshot_json_sha256 FROM agenda_dia WHERE empresa_id=? AND data_agenda=?',[$u['company_id'],$m[1]]);$sha=hash_file('sha256',$path);
                if($old&&($old[0]['status']!=='FINALIZADA'||(!empty($old[0]['snapshot_json_sha256'])&&$old[0]['snapshot_json_sha256']!==$sha)))throw new Failure('HISTORICO_DIVERGENTE','Resolva o histórico '.$m[1].' antes de importar.',409);
                $fields=['empresa_id'=>$u['company_id'],'data_agenda'=>$m[1],'status'=>'FINALIZADA','versao_rascunho'=>1,'snapshot_json_path'=>basename($path),'snapshot_json_sha256'=>$sha];
                if($old)dbUpdate($db,'agenda_dia',$fields,'id=? AND empresa_id=?',[$old[0]['id'],$u['company_id']]);else dbInsert($db,'agenda_dia',$fields);
            }
            $db->commit();
        }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
        agendaProject($db,$u,agendaStateRow($db,(int)$u['company_id']));agendaProjectionCheck($u,$draft);
        return array_merge($preview,['committed'=>true,'verified'=>true,'revision'=>1]);
    });
}
function agendaRulesSql(array $u):array {
    permission($u,'atividades');$u=agendaDbActor($u);$rows=dbRows(agendaDb(),'SELECT r.* FROM agenda_cap_regra r WHERE r.empresa_id=? AND r.versao=(SELECT MAX(v.versao) FROM agenda_cap_regra v WHERE v.empresa_id=r.empresa_id AND v.chave=r.chave) ORDER BY r.chave',[$u['company_id']]);
    return ['ok'=>true,'company_id'=>$u['company_id'],'core_source'=>'Raio-X Agenda do Dia V1 + correções explícitas RC2','core'=>file_get_contents(dirname(__DIR__).'/context/raiox_agenda_v1.txt'),'company_rules'=>$rows,'note'=>'Regras da empresa são registros versionados. Não alteram invariantes do serviço nem treinam os pesos do modelo.'];
}
function agendaRuleSaveSql(array $u,array $in):array {
    if(!$u['admin'])throw new Failure('REGRA_REQUER_ADMIN','Somente um administrador da empresa pode registrar uma regra aprovada.',403);$u=agendaDbActor($u);$db=agendaDb();
    $key=(string)($in['key']??'');$text=trim((string)($in['text']??''));$source=trim((string)($in['source']??''));
    if(!preg_match('/^empresa\.[a-z0-9_]{1,60}$/D',$key)||$text===''||strlen($text)>12000||$source==='')throw new Failure('REGRA_INVALIDA','Informe chave empresa.*, texto da regra e referência de aprovação.');
    return agendaWithLock($u,function()use($db,$u,$in,$key,$text,$source){$db->beginTransaction();try{
        agendaStateRow($db,(int)$u['company_id'],true);$rows=dbRows($db,'SELECT MAX(versao) AS versao FROM agenda_cap_regra WHERE empresa_id=? AND chave=?',[$u['company_id'],$key]);$v=(int)($rows[0]['versao']??0);
        if((int)($in['expected_version']??-1)!==$v)throw new Failure('REGRA_ALTERADA','A regra mudou. Consulte a versão atual antes de registrar.',409);
        dbInsert($db,'agenda_cap_regra',['empresa_id'=>$u['company_id'],'chave'=>$key,'versao'=>$v+1,'texto'=>$text,'fonte'=>$source,'usuario_id'=>$u['db_user_id'],'criado_em'=>agendaOpsNow()]);$db->commit();return ['ok'=>true,'verified'=>true,'company_id'=>$u['company_id'],'key'=>$key,'version'=>$v+1];
    }catch(\Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}});
}
