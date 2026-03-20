from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import os
import time

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ULTIMO_ARQUIVO = os.path.join(BASE_DIR, "resultado_consulta.xlsx")

def gerar_dados(material, mercado, modo):
    # simulação mais inteligente até plugar a busca real
    if material == "elastomerico":
        if mercado == "asia":
            dados = [
                {"fornecedor":"Aaryi Industrial Materials", "pais":"Índia", "origem":2.28, "unidade":"m"},
                {"fornecedor":"NBR Tube Supplier", "pais":"Índia", "origem":3.00, "unidade":"m"},
                {"fornecedor":"Thermaflex Supplier", "pais":"Índia", "origem":3.60, "unidade":"m"},
                {"fornecedor":"Fornecedor Brasil", "pais":"Brasil", "origem":20.24, "unidade":"m"},
            ]
        elif mercado == "brasil":
            dados = [
                {"fornecedor":"Fornecedor SC", "pais":"Brasil", "origem":13.85, "unidade":"m"},
                {"fornecedor":"Fornecedor SP", "pais":"Brasil", "origem":20.24, "unidade":"m"},
                {"fornecedor":"Fornecedor PR", "pais":"Brasil", "origem":25.56, "unidade":"m"},
            ]
        else:
            dados = [
                {"fornecedor":"Índia Lead", "pais":"Índia", "origem":2.28, "unidade":"m"},
                {"fornecedor":"Vietnã Lead", "pais":"Vietnã", "origem":4.10, "unidade":"m"},
                {"fornecedor":"Brasil", "pais":"Brasil", "origem":20.24, "unidade":"m"},
            ]

    elif material == "cobre":
        if mercado == "asia":
            dados = [
                {"fornecedor":"India Copper Tube", "pais":"Índia", "origem":51.60, "unidade":"kg"},
                {"fornecedor":"Made in Asia", "pais":"Vietnã", "origem":58.00, "unidade":"kg"},
                {"fornecedor":"Brasil Base", "pais":"Brasil", "origem":130.00, "unidade":"kg"},
            ]
        elif mercado == "brasil":
            dados = [
                {"fornecedor":"Distribuidor SC", "pais":"Brasil", "origem":130.00, "unidade":"kg"},
                {"fornecedor":"Distribuidor SP", "pais":"Brasil", "origem":150.00, "unidade":"kg"},
            ]
        else:
            dados = [
                {"fornecedor":"Índia", "pais":"Índia", "origem":51.60, "unidade":"kg"},
                {"fornecedor":"China", "pais":"China", "origem":52.50, "unidade":"kg"},
                {"fornecedor":"Brasil", "pais":"Brasil", "origem":130.00, "unidade":"kg"},
            ]

    else:  # aço galvanizado
        if mercado == "asia":
            dados = [
                {"fornecedor":"Turkey GI Coil", "pais":"Turquia", "origem":5.10, "unidade":"kg"},
                {"fornecedor":"Vietnam GI Sheet", "pais":"Vietnã", "origem":5.60, "unidade":"kg"},
                {"fornecedor":"Brasil Base", "pais":"Brasil", "origem":13.00, "unidade":"kg"},
            ]
        elif mercado == "brasil":
            dados = [
                {"fornecedor":"Fornecedor SC", "pais":"Brasil", "origem":13.00, "unidade":"kg"},
                {"fornecedor":"Fornecedor Santos", "pais":"Brasil", "origem":12.70, "unidade":"kg"},
            ]
        else:
            dados = [
                {"fornecedor":"Turquia", "pais":"Turquia", "origem":5.10, "unidade":"kg"},
                {"fornecedor":"Vietnã", "pais":"Vietnã", "origem":5.60, "unidade":"kg"},
                {"fornecedor":"Brasil", "pais":"Brasil", "origem":13.00, "unidade":"kg"},
            ]

    # estimativa de custo Brasil
    for d in dados:
        if material == "cobre":
            fator = 2.4
        elif material == "aco_galvanizado":
            fator = 2.1
        else:
            fator = 2.5

        d["brasil"] = round(d["origem"] * fator, 2)

    return dados

@app.route("/buscar", methods=["POST"])
def buscar():
    payload = request.get_json(force=True)
    material = payload.get("material", "elastomerico")
    mercado = payload.get("mercado", "asia")
    modo = payload.get("modo", "preco")

    logs = []
    logs.append("🔍 Iniciando busca estratégica...")
    time.sleep(0.25)
    logs.append(f"🌐 Mercado selecionado: {mercado}")
    time.sleep(0.25)
    logs.append(f"📦 Material selecionado: {material}")
    time.sleep(0.25)
    logs.append(f"🧭 Modo de retorno: {modo}")
    time.sleep(0.25)
    logs.append("🚚 Calculando custo estimado até o Brasil...")
    time.sleep(0.25)

    dados = gerar_dados(material, mercado, modo)

    df = pd.DataFrame(dados)
    df.to_excel(ULTIMO_ARQUIVO, index=False)

    logs.append(f"✅ {len(dados)} fornecedores processados")
    logs.append("✅ Planilha gerada com sucesso")

    return jsonify({
        "logs": logs,
        "dados": dados
    })

@app.route("/baixar", methods=["GET"])
def baixar():
    if not os.path.exists(ULTIMO_ARQUIVO):
        return "Arquivo ainda não gerado.", 404
    return send_file(ULTIMO_ARQUIVO, as_attachment=True)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765, debug=True)
