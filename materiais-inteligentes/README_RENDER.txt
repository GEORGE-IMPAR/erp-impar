ERP ÍMPAR • OCR DANFE Render

Subir estes arquivos dentro da pasta do GitHub:
materiais-inteligentes/

Arquivos:
- app_ocr.py
- Dockerfile
- requirements.txt

Render:
- New > Web Service
- Repository: GEORGE-IMPAR/erp-impar
- Root Directory: materiais-inteligentes
- Runtime: Docker
- Branch: main

Endpoint final:
https://SEU-SERVICO.onrender.com/processar-lote

O motor processa PDFs e envia automaticamente o JSON para:
https://api.erpimpar.com.br/danfe/salvar_resultado.php
