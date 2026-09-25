# ERP ÍMPAR — preparação da base SaaS azul

Status: PREPARAÇÃO / NÃO IMPLANTAR. Esta árvore ainda não contém o frontend integrado nem um backend novo.

## Direção confirmada em 25/09/2026

PMOC será o primeiro módulo da nova versão comercial SaaS, com banco de dados e isolamento por empresa. Os oito HTMLs enviados pelo responsável são a referência visual e de interação. Preservar o azul do index/login, o novo drag and drop, a cópia encadeada com Ctrl, o calendário único de período e a inclusão fluida de atividades. Não importar a interface ou as travas antigas ao integrar.

## Estrutura limpa

- frontend/: destino dos arquivos realmente utilizados, após integração.
- docs/: decisões, inventário e mapa de integração.
- tests/: orientação e evidências de verificação.

A árvore começa sem os arquivos legados. O commit mantém um pai histórico para rastreabilidade: isto NÃO é uma branch órfã, não reduz o histórico inteiro do repositório e não apaga a main. Não fazer merge desta árvore limpa na main: a migração do sistema atual será posterior, seletiva e autorizada.

Nenhum workflow de deploy, CNAME, segredo, dado operacional ou cópia de banco foi incluído. As telas originais continuam preservadas nos anexos da conversa; não foram publicadas nesta branch.

## Dependência para a próxima entrega

Conferir a cópia vigente dos PHPs do KingHost e a estrutura do banco SaaS, sem credenciais. A leitura de um cliente JavaScript do GitHub não comprova qual backend está implantado. Só depois conectar sessão/empresa, permissões, cadastros, agendas, fechamento e relatórios. Nada foi gravado no backend de produção nesta preparação.
