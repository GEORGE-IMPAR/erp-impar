import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

SERP_API_KEY = os.getenv("SERP_API_KEY")

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
    if not SERP_API_KEY:
        raise Exception("SERP_API_KEY não configurada no ambiente")

    url = "https://serpapi.com/search.json"
    params = {
        "q": query,
        "api_key": SERP_API_KEY,
        "engine": "google"
    }

    resp = requests.get(url, params=params, timeout=25)
    resp.raise_for_status()
    data = resp.json()

    resultados = []

    for r in data.get("organic_results", [])[:5]:
        link = r.get("link", "")
        if link_ruim(link):
            continue

        snippet = r.get("snippet", "")
        preco = extrair_preco(snippet)
        if not preco:
            continue

        pais = detectar_pais(f"{r.get('title', '')} {snippet} {link}")

        resultados.append({
            "fornecedor": r.get("title", "")[:80],
            "pais": pais,
            "origem": preco,
            "link": link
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
    data = request.get_json(silent=True) or {}

    material = data.get("material", "elastomerico")
    mercado = data.get("mercado", "asia")
    modo = data.get("modo", "preco")

    logs = []
    logs.append("🔍 Buscando dados reais na internet...")

    try:
        dados = processar(material)
        logs.append(f"✅ {len(dados)} resultados encontrados")

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
