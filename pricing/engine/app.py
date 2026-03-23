import os
import re
import requests
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

SERP_API_KEY = os.getenv("SERP_API_KEY")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ULTIMO_ARQUIVO = os.path.join(BASE_DIR, "resultado.xlsx")

# =========================
# UTIL
# =========================
def link_ruim(url):
    ruins = [
        "amazon", "ebay", "walmart", "mercadolivre",
        "shopee", "aliexpress", "magazineluiza",
        "americanas", "carrefour", "shop", "store"
    ]
    url = (url or "").lower()
    return any(r in url for r in ruins)

def extrair_preco(texto):
    if not texto:
        return None

    # tenta padrões comuns
    patterns = [
        r'R\$\s?(\d+[.,]?\d*)',
        r'₹\s?(\d+[.,]?\d*)',
        r'\$\s?(\d+[.,]?\d*)',
        r'USD\s?(\d+[.,]?\d*)',
        r'(\d+[.,]?\d*)\s?(?:/kg|kg|/meter|/m|meter|m)\b'
    ]

    for p in patterns:
        m = re.search(p, texto, re.IGNORECASE)
        if m:
            try:
                return float(m.group(1).replace(".", "").replace(",", "."))
            except:
                pass

    # fallback
    m = re.search(r'(\d+[.,]?\d*)', texto)
    if m:
        try:
            return float(m.group(1).replace(".", "").replace(",", "."))
        except:
            return None

    return None

def detectar_pais(texto):
    t = (texto or "").lower()

    if "india" in t or "indiamart" in t:
        return "Índia"
    if "vietnam" in t:
        return "Vietnã"
    if "turkey" in t or "turquia" in t:
        return "Turquia"
    if "brazil" in t or ".br" in t or "brasil" in t:
        return "Brasil"
    if "china" in t:
        return "China"

    return "Global"

def calcular_brasil(origem, pais):
    if origem is None:
        return None

    if (pais or "").strip().lower() == "brasil":
        return round(origem, 2)

    fator = 2.2
    return round(origem * fator, 2)

def detectar_tipo_cobre(nome):
    nome = (nome or "").lower()
    if "coil" in nome or "soft" in nome or "flex" in nome or "pancake" in nome:
        return "flexivel"
    return "rigido"

# =========================
# BUSCA SERPAPI
# =========================
def buscar_serp(query):
    if not SERP_API_KEY:
        raise Exception("SERP_API_KEY não configurada no ambiente")

    url = "https://serpapi.com/search.json"
    params = {
        "q": query,
        "api_key": SERP_API_KEY,
        "engine": "google",
        "num": 10
    }

    resp = requests.get(url, params=params, timeout=25)
    resp.raise_for_status()
    data = resp.json()

    resultados = []

    for r in data.get("organic_results", [])[:10]:
        link = r.get("link", "")
        if link_ruim(link):
            continue

        titulo = r.get("title", "")
        snippet = r.get("snippet", "")

        preco = extrair_preco(f"{titulo} {snippet}")
        if preco is None:
            continue

        pais = detectar_pais(f"{titulo} {snippet} {link}")

        resultados.append({
            "fornecedor": titulo[:80],
            "pais": pais,
            "origem": preco,
            "link": link
        })

    return resultados

# =========================
# CORE
# =========================
def gerar_consulta(material, mercado, modo):
    logs = []
    dados = []

    logs.append("🔍 Iniciando busca estratégica...")

    queries = []

    if material == "cobre":
        queries = [
            "copper tube price per kg hvac india",
            "copper pipe price per kg vietnam",
            "copper coil price per kg hvac"
        ]
    elif material == "elastomerico":
        queries = [
            "elastomeric insulation price per meter hvac india",
            "nitrile rubber insulation price per meter vietnam",
            "elastomeric insulation price per meter brazil"
        ]
    elif material == "aco_galvanizado":
        queries = [
            "galvanized steel sheet price per kg turkey",
            "gi sheet price per kg vietnam",
            "chapa galvanizada preço kg brasil"
        ]
    else:
        raise Exception(f"Material inválido: {material}")

    for query in queries:
        logs.append(f"🌐 Consulta: {query}")
        resultados = buscar_serp(query)
        logs.append(f"📦 {len(resultados)} resultado(s) aproveitado(s)")
        dados.extend(resultados)

    # remove duplicados por fornecedor+país+origem
    vistos = set()
    filtrados = []

    for d in dados:
        chave = (d["fornecedor"], d["pais"], d["origem"])
        if chave in vistos:
            continue
        vistos.add(chave)

        if material == "cobre":
            d["tipo_cobre"] = detectar_tipo_cobre(d["fornecedor"])
        else:
            d["tipo_cobre"] = None

        d["brasil"] = calcular_brasil(d["origem"], d["pais"])
        filtrados.append(d)

    # filtro por mercado
    if mercado == "asia":
        paises_asia = {"Índia", "Vietnã", "China"}
        filtrados = [d for d in filtrados if d["pais"] in paises_asia]
    elif mercado == "brasil":
        filtrados = [d for d in filtrados if d["pais"] == "Brasil"]
    elif mercado == "global":
        pass

    # ordenação
    filtrados.sort(key=lambda x: (x["brasil"] if x["brasil"] is not None else 999999))

    if material == "cobre":
        flex = [d for d in filtrados if d["tipo_cobre"] == "flexivel"]
        rig = [d for d in filtrados if d["tipo_cobre"] == "rigido"]
        logs.append(f"📦 Cobre flexível: {len(flex)} registro(s)")
        logs.append(f"📦 Cobre rígido: {len(rig)} registro(s)")

        filtrados = flex + rig

    logs.append("✅ Consulta finalizada")

    return filtrados, logs

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

    material = data.get("material", "elastomerico")
    mercado = data.get("mercado", "asia")
    modo = data.get("modo", "preco")

    logs = []
    logs.append("🔍 Buscando dados reais na internet...")

    try:
        dados, logs_core = gerar_consulta(material, mercado, modo)
        logs.extend(logs_core)
        logs.append(f"✅ {len(dados)} resultados encontrados")

        # gera excel do último resultado
        try:
            df = pd.DataFrame(dados)
            df.to_excel(ULTIMO_ARQUIVO, index=False)
            logs.append("✅ Planilha gerada")
        except Exception as e:
            logs.append(f"⚠ Falha ao gerar Excel: {str(e)}")

        return jsonify({
            "ok": True,
            "dados": dados,
            "logs": logs
        })

    except Exception as e:
        logs.append(f"❌ Erro: {str(e)}")
        return jsonify({
            "ok": False,
            "dados": [],
            "logs": logs
        }), 500

@app.route("/baixar")
def baixar():
    if os.path.exists(ULTIMO_ARQUIVO):
        return send_file(ULTIMO_ARQUIVO, as_attachment=True)
    return "Arquivo não encontrado", 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
