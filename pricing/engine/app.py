import os
import re
import json
import time
import statistics
from datetime import datetime

import requests
import pandas as pd
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

SERP_API_KEY = os.getenv("SERP_API_KEY")
BRIGHT_API_KEY = os.getenv("BRIGHTDATA_API_KEY")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LAST_XLSX = os.path.join(BASE_DIR, "resultado_consulta.xlsx")
HISTORY_DIR = os.path.join(BASE_DIR, "history")
os.makedirs(HISTORY_DIR, exist_ok=True)

FONTES_RUINS = [
    "indiamart",
    "tradeindia",
    "exportersindia",
    "amazon",
    "ebay",
    "walmart",
    "mercadolivre",
    "shopee",
    "aliexpress",
    "magazineluiza",
    "americanas",
    "carrefour"
]

PAISES_ASIA = {"Índia", "China", "Vietnã"}

# =========================
# UTIL
# =========================
def is_fonte_ruim(link: str) -> bool:
    l = (link or "").lower()
    return any(f in l for f in FONTES_RUINS)

def strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", text)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def parse_price_string(s: str):
    s = s.strip()
    s = s.replace(" ", "")

    if "," in s and "." in s:
        # tenta normalizar ambos formatos
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        # só ponto ou nenhum separador
        pass

    try:
        return float(s)
    except:
        return None

def extrair_preco(texto: str, material: str):
    if not texto:
        return None

    candidates = []

    patterns = [
        r"(?:R\$|US\$|USD|INR|₹|CNY|CN¥|\$)\s*([0-9][0-9\.,]{0,18})",
        r"(?:price|preço|rate|valor)[^0-9]{0,15}([0-9][0-9\.,]{0,18})",
    ]

    unit_patterns = {
        "cobre": [r"([0-9][0-9\.,]{0,18})\s*(?:/kg|kg\b)"],
        "elastomerico": [r"([0-9][0-9\.,]{0,18})\s*(?:/m|/meter|meter\b|metre\b|m\b)"],
        "aco_galvanizado": [r"([0-9][0-9\.,]{0,18})\s*(?:/sheet|sheet\b|sheet price)"],
    }

    for p in patterns:
        for m in re.finditer(p, texto, re.IGNORECASE):
            v = parse_price_string(m.group(1))
            if v is not None:
                candidates.append(v)

    for p in unit_patterns.get(material, []):
        for m in re.finditer(p, texto, re.IGNORECASE):
            v = parse_price_string(m.group(1))
            if v is not None:
                candidates.append(v)

    # remove valores absurdos ou muito pequenos
    sane = []
    for v in candidates:
        if v <= 0:
            continue
        # proteção básica contra "1/4" virar preço 1
        if material == "cobre" and v < 20:
            continue
        if material == "elastomerico" and v < 1:
            continue
        if material == "aco_galvanizado" and v < 1:
            continue
        sane.append(v)

    if not sane:
        return None

    return min(sane)

def detectar_tipo_cobre(nome: str) -> str:
    n = (nome or "").lower()
    if any(k in n for k in ["coil", "soft", "flex", "flexible", "pancake"]):
        return "flexivel"
    return "rigido"

def detectar_pais(texto: str) -> str:
    t = (texto or "").lower()

    if "indiamart" in t or " india " in f" {t} " or ".in" in t:
        return "Índia"
    if "made-in-china" in t or " china " in f" {t} " or ".cn" in t:
        return "China"
    if "vietnam" in t or ".vn" in t:
        return "Vietnã"
    if "turkey" in t or "turquia" in t or ".tr" in t:
        return "Turquia"
    if "brazil" in t or "brasil" in t or ".br" in t:
        return "Brasil"
    return "Global"

def calcular_brasil(origem: float, pais: str):
    if origem is None:
        return None

    p = (pais or "").strip().lower()

    if p == "brasil":
        return round(origem, 2)

    fatores = {
        "índia": 2.2,
        "china": 2.4,
        "vietnã": 2.3,
        "turquia": 2.25,
        "global": 2.35
    }
    fator = fatores.get(p, 2.35)
    return round(origem * fator, 2)

def validar_preco(material: str, preco: float) -> bool:
    if preco is None:
        return False

    if material == "cobre":
        return 20 <= preco <= 5000
    if material == "elastomerico":
        return 1 <= preco <= 5000
    if material == "aco_galvanizado":
        return 1 <= preco <= 5000

    return True

def calcular_confianca(precos):
    if not precos:
        return "C"

    if len(precos) < 3:
        return "C"

    media = statistics.mean(precos)
    if media == 0:
        return "C"

    desvio = statistics.pstdev(precos) if len(precos) > 1 else 0
    cv = desvio / media

    if cv < 0.15:
        return "A"
    elif cv < 0.35:
        return "B"
    return "C"

def gerar_insight(precos_brasil, melhor, mercado, material):
    if not precos_brasil or not melhor:
        return "Sem dados suficientes para análise."

    media = statistics.mean(precos_brasil)
    melhor_preco = melhor.get("brasil")

    if melhor_preco < media * 0.8:
        base = "Preço abaixo da média consolidada. Excelente oportunidade."
    elif melhor_preco < media:
        base = "Preço abaixo da média de mercado. Cenário favorável."
    elif melhor_preco <= media * 1.15:
        base = "Preço dentro da faixa média. Compra viável."
    else:
        base = "Preço acima da média consolidada. Avaliar negociação."

    if material == "cobre" and melhor.get("tipo") == "flexivel":
        base += " Destaque para cobre flexível."
    if mercado == "brasil":
        base += " Comparação focada em mercado nacional."
    elif mercado == "asia":
        base += " Comparação focada em fornecedores asiáticos."
    else:
        base += " Comparação global."

    return base

def salvar_historico(material, payload):
    path = os.path.join(HISTORY_DIR, f"historico_{material}.json")
    try:
        hist = []
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                hist = json.load(f)

        hist.append({
            "data": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "payload": payload
        })

        hist = hist[-50:]  # mantém últimos 50
        with open(path, "w", encoding="utf-8") as f:
            json.dump(hist, f, ensure_ascii=False, indent=2)
    except:
        pass

def ler_historico(material):
    path = os.path.join(HISTORY_DIR, f"historico_{material}.json")
    if not os.path.exists(path):
        return []

    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

# =========================
# QUERY INTELIGENTE
# =========================
def traduzir_item_detalhado(item_texto: str):
    t = (item_texto or "").strip()
    tu = t.upper()

    result = {
        "material": "elastomerico" if "ELASTOM" in tu else "cobre" if "COBRE" in tu else "aco_galvanizado",
        "tipo": "",
        "bitola": "",
        "detalhe": "",
        "query": t
    }

    # elastomérico detalhado
    if "ELASTOM" in tu or "BORRACHA ELASTOM" in tu:
        esp = ""
        m_esp = re.search(r"ESPESSURA\s*([0-9]+(?:[.,][0-9]+)?)\s*MM", tu)
        if m_esp:
            esp = m_esp.group(1).replace(",", ".")

        bit = ""
        m_bit = re.search(r'TUBO DE COBRE DE\s*([0-9\./"]+)', tu)
        if m_bit:
            bit = m_bit.group(1).strip().replace('"', "")

        result["material"] = "elastomerico"
        result["bitola"] = bit
        result["detalhe"] = f"closed cell elastomeric rubber insulation {esp}mm for copper tube {bit} hvac".strip()
        result["query"] = f'closed cell elastomeric rubber insulation {esp}mm for copper tube {bit} hvac price per meter supplier manufacturer'
        return result

    # cobre
    if "COBRE" in tu:
        bit = ""
        m_bit = re.search(r'([0-9]+(?:\.[0-9]+)?(?:/[0-9]+)?(?:\.[0-9]+/[0-9]+)?)', t)
        if m_bit:
            bit = m_bit.group(1)

        tipo = "flexivel" if "FLEX" in tu or "COIL" in tu or "SOFT" in tu else "rigido"
        result["material"] = "cobre"
        result["tipo"] = tipo
        result["bitola"] = bit
        result["detalhe"] = f"copper tube {tipo} {bit} hvac refrigeration"
        result["query"] = f'copper tube {tipo} {bit} hvac refrigeration price per kg supplier manufacturer'
        return result

    # chapa
    if "CHAPA" in tu or "GALVANIZ" in tu:
        gauge = ""
        m_g = re.search(r'#\s*([0-9]+)', tu)
        if m_g:
            gauge = f"#{m_g.group(1)}"

        esp = ""
        m_esp = re.search(r'([0-9]+(?:[.,][0-9]+)?)\s*MM', tu)
        if m_esp:
            esp = m_esp.group(1).replace(",", ".")

        result["material"] = "aco_galvanizado"
        result["bitola"] = gauge or esp
        result["detalhe"] = f"galvanized steel sheet {gauge} {esp}mm"
        result["query"] = f'galvanized steel sheet {gauge} {esp}mm price per sheet supplier manufacturer'
        return result

    return result

def montar_query(material, mercado, tipo="", bitola="", detalhe=""):
    if detalhe:
        base = detalhe
    elif material == "cobre":
        base = f"copper tube {tipo} {bitola} hvac refrigeration price per kg"
    elif material == "elastomerico":
        base = f"closed cell elastomeric rubber insulation {bitola} hvac price per meter"
    elif material == "aco_galvanizado":
        base = f"galvanized steel sheet {bitola} price per sheet"
    else:
        base = material

    mercado_txt = {
        "asia": "india china vietnam supplier manufacturer",
        "brasil": "brazil brasil fornecedor fabricante",
        "global": "global supplier manufacturer"
    }.get(mercado, "global supplier manufacturer")

    return f"{base} {mercado_txt}".strip()

# =========================
# SERP API
# =========================
def buscar_serp(query, num=20):
    if not SERP_API_KEY:
        raise Exception("SERP_API_KEY não configurada no ambiente")

    url = "https://serpapi.com/search.json"
    params = {
        "q": query,
        "api_key": SERP_API_KEY,
        "engine": "google",
        "num": num
    }

    resp = requests.get(url, params=params, timeout=12)
    resp.raise_for_status()
    data = resp.json()
    return data.get("organic_results", [])

# =========================
# BRIGHT DATA
# =========================
def abrir_pagina(link):
    if not BRIGHT_API_KEY:
        return ""

    endpoint = "https://api.brightdata.com/request"
    payload = {
        "zone": "web_unlocker1",
        "url": link,
        "format": "raw"
    }
    headers = {
        "Authorization": f"Bearer {BRIGHT_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        resp = requests.post(endpoint, json=payload, headers=headers, timeout=18)
        resp.raise_for_status()
        return strip_html(resp.text)[:4000]
    except:
        return ""

# =========================
# CORE
# =========================
def processar_item(item_ref, material, mercado, tipo="", bitola="", detalhe="", deadline=None):
    logs = []
    dados = []

    query = montar_query(material, mercado, tipo, bitola, detalhe)
    logs.append(f"🔎 Query: {query}")

    resultados = buscar_serp(query, num=20)
    logs.append(f"🌐 {len(resultados)} links encontrados")

    aceitos = 0

    for r in resultados:
        if deadline and time.time() > deadline:
            logs.append("⏱ Tempo limite atingido para este item")
            break

        link = r.get("link", "")
        titulo = r.get("title", "")
        snippet = r.get("snippet", "")

        if not link or is_fonte_ruim(link):
            continue

        texto_base = f"{titulo} {snippet}"
        pagina = abrir_pagina(link) if aceitos < 4 else ""
        texto_total = f"{texto_base} {pagina}"

        preco = extrair_preco(texto_total, material)
        if preco is None:
            continue

        if not validar_preco(material, preco):
            continue

        pais = detectar_pais(f"{titulo} {snippet} {link} {pagina[:1000] if pagina else ''}")

        if mercado == "asia" and pais not in PAISES_ASIA:
            continue
        if mercado == "brasil" and pais != "Brasil":
            continue

        tipo_cobre = detectar_tipo_cobre(titulo) if material == "cobre" else None
        brasil = calcular_brasil(preco, pais)

        evidencia = snippet[:220] if snippet else ""
        if not evidencia and pagina:
            evidencia = pagina[:220]

        dados.append({
            "item_ref": item_ref,
            "fornecedor": titulo[:80],
            "pais": pais,
            "origem": round(preco, 2),
            "brasil": round(brasil, 2) if brasil is not None else None,
            "tipo": tipo_cobre,
            "link": link,
            "evidencia": evidencia
        })

        aceitos += 1
        if aceitos >= 8:
            break

    return dados, logs

def consolidar_resultados(material, mercado, dados, logs):
    # remove duplicados
    unicos = []
    vistos = set()
    for d in dados:
        chave = (d["item_ref"], d["fornecedor"], d["pais"], d["origem"], d["link"])
        if chave in vistos:
            continue
        vistos.add(chave)
        unicos.append(d)

    if material == "cobre":
        flex = [d for d in unicos if d["tipo"] == "flexivel"]
        rig = [d for d in unicos if d["tipo"] == "rigido"]
        logs.append(f"📦 Cobre flexível: {len(flex)} registro(s)")
        logs.append(f"📦 Cobre rígido: {len(rig)} registro(s)")
        unicos = flex + rig

    if not unicos:
        return {
            "dados": [],
            "grafico": {"labels": [], "valores": []},
            "confianca": "C",
            "insight": "Nenhum resultado confiável encontrado.",
            "melhor": None,
            "logs": logs
        }

    precos_brasil = [d["brasil"] for d in unicos if d["brasil"] is not None]
    confianca = calcular_confianca(precos_brasil if precos_brasil else [d["origem"] for d in unicos])

    melhor = min(unicos, key=lambda x: x["brasil"] if x["brasil"] is not None else 999999)
    insight = gerar_insight(precos_brasil if precos_brasil else [d["origem"] for d in unicos], melhor, mercado, material)

    grafico = {
        "labels": [f"{d['fornecedor'][:18]}" for d in unicos[:10]],
        "valores": [d["origem"] for d in unicos[:10]]
    }

    logs.append(f"✅ {len(unicos)} resultados encontrados")
    logs.append("✅ Consulta finalizada")

    return {
        "dados": unicos,
        "grafico": grafico,
        "confianca": confianca,
        "insight": insight,
        "melhor": melhor,
        "logs": logs
    }

def gerar_excel(dados):
    if not dados:
        # gera vazio para evitar erro do botão
        df = pd.DataFrame(columns=["item_ref", "fornecedor", "pais", "origem", "brasil", "tipo", "link", "evidencia"])
    else:
        df = pd.DataFrame(dados)
    df.to_excel(LAST_XLSX, index=False)

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

@app.route("/health")
def health():
    return jsonify({
        "ok": True,
        "serp_configurada": bool(SERP_API_KEY),
        "bright_configurada": bool(BRIGHT_API_KEY),
        "status": "healthy"
    })

@app.route("/buscar", methods=["POST"])
def buscar():
    data = request.get_json(silent=True) or {}

    material = data.get("material", "elastomerico")
    mercado = data.get("mercado", "global")
    modo = data.get("modo", "preco")
    tipo = data.get("tipo", "").strip()
    bitola = data.get("bitola", "").strip()
    detalhe = data.get("detalhe", "").strip()
    lista_materiais = data.get("lista_materiais", [])

    logs = [
        "🚀 HARD V2.1 iniciado",
        f"▶ Material: {material}",
        f"▶ Mercado: {mercado}",
        f"▶ Retorno: {modo}",
    ]

    try:
        itens = []
        if isinstance(lista_materiais, list) and any(str(x).strip() for x in lista_materiais):
            for item in lista_materiais:
                item = str(item).strip()
                if not item:
                    continue
                traduzido = traduzir_item_detalhado(item)
                itens.append({
                    "item_ref": item,
                    "material": traduzido["material"],
                    "tipo": traduzido["tipo"],
                    "bitola": traduzido["bitola"],
                    "detalhe": traduzido["detalhe"]
                })
        else:
            itens.append({
                "item_ref": detalhe or f"{material} {tipo} {bitola}".strip(),
                "material": material,
                "tipo": tipo,
                "bitola": bitola,
                "detalhe": detalhe
            })

        deadline = time.time() + 25
        all_dados = []

        for item_cfg in itens:
            if time.time() > deadline:
                logs.append("⏱ Tempo limite global atingido, retornando melhores resultados já consolidados...")
                break

            logs.append(f"📌 Item: {item_cfg['item_ref'][:120]}")
            d_item, l_item = processar_item(
                item_ref=item_cfg["item_ref"],
                material=item_cfg["material"],
                mercado=mercado,
                tipo=item_cfg["tipo"],
                bitola=item_cfg["bitola"],
                detalhe=item_cfg["detalhe"],
                deadline=deadline
            )
            logs.extend(l_item)
            all_dados.extend(d_item)

        resultado = consolidar_resultados(material, mercado, all_dados, logs)
        gerar_excel(resultado["dados"])

        salvar_historico(material, {
            "mercado": mercado,
            "modo": modo,
            "tipo": tipo,
            "bitola": bitola,
            "detalhe": detalhe,
            "dados": resultado["dados"],
            "confianca": resultado["confianca"],
            "insight": resultado["insight"]
        })

        historico = ler_historico(material)
        historico_grafico = {
            "labels": [h["data"] for h in historico[-10:]],
            "valores": [
                min(
                    [d["brasil"] for d in h.get("payload", {}).get("dados", []) if d.get("brasil") is not None],
                    default=0
                )
                for h in historico[-10:]
            ]
        }

        return jsonify({
            "ok": True,
            "dados": resultado["dados"],
            "melhor": resultado["melhor"],
            "confianca": resultado["confianca"],
            "insight": resultado["insight"],
            "grafico": resultado["grafico"],
            "historico_grafico": historico_grafico,
            "logs": resultado["logs"]
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
    if os.path.exists(LAST_XLSX):
        return send_file(LAST_XLSX, as_attachment=True)
    return "Arquivo não encontrado", 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
