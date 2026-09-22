# Homologação — Agenda do Dia

Data: 22/09/2026
Escopo: correção funcional e regressão da Agenda do Dia atual, sem redesenho e sem deploy.

## Resultado objetivo

- Corrigida a falha ao abrir **Colaboradores** quando `agenda_client_v2.js` não está disponível ou não inicializa. A tela deixa de quebrar com `Cannot read properties of undefined (reading 'flush')`, abre a lista local e informa que o cadastro central não foi consultado.
- Mantido o fluxo integrado original quando o cliente está disponível.
- Incluída regressão automática da tela e do cliente no workflow PHP 8.2/8.3.
- Confirmado por teste de contrato que o George consulta e altera a Agenda pelo domínio compartilhado e só anuncia sucesso verificado.
- Nenhum layout foi alterado.
- Nenhum deploy, commit, push ou escrita em produção foi realizado nesta etapa.

## Evidências executadas localmente

| Verificação | Resultado |
|---|---|
| 43 blocos JavaScript inline do HTML | PASS |
| Dependência `agenda_client_v2.js` ao lado do HTML | PASS |
| Controles Colaboradores, Planejamento, Relatório, Semanal e Salvar | PASS |
| Fallback seguro de Colaboradores | PASS |
| Copiar atividade preserva origem | PASS |
| Mover atividade retira origem e cria destino | PASS |
| Rastreabilidade da cópia/movimentação | PASS |
| Vincular e remover colaborador do dia | PASS |
| Persistência encaminhada ao endpoint oficial | PASS |
| George: `agenda_read` e `agenda_execute` no domínio compartilhado | PASS |
| George: plano transacional e confirmação `verified=true` | PASS |
| Sintaxe de `agenda_client_v2.js` e `agenda_interacoes.js` | PASS |
| Sintaxe do app e bridge de relatório do George | PASS |
| Estrutura YAML do workflow | PASS |
| `git diff --check` | PASS |

## Cobertura no CI

O workflow `George PHP Preflight` passa a disparar também quando mudarem:

- `cronograma/agenda_do_dia_novo.html`;
- `cronograma/agenda_client_v2.js`;
- `cronograma/agenda_interacoes.js`;
- testes da Agenda.

O job executa em PHP 8.2 e 8.3:

- sintaxe PHP e JavaScript crítica;
- testes da interface e do cliente da Agenda;
- contrato George/Agenda;
- smoke HTTP/JSON;
- regressão de domínio AD-001 a AD-006.

## Validações ainda obrigatórias em homologação

Estas verificações **não foram marcadas como aprovadas**:

1. Banco SQL real: não existe `db-v2/config.local.php` nesta cópia local.
2. Execução PHP local: o PHP CLI não está instalado neste ambiente.
3. Navegação autenticada no ERP: o acesso público redireciona ao login e esta sessão não possui credenciais do usuário.
4. Teste visual manual em desktop e celular com dados reais.
5. Operações destrutivas/reais de Salvar e Finalizar no banco de homologação.
6. Deploy/migração: devem ocorrer somente depois dos itens anteriores e de autorização explícita.

## Critério para encerrar a Agenda

A Agenda pode ser declarada pronta para deploy somente quando o workflow estiver verde, o diagnóstico do banco em homologação estiver aprovado e o roteiro autenticado confirmar abrir Colaboradores, mover/copiar/cancelar, salvar, consultar relatório/semanal e finalizar o dia sem divergência entre SQL e JSON.
