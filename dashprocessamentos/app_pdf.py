import os
from ftplib import FTP
from flask import Flask, jsonify

app = Flask(__name__)

FTP_HOST = os.getenv("FTP_HOST")
FTP_USER = os.getenv("FTP_USER")
FTP_PASS = os.getenv("FTP_PASS")
FTP_PATH = os.getenv("FTP_PATH")

@app.route("/")
def home():
    return jsonify({"status": "ok", "msg": "Motor PDF rodando 🚀"})

@app.route("/pdf/processar")
def processar():

    logs = []
    arquivos = []

    try:
        ftp = FTP(FTP_HOST)
        ftp.login(FTP_USER, FTP_PASS)
        ftp.cwd(FTP_PATH)

        arquivos = ftp.nlst()

        pdfs = [f for f in arquivos if f.lower().endswith(".pdf")]

        logs.append(f"{len(pdfs)} PDFs encontrados")

        # aqui só listamos por enquanto (próximo passo é baixar e processar)
        
        return jsonify({
            "status": "ok",
            "pdfs_encontrados": len(pdfs),
            "arquivos": pdfs,
            "logs": logs
        })

    except Exception as e:
        return jsonify({
            "status": "erro",
            "erro": str(e)
        })
