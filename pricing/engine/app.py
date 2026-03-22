import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SERP_API_KEY = os.getenv("eb6e19e7325ca5fa0fbc8165712ecfe1d1aa49c0156093684b8335c72e8b261c")

# =========================
# UTIL
# =========================
def moeda_para_float(valor_str):
    try:
        v = valor_str.replace("R$", "").replace(",", ".")
        return float(v)
    except:
        return None

def calcular_brasil(origem, pais):
    if not origem:
        return None

    if pais.lower() == "brasil":
        return origem  # NÃO multiplica

    # custo estimado importação
    fator = 2.2
    return round(origem * fator, 2)

def detectar_tipo_cobre(nome):
    nome = nome.lower()
    if "coil" in nome or "soft" in nome or "flex" in nome:
        return "flexivel"
    return "rigido"

# =========================
# BUSCA SERPAPI
# =========================
def buscar_serp(query):
    url = "https://serpapi.com/search.json"

    params = {
        "q": query,
        "engine": "google",
        "api_key": SERP_API_KEY
    }

    r = requests.get(url, params=params, timeout=20)
    data = r.json()

    resultados = []

    for item in data.get("organic_results", [])[:10]:
        titulo = item.get("title", "")
        link = item.get("link", "")

        # tentativa simples de extrair preço do snippet
        snippet = item.get("snippet", "")

        preco = None
        for token in snippet.split():
            if "₹" in token or "$" in token:
                try:
                    preco = float(token.replace("₹", "").replace("$", "").replace(",", ""))
                    break
                except:
                    pass

        resultados.append({
            "titulo": titulo,
            "link": link,
            "preco": preco
        })

    return resultados

# =========================
# CORE
# =========================
def gerar_consulta(material, mercado):
    logs = []
    dados = []

    logs.append("🔍 Iniciando busca estratégica...")

    if material == "cobre":
        query = "copper tube price per kg hvac"
    elif material == "elastomerico":
        query = "elastomeric insulation price per meter hvac"
    else:
        query = "galvanized steel sheet price per kg"

    resultados = buscar_serp(query)

    logs.append(f"🌐 {len(resultados)} resultados encontrados")

    for r in resultados:
        preco = r["preco"]

        if not preco:
            continue

        pais = "Índia" if "india" in r["link"].lower() else "Global"

        origem = preco

        tipo_cobre = None
        if material == "cobre":
            tipo_cobre = detectar_tipo_cobre(r["titulo"])

        brasil = calcular_brasil(origem, pais)

        dados.append({
            "fornecedor": r["titulo"][:40],
            "pais": pais,
            "origem": origem,
            "brasil": brasil,
            "tipo_cobre": tipo_cobre
        })

    logs.append("📊 Processando ranking...")

    if material == "cobre":
        flex = [d for d in dados if d["tipo_cobre"] == "flexivel"]
        rig = [d for d in dados if d["tipo_cobre"] == "rigido"]

        logs.append(f"📦 Cobre flexível: {len(flex)} registro(s)")
        logs.append(f"📦 Cobre rígido: {len(rig)} registro(s)")

    logs.append("✅ Consulta finalizada")

    return dados, logs

# =========================
# ROTAS
# =========================
@app.route("/")
def home():
    return jsonify({"ok": True, "service": "consulta-precos-impar", "status": "online"})

@app.route("/buscar", methods=["POST"])
def buscar():
    try:
        dados = processar(material)

        logs.append(f"✅ {len(dados)} resultados encontrados")

        return jsonify({
            "ok": True,
            "dados": dados,
            "logs": logs
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "erro": str(e)
        })

if __name__ == "__main__":
    app.run()
