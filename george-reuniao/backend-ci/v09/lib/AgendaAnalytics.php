<?php
declare(strict_types=1);
namespace GeorgeV09;

/**
 * Consultas analíticas da Agenda do Dia.
 *
 * Este arquivo nunca grava, finaliza ou reconstrói a Agenda. Ele lê o rascunho
 * e os históricos oficiais já existentes e grava somente a última consulta na
 * pasta da conversa do George, para permitir continuações como "e o Valdeci?"
 * e "exporta isso".
 */

function agendaAnalyticsObject(array $properties,array $required=[]):array {
    return ['type'=>'object','properties'=>(object)$properties,'required'=>$required,'additionalProperties'=>false];
}

function agendaAnalyticsTools():array {
    $string=['type'=>'string'];$strings=['type'=>'array','items'=>$string];
    return [[
        'type'=>'function','strict'=>false,'name'=>'consultar_indicadores_agenda_dia',
        'description'=>'Consulta SOMENTE EM LEITURA os históricos e o rascunho oficial da Agenda do Dia. Use para horas, esforços, alocações, obras, atividades, colaboradores, coordenadores, veículos, rankings, comparações, pessoas sem alocação e perguntas por dia/semana/mês/período. Dentro do contexto Agenda do Dia, respostas curtas herdam a última consulta com usar_ultimo=true. Cada colaborador vale 8 horas por dia, divididas igualmente entre suas atividades produtivas válidas; nunca some os 8 gravados em cada atividade. Pode preparar tabela, planilha CSV, relatório para impressão/PDF ou dashboard. Não altera nenhum dado operacional.',
        'parameters'=>agendaAnalyticsObject([
            'periodo'=>['type'=>'string','enum'=>['dia_aberto','hoje','ontem','esta_semana','semana_passada','este_mes','mes_passado','ultimos_3_meses','personalizado']],
            'data_inicio'=>$string,'data_fim'=>$string,
            'colaboradores'=>$strings,'excluir_colaboradores'=>$strings,
            'obras'=>$strings,'atividades'=>$strings,'funcoes'=>$strings,'veiculos'=>$strings,
            'incluir_canceladas'=>['type'=>'boolean'],
            'agrupar_por'=>['type'=>'array','items'=>['type'=>'string','enum'=>['data','mes','colaborador','funcao','obra','atividade','veiculo','status']]],
            'ordenar_por'=>['type'=>'string','enum'=>['horas_desc','horas_asc','nome_asc','nome_desc']],
            'limite'=>['type'=>'integer','minimum'=>1,'maximum'=>200],
            'usar_ultimo'=>['type'=>'boolean'],
            'saida'=>['type'=>'string','enum'=>['resumo','tabela','planilha','pdf','grafico','dashboard']]
        ])
    ],[
        'type'=>'function','strict'=>false,'name'=>'consultar_agenda_semanal_oficial',
        'description'=>'Consulta SOMENTE EM LEITURA a Agenda Semanal oficial que alimenta a Agenda do Dia. Use para perguntas sobre o planejamento desta semana ou de uma semana específica, inclusive por colaborador. Não substitua esta fonte por históricos diários incompletos.',
        'parameters'=>agendaAnalyticsObject(['semana'=>$string,'colaborador'=>$string])
    ]];
}

function agendaWeeklyMonday(string $value=''):string {
    $date=agendaAnalyticsDate($value)??new \DateTimeImmutable('today');
    return $date->modify('monday this week')->format('Y-m-d');
}

function agendaWeeklyOfficial(array $u,array $args):array {
    permission($u,'atividades');
    if(!function_exists('curl_init'))throw new Failure('CURL_AUSENTE','O servidor não pode consultar a Agenda Semanal agora.',503);
    $week=agendaWeeklyMonday((string)($args['semana']??''));
    $urls=['https://api.erpimpar.com.br/agenda/carregar_agenda.php?semana='.rawurlencode($week),'https://api.erpimpar.com.br/agenda/data/agenda_'.rawurlencode($week).'.json'];
    $doc=null;$last='';
    foreach($urls as $url){$ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>20,CURLOPT_HTTPHEADER=>['Accept: application/json']]);$raw=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=(string)curl_error($ch);curl_close($ch);if($raw!==false&&$code>=200&&$code<300){$candidate=json_decode($raw,true);if(is_array($candidate)){$doc=$candidate;break;}}$last=$err!==''?$err:'HTTP '.$code;}
    if(!$doc)throw new Failure('AGENDA_SEMANAL_INDISPONIVEL','A fonte oficial da Agenda Semanal não respondeu. '.$last,503);
    $root=$doc['payload']??$doc['agendaSemanal']??$doc;
    if(isset($root['data']['agenda'])&&is_array($root['data']['agenda'])){$agenda=$root['data']['agenda'];$people=$root['data']['colaboradores']??[];}
    elseif(isset($root['agenda'])&&is_array($root['agenda'])){$agenda=$root['agenda'];$people=$root['colaboradores']??[];}
    else{$agenda=is_array($root)?$root:[];$people=$doc['colaboradores']??[];}
    $wanted=norm((string)($args['colaborador']??''));$days=['segunda','terca','quarta','quinta','sexta'];$rows=[];
    foreach($agenda as $personName=>$person){if(!is_array($person))continue;$name=is_string($personName)?trim($personName):trim((string)($person['colaborador']??$person['nome']??''));if($name===''||($wanted!==''&&!str_contains(norm($name),$wanted)&&!str_contains($wanted,norm($name))))continue;$map=$person['dias']??$person['days']??$person;foreach($days as $index=>$label){$cell=$map[$index]??$map[(string)$index]??$map[$label]??null;if(!$cell)continue;$allocations=is_array($cell['alocacoes']??null)?$cell['alocacoes']:(array_is_list($cell)?$cell:[$cell]);foreach($allocations as $item){if(!is_array($item))continue;$work=trim((string)($item['obraNome']??$item['nomeObra']??$item['obra']??$item['obraId']??''));$activity=trim((string)($item['atividadeNome']??$item['nomeAtividade']??$item['atividade']??$item['descricao']??$item['atividadeId']??''));if($work===''&&$activity==='')continue;$rows[]=['dia'=>$label,'data'=>(new \DateTimeImmutable($week))->modify('+'.$index.' days')->format('Y-m-d'),'colaborador'=>$name,'obra'=>$work,'atividade'=>$activity,'horas'=>(float)($item['horas']??8),'veiculo'=>(string)($item['carro']??$item['placa']??'')];}}}
    return ['ok'=>true,'verified'=>true,'source'=>'Agenda Semanal oficial — somente leitura','semana'=>$week,'colaboradores'=>$people,'quantidade'=>count($rows),'atividades'=>$rows];
}

function agendaAnalyticsCapabilityIndex(array $u):array {
    permission($u,'atividades');
    $dates=[];$sourceAvailable=false;
    try{
        $current=agendaRead($u,null);$sourceAvailable=true;
        foreach($current['historicos']??[] as $row){
            $date=(string)($row['data']??'');
            if(agendaAnalyticsDate($date))$dates[$date]=true;
        }
        $open=(string)($current['data']??'');
        if(agendaAnalyticsDate($open))$dates[$open]=true;
    }catch(\Throwable $e){}
    $dates=array_keys($dates);sort($dates);
    return [
        'module'=>'agenda_dia','module_label'=>'Agenda do Dia','status'=>'revisado_e_liberado',
        'coverage'=>[
            'available'=>$sourceAvailable,'first'=>$dates[0]??null,'last'=>$dates?end($dates):null,
            'days'=>count($dates)
        ],
        'operations'=>['consultar','adicionar','alterar','mover','copiar','cancelar','restaurar','desfazer','salvar','fechar o dia'],
        'analysis'=>['horas e esforço','alocação por colaborador','obra','atividade','função','veículo','dia, semana, mês ou período','rankings','colaboradores sem alocação'],
        'outputs'=>['resumo','tabela','planilha compatível com Excel','dashboard e gráfico','impressão ou PDF','compartilhamento'],
        'general_capabilities'=>['conversa por áudio ou escrita','gravação de reunião e kickoff','transcrição de áudio e vídeo','importação de texto, imagens, documentos e arquivos do WhatsApp','ata e relatório em PDF'],
        'source'=>'Históricos oficiais da Agenda do Dia — somente leitura'
    ];
}

function agendaAnalyticsValue(array $row,array $keys,mixed $default=''):mixed {
    foreach($keys as $key)if(array_key_exists($key,$row)&&!is_array($row[$key])&&$row[$key]!==null&&$row[$key]!=='')return $row[$key];
    return $default;
}

function agendaAnalyticsMerged(array $row):array {
    $merged=$row;
    if(isset($row['planejado'])&&is_array($row['planejado']))$merged=array_merge($row['planejado'],$merged);
    if(isset($row['executado'])&&is_array($row['executado']))$merged=array_merge($merged,$row['executado']);
    if(isset($row['execucoes'])&&is_array($row['execucoes'])&&$row['execucoes']){
        $last=end($row['execucoes']);if(is_array($last))$merged=array_merge($merged,$last);
    }
    return $merged;
}

function agendaAnalyticsCancelled(array $row):bool {
    $status=norm((string)agendaAnalyticsValue($row,['status','status_item','auditStatus'],''));
    return !empty($row['cancelado'])||!empty($row['cancelled'])||str_contains($status,'cancel');
}

function agendaAnalyticsSpecial(array $row):string {
    $merged=agendaAnalyticsMerged($row);
    $text=norm((string)agendaAnalyticsValue($merged,['atividade','descricao','activity'],'').' '.(string)agendaAnalyticsValue($merged,['obra','project','nomeObra'],''));
    if(preg_match('/\bferias\b/u',$text))return 'Férias';
    if(preg_match('/\bfalta\b/u',$text))return 'Falta';
    return '';
}

function agendaAnalyticsDate(string $value):?\DateTimeImmutable {
    if(!preg_match('/^20\d{2}-\d{2}-\d{2}$/D',$value))return null;
    $date=\DateTimeImmutable::createFromFormat('!Y-m-d',$value);
    return $date&&$date->format('Y-m-d')===$value?$date:null;
}

function agendaAnalyticsPeriod(array $args,string $openDate):array {
    $today=new \DateTimeImmutable('today');
    $period=(string)($args['periodo']??'');
    $start=agendaAnalyticsDate((string)($args['data_inicio']??''));
    $end=agendaAnalyticsDate((string)($args['data_fim']??''));
    if(!$start||!$end){
        if($period===''||$period==='dia_aberto')$start=$end=agendaAnalyticsDate($openDate)??$today;
        elseif($period==='hoje')$start=$end=$today;
        elseif($period==='ontem')$start=$end=$today->modify('-1 day');
        elseif($period==='esta_semana'){$start=$today->modify('monday this week');$end=$start->modify('+6 days');}
        elseif($period==='semana_passada'){$start=$today->modify('monday last week');$end=$start->modify('+6 days');}
        elseif($period==='este_mes'){$start=$today->modify('first day of this month');$end=$today->modify('last day of this month');}
        elseif($period==='mes_passado'){$start=$today->modify('first day of last month');$end=$today->modify('last day of last month');}
        elseif($period==='ultimos_3_meses'){$start=$today->modify('first day of -2 months');$end=$today;}
        else $start=$end=agendaAnalyticsDate($openDate)??$today;
    }
    if($start>$end)[$start,$end]=[$end,$start];
    return [$start->format('Y-m-d'),$end->format('Y-m-d')];
}

function agendaAnalyticsList(mixed $value):array {
    if(is_string($value))$value=[$value];
    if(!is_array($value))return [];
    return array_values(array_filter(array_map(fn($v)=>trim((string)$v),$value),fn($v)=>$v!==''));
}

function agendaAnalyticsMatches(string $value,array $filters):bool {
    if(!$filters)return true;$candidate=norm($value);
    foreach($filters as $filter){$wanted=norm($filter);if($wanted!==''&&(str_contains($candidate,$wanted)||str_contains($wanted,$candidate)))return true;}
    return false;
}

function agendaAnalyticsRecord(array $u,string $date,array $current):?array {
    if($date===(string)($current['data']??''))return $current;
    if(agendaBackendJson($u)){
        $path=agendaDataDir($u).'/historico_atividade_dia_'.$date.'.json';
        if(!is_file($path))return null;
        $record=readJson($path);
        return ['ok'=>true,'verified'=>true,'source'=>'Histórico oficial da Agenda do Dia','data'=>$date,'status'=>'Histórico','atividades'=>$record['atividades']??[],'draft'=>$record];
    }
    try{return agendaRead($u,$date);}catch(\Throwable $e){return null;}
}

function agendaAnalyticsAvailableDates(array $current,string $start,string $end):array {
    $dates=[];
    foreach($current['historicos']??[] as $row){$date=(string)($row['data']??'');if($date>=$start&&$date<=$end)$dates[$date]=true;}
    $open=(string)($current['data']??'');if($open>=$start&&$open<=$end)$dates[$open]=true;
    $out=array_keys($dates);sort($out);return $out;
}

function agendaAnalyticsExpectedWorkdays(string $start,string $end):array {
    $from=agendaAnalyticsDate($start);$to=agendaAnalyticsDate($end);if(!$from||!$to)return [];$out=[];
    for($d=$from;$d<=$to;$d=$d->modify('+1 day'))if((int)$d->format('N')<=5)$out[]=$d->format('Y-m-d');
    return $out;
}

function agendaAnalyticsDimension(array $row,string $dimension):string {
    return match($dimension){
        'data'=>(string)$row['data'],'mes'=>(string)$row['mes'],'colaborador'=>(string)$row['colaborador'],
        'funcao'=>(string)$row['funcao'],'obra'=>(string)$row['obra'],'atividade'=>(string)$row['atividade'],
        'veiculo'=>(string)$row['veiculo'],'status'=>(string)$row['status'],default=>''
    };
}

function agendaAnalyticsLatestPath():?string {
    $id=(string)($GLOBALS['agenda_record_id']??'');if($id==='')return null;
    try{return recordDir($id).'/analytics_latest.json';}catch(\Throwable $e){return null;}
}

function agendaAnalyticsLoadLast():array {
    $path=agendaAnalyticsLatestPath();if(!$path||!is_file($path))return [];
    try{return readJson($path,[]);}catch(\Throwable $e){return [];}
}

function agendaAnalyticsSaveLast(array $request,array $dataset):void {
    $path=agendaAnalyticsLatestPath();if(!$path)return;
    try{atomic($path,encode(['request'=>$request,'dataset'=>$dataset,'at'=>date(DATE_ATOM)]));}catch(\Throwable $e){}
}

function agendaAnalyticsResolveRequest(array $args):array {
    if(empty($args['usar_ultimo']))return $args;
    $last=agendaAnalyticsLoadLast();$base=is_array($last['request']??null)?$last['request']:[];
    unset($args['usar_ultimo']);
    foreach($args as $key=>$value)if($value!==''&&$value!==[]&&$value!==null)$base[$key]=$value;
    return $base;
}

function agendaAnalyticsQuery(array $u,array $rawArgs):array {
    permission($u,'atividades');
    $args=agendaAnalyticsResolveRequest($rawArgs);
    $current=agendaRead($u,null);$openDate=(string)($current['data']??date('Y-m-d'));
    [$start,$end]=agendaAnalyticsPeriod($args,$openDate);
    $available=agendaAnalyticsAvailableDates($current,$start,$end);
    $catalog=agendaCatalog($u);$catalogNames=[];
    foreach($catalog as $person){$name=trim((string)($person['name']??$person['nome']??''));if($name!=='')$catalogNames[norm($name)]=$name;}

    $all=[];$presence=[];$specialPresence=[];$readDates=[];
    foreach($available as $date){
        $record=agendaAnalyticsRecord($u,$date,$current);if(!$record)continue;$readDates[]=$date;
        $activities=is_array($record['atividades']??null)?$record['atividades']:[];$byPerson=[];
        foreach($activities as $index=>$original){
            if(!is_array($original))continue;$merged=agendaAnalyticsMerged($original);
            $person=trim((string)agendaAnalyticsValue($merged,['colaborador','colaborador_nome','personName','nome','responsavel'],''));
            if($person==='')continue;$person=$catalogNames[norm($person)]??$person;
            $cancelled=agendaAnalyticsCancelled($original);$special=agendaAnalyticsSpecial($original);
            $status=$cancelled?'Cancelada':($special!==''?$special:'Ativa');
            $row=[
                'data'=>$date,'mes'=>substr($date,0,7),'colaborador'=>$person,
                'funcao'=>trim((string)agendaAnalyticsValue($merged,['funcao','role','cargo'],'')),
                'obra'=>trim((string)agendaAnalyticsValue($merged,['obra','obra_texto','project','nomeObra','projeto'],'Sem obra')),
                'atividade'=>trim((string)agendaAnalyticsValue($merged,['atividade','atividade_texto','descricao','description','activity'],'Sem descrição')),
                'veiculo'=>trim((string)agendaAnalyticsValue($merged,['carro','car','placa'],'Sem veículo')),
                'status'=>$status,'horas'=>0.0,'atividade_id'=>(string)agendaAnalyticsValue($original,['id','atividadeId'],$date.'_'.$index)
            ];
            $byPerson[norm($person)][]=$row;
        }
        foreach($byPerson as $personKey=>$rows){
            $productive=array_keys(array_filter($rows,fn($row)=>$row['status']==='Ativa'));
            $share=count($productive)>0?8.0/count($productive):0.0;
            foreach($rows as $index=>$row){if($row['status']==='Ativa'){$row['horas']=$share;$presence[$date][$personKey]=true;}elseif(in_array($row['status'],['Férias','Falta'],true))$specialPresence[$date][$personKey]=$row['status'];$all[]=$row;}
        }
    }

    $includeCancelled=!empty($args['incluir_canceladas']);
    $filters=[
        'colaborador'=>agendaAnalyticsList($args['colaboradores']??[]),'obra'=>agendaAnalyticsList($args['obras']??[]),
        'atividade'=>agendaAnalyticsList($args['atividades']??[]),'funcao'=>agendaAnalyticsList($args['funcoes']??[]),
        'veiculo'=>agendaAnalyticsList($args['veiculos']??[])
    ];
    $excluded=agendaAnalyticsList($args['excluir_colaboradores']??[]);
    $rows=array_values(array_filter($all,function($row)use($filters,$excluded,$includeCancelled){
        if(!$includeCancelled&&$row['status']==='Cancelada')return false;
        if($excluded&&agendaAnalyticsMatches($row['colaborador'],$excluded))return false;
        foreach($filters as $field=>$values)if($values&&!agendaAnalyticsMatches((string)$row[$field],$values))return false;
        return true;
    }));

    $dimensions=agendaAnalyticsList($args['agrupar_por']??[]);if(!$dimensions)$dimensions=['obra'];
    $allowed=['data','mes','colaborador','funcao','obra','atividade','veiculo','status'];
    $dimensions=array_values(array_unique(array_filter($dimensions,fn($d)=>in_array($d,$allowed,true))));if(!$dimensions)$dimensions=['obra'];
    $groups=[];
    foreach($rows as $row){$values=[];foreach($dimensions as $dimension)$values[$dimension]=agendaAnalyticsDimension($row,$dimension);$key=encode($values);
        if(!isset($groups[$key]))$groups[$key]=['grupo'=>$values,'horas'=>0.0,'atividades'=>0,'colaboradores'=>[],'obras'=>[],'veiculos'=>[]];
        $groups[$key]['horas']+=(float)$row['horas'];$groups[$key]['atividades']++;
        $groups[$key]['colaboradores'][norm($row['colaborador'])]=$row['colaborador'];$groups[$key]['obras'][norm($row['obra'])]=$row['obra'];if($row['veiculo']!=='Sem veículo')$groups[$key]['veiculos'][norm($row['veiculo'])]=$row['veiculo'];
    }
    $groupRows=[];foreach($groups as $group)$groupRows[]=['grupo'=>$group['grupo'],'horas'=>round($group['horas'],4),'atividades'=>$group['atividades'],'colaboradores'=>array_values($group['colaboradores']),'obras'=>array_values($group['obras']),'veiculos'=>array_values($group['veiculos'])];
    $order=(string)($args['ordenar_por']??'horas_desc');
    usort($groupRows,function($a,$b)use($order){$an=implode(' · ',$a['grupo']);$bn=implode(' · ',$b['grupo']);return match($order){'horas_asc'=>$a['horas']<=>$b['horas'],'nome_asc'=>strnatcasecmp($an,$bn),'nome_desc'=>strnatcasecmp($bn,$an),default=>$b['horas']<=>$a['horas']};});
    $limit=max(1,min(200,(int)($args['limite']??30)));$limitedGroups=array_slice($groupRows,0,$limit);

    $activeNames=array_values($catalogNames);sort($activeNames,SORT_NATURAL|SORT_FLAG_CASE);
    $neverAllocated=[];$unallocatedDays=[];$specialDays=[];
    foreach($activeNames as $name){$key=norm($name);$allocated=0;$missing=[];$special=[];
        foreach($readDates as $date){if(!empty($presence[$date][$key]))$allocated++;elseif(isset($specialPresence[$date][$key]))$special[]=['data'=>$date,'status'=>$specialPresence[$date][$key]];else $missing[]=$date;}
        if($readDates&&$allocated===0&&!$special)$neverAllocated[]=$name;
        if($missing)$unallocatedDays[]=['colaborador'=>$name,'dias_sem_alocacao'=>count($missing),'datas'=>$missing];
        if($special)$specialDays[]=['colaborador'=>$name,'ocorrencias'=>$special];
    }
    usort($unallocatedDays,fn($a,$b)=>($b['dias_sem_alocacao']<=>$a['dias_sem_alocacao'])?:strnatcasecmp($a['colaborador'],$b['colaborador']));

    $productiveRows=array_values(array_filter($rows,fn($row)=>$row['status']==='Ativa'));
    $totalHours=array_sum(array_column($productiveRows,'horas'));
    $people=[];$works=[];$vehicles=[];foreach($productiveRows as $row){$people[norm($row['colaborador'])]=$row['colaborador'];$works[norm($row['obra'])]=$row['obra'];if($row['veiculo']!=='Sem veículo')$vehicles[norm($row['veiculo'])]=$row['veiculo'];}
    $missingDates=array_values(array_diff(agendaAnalyticsExpectedWorkdays($start,$end),$readDates));
    $summary=[
        'periodo'=>['inicio'=>$start,'fim'=>$end],'dias_com_agenda'=>count($readDates),'datas_lidas'=>$readDates,'datas_uteis_sem_agenda'=>$missingDates,
        'horas'=>round($totalHours,4),'atividades'=>count($productiveRows),'colaboradores'=>count($people),'obras'=>count($works),'veiculos'=>count($vehicles),
        'regra'=>'8 horas por colaborador/dia, divididas igualmente entre as atividades produtivas válidas'
    ];
    $dataset=['title'=>'Análise da Agenda do Dia','request'=>$args,'summary'=>$summary,'dimensions'=>$dimensions,'groups'=>$groupRows,'rows'=>$rows,'never_allocated'=>$neverAllocated,'unallocated_days'=>$unallocatedDays,'special_days'=>$specialDays];
    agendaAnalyticsSaveLast($args,$dataset);
    $client=$dataset;$client['groups']=$limitedGroups;$client['format']=(string)($args['saida']??'resumo');$client['filename']='agenda_do_dia_'.$start.'_a_'.$end;
    return [
        'ok'=>true,'source'=>'Históricos oficiais da Agenda do Dia — consulta somente leitura','filters'=>$args,'summary'=>$summary,
        'grouping'=>$dimensions,'rows'=>$limitedGroups,'total_groups'=>count($groupRows),'never_allocated'=>$neverAllocated,
        'unallocated_days'=>array_slice($unallocatedDays,0,50),'special_days'=>array_slice($specialDays,0,50),
        'client_payload'=>$client
    ];
}

function agendaAnalyticsExecute(string $name,array $args,array $u):?array {
    if(!in_array($name,['consultar_indicadores_agenda_dia','consultar_agenda_semanal_oficial'],true))return null;
    try{return $name==='consultar_agenda_semanal_oficial'?agendaWeeklyOfficial($u,$args):agendaAnalyticsQuery($u,$args);}catch(\Throwable $e){
        return ['ok'=>false,'status'=>$e instanceof Failure?$e->status:'ANALISE_INDISPONIVEL','message'=>$e instanceof Failure?$e->getMessage():'Não foi possível consultar a fonte oficial da Agenda. Nenhum dado foi alterado.','source'=>'Agenda — somente leitura'];
    }
}
