import os
import requests
import re
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SERP_API_KEY = os.getenv("SERP_API_KEY")
BRIGHT_API_KEY = os.getenv("BRIGHTDATA_API_KEY")

# ==========================================
# 🔥 BASE REAL (PDF LUSOTRADE)
# ==========================================

BASE_ELASTOMERICO = {
    "min": 1,
    "max": 50
}

# ==========================================
# 🔥 FILTRO DE MERCADO
# ==========================================

def validar_mercado(pais, mercado):
    pais = pais.lower()

    if mercado == "brasil":
        return "brasil" in pais

    if mercado == "asia":
        return any(x in pais for x in ["china", "india", "vietnam"])

    return True

# ==========================================
# 🔥 FILTRO DE LINKS RUINS
# ==========================================

def link_ruim(url):
    ruins = [
        "blog", "news", "market", "report",
        "quemfornece", "directory", "pdfviewer"
    ]
    return any(r in url.lower() for r in ruins)

# ==========================================
# 🔥 CLASSIFICAÇÃO DE FONTE
# ==========================================

def classificar_fonte(url, titulo):
    url = url.lower()
    titulo = titulo.lower()

    if "pdf" in url:
        return "A"

    if any(x in url for x in ["manufacturer", "factory", "supplier"]):
        return "A"

    if "indiamart" in url:
        return "C"

    if any(x in titulo for x in ["buy", "price", "hvac"]):
        return "B"

    return "C"

# ==========================================
# 🔥 GERADOR DE QUERY INTELIGENTE
# ==========================================

def gerar_queries(material):
    base = material.lower()

    queries = [
        f"{base} hvac price per meter supplier",
        f"elastomeric insulation tube {base} hvac price",
        f"rubber insulation pipe hvac price {base}",
        f"tubo espuma elastomerica preço {base}",
        f"{base} insulation supplier vietnam china hvac"
    ]

    return queries

# ==========================================
# 🔥 EXTRAÇÃO DE PREÇO
# ==========================================

def extrair_preco(texto):
    padrao = r'(\d+[.,]?\d*)\s?(USD|R\$|€)'
    match = re.search(padrao, texto)

    if match:
        valor = float(match.group(1).replace(",", "."))
        moeda = match.group(2)
        return valor, moeda

    return None, None

# ==========================================
# 🔥 BRIGHT DATA
# ==========================================

def extrair_preco_pagina(url):
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
        r = requests.post(endpoint, json=payload, headers=headers, timeout=15)
        html = r.text

        valor, moeda = extrair_preco(html)
        return valor, moeda

    except:
        return None, None

# ==========================================
# 🔥 VALIDAÇÃO DE PREÇO
# ==========================================

def validar_preco(valor):
    if valor < BASE_ELASTOMERICO["min"]:
        return False

    if valor > BASE_ELASTOMERICO["max"]:
        return False

    return True

# ==========================================
# 🔥 SCORE
# ==========================================

def score_fonte(classe):
    if classe == "A":
        return 1.0
    if classe == "B":
        return 0.7
    return 0.3

# ==========================================
# 🔥 BUSCA SERP
# ==========================================

def buscar_serp(query):
    url = "https://serpapi.com/search.json"

    params = {
        "q": query,
        "api_key": SERP_API_KEY,
        "engine": "google"
    }

    r = requests.get(url, params=params)
    return r.json()

# ==========================================
# 🔥 PROCESSAMENTO
# ==========================================

def processar(material, mercado):
    logs = []
    resultados = []

    queries = gerar_queries(material)

    logs.append(f"🔎 {len(queries)} estratégias de busca geradas")

    for q in queries:
        logs.append(f"🌐 Query: {q}")

        data = buscar_serp(q)

        if "organic_results" not in data:
            continue

        for item in data["organic_results"][:7]:
            url = item.get("link", "")
            titulo = item.get("title", "")

            if link_ruim(url):
                continue

            valor, moeda = extrair_preco_pagina(url)

            if not valor:
                continue

            classe = classificar_fonte(url, titulo)

            if not validar_preco(valor):
                continue

            peso = score_fonte(classe)

            resultados.append({
                "fornecedor": titulo[:60],
                "pais": "global",
                "origem": valor,
                "moeda": moeda,
                "score": peso,
                "classe": classe,
                "link": url
            })

    if not resultados:
        return [], logs

    # média ponderada
    preco_final = sum(r["origem"] * r["score"] for r in resultados) / sum(r["score"] for r in resultados)

    logs.append(f"📊 {len(resultados)} fontes válidas")
    logs.append("✅ Processamento finalizado")

    return resultados, logs, round(preco_final, 2)

# ==========================================
# 🔥 ROTAS
# ==========================================

@app.route("/")
def home():
    return jsonify({"ok": True})

@app.route("/buscar", methods=["POST"])
def buscar():
    data = request.json

    material = data.get("material")
    mercado = data.get("mercado", "global")

    resultados, logs, preco = processar(material, mercado)

    return jsonify({
        "ok": True,
        "dados": resultados,
        "logs": logs,
        "preco_estimado": preco,
        "analise": f"Baseado em {len(resultados)} fontes confiáveis HVAC"
    })

if __name__ == "__main__":
    app.run()


