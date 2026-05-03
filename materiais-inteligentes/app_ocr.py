
# app_ocr.py
# ERP ÍMPAR • Motor OCR DANFE

import requests

API = "https://api.erpimpar.com.br/danfe/salvar_resultado.php"

def enviar_resultado(payload):

    r = requests.post(
        API,
        json=payload,
        timeout=120
    )

    print(r.text)

if __name__ == "__main__":
    print("Motor OCR inicializado.")
