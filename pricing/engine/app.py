import os
import re
import requests
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

SERP_API_KEY = os.getenv("SERP_API_KEY")
BRIGHT_API_KEY = os.getenv("BRIGHTDATA_API_KEY")

# ==========================================
# BASE REAL (PDF LUSOTRADE / faixa plausível)
# ==========================================
BASE_ELASTOMERICO = {
    "min": 1.0,
    "max": 20.0
}

# ==========================================
# FILTRO DE MERCADO
# ==========================================
def validar_mercado(pais, mercado):
    p = (pais or "").lower()

    if mercado == "brasil":
        return "brasil" in p or "brazil" in p

    if mercado == "asia":
        return any(x in p for x in ["china", "índia", "india", "vietnam", "vietnã"])

    return True  # global

# ==========================================
# DETECÇÃO DE PAÍS
# ==========================================
def detectar_pais(url, titulo="", html=""):
    base = f"{url} {titulo} {html}".lower()

    if any(x in base for x in ["brasil", "brazil", ".br"]):
        return "Brasil"
    if any(x in base for x in ["india", "índia", ".in", "indiamart"]):
        return "Índia"
    if any(x in base for x in ["china", ".cn", "made-in-china"]):
        return "China"
    if any(x in base for x in ["vietnam", "vietnã", ".vn"]):
        return "Vietnã"

    return "Global"

# ==========================================
# FILTRO DE LINKS RUINS
# ==========================================
def link_ruim(url):
    u = (url or "").lower()
    ruins = [
        "blog", "news", "market", "report", "verifiedmarketreports",
        "quemfornece", "directory", "pdfviewer", "tradevision",
        "forneceb2b", "solucoesindustriais"
    ]
    return any(r in u for r in ruins)

# ==========================================
# CLASSIFICAÇÃO DE FONTE
# ==========================================
def classificar_fonte(url, titulo, html=""):
    u = (url or "").lower()
    t = (titulo or "").lower()
    h = (html or "").lower()

    if any(x in u for x in ["pdf"]) or "tabela de preços" in h:
        return "A"

    if any(x in h for x in [
        "market size", "tamanho do mercado", "forecast", "cagr", "industry report", "billion", "bilhões"
    ]):
        return "X"  # relatório, descarta

    if any(x in h for x in [
        "cotar agora", "encontre fornecedores", "fornecedor de", "soluções industriais", "orçamento online"
    ]):
        return "X"  # diretório, descarta

    if any(x in u for x in ["manufacturer", "factory", "supplier", "shop", "store", "produto"]):
        return "A"

    if "indiamart" in u:
        return "C"

    if any(x in t for x in ["buy", "price", "hvac", "insulation"]):
        return "B"

    return "C"

# ==========================================
# GERADOR DE QUERY INTELIGENTE
# ==========================================
def gerar_queries(material, mercado):
    base = (material or "").lower()

    mercado_hint = {
        "brasil": "brazil brasil fornecedor preço",
        "asia": "china india vietnam supplier price hvac",
        "global": "global supplier manufacturer price hvac"
    }.get(mercado, "global supplier manufacturer price hvac")

    # foco em HVAC / ar-condicionado
    queries = [
        f"{base} hvac price per meter supplier {mercado_hint}",
        f"elastomeric insulation tube {base} hvac price {mercado_hint}",
        f"rubber insulation pipe hvac price {base} {mercado_hint}",
        f"tubo espuma elastomerica preço {base} ar condicionado {mercado_hint}",
        f"espuma elastomérica tubo cobre hvac preço {base} {mercado_hint}"
    ]

    return queries

# ==========================================
# EXTRAÇÃO DE PREÇO
# ==========================================
def extrair_preco(texto):
    if not texto:
        return None, None

    # moeda antes do número
    padroes = [
        r'(R\$|USD|US\$|€)\s*([0-9]+(?:[.,][0-9]{1,2})?)',
        r'([0-9]+(?:[.,][0-9]{1,2})?)\s*(R\$|USD|US\$|€)'
    ]

    for padrao in padroes:
        match = re.search(padrao, texto, re.IGNORECASE)
        if match:
            if match.group(1) in ["R$", "USD", "US$", "€"]:
                moeda = match.group(1)
                valor = float(match.group(2).replace(",", "."))
            else:
                valor = float(match.group(1).replace(",", "."))
                moeda = match.group(2)
            return valor, moeda

    return None, None

# ==========================================
# BRIGHT DATA
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
        r = requests.post(endpoint, json=payload, headers=headers, timeout=8)
        r.raise_for_status()
        html = r.text[:150000]  # limita volume

        valor, moeda = extrair_preco(html)
        return valor, moeda, html
    except Exception:
        return None, None, ""

# ==========================================
# VALIDAÇÃO DE PREÇO
# ==========================================
def validar_preco(valor):
    if valor is None:
        return False
    if valor < BASE_ELASTOMERICO["min"]:
        return False
    if valor > BASE_ELASTOMERICO["max"]:
        return False
    return True

# ==========================================
# SCORE
# ==========================================
def score_fonte(classe):
    if classe == "A":
        return 1.0
    if classe == "B":
        return 0.7
    if classe == "C":
        return 0.3
    return 0.0

# ==========================================
# BUSCA SERP
# ==========================================
def buscar_serp(query):
    url = "https://serpapi.com/search.json"

    params = {
        "q": query,
        "api_key": SERP_API_KEY,
        "engine": "google",
        "num": 8
    }

    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    return r.json()

# ==========================================
# PROCESSAMENTO
# ==========================================
def processar(material, mercado):
    logs = []
    resultados = []

    queries = gerar_queries(material, mercado)
    logs.append(f"🔎 {len(queries)} estratégias de busca geradas")

    for q in queries:
        logs.append(f"🌐 Query: {q}")

        try:
            data = buscar_serp(q)
        except Exception as e:
            logs.append(f"⚠ Erro na SERP: {str(e)}")
            continue

        if "organic_results" not in data:
            logs.append("⚠ Nenhum organic_results retornado")
            continue

        for item in data["organic_results"][:5]:
            url = item.get("link", "")
            titulo = item.get("title", "")

            if not url or link_ruim(url):
                continue

            valor, moeda, html = extrair_preco_pagina(url)

            if not valor:
                continue

            classe = classificar_fonte(url, titulo, html)
            if classe == "X":
                continue

            if not validar_preco(valor):
                continue

            pais = detectar_pais(url, titulo, html)
            if not validar_mercado(pais, mercado):
                continue

            peso = score_fonte(classe)
            if peso <= 0:
                continue

            resultados.append({
                "fornecedor": titulo[:80],
                "pais": pais,
                "origem": valor,
                "moeda": moeda,
                "score": peso,
                "classe": classe,
                "link": url
            })

    if not resultados:
        logs.append("⚠ Nenhuma fonte válida encontrada")
        return [], logs, None

    preco_final = sum(r["origem"] * r["score"] for r in resultados) / sum(r["score"] for r in resultados)

    logs.append(f"📊 {len(resultados)} fontes válidas")
    logs.append("✅ Processamento finalizado")

    return resultados, logs, round(preco_final, 2)

# ==========================================
# ROTAS
# ==========================================
@app.route("/")
def home():
    return jsonify({
        "ok": True,
        "service": "ERP ÍMPAR - Consulta de Preços",
        "status": "online",
        "engine": "V4 MONSTRÃO",
        "apis": {
            "serp": "ativa" if SERP_API_KEY else "erro",
            "brightdata": "ativa" if BRIGHT_API_KEY else "erro"
        }
    })

@app.route("/buscar", methods=["POST"])
def buscar():
    try:
        data = request.get_json(silent=True) or {}

        material = data.get("material", "elastomerico")
        mercado = data.get("mercado", "global")

        resultados, logs, preco = processar(material, mercado)

        return jsonify({
            "ok": True,
            "dados": resultados,
            "logs": logs,
            "preco_estimado": preco,
            "analise": f"Baseado em {len(resultados)} fontes confiáveis HVAC" if resultados else "Sem dados confiáveis para análise."
        })
    except Exception as e:
        return jsonify({
            "ok": False,
            "dados": [],
            "logs": [f"❌ Erro interno: {str(e)}"]
        }), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
