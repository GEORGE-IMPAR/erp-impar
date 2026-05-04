const API_BASE = "https://api.erpimpar.com.br/empreiteiros";
const API_OBRAS = "https://api.erpimpar.com.br/cronograma/listar_obras.php";

if (window.Swal && Swal.mixin) {
  window.Swal = Swal.mixin({
    customClass: {
      popup: "impar-swal",
      confirmButton: "impar-swal-confirm",
      cancelButton: "impar-swal-cancel"
    },
    buttonsStyling: false
  });
}

const estado = {
  contratoId: null,
  itens: [],
  medicoes: [],
  pagos: 0,
  empreiteiros: [],
  contratoCarregado: null
};

function moeda(n) {
  return Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function parseMoeda(v) {
  if (typeof v === "number") return v;
  return Number(
    String(v || "0")
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  ) || 0;
}

function val(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

function dataISOHoje() {
  return new Date().toISOString().slice(0, 10);
}

function abrirCalendario(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.showPicker) el.showPicker();
  else el.focus();
}

function dataPorExtenso(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

function atualizarDataExtenso() {
  const el = document.getElementById("dataExtenso");
  if (el) el.value = dataPorExtenso(val("dataContrato"));
}

function valorPorExtensoBRL(valor) {
  valor = Math.round(Number(valor || 0));

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function ate999(n) {
    if (n === 0) return "";
    if (n === 100) return "cem";

    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    const partes = [];

    if (c) partes.push(centenas[c]);

    if (d === 1) {
      partes.push(especiais[u]);
    } else {
      if (d) partes.push(dezenas[d]);
      if (u) partes.push(unidades[u]);
    }

    return partes.filter(Boolean).join(" e ");
  }

  if (valor === 0) return "zero real";

  const milhoes = Math.floor(valor / 1000000);
  const milhares = Math.floor((valor % 1000000) / 1000);
  const resto = valor % 1000;
  const partes = [];

  if (milhoes) partes.push(milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`);
  if (milhares) partes.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto) partes.push(ate999(resto));

  return partes.join(" e ") + (valor === 1 ? " real" : " reais");
}

function onValorContrato() {
  const v = parseMoeda(val("valorContrato"));
  const el = document.getElementById("valorExtenso");
  if (el) el.value = valorPorExtensoBRL(v);
  atualizarResumo();
  renderExtrato();
}

function formatarValorContrato() {
  const el = document.getElementById("valorContrato");
  if (!el) return;
  el.value = moeda(parseMoeda(el.value));
  onValorContrato();
}

function novoItem() {
  return {
    id: estado.itens.length + 1,
    descricao: "",
    quantidade: 100,
    valorUnitario: 0,
    valorTotal: 0,
    percentualMedido: 0
  };
}

function adicionarItem(foco) {
  estado.itens.push(novoItem());
  renderItens();

  if (foco) {
    const inputs = document.querySelectorAll("#itensBody tr:last-child input:not([readonly])");
    if (inputs[0]) inputs[0].focus();
  }
}

function removerItem(idx) {
  estado.itens.splice(idx, 1);
  estado.itens.forEach((it, i) => it.id = i + 1);
  renderItens();
}

function renderItens() {
  const body = document.getElementById("itensBody");
  if (!body) return;

  body.innerHTML = "";

  estado.itens.forEach((it, idx) => {
    const saldo = Math.max(0, 100 - (Number(it.percentualMedido) || 0));
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input value="${it.id}" readonly></td>
      <td><input value="${it.descricao || ""}" placeholder="Descrição" data-field="descricao"></td>
      <td><input value="${it.quantidade || 100}" placeholder="100%" data-field="quantidade"></td>
      <td><input value="${it.valorUnitario ? moeda(it.valorUnitario) : ""}" placeholder="Valor unitário" data-field="valorUnitario"></td>
      <td><input value="${moeda(it.valorTotal)}" readonly></td>
      <td><input value="${saldo.toFixed(2).replace(".", ",")}%" readonly></td>
      <td><button class="remove-btn" onclick="removerItem(${idx})" type="button">×</button></td>
    `;

    tr.querySelectorAll("input[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.field;

        if (field === "descricao") it.descricao = input.value;
        if (field === "quantidade") it.quantidade = parseMoeda(input.value);
        if (field === "valorUnitario") it.valorUnitario = parseMoeda(input.value);

        it.valorTotal = (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0);
        atualizarLinha(tr, it);
        atualizarResumo();
      });

      input.addEventListener("blur", () => {
        const field = input.dataset.field;
        if (field === "valorUnitario") input.value = it.valorUnitario ? moeda(it.valorUnitario) : "";
      });
    });

    body.appendChild(tr);
  });

  bindTabelaTab();
  atualizarResumo();
}

function atualizarLinha(tr, it) {
  const readonlys = tr.querySelectorAll("input[readonly]");
  if (readonlys[1]) readonlys[1].value = moeda(it.valorTotal);
}

function bindTabelaTab() {
  document.querySelectorAll("#itensBody tr").forEach((tr) => {
    const inputs = tr.querySelectorAll("input:not([readonly])");

    inputs.forEach((inp, pos) => {
      inp.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          adicionarItem(true);
          return;
        }

        if (e.key === "Tab" && !e.shiftKey && pos === inputs.length - 1) {
          e.preventDefault();
          adicionarItem(true);
        }
      };
    });
  });
}

function atualizarResumo() {
  const totalItens = estado.itens.reduce((s, it) => s + (Number(it.valorTotal) || 0), 0);
  const valorTopo = parseMoeda(val("valorContrato"));
  const totalContrato = valorTopo || totalItens;

  const totalMedido = estado.itens.reduce((s, it) => {
    return s + ((Number(it.valorTotal) || 0) * (Number(it.percentualMedido) || 0) / 100);
  }, 0);

  const saldo = totalContrato - totalMedido;
  const percSaldo = totalContrato ? Math.max(0, 100 - (totalMedido / totalContrato * 100)) : 100;

  document.getElementById("kpiContrato").textContent = moeda(totalContrato);
  document.getElementById("kpiMedido").textContent = moeda(totalMedido);
  document.getElementById("kpiPago").textContent = moeda(estado.pagos);
  document.getElementById("kpiSaldo").textContent = moeda(saldo);
  document.getElementById("kpiSaldoPerc").textContent = percSaldo.toFixed(1).replace(".", ",") + "%";
}

function abrirModal(id) {
  document.getElementById(id)?.setAttribute("aria-hidden", "false");
}

function fecharModal(id) {
  document.getElementById(id)?.setAttribute("aria-hidden", "true");
}

function abrirEmpreiteiro() {
  abrirModal("modalEmpreiteiro");
}

async function salvarEmpreiteiro() {
  const dados = {
    nome: val("empNome") || "Novo empreiteiro",
    contato: val("empContato"),
    cpf_contato: val("empCpfContato"),
    telefone: val("empTelefone"),
    cep: val("empCep"),
    cpf_cnpj: val("empDoc"),
    documento: val("empDoc"),
    logradouro: val("empLogradouro"),
    endereco: `${val("empLogradouro")}${val("empNumero") ? ", " + val("empNumero") : ""}${val("empBairro") ? " - " + val("empBairro") : ""}`,
    numero: val("empNumero"),
    bairro: val("empBairro"),
    cidade: val("empCidade"),
    uf: val("empUf"),
    complemento: val("empComplemento"),
    email: val("empEmail"),
    assinatura_nome: val("empContato") || val("empNome")
  };

  try {
    await post(`${API_BASE}/salvar_empreiteiro.php`, dados);
  } catch (e) {
    console.warn(e);
  }

  const select = document.getElementById("empreiteiro");
  const opt = document.createElement("option");
  opt.textContent = dados.nome;
  opt.value = dados.nome;
  opt.dataset.raw = JSON.stringify(dados);
  select.appendChild(opt);
  select.value = dados.nome;

  fecharModal("modalEmpreiteiro");

  Swal.fire({
    icon: "success",
    title: "Empreiteiro cadastrado",
    text: "Cadastro adicionado e selecionado no contrato."
  });
}

function abrirMedicao() {
  if (!estado.itens.length) {
    Swal.fire({
      icon: "warning",
      title: "Sem itens",
      text: "Adicione pelo menos um item na tabela base."
    });
    return;
  }

  document.getElementById("dataMedicao").value = dataISOHoje();

  const body = document.getElementById("medicaoBody");
  body.innerHTML = "";

  estado.itens.forEach((it, idx) => {
    const ja = Number(it.percentualMedido) || 0;
    const saldoPerc = Math.max(0, 100 - ja);
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${it.id}</td>
      <td>${it.descricao || "—"}</td>
      <td>${moeda(it.valorTotal)}</td>
      <td>${ja.toFixed(2).replace(".", ",")}%</td>
      <td><input type="number" min="0" max="${saldoPerc}" step="0.01" value="0" data-med-idx="${idx}"></td>
      <td class="valor-med">${moeda(0)}</td>
      <td class="saldo-med">${moeda((it.valorTotal || 0) * (saldoPerc / 100))}</td>
    `;

    body.appendChild(tr);
  });

  body.querySelectorAll("input[data-med-idx]").forEach(inp => {
    inp.addEventListener("input", calcularMedicaoModal);
  });

  calcularMedicaoModal();
  abrirModal("modalMedicao");
}

function calcularMedicaoModal() {
  let total = 0;

  document.querySelectorAll("#medicaoBody tr").forEach(tr => {
    const idx = Number(tr.querySelector("input[data-med-idx]").dataset.medIdx);
    const it = estado.itens[idx];
    const ja = Number(it.percentualMedido) || 0;
    const saldoPerc = Math.max(0, 100 - ja);

    let p = Number(tr.querySelector("input[data-med-idx]").value) || 0;
    if (p > saldoPerc) p = saldoPerc;

    const valorMed = (Number(it.valorTotal) || 0) * p / 100;
    const saldoApos = (Number(it.valorTotal) || 0) * Math.max(0, saldoPerc - p) / 100;

    tr.querySelector(".valor-med").textContent = moeda(valorMed);
    tr.querySelector(".saldo-med").textContent = moeda(saldoApos);

    total += valorMed;
  });

  document.getElementById("totalMedicaoAtual").textContent = moeda(total);
}

async function confirmarMedicao() {
  const data = val("dataMedicao") || dataISOHoje();
  const obs = val("obsMedicao");
  const itensMedidos = [];
  const extrato = [];
  let total = 0;

  document.querySelectorAll("#medicaoBody tr").forEach(tr => {
    const idx = Number(tr.querySelector("input[data-med-idx]").dataset.medIdx);
    const it = estado.itens[idx];

    let p = Number(tr.querySelector("input[data-med-idx]").value) || 0;
    const saldoPercAntes = Math.max(0, 100 - (Number(it.percentualMedido) || 0));

    if (p > saldoPercAntes) p = saldoPercAntes;

    const valor = (Number(it.valorTotal) || 0) * p / 100;

    if (p > 0) {
      it.percentualMedido = (Number(it.percentualMedido) || 0) + p;
      const saldoPercDepois = Math.max(0, 100 - (Number(it.percentualMedido) || 0));
      const saldoValorDepois = (Number(it.valorTotal) || 0) * saldoPercDepois / 100;

      total += valor;

      const linha = {
        data,
        item: it.id,
        descricao: it.descricao,
        percentual: p,
        valor,
        percentual_acumulado: it.percentualMedido,
        saldo_percentual: saldoPercDepois,
        saldo_valor: saldoValorDepois
      };

      itensMedidos.push(linha);
      extrato.push(linha);
    }
  });

  if (!itensMedidos.length) {
    Swal.fire({
      icon: "warning",
      title: "Medição zerada",
      text: "Informe pelo menos um percentual realizado."
    });
    return;
  }

  const medicao = {
    id: "MED-" + String(estado.medicoes.length + 1).padStart(3, "0"),
    data,
    data_sistema: new Date().toISOString(),
    obs,
    total,
    itens: itensMedidos,
    extrato,
    notificacao: {
      diretoria: true,
      financeiro: true,
      whatsapp_pendente: true
    }
  };

  estado.medicoes.push(medicao);

  let resp = null;

  try {
    resp = await post(`${API_BASE}/salvar_medicao.php`, {
      contrato: montarPayload(),
      medicao
    });
  } catch (e) {
    console.warn(e);
  }

  fecharModal("modalMedicao");
  renderItens();
  renderExtrato();

  const relatorioUrl = resp?.relatorio_url || `${API_BASE}/relatorio_medicao.php?contrato_id=${encodeURIComponent(estado.contratoId || "")}&medicao_id=${encodeURIComponent(medicao.id)}`;

  Swal.fire({
    icon: "success",
    title: "Medição registrada",
    html: `
      Histórico gravado.<br><br>
      <b>Total a pagar:</b> ${moeda(total)}<br><br>
      <button class="impar-swal-confirm" onclick="window.open('${relatorioUrl}','_blank')">Abrir relatório</button>
      <button class="impar-swal-confirm" onclick="compartilharMedicao('${medicao.id}')">Compartilhar</button>
    `,
    showConfirmButton: true,
    confirmButtonText: "OK"
  });
}

function renderExtrato() {
  const body = document.getElementById("extratoBody");
  if (!body) return;

  const linhas = [];

  estado.medicoes.forEach(m => {
    (m.itens || []).forEach(it => {
      linhas.push({
        medicao: m.id,
        data: m.data,
        item: it.item,
        descricao: it.descricao,
        percentual: it.percentual,
        valor: it.valor,
        saldo_valor: it.saldo_valor
      });
    });
  });

  if (!linhas.length) {
    body.innerHTML = `<tr><td colspan="7">Nenhuma medição registrada.</td></tr>`;
    return;
  }

  body.innerHTML = "";

  linhas.forEach(l => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${l.data || "—"}</td>
      <td>${l.medicao || "—"}</td>
      <td>${l.item || "—"}</td>
      <td>${l.descricao || "—"}</td>
      <td>${Number(l.percentual || 0).toFixed(2).replace(".", ",")}%</td>
      <td>${moeda(l.valor || 0)}</td>
      <td>${moeda(l.saldo_valor || 0)}</td>
    `;
    body.appendChild(tr);
  });
}

async function compartilharMedicao(medicaoId) {
  const medicao = estado.medicoes.find(m => m.id === medicaoId);
  if (!medicao) return;

  const linhas = (medicao.itens || []).map(i =>
    `Item ${i.item} - ${i.descricao}: ${Number(i.percentual || 0).toFixed(2).replace(".", ",")}% = ${moeda(i.valor || 0)}`
  ).join("\\n");

  const texto = `Medição ${medicao.id}\\nData: ${medicao.data}\\nEmpreiteiro: ${val("empreiteiro")}\\nObra: ${val("obra")}\\n\\n${linhas}\\n\\nTotal a pagar: ${moeda(medicao.total)}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Medição ${medicao.id}`,
        text: texto
      });
      return;
    } catch(e) {}
  }

  const url = "https://wa.me/?text=" + encodeURIComponent(texto);
  window.open(url, "_blank");
}

function getEmpreiteiroSelecionadoObj() {
  const sel = document.getElementById("empreiteiro");
  const opt = sel?.selectedOptions?.[0];
  if (!opt) return {};
  try {
    return JSON.parse(opt.dataset.raw || "{}");
  } catch (e) {
    return {};
  }
}

function montarPayload() {
  const totalMedido = estado.itens.reduce((s, it) => {
    return s + ((Number(it.valorTotal) || 0) * (Number(it.percentualMedido) || 0) / 100);
  }, 0);

  const valorContrato = parseMoeda(val("valorContrato"));
  const empObj = getEmpreiteiroSelecionadoObj();

  return {
    id: estado.contratoId || null,
    obra: val("obra"),
    obra_nome: val("obra"),
    empreiteiro: val("empreiteiro"),
    empreiteiro_nome: empObj.nome || val("empreiteiro"),
    empreiteiro_documento: empObj.documento || empObj.cpf_cnpj || "",
    empreiteiro_endereco: empObj.endereco || empObj.logradouro || "",
    empreiteiro_cidade: empObj.cidade || "",
    empreiteiro_uf: empObj.uf || "",
    empreiteiro_assinatura_nome: empObj.assinatura_nome || empObj.contato || empObj.nome || val("empreiteiro"),
    cidade_contrato: "São José",
    escopo: val("escopoServico") || val("condicoesPagamento"),
    condicoes_pagamento: val("condicoesPagamento"),
    criterios_preco: val("criteriosPreco"),
    valor_contrato: valorContrato,
    valor_contrato_formatado: moeda(valorContrato).replace("R$ ", "").replace("R$ ", ""),
    valor_extenso: val("valorExtenso"),
    data: val("dataContrato"),
    data_extenso: val("dataExtenso"),
    prazo_dias: Number(val("prazoDias")) || 0,
    itens: estado.itens,
    medicoes: estado.medicoes,
    conta_corrente: {
      total_contrato: valorContrato,
      total_medido: totalMedido,
      total_pago: estado.pagos,
      saldo: valorContrato - totalMedido
    },
    meta: {
      criado_em: estado.contratoCarregado?.meta?.criado_em || new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      origem: "contrato_empreiteiro_v7_template_original"
    }
  };
}

async function post(url, data) {
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(data)
  });

  const txt = await res.text();
  let js = {};

  try {
    js = JSON.parse(txt);
  } catch (e) {
    throw new Error(txt || "Resposta inválida da API");
  }

  if (!res.ok || js.success === false || js.ok === false) {
    throw new Error(js.error || js.erro || txt || "Erro no servidor");
  }

  return js;
}

function baixarContratoPorId(id) {
  if (!id) return;
  window.open(`${API_BASE}/gerar_contrato_por_id.php?id=${encodeURIComponent(id)}`, "_blank");
}

async function atualizarContrato() {
  const payload = montarPayload();

  if (!estado.contratoId) {
    Swal.fire({
      icon: "warning",
      title: "Nenhum contrato carregado",
      text: "Para atualizar, primeiro carregue um contrato salvo ou gere um contrato novo."
    });
    return;
  }

  try {
    const resp = await post(`${API_BASE}/salvar_contrato.php`, payload);

    Swal.fire({
      icon: "success",
      title: "Contrato atualizado",
      html: `JSON atualizado com sucesso.<br><br><b>ID:</b> ${resp.id || estado.contratoId}`
    });
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Erro ao atualizar contrato",
      text: e.message
    });
  }
}

async function gerarContrato() {
  const payload = montarPayload();

  if (!payload.obra || !payload.empreiteiro) {
    Swal.fire({
      icon: "warning",
      title: "Dados incompletos",
      text: "Informe obra e empreiteiro antes de gerar o contrato."
    });
    return;
  }

  try {
    const resp = await post(`${API_BASE}/salvar_contrato.php`, payload);
    const id = resp.id || payload.id;

    estado.contratoId = id;

    Swal.fire({
      icon: "success",
      title: "Contrato salvo",
      html: `JSON gravado com sucesso.<br><br><b>ID:</b> ${id}<br><br>Iniciando download do contrato no template original...`
    });

    setTimeout(() => {
      baixarContratoPorId(id);
    }, 600);

  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Erro ao salvar contrato",
      text: e.message
    });
  }
}

async function abrirContratosSalvos() {
  const body = document.getElementById("contratosSalvosBody");

  if (!body) {
    Swal.fire({
      icon: "error",
      title: "Modal não encontrado",
      text: "O modal de contratos salvos não está no index.html."
    });
    return;
  }

  body.innerHTML = `
    <tr>
      <td colspan="6">Carregando contratos salvos...</td>
    </tr>
  `;

  abrirModal("modalContratosSalvos");

  try {
    const res = await fetch(`${API_BASE}/listar_contratos.php?t=${Date.now()}`);
    const js = await res.json();

    const contratos = js.contratos || [];

    if (!contratos.length) {
      body.innerHTML = `
        <tr>
          <td colspan="6">Nenhum contrato salvo encontrado.</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = "";

    contratos.forEach(c => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${c.id || "—"}</td>
        <td>${c.obra || "—"}</td>
        <td>${c.empreiteiro || "—"}</td>
        <td>${moeda(c.valor_contrato || 0)}</td>
        <td>${c.data_extenso || c.data || "—"}</td>
        <td style="white-space:nowrap">
          <button class="btn-secondary" style="min-width:120px;padding:10px 14px" onclick="carregarContratoSalvo('${c.id}')" type="button">
            Carregar
          </button>
          <button class="btn-primary" style="min-width:130px;padding:10px 14px" onclick="baixarContratoPorId('${c.id}')" type="button">
            Gerar DOCX
          </button>
        </td>
      `;

      body.appendChild(tr);
    });

  } catch (e) {
    console.error(e);
    body.innerHTML = `
      <tr>
        <td colspan="6">Erro ao carregar contratos salvos.</td>
      </tr>
    `;
  }
}

async function carregarContratoSalvo(id) {
  try {
    const res = await fetch(`${API_BASE}/obter_contrato.php?id=${encodeURIComponent(id)}&t=${Date.now()}`);
    const js = await res.json();

    if (!js.ok || !js.contrato) {
      throw new Error(js.erro || "Contrato não encontrado.");
    }

    preencherTelaComContrato(js.contrato);
    fecharModal("modalContratosSalvos");

    Swal.fire({
      icon: "success",
      title: "Contrato carregado",
      text: "Você pode editar a tabela, dados e clicar em Atualizar contrato."
    });

  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Erro ao carregar contrato",
      text: e.message
    });
  }
}

function preencherTelaComContrato(c) {
  estado.contratoId = c.id || null;
  estado.contratoCarregado = c;

  setVal("obra", c.obra || c.obra_nome || "");
  setVal("empreiteiro", c.empreiteiro || c.empreiteiro_nome || "");
  setVal("escopoServico", c.escopo || c.servico || c.condicoes_pagamento || "");
  setVal("criteriosPreco", c.criterios_preco || "");
  setVal("valorContrato", moeda(c.valor_contrato || 0));
  setVal("valorExtenso", c.valor_extenso || valorPorExtensoBRL(c.valor_contrato || 0));
  setVal("dataContrato", c.data || "");
  setVal("dataExtenso", c.data_extenso || dataPorExtenso(c.data || ""));
  setVal("prazoDias", c.prazo_dias || "");

  estado.itens = Array.isArray(c.itens) ? c.itens.map((it, idx) => ({
    id: it.id || idx + 1,
    descricao: it.descricao || "",
    quantidade: Number(it.quantidade || 100),
    valorUnitario: Number(it.valorUnitario ?? it.valor_unitario ?? 0),
    valorTotal: Number(it.valorTotal ?? it.valor_total ?? 0),
    percentualMedido: Number(it.percentualMedido || 0)
  })) : [];

  estado.medicoes = Array.isArray(c.medicoes) ? c.medicoes : [];
  estado.pagos = Number(c.conta_corrente?.total_pago || 0);

  if (!estado.itens.length) adicionarItem(false);
  else renderItens();

  atualizarResumo();
  renderExtrato();
}

async function carregarEmpreiteiros() {
  try {
    const r = await fetch(`${API_BASE}/listar_empreiteiros.php?t=${Date.now()}`);
    const js = await r.json();
    const sel = document.getElementById("empreiteiro");

    (js.empreiteiros || []).forEach(e => {
      const nome = e.nome || e.razao_social;
      if (!nome) return;

      const o = document.createElement("option");
      o.value = nome;
      o.textContent = nome;
      o.dataset.raw = JSON.stringify(e);
      sel.appendChild(o);
    });
  } catch (e) {
    const sel = document.getElementById("empreiteiro");

    ["Abilio Serafim Construtora Ltda"].forEach(n => {
      const o = document.createElement("option");
      o.value = n;
      o.textContent = n;
      sel.appendChild(o);
    });
  }
}

async function carregarObras() {
  try {
    const r = await fetch(`${API_OBRAS}?t=${Date.now()}`);
    const js = await r.json();
    const arr = Array.isArray(js) ? js : (js.obras || js.data || []);
    const sel = document.getElementById("obra");

    arr.forEach(o => {
      const nome = o.nome || o.Nome || o.obra || o.Obra || String(o);
      const op = document.createElement("option");
      op.value = nome;
      op.textContent = nome;
      sel.appendChild(op);
    });
  } catch (e) {
    ["Cooperativa Fumacense", "FIESC", "Giassi Araranguá"].forEach(n => {
      const o = document.createElement("option");
      o.value = n;
      o.textContent = n;
      document.getElementById("obra").appendChild(o);
    });
  }
}

function popularInicial() {
  estado.itens = [{
    id: 1,
    descricao: "Descrição",
    quantidade: 100,
    valorUnitario: 0,
    valorTotal: 0,
    percentualMedido: 0
  }];

  renderItens();
  atualizarDataExtenso();
  onValorContrato();
  renderExtrato();
}

window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("impar-enter");
  carregarObras();
  carregarEmpreiteiros();
  popularInicial();
});
