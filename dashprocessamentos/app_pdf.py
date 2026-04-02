import os
import re
import json
from flask import Flask, jsonify, request

app = Flask(__name__)

# 🔥 AGORA SIM: DISCO DO RENDER
BASE_PATH = "/data/pdfs"

ENTRADA = f"{BASE_PATH}/entrada"
PROCESSADOS = f"{BASE_PATH}/processados"
ERRO = f"{BASE_PATH}/erro"
JSON_DIR = f"{BASE_PATH}/json"

# cria estrutura automaticamente
os.makedirs(ENTRADA, exist_ok=True)
os.makedirs(PROCESSADOS, exist_ok=True)
os.makedirs(ERRO, exist_ok=True)
os.makedirs(JSON_DIR, exist_ok=True)

@app.route("/")
def home():
    return jsonify({"status": "ok", "msg": "Motor PDF rodando 🚀"})

# 🔥 UPLOAD DE PDF
@app.route("/pdf/upload", methods=["POST"])
def upload():
    if 'file' not in request.files:
        return {"erro": "sem arquivo"}

    file = request.files['file']
    path = os.path.join(ENTRADA, file.filename)
    file.save(path)

    return {"status": "ok", "arquivo": file.filename}

# 🔥 PROCESSAMENTO
@app.route("/pdf/processar")
def processar():

    logs = []
    resumo = []

    arquivos = [f for f in os.listdir(ENTRADA) if f.lower().endswith(".pdf")]

    for nome in arquivos:
        caminho = os.path.join(ENTRADA, nome)

        logs.append(f"Processando {nome}")

        try:
            with open(caminho, "rb") as f:
                texto = f.read().decode(errors="ignore")

            # 🔍 EXTRAÇÃO BÁSICA (vamos melhorar depois)
            nf = re.search(r'NF\s*(\d+)', texto)
            total = re.search(r'([\d\.,]+)', texto)

            numero = nf.group(1) if nf else "0"

            resumo.append({
                "arquivo": nome,
                "nf": numero
            })

            os.rename(caminho, os.path.join(PROCESSADOS, nome))

        except Exception as e:
            logs.append(str(e))
            os.rename(caminho, os.path.join(ERRO, nome))

    with open(f"{JSON_DIR}/resumo.json", "w") as f:
        json.dump(resumo, f, indent=2)

    return jsonify({
        "status": "ok",
        "processados": len(resumo),
        "logs": logs
    })

# 🔥 STATUS
@app.route("/pdf/status")
def status():
    return jsonify({
        "fila": len(os.listdir(ENTRADA)),
        "processados": len(os.listdir(PROCESSADOS)),
        "erro": len(os.listdir(ERRO))
    })
