from flask import Flask, request, jsonify, send_file
import time
import pandas as pd
import os

app = Flask(__name__)

ULTIMO_ARQUIVO = "resultado.xlsx"

def gerar_dados(material):
    dados = []

    if material == "elastomerico":
        base = 3
    elif material == "cobre":
        base = 25
    else:
        base = 10

    fornecedores = [
        ("Índia", base),
        ("Vietnã", base * 1.2),
        ("Brasil", base * 5)
    ]

    for nome, preco in fornecedores:
        estimado = preco * 2.5
        dados.append({
            "fornecedor": nome,
            "pais": nome,
            "origem": round(preco,2),
            "brasil": round(estimado,2),
        })

    return dados

@app.route("/buscar", methods=["POST"])
def buscar():
    material = request.json.get("material")

    logs = []
    logs.append("🔍 Iniciando busca...")
    time.sleep(1)

    logs.append("🌐 Consultando fornecedores...")
    time.sleep(1)

    dados = gerar_dados(material)

    logs.append("💰 Preços encontrados")
    time.sleep(1)

    df = pd.DataFrame(dados)
    df.to_excel(ULTIMO_ARQUIVO, index=False)

    logs.append("✅ Planilha gerada")

    return jsonify({
        "logs": logs,
        "dados": dados
    })

@app.route("/baixar")
def baixar():
    if os.path.exists(ULTIMO_ARQUIVO):
        return send_file(ULTIMO_ARQUIVO, as_attachment=True)
    return "Arquivo não encontrado", 404

if __name__ == "__main__":
    app.run(port=8765)