/* ========= Gerador de Documentos — JS compartilhado =========
   Módulo isolado para não interferir no app atual.
   Pastinha sugerida: /docs/
*/

const DOCS_USER_KEY = "usuarioDocsLogado";

// ------- helpers UI
function toastOK(msg){
  Swal.fire({icon:"success",title:msg, timer:1500, showConfirmButton:false});
}
function toastWarn(msg){
  Swal.fire({icon:"warning",title:msg, timer:1800, showConfirmButton:false});
}
function needLogin(){
  Swal.fire({icon:"error",title:"Faça login novamente"})
    .then(()=>location.href="login_docs.html");
}

// ------- LOGIN
async function initDocsLogin(){
  const sel = document.getElementById("usuarioDocs");
  const form = document.getElementById("loginDocsForm");
  if(!sel || !form) return;

  // carrega usuários do módulo docs
  try{
    const resp = await fetch("usuarios_docs.json");
    const users = await resp.json();

    users.forEach(u=>{
      const opt = document.createElement("option");
      opt.value = u.Email; opt.textContent = u.Nome;
      sel.appendChild(opt);
    });

    form.addEventListener("submit", (e)=>{
      e.preventDefault();
      const email = sel.value;
      const senha = document.getElementById("senhaDocs").value;
      const ok = users.find(u => u.Email.toLowerCase().trim()===email.toLowerCase().trim() && u.Senha===senha);
      if(ok){
        localStorage.setItem(DOCS_USER_KEY, JSON.stringify(ok));
        toastOK("Login realizado!");
        setTimeout(()=>location.href="menu_docs.html", 800);
      }else{
        Swal.fire({icon:"error",title:"Usuário ou senha inválidos!"});
      }
    });

  }catch(err){
    console.error(err);
    Swal.fire({icon:"error",title:"Falha ao carregar usuários do módulo."});
  }
}

// ------- MENU
function initDocsMenu(){
  const who = JSON.parse(localStorage.getItem(DOCS_USER_KEY)||"null");
  if(!who){ needLogin(); return; }
  const whoEl = document.getElementById("whoDocs");
  if(whoEl) whoEl.textContent = `${who.Nome} — ${who.Email}`;

  const goProposta = document.getElementById("goProposta");
  const goContrato = document.getElementById("goContrato");
  const goOS = document.getElementById("goOS");

  goProposta?.addEventListener("click", ()=>{
    // por ora, só placeholder
    Swal.fire({
      icon:"info",
      title:"Em construção",
      text:"Tela de Proposta ainda em construção.",
      confirmButtonText:"Ok"
    });
  });

  goContrato?.addEventListener("click", ()=> location.href="contrato.html");

  goOS?.addEventListener("click", ()=>{
    Swal.fire({
      icon:"info",
      title:"Em construção",
      text:"Tela de Ordem de Serviço ainda em construção.",
      confirmButtonText:"Ok"
    });
  });
}

// ------- CONTRATO (verificação de código + modal)
function initDocsContrato(){
  const who = JSON.parse(localStorage.getItem(DOCS_USER_KEY)||"null");
  if(!who){ needLogin(); return; }
  const whoEl = document.getElementById("whoDocs");
  if(whoEl) whoEl.textContent = `${who.Nome} — ${who.Email}`;

  const form = document.getElementById("formCodigo");
  const inp = document.getElementById("codigoContrato");
  if(!form || !inp) return;

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const codigo = (inp.value||"").trim().toUpperCase();
    if(!codigo){
      toastWarn("Informe um código.");
      return;
    }

    try{
      const r = await fetch("contratos.json?ts=" + Date.now());
      const contratos = await r.json();

      const item = contratos.find(c=> (c.codigo||"").toUpperCase() === codigo);
      if(item){
        // contrato existe → seguir para o formulário (placeholder)
        Swal.fire({
          icon:"success",
          title:"Contrato encontrado",
          html:`Status: <b>${item.status||"desconhecido"}</b><br/>Cliente: <b>${item.cliente||"-"}</b>`,
          confirmButtonText:"Continuar"
        }).then(()=>{
          // aqui você direcionará para a próxima tela (ex.: contrato_form.html?c=AC054825)
          console.log("Ir para o form do contrato:", codigo);
        });
      }else{
        // não existe → pergunta se deseja criar
        Swal.fire({
          icon:"warning",
          title:"Contrato não existe",
          text:"Deseja cadastrar um novo com este código?",
          showCancelButton:true,
          confirmButtonText:"Sim",
          cancelButtonText:"Não"
        }).then(({isConfirmed})=>{
          if(isConfirmed){
            // seguir para cadastro (placeholder)
            Swal.fire({
              icon:"info",
              title:"Iniciando novo contrato",
              text:`Código: ${codigo}`
            }).then(()=>{
              console.log("Ir para o cadastro do contrato:", codigo);
            });
          }else{
            inp.focus(); inp.select();
          }
        });
      }

    }catch(err){
      console.error(err);
      Swal.fire({icon:"error",title:"Falha ao consultar contratos."});
    }
  });
}
