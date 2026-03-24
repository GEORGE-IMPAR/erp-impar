import os
import requests
import re
import statistics
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SERP_API_KEY = os.getenv("SERP_API_KEY")
BRIGHT_API_KEY = os.getenv("BRIGHTDATA_API_KEY")

# =========================
# CONFIG
# =========================
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
    if "coil" in nome or "soft" in nome or "flex" in nome:
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
# SERP API
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
    base = ""

    if material == "cobre":
        base = f"copper tube {tipo} {bitola} hvac price per kg"
    elif material == "elastomerico":
        base = f"elastomeric insulation {bitola} price per meter hvac"
    else:
        base = "galvanized steel sheet price per unit"

    return base + " supplier china india"

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
            logs.append(f"❌ Ignorado (fonte ruim): {link}")
            continue

        texto = snippet

        # tenta enriquecer com BrightData
        pagina = abrir_pagina(link)
        if pagina:
            texto += " " + pagina

        preco = extrair_preco(texto)

        if not preco:
            continue

        if not validar_preco(material, preco):
            logs.append(f"⚠️ Preço descartado: {preco}")
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
        return [], logs

    precos = [d["origem"] for d in dados]

    mediana = statistics.median(precos)
    media = round(statistics.mean(precos), 2)

    logs.append(f"📊 Média: {media}")
    logs.append(f"📊 Mediana: {mediana}")

    return dados, logs

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

    logs = []
    logs.append("🚀 Iniciando motor HARD V1...")

    try:
        dados, logs_core = processar(material, tipo, bitola)
        logs += logs_core

        melhor = min(dados, key=lambda x: x["brasil"]) if dados else None

        return jsonify({
            "ok": True,
            "dados": dados,
            "melhor": melhor,
            "logs": logs
        })

    except Exception as e:
        logs.append(f"❌ Erro: {str(e)}")
        return jsonify({
            "ok": False,
            "dados": [],
            "logs": logs
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))