# Verificação inicial — 25/09/2026

Escopo: oito HTMLs originais recebidos, sem alterações. Onze blocos inline de JavaScript passaram no node --check.

Renderização: 16 aberturas em Chromium local, 1440x1000 e 390x844. Por restrição de rede do ambiente, o HTML foi carregado via set_content em about:blank; requisições externas foram bloqueadas. Não é homologação HTTP, CORS, backend, voz nem aparelho físico. Nenhum erro JavaScript inicial foi observado nessas aberturas. Relatórios em 390px produziu documento com 406px: revisar extravasamento horizontal dos filtros.

Amostras de interação:

- PASSOU: mover por arrasto na Agenda do Dia e na Agenda Semanal.
- PASSOU: cópias encadeadas por Ctrl e cliques nas duas agendas.
- PASSOU: inclusão pela fórmula e Desfazer local na Agenda do Dia.
- PASSOU: escolha do período por arrasto em Relatórios.
- CONFIRMADO COMO DEMONSTRAÇÃO: Salvar no dia não emite fetch/XHR; login informa ausência de servidor.
- A COMPLEMENTAR: teste automatizado do botão + na Semana encontrou interceptação de ponteiro. Não foi alterado o componente nem concluído que a interação humana falha.
- A COMPLEMENTAR: dois cliques no calendário encontraram recriação do elemento durante o movimento do ponteiro. Arrasto passou; o teste de dois cliques não foi homologado.

Foram 10 cenários de inspeção: 8 atingiram seu resultado esperado, inclusive os dois que verificam a natureza demonstrativa; 2 ficaram pendentes. Isso NÃO significa 80% do produto homologado. O pacote local de análise contém o executável de teste, JSON e screenshots. Nenhum teste de banco, API real, segregação entre empresas, áudio/voz ou ciclo completo foi executado nesta etapa.
