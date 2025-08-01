# ERP Impar - Atualização do módulo de Solicitação de Materiais

## Passo a passo para atualizar no GitHub Pages

1. Extraia este ZIP na pasta do seu projeto (substitua os arquivos existentes).
   - solicitacao.html
   - script.js

2. Abra o Git Bash ou CMD na pasta do projeto. Exemplo:
   cd C:/IMPAR/erp-impar

3. Execute os comandos abaixo:

   git add solicitacao.html script.js
   git commit -m "Atualização: botão de envio de solicitação por e-mail"
   git push origin main

4. Aguarde de 1 a 5 minutos até o GitHub Pages atualizar.

5. Teste acessando:
   https://www.erpimpar.com.br/solicitacao.html

## Observações
- O botão antigo de baixar Word foi removido.
- Agora o botão "Gerar solicitação de material e enviar por e-mail" cria o arquivo Word automaticamente e envia em anexo pelo EmailJS.
- O arquivo é nomeado no formato:
  SOLICITACAO_MATERIAIS_NomeUsuario_Data_Numero.docx

