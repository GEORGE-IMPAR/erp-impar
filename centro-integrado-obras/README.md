# V16.35 — Convite inline no RDO

## Prioridade
Suba estes arquivos:

### KingHost/API `/api/centro-integrado-obras/`
- `participantes_api.php`
- `convite.php`
- `telegram_invite.php` (se ainda não aplicou o convite no bot)

### GitHub/front `/centro-integrado-obras/`
- `sala.html`

### Menu principal
- Substituir `/menu.html` pelo `menu.html` deste pacote.

## O que mudou
- Na Sala/RDO, cada participante ganhou botão `📨 Enviar/Reenviar`.
- O botão gera convite oficial via API e abre WhatsApp com mensagem pronta.
- O link do convite agora aponta para `api.erpimpar.com.br`, evitando erro 404 em PHP no GitHub.
- Card do Centro Integrado de Obras foi inserido nativo no menu principal.

## Teste rápido
1. Abrir uma sala: `/centro-integrado-obras/sala.html?obra=CORPORATE%208%20-%20LINHAS`.
2. Ir em Participantes.
3. Clicar em `📨 Enviar` ao lado do participante.
4. Confirmar se abre WhatsApp com o convite.
5. O convidado clica no link, instala/abre Telegram e ativa o acesso.
