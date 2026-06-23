// integração_orcamento_conversao_cobre.js
// Botão no formulário: abre tabela e também permite converter automaticamente KG -> METRO.
// Ajuste os seletores conforme os IDs reais do seu HTML.

const URL_CONVERSAO_COBRE = 'https://api.erpimpar.com.br/materiais/data/conversao_cobre.php';

async function converterCobreKgParaMetro({ descricao, tipoObra, valorUnitario }) {
  const qs = new URLSearchParams({
    acao: 'converter',
    direcao: 'kg_para_metro',
    descricao,
    tipo_obra: tipoObra,
    valor_unitario: String(valorUnitario || '')
  });

  const resp = await fetch(`${URL_CONVERSAO_COBRE}?${qs.toString()}`);
  const json = await resp.json();

  if (!json.ok) throw new Error(json.erro || 'Falha na conversão do cobre.');
  return json;
}

async function abrirTabelaConversaoCobre() {
  const resp = await fetch(`${URL_CONVERSAO_COBRE}?acao=listar`);
  const json = await resp.json();
  if (!json.ok) throw new Error(json.erro || 'Falha ao carregar tabela.');

  const rows = json.tabela.registros.map(r => `
    <tr>
      <td>${r.tipo_obra}</td>
      <td>${r.diametro}</td>
      <td>${(r.fator_margem * 100).toFixed(0)}%</td>
      <td>${String(r.fator_conversao_kg_por_metro).replace('.', ',')}</td>
    </tr>
  `).join('');

  const html = `
    <div class="modal-cobre-backdrop" onclick="this.remove()">
      <div class="modal-cobre" onclick="event.stopPropagation()">
        <div class="modal-cobre-head">
          <strong>Conversão de Cobre</strong>
          <button onclick="document.querySelector('.modal-cobre-backdrop').remove()">×</button>
        </div>
        <div class="modal-cobre-info">
          Fórmula KG → METRO: <b>valor metro = valor kg × fator × (1 + margem)</b>
        </div>
        <table>
          <thead>
            <tr><th>Obra</th><th>Diâmetro</th><th>Margem</th><th>Fator kg/m</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

// CSS sugerido para manter o padrão premium do ERP ÍMPAR
const styleCobre = document.createElement('style');
styleCobre.innerHTML = `
.modal-cobre-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}
.modal-cobre{width:min(820px,96vw);max-height:86vh;overflow:auto;background:linear-gradient(135deg,#06233d,#064f4a);border:1px solid rgba(0,255,180,.35);border-radius:18px;color:white;box-shadow:0 18px 60px rgba(0,0,0,.45)}
.modal-cobre-head{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:16px 18px;background:rgba(2,18,36,.92);border-bottom:1px solid rgba(255,255,255,.12)}
.modal-cobre-head strong{font-size:20px}
.modal-cobre-head button{border:0;border-radius:10px;padding:6px 12px;background:#0cbf84;color:#001b23;font-weight:900;cursor:pointer}
.modal-cobre-info{margin:14px 18px;padding:10px 12px;border-radius:12px;background:rgba(255,193,7,.16);border:1px solid rgba(255,193,7,.38)}
.modal-cobre table{width:calc(100% - 36px);margin:0 18px 18px;border-collapse:collapse;font-size:13px}
.modal-cobre th,.modal-cobre td{padding:10px;border-bottom:1px solid rgba(255,255,255,.12);text-align:left}
.modal-cobre th{background:rgba(0,0,0,.28);color:#a7ffdf}
`;
document.head.appendChild(styleCobre);

// Exemplo de uso ao selecionar material:
// const conv = await converterCobreKgParaMetro({
//   descricao: item.descricao,
//   tipoObra: document.querySelector('#tipoObra').value, // VRF ou SPLIT
//   valorUnitario: item.valorUnitario
// });
// item.descricao = conv.descricao_convertida;
// item.unidade = 'METRO';
// item.valorUnitario = conv.valor_convertido;
