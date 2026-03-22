from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import time
import pandas as pd
import os

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ULTIMO_ARQUIVO = os.path.join(BASE_DIR, "resultado.xlsx")

flex_keywords = [
    "coil", "coils", "bobina", "roll",
    "soft", "annealed", "pancake",
    "flexible", "acr coil", "soft tube"
]

rigid_keywords = [
    "pipe", "pipes", "tube", "tubes",
    "straight", "length", "6m", "3m",
    "hard", "rigid", "straight length", "bar"
]

def classificar_cobre(texto: str) -> str:
    t = (texto or "").lower()

    score_flex = sum(1 for k in flex_keywords if k in t)
    score_rigid = sum(1 for k in rigid_keywords if k in t)

    if score_flex > score_rigid:
        return "flexivel"
    elif score_rigid > score_flex:
        return "rigido"
    return "indefinido"

def gerar_dados(material, mercado="asia", modo="preco"):
    if material == "elastomerico":
        if mercado == "asia":
            dados = [
                {"fornecedor":"Aaryi Industrial Materials", "pais":"Índia", "origem":2.28, "unidade":"m"},
                {"fornecedor":"NBR Tube Supplier", "pais":"Índia", "origem":3.00, "unidade":"m"},
                {"fornecedor":"Thermaflex Supplier", "pais":"Índia", "origem":3.60, "unidade":"m"},
                {"fornecedor":"Fornecedor Vietnã", "pais":"Vietnã", "origem":4.10, "unidade":"m"},
                {"fornecedor":"Fornecedor Brasil", "pais":"Brasil", "origem":20.24, "unidade":"m"},
            ]
            fator = 2.5
        elif mercado == "brasil":
            dados = [
                {"fornecedor":"Fornecedor SC", "pais":"Brasil", "origem":13.85, "unidade":"m"},
                {"fornecedor":"Fornecedor SP", "pais":"Brasil", "origem":20.24, "unidade":"m"},
                {"fornecedor":"Fornecedor PR", "pais":"Brasil", "origem":25.56, "unidade":"m"},
            ]
            fator = 1.0
        else:
            dados = [
                {"fornecedor":"Índia Lead", "pais":"Índia", "origem":2.28, "unidade":"m"},
                {"fornecedor":"Vietnã Lead", "pais":"Vietnã", "origem":4.10, "unidade":"m"},
                {"fornecedor":"Brasil", "pais":"Brasil", "origem":20.24, "unidade":"m"},
            ]
            fator = 2.5

    elif material == "cobre":
        if mercado == "asia":
            dados = [
                {
                    "fornecedor":"India Copper Tube Soft Coil",
                    "pais":"Índia",
                    "origem":51.60,
                    "unidade":"kg",
                    "tipo_cobre":"flexivel"
                },
                {
                    "fornecedor":"Vietnam Copper Tube Straight Length",
                    "pais":"Vietnã",
                    "origem":58.00,
                    "unidade":"kg",
                    "tipo_cobre":"rigido"
                },
                {
                    "fornecedor":"Brasil Copper Coil Base",
                    "pais":"Brasil",
                    "origem":130.00,
                    "unidade":"kg",
                    "tipo_cobre":"flexivel"
                },
                {
                    "fornecedor":"Brasil Copper Bar Base",
                    "pais":"Brasil",
                    "origem":150.00,
                    "unidade":"kg",
                    "tipo_cobre":"rigido"
                },
            ]
            fator = 2.4
        elif mercado == "brasil":
            dados = [
                {
                    "fornecedor":"Distribuidor SC Coil",
                    "pais":"Brasil",
                    "origem":130.00,
                    "unidade":"kg",
                    "tipo_cobre":"flexivel"
                },
                {
                    "fornecedor":"Distribuidor SP Barra",
                    "pais":"Brasil",
                    "origem":150.00,
                    "unidade":"kg",
                    "tipo_cobre":"rigido"
                },
            ]
            fator = 1.0
        else:
            dados = [
                {
                    "fornecedor":"Índia ACR Soft Coil",
                    "pais":"Índia",
                    "origem":51.60,
                    "unidade":"kg",
                    "tipo_cobre":"flexivel"
                },
                {
                    "fornecedor":"China Straight Copper Tube",
                    "pais":"China",
                    "origem":52.50,
                    "unidade":"kg",
                    "tipo_cobre":"rigido"
                },
                {
                    "fornecedor":"Brasil Flex Base",
                    "pais":"Brasil",
                    "origem":130.00,
                    "unidade":"kg",
                    "tipo_cobre":"flexivel"
                },
                {
                    "fornecedor":"Brasil Rígido Base",
                    "pais":"Brasil",
                    "origem":150.00,
                    "unidade":"kg",
                    "tipo_cobre":"rigido"
                },
            ]
            fator = 2.4

        for d in dados:
            if "tipo_cobre" not in d:
                d["tipo_cobre"] = classificar_cobre(d.get("fornecedor", ""))

        flexiveis = [d for d in dados if d.get("tipo_cobre") == "flexivel"]
        rigidos = [d for d in dados if d.get("tipo_cobre") == "rigido"]
        indef = [d for d in dados if d.get("tipo_cobre") not in ["flexivel", "rigido"]]

        flexiveis.sort(key=lambda x: x["origem"])
        rigidos.sort(key=lambda x: x["origem"])
        indef.sort(key=lambda x: x["origem"])

        dados = flexiveis + rigidos + indef

    else:  # aco_galvanizado
        if mercado == "asia":
            dados = [
                {"fornecedor":"Turkey GI Coil", "pais":"Turquia", "origem":5.10, "unidade":"kg"},
                {"fornecedor":"Vietnam GI Sheet", "pais":"Vietnã", "origem":5.60, "unidade":"kg"},
                {"fornecedor":"Brasil Base", "pais":"Brasil", "origem":13.00, "unidade":"kg"},
            ]
            fator = 2.1
        elif mercado == "brasil":
            dados = [
                {"fornecedor":"Fornecedor SC", "pais":"Brasil", "origem":13.00, "unidade":"kg"},
                {"fornecedor":"Fornecedor Santos", "pais":"Brasil", "origem":12.70, "unidade":"kg"},
            ]
            fator = 1.0
        else:
            dados = [
                {"fornecedor":"Turquia", "pais":"Turquia", "origem":5.10, "unidade":"kg"},
                {"fornecedor":"Vietnã", "pais":"Vietnã", "origem":5.60, "unidade":"kg"},
                {"fornecedor":"Brasil", "pais":"Brasil", "origem":13.00, "unidade":"kg"},
            ]
            fator = 2.1

    for d in dados:
        d["brasil"] = round(d["origem"] * fator, 2)

    return dados

@app.route("/")
def home():
    return jsonify({
        "ok": True,
        "service": "consulta-precos-impar",
        "status": "online"
    })

@app.route("/buscar", methods=["POST"])
def buscar():
    payload = request.get_json(silent=True) or {}
    material = payload.get("material", "elastomerico")
    mercado = payload.get("mercado", "asia")
    modo = payload.get("modo", "preco")

    logs = []
    logs.append("🔍 Iniciando busca...")
    time.sleep(0.2)

    logs.append(f"🌐 Mercado: {mercado}")
    time.sleep(0.2)

    logs.append(f"📦 Material: {material}")
    time.sleep(0.2)

    logs.append("💰 Processando ranking...")
    time.sleep(0.2)

    dados = gerar_dados(material, mercado, modo)

    if material == "cobre":
        qtd_flex = len([d for d in dados if d.get("tipo_cobre") == "flexivel"])
        qtd_rig = len([d for d in dados if d.get("tipo_cobre") == "rigido"])
        logs.append(f"✅ Cobre flexível: {qtd_flex} registro(s)")
        logs.append(f"✅ Cobre rígido: {qtd_rig} registro(s)")

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
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)