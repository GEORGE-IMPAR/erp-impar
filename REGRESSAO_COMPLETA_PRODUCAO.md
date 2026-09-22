# Matriz mestre de regressão do ERP ÍMPAR

## Objetivo e regra de aceite

Esta matriz transforma o sistema publicado em contrato verificável. Uma entrega só pode ser declarada pronta quando todos os casos críticos aplicáveis estiverem aprovados no mesmo commit candidato, nas versões PHP 8.2 e 8.3, em desktop e celular, e contra uma cópia controlada do banco operacional.

**Não significam “funcionando”:** arquivo existente, sintaxe válida, botão presente, mock aprovado ou resposta HTTP 200. HTTP 200 com JSON/HTML inválido é falha. Caso não executado deve ser registrado como **NÃO TESTADO**, nunca como aprovado.

Estados: `AUTO` (CI), `E2E` (navegador + backend + banco), `MANUAL` (avaliação humana), `BLOQUEADO` (dependência indisponível).

## Fonte do escopo publicado

O escopo automático nasce das rotas efetivamente abertas por `menu_novo.html`, mais `login_novo.html`, George e seus endpoints. Backups, protótipos e arquivos sem rota não entram como produção até serem publicados. A confirmação direta do servidor `erpimpar.com.br` permanece obrigatória antes do deploy; o repositório sozinho não prova qual commit está no servidor.

| Área publicada | Entrada atual | Prioridade |
|---|---|---:|
| Login e shell | `login_novo.html`, `menu_novo.html` | P0 |
| Mesa e dashboard de projetos | `projetos/mesa_projetos.html`, `projetos/dashboard_projetos.html` | P1 |
| Agenda semanal e Agenda do Dia | `cronograma/agenda_semanal_novo.html`, `cronograma/agenda_do_dia_novo.html` | P0 |
| Cronograma e dashboard de obras | `cronograma/cronograma_novo.html`, `cronograma/dashboard_executivo_obras_novo.html` | P1 |
| Vida/Gestão da Obra | `obras/gestao_obras_novo.html` | P0 |
| Medição | `medicao-empreiteiro/medicao_empreiteiro.html` | P1 |
| Documentos | `documentos/gestão_documental_novo.html` | P1 |
| Orçamentos | `orcamento_novo.html` | P1 |
| Solicitações de materiais | `materiais/solicitacao_materiais_novo.html` | P1 |
| Viagens | `rh/viagens/atualizacao_viagens_novo.html` | P1 |
| Administração | `administracao/index.html` | P0 |
| George | `george-reuniao/george_v09.html` e backend v09 | P0 |

Itens exibidos no menu sem rota, hoje tratados como “em implantação”, devem continuar inacessíveis ou ganhar uma rota e testes antes da publicação: TV Experience, Google Maps, Compras, Recebimento, Colaboradores, Horas e Alocação, Combustível e Indicadores.

## Casos obrigatórios

### RG-LOGIN — autenticação, sessão e shell

| Casos | Tipo |
|---|---|
| Login válido; senha inválida; usuário inexistente; usuário inativo; campos vazios | E2E |
| Persistência e expiração de sessão; sair limpa sessão; retorno ao login | E2E |
| Perfil/nome corretos; permissões por usuário; bloqueio de módulo não autorizado | E2E |
| Todas as 13 rotas do shell existem, abrem no iframe e não produzem erro de console | AUTO + E2E |
| Navegação desktop/mobile; menu recolhido; voltar/atualizar sem perder contexto | E2E |
| Fonte de usuários, credenciais no cliente e controles de acesso passam revisão de segurança | MANUAL |

### RG-PROJ — projetos

| Casos | Tipo |
|---|---|
| Criar, consultar, editar, cancelar e reabrir projeto | E2E |
| Filtros, prioridades, responsáveis, equipe, estimativas, status e datas | E2E |
| Drag-and-drop de equipe e persistência após recarga | E2E |
| Geração semanal sem duplicidade e vínculo correto com agenda | E2E |
| Dashboard, totais, estados vazios e relatório imprimir/compartilhar/CSV | E2E |

### RG-AS — Agenda Semanal

| Casos | Tipo |
|---|---|
| Carregar semana anterior/atual/próxima e preservar fuso/data | E2E |
| Cadastrar/ativar colaborador; carregar obras; pesquisa/autocomplete | E2E |
| Criar/editar/remover atividade; veículo; viagem; observação | E2E |
| Mover/copiar por drag-and-drop entre pessoa/dia e reordenar | E2E |
| Salvar/recarregar sem perda; impedir duplicidade; proteger alteração não salva | E2E |
| Limpar com confirmação; congelar/finalizar; bloquear edição congelada | E2E |
| Construir semana seguinte conforme regras e sem sobrescrever dados existentes | E2E |
| Relatório, filtros, impressão, compartilhamento e falhas de API | E2E |

### RG-AD — Agenda do Dia

| Casos | Tipo |
|---|---|
| Carregar dia com dados reais; trocar dia; domingo/segunda; ausência de dados | E2E |
| Origem semanal, atividade manual, cores/legenda e identidade de cada estado | E2E |
| Criar/editar atividade, obra, serviço, viagem, veículo e observação | E2E |
| Seleção simples/múltipla; teclado; toque; mover/copiar/ordenar via drag-and-drop | E2E |
| Cancelar manual desaparece; cancelar semanal conserva origem corretamente; restaurar | E2E |
| Colaboradores abre sem erro, lista dados, botões consistentes e ações explícitas | E2E |
| Salvar/checkpoint não cria histórico indevido; desfazer restaura exatamente | AUTO + E2E |
| Finalização exige percentual; cancelamento exige motivo; bloqueio após finalizar | E2E |
| Dia seguinte não altera histórico; segunda-feira mantém dados e independência semanal | AUTO + E2E |
| Consulta semanal, relatório, PDF/impressão/compartilhamento e erros compreensíveis | E2E |

Os casos detalhados AD-001 em diante permanecem documentados em `PLANO_REGRESSAO_GEORGE.md` e são parte desta porta de qualidade.

### RG-CRO — cronograma e dashboard executivo

| Casos | Tipo |
|---|---|
| Criar/abrir obra; coordenador; datas; calendário útil e feriados | E2E |
| Atividade/grupo: incluir, editar, excluir, ordenar, predecessor e dependência | E2E |
| Duração, avanço, peso, status, atraso e totais calculados corretamente | E2E |
| Rascunho/salvar/recarregar; concorrência e conflito entre usuários | E2E |
| Importar/exportar planilha; relatório/PDF; filtros do dashboard | E2E |

### RG-OBRA — Gestão/Vida da Obra

| Casos | Tipo |
|---|---|
| Listar, pesquisar, criar e abrir obra; permissões por empresa/usuário | E2E |
| Estrutura/card principal da obra reúne cronograma, contratos, documentos e materiais | E2E |
| Repositório: pastas, upload, download, prévia, exclusão e versionamento | E2E |
| Contratos e solicitações aparecem uma única vez e com vínculo correto | E2E |
| Linha do tempo e auditoria registram autor/data/ação sem alterar histórico | E2E |

### RG-MED — medição de empreiteiro

| Casos | Tipo |
|---|---|
| Selecionar obra/contrato e carregar composição/saldo | E2E |
| Lançar quantidades/valores; impedir excedente e inconsistência | E2E |
| Anexar/remover evidências; prévia; confirmar/enviar; impedir duplicidade | E2E |
| Histórico, detalhes, relatório, impressão e compartilhamento | E2E |

### RG-DOC — gestão documental

| Casos | Tipo |
|---|---|
| Empresas: cadastrar, editar, pesquisar, importar e validar duplicidade | E2E |
| Templates: editar, versionar, selecionar e preservar campos | E2E |
| Contratos: assistente, obrigatórios, contratante/contratada, código, prazo e valor | E2E |
| Composição por planilha, assinaturas, datas/valores por extenso e anexos | E2E |
| Gerar/abrir/baixar Word e PDF; reabrir e manter histórico | E2E |

### RG-ORC — orçamento

| Casos | Tipo |
|---|---|
| Selecionar obra/data/responsável; incluir/editar/remover/grupar itens | E2E |
| Quantidade, unidade, preço, impostos, fatores, comissão, lucro e total | E2E |
| Conversões e arredondamentos; zero, negativo, vazio e valor inválido | E2E |
| Importar planilha; salvar/reabrir; exportar/relatório sem divergência | E2E |

### RG-MAT — solicitações

| Casos | Tipo |
|---|---|
| Nova solicitação, obra, centro de custo, prazo e itens por busca/manual | E2E |
| Editar/remover item; observação; obrigatórios; rascunho salvar/abrir/excluir | E2E |
| Enviar a Compras uma única vez; falha/reenvio idempotente; status e histórico | E2E |
| Relatórios, filtros e exportação com os mesmos totais da ficha | E2E |

### RG-VIA — viagens

| Casos | Tipo |
|---|---|
| Carregar origem da agenda, pessoas e viagens sem perder vínculo | E2E |
| Criar/editar/cancelar; diária e regra N-1; hotel/quartos/acompanhantes | E2E |
| Rascunho, salvar/recarregar/finalizar; mapas e dados incompletos | E2E |
| Relatório, compartilhar e Excel com valores e participantes corretos | E2E |

### RG-ADM — administração

| Casos | Tipo |
|---|---|
| Listar/pesquisar/filtrar usuário; criar/editar/ativar/desativar | E2E |
| Senha e política de credencial; impedir exclusão indevida | E2E |
| Adicionar/remover perfil e permissão; persistir e refletir no shell | E2E |
| Workflows e auditoria; impedir escalada de privilégio | E2E + MANUAL |

### RG-GEO — George

| Casos | Tipo |
|---|---|
| Abrir sessão, nova conversa, retomar, texto, contexto e histórico | AUTO + E2E |
| Áudio iniciar/parar/retomar; reconexão automática; troca de rede e tela bloqueada | E2E |
| Controle de reunião: gravar, pausar perguntas, liberar, anotar dúvidas | AUTO + E2E |
| Fechamento: data, participantes, tópicos, pendências, incertezas e confirmação | AUTO + E2E |
| Consultar Agenda do Dia/semanal e colaborador usando a mesma fonte operacional | AUTO + E2E |
| Criar atividade somente com confirmação; idempotência e ausência de duplicidade | E2E |
| Gerar relatório/PDF real, abrir, baixar e compartilhar; validar MIME e assinatura `%PDF` | AUTO + E2E |
| Anexos, áudio, imagem, vídeo, partes grandes, interrupção e retomada | E2E |
| Erros: HTTP 200 inválido, timeout, 4xx/5xx, sessão vencida e mensagem útil | AUTO + E2E |
| Mesmas respostas essenciais no RP, desktop e celular | E2E |

### RG-NF — transversal

| Casos | Tipo |
|---|---|
| Chrome desktop e Android; larguras principais; teclado, toque e foco visível | E2E + MANUAL |
| Erros de console/rede zerados; carregamento, timeout, repetição e offline/cache | E2E |
| PHP 8.2/8.3; JSON/MIME/charset; datas e fuso; arquivos com caracteres especiais | AUTO + E2E |
| Isolamento por empresa/usuário, permissões, dados sensíveis e upload malicioso | E2E + MANUAL |
| Concorrência, locks, repetição de clique/request e consistência após falha | E2E |
| Backup/restore e migração executados em staging antes de produção | MANUAL |

## Cobertura automática existente em 22/09/2026

| Suíte | Cobertura real | Limite |
|---|---|---|
| `tests/erp_production_contract.test.mjs` | Login/shell, 13 rotas, controles e endpoints críticos, capacidades George | Não clica nem consulta banco |
| `agenda-dia-ui-contract.test.mjs` | Contrato da interface da Agenda do Dia | Não prova backend |
| `agenda-client-v2.test.mjs` | Cliente e respostas da Agenda | Ambiente sintético |
| `agenda_domain_regression.php` | Regras AD-001 a AD-006 | Recorte do domínio |
| `agenda_george_contract.test.mjs` | Integração contratual George/Agenda | Não substitui E2E real |
| `agenda_report_pdf_regression.test.mjs` | Caminho de geração de PDF | Necessita validar também servidor/arquivo real |
| `meeting_question_control_regression.test.js` | Controle de perguntas em reunião | Não valida microfone/rede reais |
| `php_api_smoke.sh` | HTTP/JSON básico do backend George | Smoke, não jornada completa |
| `erp_business_rules_contract.test.mjs` | Contratos críticos de login, shell, agendas, cronograma, obras, medição, documentos, materiais, viagens, administração e George | Confirma presença da regra no código; não substitui clique e banco |
| `erp_static_integrity.test.mjs` | Referências locais, sintaxe dos scripts inline e IDs HTML duplicados | Bloqueia a CI ao encontrar defeito estrutural |
| `erp_browser_smoke.test.mjs` | Abre 16 entradas em Chromium e captura erro JavaScript/HTTP com APIs isoladas | Executa no Actions; não consulta produção nem banco real |
| `agenda_mysql_regression.php` | Schema InnoDB, extensões de ENUM, isolamento por empresa, resolução de colaborador/alias, cópia, finalização imutável e rollback | Executa em MySQL 8.4 descartável no Actions; não usa dados de produção |

Conclusão honesta: a automação atual protege uma parte importante de Agenda + George e agora impede sumiço estrutural dos módulos publicados, mas **ainda não executa a regressão completa de produção**. Os casos `E2E` desta matriz precisam ser implementados com navegador, staging e banco clonado/sanitizado. Até isso ocorrer, não se pode afirmar que “tudo foi testado”.

## Resultado da rodada de 22/09/2026

Passaram localmente:

- contrato de produção: login, shell, 13 módulos e integrações críticas;
- contratos de regras críticas de 12 áreas;
- integração George/Agenda e geração de PDF com fonte operacional;
- quatro casos de controle de perguntas e fechamento de reunião;
- contrato da Agenda do Dia, com 43 blocos inline válidos;
- cliente da Agenda: copiar, mover, vincular, remover, rastrear e persistir;
- verificação de whitespace com `git diff --check`.

Preparado para execução obrigatória no CI:

- MySQL 8.4 isolado e descartável em cada matriz PHP 8.2 e 8.3;
- instalação e diagnóstico do schema da Agenda;
- isolamento de empresa e vínculo de usuário;
- colaborador por nome e alias, com bloqueio de ambiguidade;
- persistência SQL de atividade original e copiada, com vínculo à origem;
- finalização imutável, assinatura do snapshot e rollback transacional.

Falhas estruturais encontradas e corrigidas nesta rodada:

1. `obras/gestao_obras_novo.html` passou a carregar `../erp-impar-demo-data.js`, que corresponde ao arquivo existente na raiz.
2. Foram removidas as ocorrências ocultas duplicadas do ID `projectSideMesa` em `projetos/mesa_projetos.html`; o botão funcional foi preservado.
3. Foram removidas as ocorrências ocultas duplicadas do ID `projectSideDash` em `projetos/mesa_projetos.html`; o botão funcional foi preservado.

Após as correções, `erp_static_integrity.test.mjs` aprovou 16 páginas e 118 scripts inline, sem referência local quebrada, erro de sintaxe inline ou ID estático duplicado.

Não executado localmente:

- PHP, porque o interpretador não está instalado neste ambiente; o workflow foi preparado para PHP 8.2 e 8.3;
- Chromium, porque a biblioteca Playwright existe, mas o binário do navegador não está instalado; o workflow instala o Chromium e executa o smoke isolado;
- staging e banco clonado/sanitizado, ainda não fornecidos a esta execução. O novo teste usa somente MySQL descartável e não escreve em produção.

## Porta de liberação

1. Congelar commit candidato e registrar hash, banco/migração e URLs do ambiente.
2. Executar CI inteira em PHP 8.2 e 8.3.
3. Restaurar banco sanitizado no staging e executar todos os P0/P1 E2E.
4. Executar checklist manual visual em desktop e celular.
5. Registrar evidência por caso: horário, usuário, entrada, resultado e captura/log.
6. Bloquear deploy com qualquer P0/P1 falho ou não testado.
7. Produção somente após autorização explícita; smoke pós-deploy somente leitura primeiro.
