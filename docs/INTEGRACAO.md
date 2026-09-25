# Integração da nova casca — diagnóstico inicial

## Arquivos recebidos

index-saas.html; login-saas.html; menu-shell-saas.html; agenda-semanal-saas.html; agenda-do-dia-saas.html; formulario-colaboradores-saas.html; fechamento-do-dia-saas.html; relatorios-saas.html.

Os originais não foram editados. Não confundir as cópias recebidas com uma auditoria do sistema em produção.

## Preservar

- Layout e interações novos; azul do index/login como referência.
- Drag and drop e seleção novos, inclusive cópias encadeadas com Ctrl.
- Calendário único de período e inclusão por fórmula.
- Regras oficiais e fonte persistente do backend existente; nenhum endpoint ou schema será inventado.
- SaaS com banco desde o início; não criar persistência paralela em localStorage.

## Pontos reais de integração

1. Login: a cópia intercepta submit e informa que não há servidor. Integrar a autenticação real, não transformar usuário digitado em empresa autorizada.
2. Shell: contém área de montagem e perfil demonstrativo; falta montar início por empresa e módulos permitidos com dados autorizados.
3. Semanal: COLAB, SEM, frota e sugestões são locais. O Salvar atual muda flags locais. Conectar leitura, gravação e fechamento preservando a interação.
4. Dia: COLAB, DIA, frota e sugestões são locais. O Salvar atual limpa o histórico local e mostra sucesso sem fetch/XHR. Confrontar checkpoint/Desfazer e fechamento com as regras oficiais antes de integrar.
5. Colaboradores: lista local. Conectar cadastro global da empresa e usar IDs estáveis; nome e índice do card não são chaves suficientes.
6. Fechamento: equipe de exemplo independente do dia. Conectar ao registro real; não levar registros fixos nem percentuais assumidos.
7. Relatórios: 42 registros sintéticos. Substituir pela consulta autorizada, preservar templates reais e distinguir compartilhar texto de compartilhar documento.
8. Links: vários apontam a nomes fora do lote. Mapear rotas e dependências; não levar arquivos antigos só para preencher esses caminhos.
9. Tokens: azul principal #1068E8; algumas telas têm token de conclusão verde, enquanto o index o redefine em azul. Consolidar conforme o index/login, sem renomear tokens públicos.
10. Recursos: scripts de telemetria externos nas cópias e imagens embutidas no index. Não herdar telemetria sem finalidade aprovada; otimizações devem preservar aparência. Dados do banco introduzidos em HTML precisam de inserção/escape seguro.

## Cliente legado consultado

Referência: cronograma/agenda_client_v2.js, main em 44ac49e8ca8230334e0659a39e3358116f2d1261. Usa https://api.erpimpar.com.br/agenda/ e depende de AgendaDiaV315, AgendaDiaRefatoracaoV1, people, schedule e renderAll. Não incluir esse cliente inteiro nas novas telas: ele contém lógica e dependências da interface anterior. As URLs são evidência do frontend consultado, não confirmação do schema SQL, versão PHP ou isolamento SaaS do servidor.

## Próxima entrada necessária

PHPs vigentes do KingHost relacionados a autenticação/empresas/permissões, cadastros, agendas, fechamento, relatórios e George; schema/migrações correspondentes e configuração de exemplo sem segredos. Testes de escrita somente em homologação isolada e autorizada. Não enviar senhas, tokens nem dump de dados de clientes.
