# ERP ÍMPAR - pacote visual azul V1.1

Este pacote contém as 17 telas recebidas, preservadas com seus nomes originais, mais o Design System azul compartilhado.

## Arquivos compartilhados obrigatórios

- `erp-impar-blue-theme.css`: paleta, superfícies, botões, campos, tabelas, modais, estados e animações.
- `erp-impar-blue-theme.js`: entrada suave dos módulos, revelação progressiva dos cards e retorno visual dos botões.
- `erp-impar-demo-data.js`: cenário demonstrativo integrado da obra Toyota Mercosul.

Os três arquivos devem permanecer no mesmo diretório dos HTMLs. Se os HTMLs forem distribuídos em pastas diferentes, copie os três arquivos compartilhados para cada pasta ou ajuste os caminhos relativos.

## Modos de abertura

- Não abra os arquivos por duplo clique (`file://`), porque APIs, PDFs, caminhos relativos e políticas do navegador podem se comportar de outra forma.
- Para validar layout e animações localmente, abra um terminal dentro da pasta e execute `py -m http.server 8080` (Windows) ou `python3 -m http.server 8080`.
- Depois acesse `http://localhost:8080/` no navegador.
- Uso normal: abra o HTML pelo endereço local sem parâmetro.
- Demonstração preenchida: acrescente `?demo=1` ao endereço.

Exemplo:

`http://localhost:8080/gestao_obras_novo%20(7).html?demo=1`

O modo demonstrativo não grava a carga fictícia no banco. Ele serve exclusivamente para apresentação, prints e validação visual.

## Padrão aplicado

- azul-marinho e azul tecnológico como cores primárias;
- superfícies claras e cartões com profundidade discreta;
- azul para ações principais;
- verde apenas para confirmações e resultados positivos;
- amarelo para atenção;
- vermelho para risco, rejeição e atraso;
- entrada suave de tela e cards;
- confirmação visual de cliques;
- respeito à configuração de redução de movimento do dispositivo;
- animações desabilitadas na impressão.

## Animação da criação da obra

A tela `gestao_obras_novo (7).html` já possui o fluxo funcional de implantação. O padrão azul foi aplicado sem substituir sua lógica. A sequência apresentada é:

1. criação do dossiê da obra;
2. geração do cronograma oficial;
3. conexão do resumo executivo;
4. geração da Ordem de Serviço;
5. criação do guia/checklist;
6. geração do Termo de Kickoff;
7. organização das pastas digitais;
8. gravação da timeline e liberação no painel.

## Publicação

Este é um pacote de homologação. Antes de substituir qualquer arquivo de produção:

1. publique em uma branch exclusiva, como `homologacao/layout-azul`, e direcione essa branch para uma pasta ou URL de homologação;
2. abra cada módulo sem `?demo=1`;
3. valide as chamadas ao backend;
4. valide impressão, PDF e compartilhamento;
5. valide desktop e mobile;
6. somente depois escolha quais arquivos substituir em produção.

O servidor local é suficiente para validar aparência e animações. A homologação publicada é necessária para validar de maneira confiável login, sessão, banco, APIs, CORS, geração e compartilhamento de PDF. A branch de homologação não deve substituir a produção.

## Correção V1.1 — Vida da Obra

- paleta interna da Gestão da Obra alterada para azul;
- formulário de inicialização alterado para azul;
- foguete removido do botão e do cabeçalho;
- marca visual ERP ÍMPAR aplicada à inicialização;
- azul aplicado a ações, foco de campos, progresso e estados ativos;
- verde mantido somente em estados semânticos de sucesso ou conclusão.
