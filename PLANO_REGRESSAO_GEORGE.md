# Plano de regressão: George e Agenda do Dia

## Escopo e evidência

Este documento confronta a auditoria [AUDITORIA_GEORGE_AGENDA_DIA_2026-09-16.md](AUDITORIA_GEORGE_AGENDA_DIA_2026-09-16.md) com o estado presente de `george-reuniao`. Nenhum código funcional foi alterado. `Abertura.html` e demais aberturas antigas foram deliberadamente ignorados.

Entry point considerado: [george-reuniao/george_v09.html](george-reuniao/george_v09.html). O [george-reuniao/index.html](george-reuniao/index.html), [george-reuniao/george_agenda_teste_v01.html](george-reuniao/george_agenda_teste_v01.html) e [george-reuniao/george_avatar_teste_v01.html](george-reuniao/george_avatar_teste_v01.html) são superfícies históricas/teste, não a tela V09 considerada para liberação.

### Classificação

- **GitHub Actions**: verificável de forma determinística sem navegador, por lint, contrato HTTP, testes unitários/integrados e fixtures.
- **Somente navegador**: depende de DOM, viewport, permissões, áudio, câmera, WebRTC, `MediaRecorder`, PDF.js, compartilhamento nativo ou interação visual.
- **Teste manual**: depende de percepção humana, dispositivo real, dados reais, autorização de produto ou comparação com fonte visual oficial.
- **Ausente/divergente**: não há implementação correspondente no escopo atual ou o comportamento encontrado contradiz a regra.

“Existe no código” não significa “OK”: a auditoria exige execução comprovada e evidência.

## Matriz completa

| ID | Requisito verificável | Implementação real encontrada | Classificação | Estado atual / evidência necessária |
|---|---|---|---|---|
| AUD-001 | Uma única fonte visual para tela, impressão, PDF e compartilhamento da Agenda | `window.GeorgeAgendaReport.build()` em [agenda_report_bridge.js](george-reuniao/assets/v09/agenda_report_bridge.js) renderiza canvas/PDF próprio; `agenda_report_bridge.js` declara que não depende do PDF oficial | **ausente/divergente** | Contradiz a regra oficial de fonte visual única. |
| AUD-002 | Cabeçalho, cards, cores, toolbar, paginação e template idênticos ao padrão aprovado | `render()`/`jpegPdf()` em [agenda_report_bridge.js](george-reuniao/assets/v09/agenda_report_bridge.js); análise visual também cria `analyticsHtml()` em [app.js](george-reuniao/assets/v09/app.js) | **ausente/divergente** | Existem dois desenhos paralelos; requer comparação visual desktop/mobile com a fonte aprovada. |
| AUD-003 | Pedido de Agenda nunca cai no PDF genérico da conversa | Roteamento em `queueQuestion()`, `agendaReportIntent()`, `handleLocalIntent()` e `document_create` em [app.js](george-reuniao/assets/v09/app.js) | **teste manual** | Há desvio explícito para PDF da Agenda, mas é necessário testar frases ambíguas, erro de bridge, contexto Geral e continuidade. |
| AUD-004 | Variações naturais de linguagem acionam a Agenda correta | `matches()`, `agendaReportIntent()`, `moduleActivationIntent()` e `georgeModuleFromText()` em [agenda_report_bridge.js](george-reuniao/assets/v09/agenda_report_bridge.js), [app.js](george-reuniao/assets/v09/app.js) e [AI.php](george-reuniao/backend-ci/v09/lib/AI.php) | **automatizável no GitHub Actions** | Pode receber matriz de frases positivas/negativas; hoje continua baseado em regex fechada e precisa cobertura de linguagem. |
| AUD-005 | PDF da conversa separado por data, inclusive na exportação | `conversation_dates.js` e reconstrução de turnos em `resume`/`initialize`; PDF genérico em `ExecutivePdfV1.php` e [Report.php](george-reuniao/backend-ci/v09/lib/Report.php) | **ausente/divergente** | Separador visual existe, mas não há prova de que o PDF da conversa replique separadores; auditoria já marcou parcial. |
| AUD-006 | Aviso de saída durante gravação é idempotente | `exitApp`, `beforeunload`, `pagehide`, estados `recording`, `pendingCapture`, `finalizing` em [app.js](george-reuniao/assets/v09/app.js) | **somente navegador** | Há bloqueio de saída, mas a repetição do aviso precisa ser reproduzida em desktop/mobile e em múltiplos eventos de saída. |
| AUD-007 | Relatório solicitado gera somente a Agenda do Dia correta | `request('agenda_read')`, `fromAgenda()`, `build()` e `agendaReportButtons()` em [app.js](george-reuniao/assets/v09/app.js), [agenda_report_bridge.js](george-reuniao/assets/v09/agenda_report_bridge.js) | **somente navegador** | O caminho está isolado, mas não há teste de ponta a ponta nem garantia visual/documental de conformidade. |
| AUD-008 | Validação da RC2.3 cobre fluxos funcionais, visuais e conversacionais | [STAGING_E_VALIDACAO.md](george-reuniao/STAGING_E_VALIDACAO.md), [php_api_smoke.sh](george-reuniao/tests/php_api_smoke.sh) | **ausente/divergente** | O smoke cobre apenas session/login/conversation_new/resume; não cobre Agenda, voz, mídia, PDF ou layout. |
| AUD-009 | Sintaxe JS local | `app.js`, `agenda_report_bridge.js`, `agenda_day_experience.js`, `pdf_viewer.js` | **GitHub Actions** | `get_errors` não encontrou erros nos principais arquivos. `node --check` não foi executado porque Node não está instalado neste ambiente. |
| AUD-010 | Sintaxe/runtime PHP local e homologação | `api.php`, `Core.php`, libs V09; barreira descrita em [STAGING_E_VALIDACAO.md](george-reuniao/STAGING_E_VALIDACAO.md) | **GitHub Actions** | `get_errors` não encontrou erro em `api.php`; PHP CLI/homologação real ainda não foram executados nesta máquina. |
| AD-001 | Nascimento pela Agenda Semanal finalizada | `agendaNextDay()` em [AgendaOps.php](george-reuniao/backend-ci/v09/lib/AgendaOps.php); `agendaNextDay()` também é usado em [AgendaDomain.php](george-reuniao/backend-ci/v09/lib/AgendaDomain.php) | **GitHub Actions** | Testar origem válida, ausência de semanal e sexta-feira sem próxima semana finalizada. |
| AD-002 | Agenda fica independente depois de criada | `agendaJsonLoad()`, `agendaRead()`, `agendaProjectionCheck()` em [AgendaJson.php](george-reuniao/backend-ci/v09/lib/AgendaJson.php) | **GitHub Actions** | Testar alteração posterior da fonte semanal sem reconstruir o dia aberto. |
| AD-003 | Rascunho aberto aceita edição, viagem e veículo | `agendaNormalize()`, `agendaApplyStep()`, `agendaVisible()` em [AgendaDomain.php](george-reuniao/backend-ci/v09/lib/AgendaDomain.php) | **GitHub Actions** | Há validação real; falta caso automatizado de contrato e persistência. |
| AD-004 | Salvar cria checkpoint sem finalizar ou navegar | Operações `checkpoint` e `replace_visible` em `agendaExecute()`; endpoint `agenda_execute` em [api.php](george-reuniao/backend-ci/v09/api.php) | **GitHub Actions** | Não há botão/tela de Agenda V09 que execute isso; validar serviço diretamente e depois navegador. |
| AD-005 | Finalizar valida tudo, congela histórico e cria próximo dia atomicamente | `agendaCloseValues()`, `agendaNextDay()`, transação em `agendaExecute()`/`agendaExecuteSql()` | **GitHub Actions** | Forte base de domínio; falta teste de falha em cada etapa e confirmação de rollback. |
| AD-006 | Histórico é imutável e somente leitura | `agendaRead($u,$date)`, checagens de `finalizado`, `agendaProjectionCheck()` | **GitHub Actions** | Testar consulta retroativa e tentativa de escrita em data histórica. |
| AD-007 | Verde, laranja, vermelho e roxo conforme origem/estado | Origem/status preservados em [AgendaDomain.php](george-reuniao/backend-ci/v09/lib/AgendaDomain.php) e `agendaOpsCandidatePublic()` em [AgendaOps.php](george-reuniao/backend-ci/v09/lib/AgendaOps.php) | **ausente/divergente** | O backend retorna origem, mas não foi localizada a tela V09 de cards que aplique as quatro cores; classificação visual permanece não implementada neste escopo. |
| AD-008 | Criar atividade manual/replanejada roxa | `agendaApplyStep()` operação `adicionar`; `agendaOpsAdd()` retorna `visual=>'ROXA'` | **GitHub Actions** | Automatizar propriedades e persistência; conferir cor somente quando existir tela operacional real. |
| AD-009 | Cancelar semanal preserva vermelho; manual desaparece | `agendaCancelItem()` em [AgendaDomain.php](george-reuniao/backend-ci/v09/lib/AgendaDomain.php) | **GitHub Actions** | Implementação explícita; cobrir semanal/manual/cancelada e restauração. |
| AD-010 | Obra/atividade livres, autocomplete não bloqueia | `agendaApplyStep()` e `agendaWorkCanonical()` em [AgendaDomain.php](george-reuniao/backend-ci/v09/lib/AgendaDomain.php), [Works.php](george-reuniao/backend-ci/v09/lib/Works.php) | **GitHub Actions** | Testar texto livre, sugestão única, ambiguidade e cadastro de obra indisponível. |
| AD-011 | Colaborador e veículo vêm do cadastro mestre | `agendaMasterResolve`, `agendaCatalog`, `AgendaFileCatalog::fleet()` e `agendaNormalize()` | **GitHub Actions** | Testar desconhecido, duplicado, placa equivalente e veículo em uso. |
| AD-012 | Ctrl/Cmd no desktop e toque longo/equivalente no mobile | Não há componente de cards/drag-drop operacional no entrypoint V09; seleção encontrada em documentos usa checkboxes em `chooseDocuments()` | **ausente/divergente** | Seleção de documentos não implementa seleção de atividades. |
| AD-013 | Múltiplos cards em uma única operação/Undo | `agendaSelectMany()`, `destinos`, `todos_outros`, planos de até 40 etapas | **GitHub Actions** | O serviço suporta seleção múltipla; falta contrato automatizado cobrindo uma transação e um undo. |
| AD-014 | Drop oferece Mover/Copiar/Cancelar sem botão direito | Nenhum drag/drop de Agenda localizado em [george_v09.html](george-reuniao/george_v09.html) ou [app.js](george-reuniao/assets/v09/app.js) | **ausente/divergente** | Requisito de interface não está presente na V09. |
| AD-015 | Copiar preserva origem e cria destino roxo | `agendaApplyStep()` e `agendaOpsCopy()`/`agendaOpsBuildCopy()` em [AgendaDomain.php](george-reuniao/backend-ci/v09/lib/AgendaDomain.php), [AgendaOps.php](george-reuniao/backend-ci/v09/lib/AgendaOps.php) | **GitHub Actions** | Testar idempotência (`COPIA_JA_EXISTE`), origem e rastreabilidade. |
| AD-016 | Mover semanal cancela origem e cria destino | `agendaApplyStep()` operação `mover` | **GitHub Actions** | Testar um destino, rejeição de múltiplos destinos e estados resultantes. |
| AD-017 | Copiar manual mantém roxo em origem e destino | `agendaOpsBuildCopy()` zera origem semanal e marca `replanejado` | **GitHub Actions** | Falta caso de fixture específico. |
| AD-018 | Mover manual remove origem e mantém destino | `agendaCancelItem()` diferencia semanal/manual | **GitHub Actions** | Falta caso de fixture específico e conferência da projeção JSON. |
| AD-019 | Rastreabilidade de origem/destino/operação/data | `copiadoDeItemId`, `copiadoDeColaborador`, `operacaoOrigem`, `transacaoId`, eventos | **GitHub Actions** | Testar todos os campos e auditoria após repetição/idempotência. |
| AD-020 | Adicionar/remover participação sem apagar cadastro mestre | `agendaLink()` e `remover_colaborador` em [AgendaDomain.php](george-reuniao/backend-ci/v09/lib/AgendaDomain.php) | **GitHub Actions** | Backend implementa; UI global não foi encontrada no entrypoint V09. |
| AD-021 | Confirmação ao remover colaborador com atividades | `CONFIRMAR_REMOCAO_COLABORADOR` em `agendaApplyStep()` | **GitHub Actions** | Testar primeira resposta `needs_choice` e confirmação explícita no plano inteiro. |
| AD-022 | Cadastro rápido pendente não cria login | `AgendaFileCatalog::create()`, `agendaLink()`, contrato em [ajustes_098_rc3.txt](george-reuniao/backend-ci/v09/context/ajustes_098_rc3.txt) | **GitHub Actions** | Testar status pendente, ausência de credencial e vínculo diário. |
| AD-023 | Undo até último salvar e undo_all | `undo`, `undo_all`, `agendaOpsUndo*()` e `checkpoint` | **GitHub Actions** | Automatizar sequência editar → salvar → editar → undo; e falhas sem histórico. |
| AD-024 | Ctrl+Z na interface | Não há listener de Ctrl+Z para Agenda no V09; `agendaExecute` só expõe serviço | **ausente/divergente** | A regra visual não está implementada nesta superfície. |
| AD-025 | Bloquear salto de dia e manter consulta sem escrita | `agendaNextDay()`, validações de data e `agendaRead()` | **GitHub Actions** | Testar dia aberto, histórico e sexta-feira. |
| AD-026 | Finalização com percentual/motivo por atividade | `agendaCloseValues()` | **GitHub Actions** | Testar 100%, parcial, cancelamento sem percentual e campos pendentes exatos. |
| AD-027 | Sessão e autenticação ERP | `session`, `login`, `logout`, `Core::actor()`, `Core::login()` em [api.php](george-reuniao/backend-ci/v09/api.php), [Core.php](george-reuniao/backend-ci/v09/lib/Core.php) | **GitHub Actions** | `php_api_smoke.sh` cobre contrato básico, mas não foi executado por falta de Bash/PHP/JQ. |
| AD-028 | Retomada em outro dispositivo sem dados operacionais locais | `resume`, `conversation_new`, storage servidor em [Core.php](george-reuniao/backend-ci/v09/lib/Core.php) e [api.php](george-reuniao/backend-ci/v09/api.php) | **GitHub Actions** | Testar cookie/sessão, registro, draft, turns, jobs e ausência de localStorage operacional. |
| AD-029 | Conversa digitada mantém contexto e módulo | `queueQuestion()`, `chat`, `module_select`, `appendTurn`, `initialize()` | **GitHub Actions** | Testar intenção, ambiguidade, retry, contexto Agenda/Geral e continuidade. |
| AD-030 | Voz: transcrição, fila, pausa, retomada e troca texto/áudio | `voice.connect()`, `event()`, `acceptTranscript()`, `stopSpeaking()`, `resumeTransmit()`, `realtime.php`, `speech.php` | **somente navegador** | Requer HTTPS, microfone, WebRTC, permissões, transcrição real e testes em dispositivos. |
| AD-031 | Reunião: finalizar, retomar encerramento e não duplicar aviso | `meetingEndIntent()`, `endCapture()`, `finishCapture()`, `state.finalizing`, `meeting_control` | **somente navegador** | Backend tem estados duráveis; precisa teste de interrupção, rede lenta, dupla ação e retorno à ata. |
| AD-032 | PDF de reunião/documento com template oficial e integridade | `Report::reportStep()`, `ExecutivePdfV1`, `download.php`, `pdf_viewer.js` | **teste manual** | Integridade/hash pode ir ao CI; equivalência visual com o modelo aprovado precisa navegador e inspeção humana. |
| AD-033 | Compartilhar PDF no mobile e fallback desktop | `navigator.share`, `navigator.canShare`, `GeorgePdf.open`, `fileActions` em [app.js](george-reuniao/assets/v09/app.js) e [pdf_viewer.js](george-reuniao/assets/v09/pdf_viewer.js) | **somente navegador** | Requer Android/iOS/desktop e gesto nativo de compartilhamento. |
| AD-034 | Anexos, foto, vídeo, prévia, análise e fila | `mediaStart`, upload em chunks, `GeorgeAgendaExperience.create`, `prepareInBrowser`, [Media.php](george-reuniao/backend-ci/v09/lib/Media.php), [Extensions.php](george-reuniao/backend-ci/v09/lib/Extensions.php) | **somente navegador** | CI pode testar contratos/chunks; câmera, codecs, preview, reprodução e preparação exigem navegador. |
| AD-035 | Cancelar, excluir e selecionar múltiplos arquivos da fila | `mediaQueueChange()` em [MediaQueue.php](george-reuniao/backend-ci/v09/lib/MediaQueue.php); `showMediaQueue()` em [app.js](george-reuniao/assets/v09/app.js) | **GitHub Actions** | Backend aceita `record_ids`; UI atual oferece exclusão individual e limpar fila, não seleção múltipla de cards de Agenda. |
| AD-036 | Bloqueios de gravação, upload, empresa e banco | `record()`, `locked()`, `agendaWithLock()`, empresa ativa em `api.php`, `state.busy/finalizing/upload` | **GitHub Actions** | Testar concorrência, empresa alterada, registro fechado, banco/projeção divergente e operação em andamento. |
| AD-037 | Desktop e mobile sem sobreposição e com responsividade | `styles.css`, `agenda_day_experience.css`, `pdf_viewer.js`, media queries em [styles.css](george-reuniao/assets/v09/styles.css) | **somente navegador** | Há regras para `600px`, `390px` e PDF; falta screenshot/automação visual em viewports reais. |
| AD-038 | Documentação, contratos, fontes e limitações acompanham o pacote | [STAGING_E_VALIDACAO.md](george-reuniao/STAGING_E_VALIDACAO.md), `context/raiox_agenda_v1.txt`, `context/ajustes_098_rc3.txt`, `context/template_spec.json` | **teste manual** | Há documentação técnica, mas o pacote ainda não prova a execução integral nem resolve o conflito do relatório. |

## Cobertura por área solicitada

| Área | Caminhos reais | Resultado do confronto |
|---|---|---|
| Layout desktop/mobile | `george_v09.html`, `assets/v09/styles.css`, `agenda_day_experience.css`, `pwa_shell.css` | Chat V09 tem responsividade; tela de cards da Agenda, drag/drop e cores não estão presentes no entrypoint. |
| Conversa digitada | `sendText()`, `queueQuestion()`, `chatAnswer()`, `appendTurn()` | Implementado estruturalmente; cobertura comportamental ainda ausente. |
| Voz | `voice`, `realtime.php`, `speech.php`, `MediaRecorder` | Implementado com dependência forte de navegador/ambiente. |
| Agenda do Dia | `agendaRead`, `agendaExecute`, `agendaTools`, `AgendaDomain`, `AgendaJson`, `AgendaStore` | Motor backend existe; UI visual integrada não foi localizada. |
| Criar/mover/copiar/recortar/excluir | `adicionar`, `mover`, `copiar`, `cancelar`, `remover_colaborador`, `mediaQueueChange` | Operações de Agenda são capability por serviço/conversa; “recortar” é representado por `mover`, não por uma ação UI encontrada. |
| Selecionar múltiplos cards | `agendaSelectMany()` no backend; checkboxes apenas em `chooseDocuments()` | Divergente: não há seleção múltipla de cards da Agenda no frontend V09. |
| PDF | `agenda_report_bridge.js`, `Report.php`, `ExecutivePdfV1.php`, `pdf_viewer.js`, `download.php` | Dois caminhos de relatório; o da Agenda diverge da regra de template único. |
| Finalizar/retomar/novo dia | `endCapture()/processJob()` para reunião; `agendaCloseValues()/agendaNextDay()` para Agenda | Ambos têm base de backend, sem regressão ponta a ponta. |
| Bloqueios | `locked()`, locks por registro/Agenda/processo, estados UI | Implementados em camadas distintas; precisam testes de concorrência e falhas. |
| Sessão/autenticação | `session`, `login`, `logout`, cookie `GEORGEV09`, CSRF | Implementados; smoke existente é insuficiente e não executado localmente. |

## Riscos e dependências

1. **Risco crítico de relatório:** corrigir apenas o roteamento não resolve a divergência visual; o template precisa ser uma fonte compartilhada entre tela, impressão, PDF e compartilhamento.
2. **Risco de falsa aprovação:** presença de `agendaExecute()` e `agendaTools()` não comprova a interface oficial, drag/drop, cores ou acessibilidade.
3. **Risco de ambiente:** o contrato depende de PHP 8.2/8.3, cURL, sessão, storage isolado, FFmpeg/FFprobe quando aplicável, HTTPS e chave/configuração apenas em staging.
4. **Risco de fonte:** JSON é a persistência operacional declarada em [ajustes_098_rc3.txt](george-reuniao/backend-ci/v09/context/ajustes_098_rc3.txt); SQL só pode ser tratado como ativo depois de `agenda_install`, bootstrap verificado e ativação confirmada.
5. **Risco de mídia:** câmera, WebRTC, codecs, permissões, tela em segundo plano e compartilhamento não são cobertos por teste PHP.
6. **Risco de regressão conversacional:** regex local, contexto de módulo e fallback `document_create` podem se sobrepor; frases positivas, negativas e ambíguas precisam permanecer no conjunto de regressão.

## Ordem recomendada de implementação e validação

1. Congelar fixtures e evidências: rascunho aberto, histórico, semanal de sexta, colaboradores, veículos, atividades semanais/manuais/canceladas e usuários de teste.
2. Criar no GitHub Actions lint JS/PHP, smoke HTTP/JSON, testes de `agendaExecute`/`agendaDomain`, idempotência, locks, undo/checkpoint, finalização e projeção.
3. Resolver o contrato do relatório: definir o template único aprovado e eliminar o caminho paralelo de canvas/analytics ou fazê-lo reutilizar o mesmo renderer, conforme decisão de produto.
4. Automatizar roteamento conversacional com matriz de frases, incluindo pedidos de Agenda, conversa, semanal, ata, PDF, erro e ambiguidade.
5. Integrar a tela oficial de Agenda ao mesmo serviço: cards, estados, criação, edição, mover, copiar, recortar, cancelar, restaurar, seleção múltipla desktop/mobile, colaboradores e feedback de bloqueio.
6. Executar navegador desktop e mobile: layout, teclado/toque, voz, gravação, pausa/retomada, PDF, impressão e compartilhamento nativo.
7. Executar staging isolado com os mesmos contratos do CI e registrar versão PHP, commit, arquivos, limitações e evidências.
8. Repetir a matriz integral após cada correção; só considerar liberação quando todo requisito obrigatório tiver evidência `OK` segundo o critério da auditoria.

## Validações executadas nesta análise

- `get_errors`: sem erros reportados em `assets/v09/app.js`, `assets/v09/agenda_report_bridge.js` e `backend-ci/v09/api.php`.
- `node --check`: não executado; `node` não está instalado neste ambiente Windows.
- `tests/php_api_smoke.sh`: não executado; `bash` não está disponível neste ambiente. O script existente cobre somente `session`, `login`, `conversation_new` e `resume`.
- Nenhuma alteração funcional, produção, branch `main`, commit ou push foi realizada.