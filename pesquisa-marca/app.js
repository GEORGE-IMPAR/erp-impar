(() => {
 const C = window.IMPAR_SURVEY_CONFIG || {};
 const steps = ["intro","profile","sites","video","logos","final","thanks"];
 let current = 0, watched=0, lastVideoTime=0;
 const data = {
   version:C.VERSION||"V0",
   started_at:new Date().toISOString(),
   order:{},
   respondent:{},
   answers:{site:{},video:{},logo:{},final:{}},
   meta:{screen:`${screen.width}x${screen.height}`, user_agent:navigator.userAgent}
 };
 const rnd = () => Math.random() < .5;
 data.order.site = rnd() ? {A:"current",B:"proposed"} : {A:"proposed",B:"current"};
 data.order.logo = rnd() ? {A:"current",B:"proposed"} : {A:"proposed",B:"current"};

 const siteQ = [
  ["trust","Qual transmite mais confiança?"],
  ["modern","Qual parece mais moderna e atual?"],
  ["engineering","Qual comunica melhor engenharia e capacidade técnica?"],
  ["size","Qual parece uma empresa mais estruturada e preparada para projetos de maior porte?"],
  ["clarity","Qual explica melhor o que a empresa faz?"],
  ["contact","Se você precisasse contratar hoje, qual delas teria maior chance de gerar contato?"]
 ];
 const logoQ = [
  ["trust","Confiança"],
  ["modern","Modernidade"],
  ["engineering","Engenharia / capacidade técnica"],
  ["technology","Tecnologia"],
  ["premium","Sofisticação / percepção premium"],
  ["size","Porte / estrutura"],
  ["memorable","Memorabilidade"],
  ["fit","Representa melhor a empresa mostrada no vídeo"]
 ];

 function optionChoice(group,key,title){
   return `<div class="q"><div class="q-title">${title}</div><div class="choices">
     ${["A","B","Igual"].map(v=>`<label class="choice"><input type="radio" name="${group}_${key}" value="${v}"><span>${v==="Igual"?"Sem diferença":`Opção ${v}`}</span></label>`).join("")}
   </div></div>`;
 }
 document.querySelector("#siteQuestions").innerHTML = siteQ.map(q=>optionChoice("site",...q)).join("");
 document.querySelector("#logoQuestions").innerHTML = logoQ.map(q=>optionChoice("logo",...q)).join("");

 document.querySelectorAll("[data-scale]").forEach(el=>{
   const key=el.dataset.scale;
   el.innerHTML=Array.from({length:11},(_,i)=>`<label><input type="radio" name="${key}" value="${i}"><span>${i}</span></label>`).join("");
 });

 function siteCard(letter,kind){
   const url = kind==="current" ? C.SITE_CURRENT_URL : C.SITE_PROPOSED_URL;
   return `<article class="option">
      <div class="option-head"><span class="option-tag">OPÇÃO ${letter}</span><button class="option-open" onclick="window.open('${url}','_blank','noopener')">Abrir em nova aba ↗</button></div>
      <div class="site-frame"><iframe src="${url}" title="Opção ${letter}" loading="lazy"></iframe><div class="frame-hint">Navegue pela opção ${letter}. Se o site atual bloquear a visualização incorporada, abra em nova aba.</div></div>
   </article>`;
 }
 document.querySelector("#siteCompare").innerHTML = siteCard("A",data.order.site.A)+siteCard("B",data.order.site.B);

 function logoCard(letter,kind){
   const src = kind==="current" ? "./assets/logo_atual.png" : "./assets/logo_proposta.png";
   return `<article class="option"><div class="option-head"><span class="option-tag">OPÇÃO ${letter}</span></div><div class="logo-stage"><img src="${src}" alt="Logo opção ${letter}"></div></article>`;
 }
 document.querySelector("#logoCompare").innerHTML = logoCard("A",data.order.logo.A)+logoCard("B",data.order.logo.B);

 const video=document.querySelector("#institutionalVideo");
 video.src=C.VIDEO_URL;
 video.addEventListener("timeupdate",()=>{
   const t=video.currentTime||0;
   if(t>lastVideoTime && t-lastVideoTime<2) watched += (t-lastVideoTime);
   lastVideoTime=t;
   document.querySelector("#watchInfo").textContent=`Tempo assistido: ${Math.round(watched)}s`;
 });

 function radioVal(name){ return document.querySelector(`input[name="${name}"]:checked`)?.value ?? null; }
 function collect(){
   data.respondent.role=document.querySelector("#role").value;
   data.respondent.familiarity=document.querySelector("#familiarity").value;
   siteQ.forEach(([k])=>data.answers.site[k]=radioVal(`site_${k}`));
   logoQ.forEach(([k])=>data.answers.logo[k]=radioVal(`logo_${k}`));
   data.answers.video.complexity=radioVal("video_complexity");
   data.answers.video.trust=radioVal("video_trust");
   data.answers.video.words=document.querySelector("#video_words").value.trim();
   data.answers.video.watched_seconds=Math.round(watched);
   data.answers.final.consideration=radioVal("consideration");
   data.answers.final.phrase=document.querySelector("#final_phrase").value.trim();
   data.answers.final.comment=document.querySelector("#final_comment").value.trim();
 }
 function validStep(){
   collect();
   if(current===1 && (!data.respondent.role || !data.respondent.familiarity)){alert("Selecione seu perfil e o quanto conhece a IMPAR.");return false;}
   if(current===2){
     const missing=siteQ.some(([k])=>!data.answers.site[k]); if(missing){alert("Responda todas as comparações do site.");return false;}
   }
   if(current===3 && (!data.answers.video.complexity || !data.answers.video.trust)){alert("Dê uma nota às duas perguntas após o vídeo.");return false;}
   if(current===4){
     const missing=logoQ.some(([k])=>!data.answers.logo[k]); if(missing){alert("Responda todos os atributos das logos.");return false;}
   }
   if(current===5 && data.answers.final.consideration===null){alert("Informe a nota de consideração da IMPAR.");return false;}
   return true;
 }
 function render(){
   document.querySelector("#intro").style.display=current===0?"block":"none";
   document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.dataset.screen===steps[current]));
   const labels=["Início","Perfil","Sites","Vídeo","Logos","Fechamento","Concluído"];
   document.querySelector("#stepLabel").textContent=labels[current];
   document.querySelector("#progress").style.width=`${Math.min(100,(current/(steps.length-1))*100)}%`;
   scrollTo({top:0,behavior:"smooth"});
 }
 document.addEventListener("click",e=>{
   if(e.target.closest("[data-next]")){ if(current>0 && !validStep()) return; current=Math.min(steps.length-1,current+1); render(); }
   if(e.target.closest("[data-prev]")){ current=Math.max(0,current-1); render(); }
 });

 document.querySelector("#submitSurvey").addEventListener("click",async()=>{
   if(!validStep()) return;
   collect(); data.completed_at=new Date().toISOString();
   const box=document.querySelector("#submitStatus");
   const btn=document.querySelector("#submitSurvey");
   btn.disabled=true; box.className="status"; box.style.display="block"; box.textContent="Enviando respostas...";
   try{
     const r=await fetch(`${C.API_BASE}/submit.php`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
     const j=await r.json();
     if(!r.ok||!j.ok) throw new Error(j.error||"Falha ao enviar");
     box.className="status ok"; box.textContent="Resposta registrada.";
     current=6; render();
   }catch(err){
     box.className="status error"; box.textContent="Não foi possível registrar no servidor. Verifique a URL da API e tente novamente.";
     btn.disabled=false;
   }
 });
 render();
})();