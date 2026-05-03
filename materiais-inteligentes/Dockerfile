FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=10000
ENV ERP_SALVAR_ENDPOINT=https://api.erpimpar.com.br/danfe/salvar_resultado.php

CMD ["uvicorn", "app_ocr:app", "--host", "0.0.0.0", "--port", "10000"]
