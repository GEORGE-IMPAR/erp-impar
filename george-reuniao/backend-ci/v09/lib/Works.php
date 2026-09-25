<?php
declare(strict_types=1);
namespace GeorgeV09;
function worksRead(array $u,array $in=[]):array {
    permission($u,'cronograma');agendaFileActor($u);legacy();
    if(!function_exists('mobile_cronograma_rows')||!function_exists('mobile_cronograma_data_dir')||!is_dir(\mobile_cronograma_data_dir())||!is_readable(\mobile_cronograma_data_dir()))return ['ok'=>false,'status'=>'FONTE_OBRAS_INDISPONIVEL','message'=>'Não consegui consultar o cadastro de obras agora. A lista e o total ainda precisam ser confirmados.'];
    $all=\mobile_cronograma_rows();$rows=[];$responsibles=[];$missing=0;
    foreach($all as $r){$d=$r['data']??[];$manager=trim((string)($r['coordenador']??$d['responsavel']??$d['gestor']??''));
        if($manager===''){$manager=trim((string)($d['responsavel']??$d['gestor']??''));if($manager==='')$missing++;}
        if($manager!=='')$responsibles[norm($manager)]=$manager;
        $rows[]=['id'=>(string)$r['id'],'nome'=>$r['obra'],'responsavel'=>$manager?:null,'status'=>$d['status']??$d['situacao']??null,'cronograma_ref'=>$r['arquivo'],'atualizado_em'=>$d['updatedAt']??$d['updated_at']??null];
    }
    $q=norm((string)($in['responsavel']??$in['colaborador']??''));$selectedManager=null;
    if($q!==''){$matches=[];foreach($responsibles as $n=>$name)if($n===$q||str_starts_with($n,$q.' '))$matches[]=$name;
        if(count($matches)>1)return ['ok'=>false,'needs_choice'=>true,'status'=>'RESPONSAVEL_AMBIGUO','message'=>'Qual responsável você quer consultar?','candidates'=>$matches];
        $selectedManager=$matches[0]??null;$rows=$selectedManager?array_values(array_filter($rows,fn($r)=>$r['responsavel']===$selectedManager)):[];
    }
    $work=norm((string)($in['obra']??''));if($work!==''){
        $exact=array_values(array_filter($rows,fn($r)=>norm($r['nome'])===$work||norm($r['id'])===$work));
        if(!$exact){$close=[];foreach($rows as $candidate){$name=norm($candidate['nome']);similar_text($work,$name,$pct);if($pct>=72||str_contains($name,$work)||str_contains($work,$name))$close[]=$candidate;}
            if(count($close)===1)return ['ok'=>false,'needs_choice'=>true,'status'=>'OBRA_SEMELHANTE','message'=>'Você quis dizer '.$close[0]['nome'].'?','candidates'=>[['id'=>$close[0]['id'],'nome'=>$close[0]['nome']]],'source'=>'Cadastro de obras e cronogramas'];
            if(count($close)>1)return ['ok'=>false,'needs_choice'=>true,'status'=>'OBRA_AMBIGUA','message'=>'Qual destas obras você quis dizer?','candidates'=>array_map(fn($w)=>['id'=>$w['id'],'nome'=>$w['nome']],$close),'source'=>'Cadastro de obras e cronogramas'];
        }
        $rows=$exact;
    }
    // Details are read from the same current schedule, without updating it.
    if(($in['detalhes']??false)===true)foreach($rows as &$row){foreach($all as $raw)if((string)$raw['id']===$row['id']){$d=$raw['data'];$row['cronograma']=$d['grupos']??$d['etapas']??$d['atividades']??$d['tasks']??[];break;}}unset($row);
    return ['ok'=>true,'verified'=>true,'source'=>'Cadastro de obras e cronogramas','obras'=>$rows,'total'=>count($rows),'total_consultado'=>count($all),'responsavel'=>$selectedManager,'sem_responsavel'=>$missing,'contagem_completa'=>$missing===0,'consultado_em'=>date(DATE_ATOM),'nota'=>$missing?'Há obras sem responsável informado; a contagem por pessoa pode estar incompleta.':''];
}
function agendaWorkCanonical(array $u,string $query):array {
    // Free descriptions remain valid. Similar registered works require an explicit choice.
    $r=worksRead($u);if(empty($r['ok']))return ['ok'=>true,'name'=>$query];$n=norm($query);$close=[];
    foreach($r['obras'] as $w){$wn=norm($w['nome']);if($wn===$n)return ['ok'=>true,'name'=>$w['nome'],'id'=>$w['id']];
        similar_text($n,$wn,$pct);$tail=preg_replace('/^\S+\s+/','',$n);if($pct>=72||strlen($tail)>=6&&str_ends_with($wn,' '.$tail))$close[]=['id'=>$w['id'],'nome'=>$w['nome']];
    }
    return $close?['ok'=>false,'needs_choice'=>true,'status'=>'OBRA_SEMELHANTE','message'=>'Você quis dizer '.implode(' ou ',array_column($close,'nome')).'?','candidates'=>$close]:['ok'=>true,'name'=>$query];
}
function worksForRecord(array $u,string $id):array {
    $r=record($id,$u);$text=encode($r['report']??[]).' '.implode(' ',array_column($r['turns']??[],'text'));
    if(($r['job_state']??'')==='ready'&&is_file(recordDir($id).'/transcript.txt'))$text.=' '.file_get_contents(recordDir($id).'/transcript.txt');
    $source=worksRead($u);if(empty($source['ok']))return $source;$n=norm($text);$related=[];
    foreach($source['obras'] as $w){$work=norm($w['nome']);$manager=norm((string)($w['responsavel']??''));$direct=$work!==''&&preg_match('/(?<![a-z0-9])'.preg_quote($work,'/').'(?![a-z0-9])/u',$n);$byManager=$manager!==''&&preg_match('/(?<![a-z0-9])'.preg_quote($manager,'/').'(?![a-z0-9])/u',$n);if($direct||$byManager){$w['vinculo']=$direct?'Obra citada':'Responsável citado';$related[]=$w;}}
    return ['ok'=>true,'source'=>$source['source'],'record_id'=>$id,'consultado_em'=>date(DATE_ATOM),'obras'=>$related,'total'=>count($related),'nota'=>'Referências ao cadastro atual. Datas e decisões da reunião permanecem como foram registradas.'];
}
