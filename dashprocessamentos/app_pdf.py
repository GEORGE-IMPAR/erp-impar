import os
from ftplib import FTP
def ftp_connect():
    ftp = FTP()
    ftp.connect(FTP_HOST, 21, timeout=30)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.set_pasv(True)
    return ftp
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
    try:
        logs.append(f"HOST={FTP_HOST}")
        logs.append(f"USER={FTP_USER}")
        logs.append(f"PATH={FTP_PATH}")

        ftp = ftp_connect()
        logs.append("Conectado ao FTP com sucesso")

        ftp.cwd(FTP_PATH)
        logs.append(f"Entrou na pasta {FTP_PATH}")

        arquivos = ftp.nlst()
        pdfs = [f for f in arquivos if f.lower().endswith(".pdf")]

        ftp.quit()

        return jsonify({
            "status": "ok",
            "pdfs_encontrados": len(pdfs),
            "arquivos": pdfs,
            "logs": logs
        })

    except Exception as e:
        return jsonify({
            "status": "erro",
            "erro": str(e),
            "logs": logs
        }), 500
