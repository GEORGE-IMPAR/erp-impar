import os
import requests
import re
import statistics
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SERP_API_KEY = os.getenv("SERP_API_KEY")
BRIGHT_API_KEY = os.getenv("BRIGHTDATA_API_KEY")

FONTES_RUINS = ["indiamart", "tradeindia", "exportersindia"]

# =========================
# UTIL
# =========================
def is_fonte_ruim(link):
    return any(f in link.lower() for f in FONTES_RUINS)

def extrair_preco(texto):
    matches = re.findall(r"(\d+[.,]?\d*)", texto)
    if not matches:
        return None
    try:
        return float(matches[0].replace(",", "."))
    except:
        return None

def detectar_tipo_cobre(nome):
    nome = nome.lower()
    if "coil" in nome or "soft" in nome or "flex":
        return "flexivel"
    return "rigido"

def calcular_brasil(origem, pais):
    if pais.lower() == "brasil":
        return origem
    return round(origem * 2.2, 2)

def validar_preco(material, preco):
    if material == "cobre" and preco < 20:
        return False
    if material == "elastomerico" and preco < 1:
        return False
    return True

# =========================
# SERP
# =========================
def buscar_serp(query):
    url = "https://serpapi.com/search.json"
    params = {
        "q": query,
        "api_key": SERP_API_KEY,
        "engine": "google"
    }

    resp = requests.get(url, params=params, timeout=20)
    resp.raise_for_status()
    return resp.json().get("organic_results", [])

# =========================
# BRIGHT DATA
# =========================
def abrir_pagina(url):
    endpoint = "https://api.brightdata.com/request"

    payload = {
        "zone": "web_unlocker1",
        "url": url,
        "format": "raw"
    }

    headers = {
        "Authorization": f"Bearer {BRIGHT_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        resp = requests.post(endpoint, json=payload, headers=headers, timeout=25)
        resp.raise_for_status()
        return resp.text[:5000]
    except:
        return ""

# =========================
# QUERY INTELIGENTE
# =========================
def montar_query(material, tipo, bitola):
    if material == "cobre":
        return f"copper tube {tipo} {bitola} hvac price per kg supplier china india"
    elif material == "elastomerico":
        return f"elastomeric insulation {bitola} hvac price per meter supplier"
    else:
        return "galvanized steel sheet price per unit supplier"

# =========================
# HISTÓRICO
# =========================
def salvar_historico(material, dados):
    path = f"historico_{material}.json"

    try:
        antigo = []
        if os.path.exists(path):
            with open(path) as f:
                antigo = json.load(f)

        antigo.append({
            "data": str(datetime.now()),
            "dados": dados
        })

        with open(path, "w") as f:
            json.dump(antigo, f)

    except:
        pass

# =========================
# SCORE
# =========================
def calcular_confianca(precos):
    if len(precos) < 3:
        return "C"

    variacao = max(precos) - min(precos)

    if variacao < 10:
        return "A"
    elif variacao < 30:
        return "B"
    return "C"

# =========================
# INSIGHT
# =========================
def gerar_insight(precos, melhor):
    media = statistics.mean(precos)

    if melhor["brasil"] < media:
        return "Preço abaixo da média global. Excelente oportunidade."
    elif melhor["brasil"] < media * 1.2:
        return "Preço dentro da média de mercado. Compra viável."
    else:
        return "Preço acima da média global. Avaliar negociação."

# =========================
# CORE
# =========================
def processar(material, tipo, bitola):
    logs = []
    dados = []

    query = montar_query(material, tipo, bitola)
    logs.append(f"🔎 Query: {query}")

    resultados = buscar_serp(query)
    logs.append(f"🌐 {len(resultados)} links encontrados")

    for r in resultados[:8]:
        link = r.get("link", "")
        titulo = r.get("title", "")
        snippet = r.get("snippet", "")

        if is_fonte_ruim(link):
            continue

        texto = snippet

        pagina = abrir_pagina(link)
        if pagina:
            texto += " " + pagina

        preco = extrair_preco(texto)

        if not preco or not validar_preco(material, preco):
            continue

        pais = "Índia" if "india" in link.lower() else "China"

        tipo_cobre = None
        if material == "cobre":
            tipo_cobre = detectar_tipo_cobre(titulo)

        brasil = calcular_brasil(preco, pais)

        dados.append({
            "fornecedor": titulo[:60],
            "pais": pais,
            "origem": preco,
            "brasil": brasil,
            "tipo": tipo_cobre,
            "link": link
        })

    if not dados:
        return [], logs, {}, "C", "Sem dados suficientes"

    precos = [d["origem"] for d in dados]

    media = round(statistics.mean(precos), 2)
    mediana = statistics.median(precos)
    confianca = calcular_confianca(precos)

    melhor = min(dados, key=lambda x: x["brasil"])

    insight = gerar_insight(precos, melhor)

    grafico = {
        "labels": [d["fornecedor"][:20] for d in dados],
        "valores": [d["origem"] for d in dados]
    }

    salvar_historico(material, dados)

    return dados, logs, grafico, confianca, insight

# =========================
# ROTAS
# =========================
@app.route("/")
def home():
    return jsonify({
        "ok": True,
        "service": "consulta-precos-impar",
        "status": "online"
    })

@app.route("/buscar", methods=["POST"])
def buscar():
    data = request.get_json(silent=True) or {}

    material = data.get("material", "cobre")
    tipo = data.get("tipo", "flexivel")
    bitola = data.get("bitola", "")

    logs = ["🚀 HARD V2 iniciado"]

    try:
        dados, logs_core, grafico, confianca, insight = processar(material, tipo, bitola)
        logs += logs_core

        melhor = min(dados, key=lambda x: x["brasil"]) if dados else None

        return jsonify({
            "ok": True,
            "dados": dados,
            "melhor": melhor,
            "confianca": confianca,
            "insight": insight,
            "grafico": grafico,
            "logs": logs
        })

    except Exception as e:
        logs.append(str(e))
        return jsonify({
            "ok": False,
            "logs": logs
        }), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
