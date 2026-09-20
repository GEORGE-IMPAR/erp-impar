<?php
declare(strict_types=1);
namespace GeorgeV09;
/** Renderer único do template executivo aprovado. Sem bibliotecas ou fontes externas.
 * Formato Carta (612x792 pt), como o PDF de referência enviado pelo usuário.
 * Usa fontes PDF padrão WinAnsi, mantendo acentos PT-BR e métricas reais de largura.
 */
final class ExecutivePdfV1 {
    private float $W=612,$H=792,$x=54,$w=504,$y=50.2,$bottom=736;
    private string $label='ATA EXECUTIVA';private string $stream='';private array $pages=[],$widths=[];private int $page=0;private ?string $jpeg=null;private array $imageSize=[0,0];
    private string $navy='#0C3245',$green='#18B978',$ink='#193B4C',$muted='#718A98';
    public function __construct(){ $this->widths=json_decode((string)file_get_contents(__DIR__.'/widths.json'),true,512,JSON_THROW_ON_ERROR); }
    private function cp(string $s):string { $s=str_replace(["\r",'**','__','`'],['','','',''],$s);return iconv('UTF-8','Windows-1252//TRANSLIT//IGNORE',$s)?:''; }
    private function esc(string $s):string{return str_replace(['\\','(',')'],['\\\\','\\(','\\)'],$this->cp($s));}
    private function rgb(string $s):string{ $s=ltrim($s,'#');return sprintf('%.4F %.4F %.4F',hexdec(substr($s,0,2))/255,hexdec(substr($s,2,2))/255,hexdec(substr($s,4,2))/255); }
    private function rect(float $x,float $y,float $w,float $h,string $c):void{$this->stream.=$this->rgb($c).sprintf(" rg %.2F %.2F %.2F %.2F re f\n",$x,$this->H-$y-$h,$w,$h);}
    private function line(float $x,float $y,float $w,string $c):void{$this->stream.=$this->rgb($c).sprintf(" RG 0.45 w %.2F %.2F m %.2F %.2F l S\n",$x,$this->H-$y,$x+$w,$this->H-$y);}
    private function text(float $x,float $y,string $s,float $size=10,bool $bold=false,?string $c=null):void{
        $font=$bold?'F2':'F1';$this->stream.="BT ".$this->rgb($c??$this->ink).sprintf(" rg /%s %.2F Tf 1 0 0 1 %.2F %.2F Tm (%s) Tj ET\n",$font,$size,$x,$this->H-$y-$size*.83,$this->esc($s));
    }
    private function width(string $s,float $size,bool $bold=false):float{ $sum=0;$t=$this->widths[$bold?'Helvetica-Bold':'Helvetica'];foreach(unpack('C*',$this->cp($s))?:[] as $b)$sum+=$t[$b]??500;return $sum*$size/1000; }
    private function wrap(string $s,float $max,float $size=10,bool $bold=false):array {
        $out=[];$current='';$words=preg_split('/\s+/u',trim($s))?:[];
        foreach($words as $word){
            if($this->width($word,$size,$bold)>$max){
                if($current!==''){$out[]=$current;$current='';}
                foreach(preg_split('//u',$word,-1,PREG_SPLIT_NO_EMPTY)?:[] as $ch){
                    if($this->width($current.$ch,$size,$bold)>$max&&$current!==''){$out[]=$current;$current='';}$current.=$ch;
                }continue;
            }
            $candidate=$current===''?$word:$current.' '.$word;
            if($this->width($candidate,$size,$bold)<=$max)$current=$candidate;else{$out[]=$current;$current=$word;}
        }
        if($current!=='')$out[]=$current;return $out?:[''];
    }
    private function newPage():void {
        if($this->page)$this->finishPage();$this->page++;$this->stream='';$this->y=50.2;
        $this->rect(54,28.7,388.8,21.5,$this->navy);$this->rect(442.8,28.7,115.2,21.5,$this->green);
        $this->text(60.1,32,'ERP ÍMPAR • GEORGE',8.1,true,'#FFFFFF');$this->text(474,32,$this->label,8.1,true,'#FFFFFF');
    }
    private function finishPage():void {
        $this->line(54,753.5,504,'#DBE5E8');
        $this->text(56.3,758,'ERP ÍMPAR • Documento executivo',7,false,$this->muted);
        $this->text(277,758,'Gerado pelo George',7,false,$this->muted);
        $txt='Página '.$this->page;$this->text(556-$this->width($txt,7),758,$txt,7,false,$this->muted);
        $this->pages[]=$this->stream;
    }
    private function ensure(float $need):void {if($this->y+$need>$this->bottom)$this->newPage();}
    private function image(float $x,float $y,float $w,float $h):void {if($this->jpeg!==null)$this->stream.=sprintf("q %.2F 0 0 %.2F %.2F %.2F cm /Logo Do Q\n",$w,$h,$x,$this->H-$y-$h);}
    private function cover(array $r,array $meta):void {
        $this->image(60,60,72,72);$this->text(146,73,'ERP ÍMPAR',25,true,$this->navy);
        $this->text(148,103,'GEORGE • INTELIGÊNCIA OPERACIONAL',11,true,'#27A684');
        $this->text(148,120,'Documento executivo • padrão de ata',10,false,$this->muted);
        $titleLines=$this->wrap($r['titulo'],491,14);$heroH=max(131.2,90+count($titleLines)*18);
        $this->rect(44.7,151,522.7,$heroH,$this->navy);$this->text(59.8,174,'ATA EXECUTIVA',28,true,'#FFFFFF');
        $yy=217;foreach($titleLines as $line){$this->text(59.8,$yy,$line,14,false,'#C2D8E2');$yy+=18;}
        $this->text(59.8,$yy+18,'Documento padrão de registro e governança de reuniões',10,false,'#92B1BF');
        $this->y=151+$heroH+15;
        $rows=[['DATA DA REUNIÃO',$r['data_reuniao']],['PARTICIPANTES',$r['participantes']?implode(', ',$r['participantes']):'não informados na transcrição'],['CLASSIFICAÇÃO',$r['classificacao']],['TEMPLATE','ERP ÍMPAR + George • V1.0']];
        foreach($rows as [$label,$value]){
            $ls=$this->wrap($value,248,9.3);$continued=false;
            while($ls){
                $this->ensure(28);$fit=max(1,(int)floor(($this->bottom-$this->y-14)/12.7));$part=array_splice($ls,0,$fit);$h=max(26.7,count($part)*12.7+14);
                $this->rect(44.7,$this->y,261.3,$h,'#E9F7F2');$this->text(50.8,$this->y+8,$label.($continued?' (continuação)':''),8,true,'#177966');
                $ty=$this->y+8;foreach($part as $l){$this->text(312,$ty,$l,9.3);$ty+=12.7;}
                $this->line(44.7,$this->y+$h,522.7,'#DCE6E8');$this->y+=$h;
                if($ls){$this->newPage();$continued=true;}
            }
        }
        $note='Fonte do conteúdo: transcrição e consolidação produzida pelo George. Quando a transcrição não informou um dado, o documento mantém a indicação “não informado”.';
        $ls=$this->wrap($note,487,8.5);$h=count($ls)*12+17;$this->y+=18;$this->ensure($h);$this->rect(54,$this->y,504,$h,'#F3F7F8');
        $ty=$this->y+8;foreach($ls as $l){$this->text(60.5,$ty,$l,8.5,false,$this->muted);$ty+=12;}
        $this->newPage();
    }
    private function heading(int $n,string $title,string $subtitle,string $color, float $following=36):void {
        $h=$subtitle===''?32:44;$this->ensure($h+$following);
        $this->rect(54,$this->y,504,$h,'#F2F6F7');$this->rect(54,$this->y,35,$h,$color);
        $this->text(68,$this->y+8,(string)$n,12,true,'#FFFFFF');$this->text(96.2,$this->y+7,$title,11,true,$this->navy);
        if($subtitle!=='')$this->text(96.2,$this->y+28,$subtitle,8.6,false,$this->muted);
        $this->y+=$h+12;
    }
    private function summary(array $pars):void {
        if(!$pars)$pars=['Não informado na transcrição.'];
        foreach($pars as $p){$ls=$this->wrap($p,480,10);while($ls){$this->ensure(32);$fit=max(1,(int)floor(($this->bottom-$this->y-16)/13));$part=array_splice($ls,0,$fit);$h=count($part)*13+10;
            $this->rect(54,$this->y,504,$h,'#EBF5F8');$this->rect(54,$this->y,6,$h,$this->green);$ty=$this->y+5;
            foreach($part as $l){$this->text(68.7,$ty,$l,10);$ty+=13;}$this->y+=$h;if($ls)$this->newPage();
        }}$this->y+=10;
    }
    private function items(array $items,string $color,string $bg):void {
        if(!$items)$items=['Não informado na transcrição.'];
        foreach($items as $i=>$item){$ls=$this->wrap($item,453,9.3);$cont=false;
            while($ls){$this->ensure(32);$fit=max(1,(int)floor(($this->bottom-$this->y-14)/13));$part=array_splice($ls,0,$fit);$h=max(28,count($part)*13+14);
                $this->rect(56,$this->y,500,$h,$bg);$this->rect(56,$this->y,35,$h,$color);
                $this->text(70.4,$this->y+8,$cont?'…':(string)($i+1),9,true,'#FFFFFF');$ty=$this->y+7;
                foreach($part as $l){$this->text(98,$ty,$l,9.3);$ty+=13;}$this->line(56,$this->y+$h,500,'#DFE8EB');$this->y+=$h+8;
                if($ls){$this->newPage();$cont=true;}
            }
        }$this->y+=5;
    }
    private function tableHeader():void {
        $this->ensure(52);$this->rect(54,$this->y,504,27,$this->navy);
        $this->text(59,$this->y+8,'Obra/Frente',8.5,true,'#FFFFFF');$this->text(169,$this->y+8,'Pendência / Próximo passo',8.5,true,'#FFFFFF');$this->text(427,$this->y+8,'Responsável citado',8.5,true,'#FFFFFF');$this->y+=27;
    }
    private function table(array $rows):void {
        if(!$rows)$rows=[['obra_frente'=>'Não informado','pendencia'=>'Não informado na transcrição.','responsavel'=>'Não informado']];
        $this->tableHeader();
        foreach($rows as $i=>$r){$cols=[$this->wrap($r['obra_frente'],100,8.8),$this->wrap($r['pendencia'],248,8.8),$this->wrap($r['responsavel'],123,8.8)];$bg=$i%2?'#F3F7F8':'#FFFFFF';
            while(array_filter($cols)){
                $max=max(array_map('count',$cols));$need=$max*12+14;
                if($this->y+$need>$this->bottom&&$need<650){$this->newPage();$this->tableHeader();}
                if($this->bottom-$this->y<40){$this->newPage();$this->tableHeader();}
                $fit=max(1,(int)floor(($this->bottom-$this->y-14)/12));$num=min($fit,$max);$h=$num*12+14;
                $this->rect(54,$this->y,504,$h,$bg);
                foreach([59,169,427] as $ci=>$xx){$lines=array_splice($cols[$ci],0,$num);$ty=$this->y+7;foreach($lines as $l){$this->text($xx,$ty,$l,8.8);$ty+=12;}}
                $this->line(54,$this->y+$h,504,'#D9E4E7');$this->y+=$h;
                if(array_filter($cols)){$this->newPage();$this->tableHeader();}
            }
        }$this->y+=18;
    }
    private function demandCycles(array $cycles):void {
        if(!$cycles){$this->items(['Nenhuma demanda pôde ser vinculada com segurança na fonte.'],'#718A98','#F3F7F8');return;}
        $labels=['CONCLUIDA'=>'CONCLUÍDA','EM_ANDAMENTO'=>'EM ANDAMENTO','AGUARDANDO_TERCEIRO'=>'AGUARDANDO TERCEIRO','SEM_RESPOSTA'=>'SEM RESPOSTA','REABERTA'=>'REABERTA','VINCULO_DUVIDOSO'=>'VÍNCULO DUVIDOSO'];
        $colors=['CONCLUIDA'=>'#18B978','EM_ANDAMENTO'=>'#D29B2D','AGUARDANDO_TERCEIRO'=>'#36B8C7','SEM_RESPOSTA'=>'#BD5866','REABERTA'=>'#9B5CB5','VINCULO_DUVIDOSO'=>'#718A98'];
        foreach($cycles as $i=>$c){
            $status=$c['status']??'VINCULO_DUVIDOSO';$color=$colors[$status]??'#718A98';
            $title=($i+1).'. '.($c['assunto']??'Demanda sem título');$head=$this->wrap($title,350,10,true);
            $meta='Solicitante: '.($c['solicitante']??'não informado').'  •  Responsável: '.($c['responsavel']??'não informado').'  •  Abertura: '.($c['abertura']??'não informada');
            $lines=[];$lines[]='PEDIDO: '.($c['pedido']??'não informado');
            foreach(($c['movimentacoes']??[]) as $n=>$move)$lines[]=(($n+1).'. ').$move;
            $lines[]='DESFECHO: '.($c['desfecho']??'não informado');
            $lines[]='EVIDÊNCIA: '.($c['evidencia_status']??'não informada').'  •  Confiança: '.($c['confianca']??'BAIXA');
            $wrapped=[];foreach($lines as $line)foreach($this->wrap($line,474,8.8) as $part)$wrapped[]=$part;
            $metaLines=$this->wrap($meta,474,8.2);$all=array_merge($metaLines,[''], $wrapped);$first=true;
            while($all){
                $this->ensure(75);$fit=max(1,(int)floor(($this->bottom-$this->y-50)/11.5));$part=array_splice($all,0,$fit);$h=count($part)*11.5+49;
                $this->rect(54,$this->y,504,$h,'#F7FAFB');$this->rect(54,$this->y,7,$h,$color);
                if($first){$yy=$this->y+8;foreach($head as $hl){$this->text(68,$yy,$hl,10,true,$this->navy);$yy+=12;}
                    $badge=$labels[$status]??$status;$this->text(548-$this->width($badge,7.4,true),$this->y+9,$badge,7.4,true,$color);
                }else{$this->text(68,$this->y+8,'Continuação',8,true,$this->muted);}
                $ty=$this->y+31;foreach($part as $line){if($line!=='')$this->text(68,$ty,$line,8.8);$ty+=11.5;}
                $this->y+=$h+8;if($all){$this->newPage();$first=false;}
            }
        }$this->y+=8;
    }
    public function build(array $r,array $meta=[]):string {
        if(is_file($meta['logo']??'')){$this->jpeg=file_get_contents($meta['logo']);$sz=getimagesize($meta['logo']);$this->imageSize=[$sz[0],$sz[1]];}
        $this->newPage();$this->cover($r,$meta);
        $this->heading(1,'RESUMO EXECUTIVO','Síntese dos principais temas, prioridades e condicionantes',$this->green);$this->summary($r['resumo_executivo']);
        $this->heading(2,'DECISÕES','Deliberações e direcionamentos definidos na reunião',$this->green);$this->items($r['decisoes'],$this->green,'#FFFFFF');
        $this->heading(3,'NOVAS IDEIAS','Oportunidades de melhoria capturadas para evolução do ERP ÍMPAR',$this->green);$this->items($r['novas_ideias'],'#36B8C7','#E9F7F3');
        $this->heading(4,'REGRAS FUNCIONAIS CONFIRMADAS','Regras de negócio que devem integrar a documentação oficial do ERP',$this->green);$this->items($r['regras_funcionais_confirmadas'],'#0B7B63','#E9F7F3');
        $this->heading(5,'PONTOS A VALIDAR','Assuntos que permanecem dependentes de verificação ou confirmação',$this->green);$this->items($r['pontos_a_validar'],'#D29B2D','#FFF7E6');
        $this->heading(6,'CICLOS DE DEMANDA','Mapa cronológico: pedido, movimentações, resposta e situação final',$this->green,72);$this->demandCycles($r['ciclos_demanda']);
        $this->heading(7,'PENDÊNCIAS E RESPONSÁVEIS','Somente assuntos que permanecem abertos após a análise cronológica',$this->green,80);$this->table($r['pendencias_responsaveis']);
        $this->heading(8,'RISCOS','Fatores com potencial de impacto em prazo, custo, execução ou governança','#BD5866');$this->items($r['riscos'],'#BD5866','#FFF0F2');
        $this->heading(9,'ITENS PARA ATUALIZAR NO BLUEPRINT','Requisitos e estruturas a incorporar na documentação do ERP ÍMPAR',$this->navy);$this->items($r['itens_blueprint'],'#163F52','#EBF5F8');
        $this->ensure(102);$this->y+=18;$this->rect(39,$this->y,523,76,'#F1F6F7');
        $this->text(46,$this->y+9,'PRÓXIMO PASSO',8.5,true,'#167865');$this->text(311,$this->y+9,'GOVERNANÇA',8.5,true,'#167865');
        foreach([[46,'Validar pendências e atualizar a Vida da Obra / Blueprint conforme decisões desta ata.'],[311,'Este documento passa a integrar o padrão executivo de atas do ERP ÍMPAR / George.']] as [$xx,$p]){$yy=$this->y+29;foreach($this->wrap($p,241,9.3) as $l){$this->text($xx,$yy,$l,9.3);$yy+=13;}}
        $this->finishPage();return $this->render();
    }
    public function buildDocument(string $title,string $content,array $meta=[]):string {
        $this->label='DOCUMENTO';
        if(is_file($meta['logo']??'')){$this->jpeg=file_get_contents($meta['logo']);$sz=getimagesize($meta['logo']);$this->imageSize=[$sz[0],$sz[1]];}
        $this->newPage();$this->y=74;
        foreach($this->wrap($title,504,18,true) as $line){$this->ensure(26);$this->text(54,$this->y,$line,18,true,$this->navy);$this->y+=25;}
        $this->y+=12;
        foreach($this->wrap('Registro da conversa. Emissão: '.date('d/m/Y H:i').' UTC. Fontes e revisões: '.($meta['sources']??''),504,8) as $line){$this->ensure(14);$this->text(54,$this->y,$line,8,false,$this->muted);$this->y+=13;}
        $this->y+=14;
        foreach(preg_split('/\R/u',$content)?:[] as $paragraph){
            foreach($this->wrap($paragraph,504,10) as $line){$this->ensure(15);$this->text(54,$this->y,$line,10);$this->y+=15;}
            $this->y+=5;
        }
        $this->finishPage();return $this->render();
    }
    private function render():string {
        $objs=[1=>'<< /Type /Catalog /Pages 2 0 R >>',3=>'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',4=>'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];$n=5;$img='';
        if($this->jpeg!==null){$id=$n++;$img='/XObject << /Logo '.$id.' 0 R >>';$objs[$id]='<< /Type /XObject /Subtype /Image /Width '.$this->imageSize[0].' /Height '.$this->imageSize[1].' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '.strlen($this->jpeg).">>\nstream\n".$this->jpeg."\nendstream";}
        $kids=[];foreach($this->pages as $stream){$p=$n++;$c=$n++;$kids[]="$p 0 R";
            $objs[$p]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> $img >> /Contents $c 0 R >>";
            $stream=gzcompress($stream);$objs[$c]='<< /Filter /FlateDecode /Length '.strlen($stream).">>\nstream\n".$stream."\nendstream";
        }
        $objs[2]='<< /Type /Pages /Count '.count($kids).' /Kids ['.implode(' ',$kids).'] >>';ksort($objs);$pdf="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";$offset=[0=>0];
        foreach($objs as $id=>$obj){$offset[$id]=strlen($pdf);$pdf.="$id 0 obj\n$obj\nendobj\n";}
        $at=strlen($pdf);$max=max(array_keys($objs));$pdf.="xref\n0 ".($max+1)."\n0000000000 65535 f \n";
        for($i=1;$i<=$max;$i++)$pdf.=sprintf("%010d 00000 n \n",$offset[$i]);
        return $pdf."trailer\n<< /Size ".($max+1)." /Root 1 0 R >>\nstartxref\n$at\n%%EOF";
    }
}
