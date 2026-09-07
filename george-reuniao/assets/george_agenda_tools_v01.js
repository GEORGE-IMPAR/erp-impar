/* GEORGE -> Agenda do Dia V2 capabilities — teste V0.1 */
(() => {
  const CAP_URL='https://api.erpimpar.com.br/db-v2/agenda/capability.php';
  const DEFAULT_DATE='2026-09-07';
  const KEY='ERPIMPAR_USER';
  let toolsInstalled=false;

  function getEmail(){
    try{
      const u=JSON.parse(localStorage.getItem(KEY)||sessionStorage.getItem(KEY)||'null')||{};
      return u.email||u.Email||'george@imparsistemas.com';
    }catch(e){ return 'george@imparsistemas.com'; }
  }

  const tools=[
    {type:'function',name:'agenda_consultar',description:'Consulta a Agenda do Dia no ERP ÍMPAR. Use para perguntas sobre atividades, estado do dia e itens.',parameters:{type:'object',properties:{data:{type:'string',description:'Data YYYY-MM-DD. Se omitida, usar o dia em contexto.'}},additionalProperties:false}},
    {type:'function',name:'agenda_adicionar_atividade',description:'Adiciona uma atividade manual/replanejada à Agenda do Dia aberta. Atividade manual fica roxa. Não peça confirmação para edição comum.',parameters:{type:'object',properties:{data:{type:'string'},colaborador_id:{type:'integer'},atividade:{type:'string'},obra_id:{type:['integer','null']},obra_texto:{type:['string','null']},local:{type:['string','null']},viagem:{type:'boolean'}},required:['colaborador_id','atividade'],additionalProperties:false}},
    {type:'function',name:'agenda_cancelar_atividade',description:'Cancela uma atividade. Se semanal, permanece como evidência vermelha. Se manual/replanejada, desaparece do dia.',parameters:{type:'object',properties:{data:{type:'string'},item_id:{type:'integer'}},required:['item_id'],additionalProperties:false}},
    {type:'function',name:'agenda_restaurar_atividade',description:'Restaura uma atividade semanal cancelada; volta ao estado natural verde ou laranja.',parameters:{type:'object',properties:{data:{type:'string'},item_id:{type:'integer'}},required:['item_id'],additionalProperties:false}},
    {type:'function',name:'agenda_desfazer',description:'Desfaz a última alteração ainda não salva da Agenda do Dia. É o mesmo conceito do Ctrl+Z.',parameters:{type:'object',properties:{data:{type:'string'}},additionalProperties:false}},
    {type:'function',name:'agenda_salvar_rascunho',description:'Salva exatamente o estado atual e cria um novo checkpoint. Não finaliza, não fecha e não navega.',parameters:{type:'object',properties:{data:{type:'string'}},additionalProperties:false}}
  ];

  function installTools(){
    if(toolsInstalled) return;
    if(typeof dc==='undefined' || !dc || dc.readyState!=='open') return;
    try{
      sendEvent({type:'session.update',session:{
        tools,
        tool_choice:'auto',
        instructions:'Você é George, assistente do ERP ÍMPAR. Para Agenda do Dia use as ferramentas oficiais. Nunca simule que executou algo: só confirme após retorno ok da ferramenta. Edições comuns do rascunho não pedem confirmação e podem ser desfeitas. Salvar é checkpoint e não finaliza. Nunca crie o próximo dia se o anterior estiver aberto.'
      }});
      toolsInstalled=true;
    }catch(e){ console.warn('agenda tools',e); }
  }

  setInterval(installTools,400);

  async function callCap(action,args){
    const data=args?.data||DEFAULT_DATE;
    const r=await fetch(CAP_URL,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,email:getEmail(),data,args,origem_acao:'GEORGE'})});
    const j=await r.json().catch(()=>({ok:false,status:'RESPOSTA_INVALIDA'}));
    return j;
  }

  const map={
    agenda_consultar:'consultar',
    agenda_adicionar_atividade:'adicionarAtividade',
    agenda_cancelar_atividade:'cancelarAtividade',
    agenda_restaurar_atividade:'restaurarAtividade',
    agenda_desfazer:'desfazer',
    agenda_salvar_rascunho:'salvarRascunho'
  };

  if(typeof handleEvent==='function'){
    const original=handleEvent;
    handleEvent=async function(evt){
      try{
        if(evt?.type==='response.function_call_arguments.done' && map[evt.name]){
          const args=JSON.parse(evt.arguments||'{}');
          const result=await callCap(map[evt.name],args);
          sendEvent({type:'conversation.item.create',item:{type:'function_call_output',call_id:evt.call_id,output:JSON.stringify(result)}});
          sendEvent({type:'response.create'});
          return;
        }
      }catch(e){
        console.warn('agenda tool call',e);
      }
      return original(evt);
    };
  }
})();