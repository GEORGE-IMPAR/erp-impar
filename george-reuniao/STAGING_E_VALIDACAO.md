# George — barreira de pré-deploy

Nenhum ZIP deve ser chamado de “validado” apenas por passar em conferência estática.

## Barreira 1 — GitHub Actions

O workflow `George PHP Preflight` executa PHP 8.2 e 8.3 e reprova quando:

- qualquer PHP possui erro de sintaxe;
- `app.js` ou `agenda_report_bridge.js` possui erro de sintaxe;
- o endpoint não responde `Content-Type: application/json`;
- a resposta contém HTML, warning, notice ou fatal error;
- `session`, `login`, `conversation_new` ou `resume` não completam o contrato esperado.

O teste usa usuário, senha e armazenamento sintéticos. Não chama OpenAI e não acessa o banco real.

## Barreira 2 — staging KingHost

Diretório sugerido: `/www/api/george-reuniao-staging/v09/`.

Regras obrigatórias:

1. `config.local.php` próprio, sem compartilhar storage com produção.
2. Chave OpenAI vazia nos testes de inicialização.
3. Banco separado ou `agenda_backend=json` com dados sintéticos.
4. Origem permitida limitada ao frontend de staging.
5. Executar os mesmos contratos HTTP do CI na versão PHP real da hospedagem.
6. Não substituir `/www/api/george-reuniao/v09/` até CI e staging estarem verdes.

## Regra de liberação

O relatório de liberação precisa registrar: commit, versão PHP, arquivos do pacote, resultado do lint, resultado do smoke HTTP/JSON e limitações não testadas.

