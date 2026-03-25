import os
import re
import json
import time
import uuid
import statistics
from datetime import datetime

import requests
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

SERP_API_KEY = os.getenv("SERP_API_KEY")
BRIGHT_API_KEY = os.getenv("BRIGHTDATA_API_KEY")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LAST_XLSX = os.path.join(BASE_DIR, "resultado_consulta.xlsx")
HISTORY_DIR = os.path.join(BASE_DIR, "history")
JOBS_DIR = os.path.join(BASE_DIR, "jobs")
os.makedirs(HISTORY_DIR, exist_ok=True)
os.makedirs(JOBS_DIR, exist_ok=True)

FONTES_RUINS = [
    "verifiedmarketreports", "marketresearch", "market-size",
    "quemfornece", "forneceb2b", "solucoesindustriais",
    "thetradevision", "directory", "blog", "news", "report"
]

PAISES_ASIA = {"Índia", "China", "Vietnã"}

BASE_REFERENCIA = {
    "elastomerico": {"min": 1.0, "max": 80.0, "fator_brasil": 2.3},
    "cobre": {"min": 20.0, "max": 2000.0, "fator_brasil": 2.2},
    "aco_galvanizado": {"min": 1.0, "max": 500.0, "fator_brasil": 1.8},
}

# =========================
# UTIL
# =========================
def strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", text)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def is_fonte_ruim(link: str) -> bool:
    l = (link or "").lower()
    return any(f in l for f in FONTES_RUINS)

def parse_number(num_str: str):
    if not num_str:
        return None
    s = num_str.strip().replace(" ", "")
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except:
        return None

def extrair_preco(texto: str, material: str):
    if not texto:
        return None, None, ""

    candidatos = []
    padroes = [
        r"(R\$|US\$|USD|€|EUR|₹|INR|CNY|CN¥)\s*([0-9][0-9\.,]{0,18})",
        r"([0-9][0-9\.,]{0,18})\s*(R\$|US\$|USD|€|EUR|₹|INR|CNY|CN¥)",
    ]

    for padrao in padroes:
        for m in re.finditer(padrao, texto, re.IGNORECASE):
            if m.group(1) in ["R$", "US$", "USD", "€", "EUR", "₹", "INR", "CNY", "CN¥"]:
                moeda = m.group(1)
                valor = parse_number(m.group(2))
                trecho = m.group(0)
            else:
                valor = parse_number(m.group(1))
                moeda = m.group(2)
                trecho = m.group(0)

            if valor is not None:
                candidatos.append((valor, moeda, trecho))

    if not candidatos:
        return None, None, ""

    valor, moeda, trecho = min(candidatos, key=lambda x: x[0])
    return valor, moeda, trecho

def detectar_tipo_cobre(nome: str) -> str:
    n = (nome or "").lower()
    if any(k in n for k in ["coil", "soft", "flex", "flexible", "pancake"]):
        return "flexivel"
    return "rigido"

def detectar_pais(url="", titulo="", html=""):
    base = f"{url} {titulo} {html}".lower()
    if any(x in base for x in ["brasil", "brazil", ".br"]):
        return "Brasil"
    if any(x in base for x in ["india", "índia", ".in", "indiamart"]):
        return "Índia"
    if any(x in base for x in ["china", ".cn", "made-in-china"]):
        return "China"
    if any(x in base for x in ["vietnam", "vietnã", ".vn"]):
        return "Vietnã"
    if any(x in base for x in ["turkey", "turquia", ".tr"]):
        return "Turquia"
    return "Global"

def validar_mercado(pais: str, mercado: str) -> bool:
    p = (pais or "").strip()
    if mercado == "brasil":
        return p == "Brasil"
    if mercado == "asia":
        return p in PAISES_ASIA
    return True

def calcular_brasil(origem: float, pais: str, material: str):
    if origem is None:
        return None
    if (pais or "").lower() == "brasil":
        return round(origem, 2)

    fator = BASE_REFERENCIA.get(material, {}).get("fator_brasil", 2.2)
    pais_lower = (pais or "").lower()
    if pais_lower == "china":
        fator += 0.15
    elif pais_lower == "vietnã":
        fator += 0.05
    elif pais_lower == "turquia":
        fator += 0.10

    return round(origem * fator, 2)

def validar_preco(material: str, valor: float) -> bool:
    if valor is None:
        return False
    ref = BASE_REFERENCIA.get(material, {"min": 1.0, "max": 999999.0})
    return ref["min"] <= valor <= ref["max"]

def classificar_fonte(url: str, titulo: str, html: str = "") -> str:
    u = (url or "").lower()
    t = (titulo or "").lower()
    h = (html or "").lower()

    if any(x in h for x in [
        "market size", "tamanho do mercado", "forecast", "cagr",
        "industry report", "billion", "bilhões"
    ]):
        return "X"

    if any(x in h for x in [
        "cotar agora", "encontre fornecedores", "fornecedor de",
        "soluções industriais", "orçamento online", "guia completo"
    ]):
        return "X"

    if "pdf" in u:
        return "A"
    if any(x in u for x in ["manufacturer", "factory", "supplier", "produto", "shop", "store"]):
        return "A"
    if "indiamart" in u:
        return "C"
    if any(x in t for x in ["price", "hvac", "insulation", "copper", "galvanized"]):
        return "B"
    return "C"

def score_fonte(classe: str) -> float:
    return {"A": 1.0, "B": 0.7, "C": 0.3}.get(classe, 0.0)

def calcular_confianca(precos_brasil):
    if not precos_brasil or len(precos_brasil) < 3:
        return "C"
    media = statistics.mean(precos_brasil)
    if media == 0:
        return "C"
    desvio = statistics.pstdev(precos_brasil) if len(precos_brasil) > 1 else 0
    cv = desvio / media
    if cv < 0.15:
        return "A"
    elif cv < 0.35:
        return "B"
    return "C"

def gerar_insight(material, mercado, dados, melhor):
    if not dados:
        return "Sem dados confiáveis para análise."
    brasil_vals = [d["brasil"] for d in dados if d.get("brasil") is not None]
    if not brasil_vals:
        return "Sem base consolidada suficiente."

    media = statistics.mean(brasil_vals)
    melhor_v = melhor["brasil"] if melhor else None
    if melhor_v is None:
        return "Sem melhor estimativa consolidada."

    if melhor_v < media * 0.80:
        faixa = "Preço abaixo da média consolidada. Excelente oportunidade."
    elif melhor_v < media:
        faixa = "Preço abaixo da média de mercado. Cenário favorável."
    elif melhor_v <= media * 1.15:
        faixa = "Preço dentro da faixa média. Compra viável."
    else:
        faixa = "Preço acima da média consolidada. Avaliar negociação."

    mercado_txt = {
        "global": "Comparação global.",
        "asia": "Comparação focada em fornecedores asiáticos.",
        "brasil": "Comparação focada em mercado nacional."
    }.get(mercado, "Comparação de mercado.")

    material_txt = {
        "elastomerico": "Foco em isolamento elastomérico HVAC.",
        "cobre": "Foco em cobre para sistemas de ar-condicionado.",
        "aco_galvanizado": "Foco em chapa galvanizada para dutos e acessórios."
    }.get(material, "")

    return f"{faixa} {mercado_txt} {material_txt}".strip()

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
        hist = hist[-30:]
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

def gerar_excel_simples(dados):
    try:
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Consulta"
        headers = ["item_ref", "fornecedor", "pais", "origem", "brasil", "tipo", "link", "evidencia"]
        ws.append(headers)
        for d in dados:
            ws.append([
                d.get("item_ref", ""),
                d.get("fornecedor", ""),
                d.get("pais", ""),
                d.get("origem", ""),
                d.get("brasil", ""),
                d.get("tipo", ""),
                d.get("link", ""),
                d.get("evidencia", ""),
            ])
        wb.save(LAST_XLSX)
    except:
        pass

def save_job(job_id, payload):
    path = os.path.join(JOBS_DIR, f"{job_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def load_job(job_id):
    path = os.path.join(JOBS_DIR, f"{job_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# =========================
# QUERY
# =========================
def traduzir_item_detalhado(item_texto: str):
    t = (item_texto or "").strip()
    tu = t.upper()

    result = {
        "material": "elastomerico" if "ELASTOM" in tu or "BORRACHA" in tu else "cobre" if "COBRE" in tu else "aco_galvanizado",
        "tipo": "",
        "bitola": "",
        "detalhe": "",
        "item_ref": t
    }

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
        result["detalhe"] = f"closed cell elastomeric rubber insulation {esp}mm for copper tube {bit} hvac price per meter"
        return result

    if "COBRE" in tu:
        bit = ""
        m_bit = re.search(r'([0-9]+(?:\.[0-9]+)?(?:/[0-9]+)?)', t)
        if m_bit:
            bit = m_bit.group(1)
        tipo = "flexivel" if any(x in tu for x in ["FLEX", "COIL", "SOFT"]) else "rigido"
        result["material"] = "cobre"
        result["tipo"] = tipo
        result["bitola"] = bit
        result["detalhe"] = f"copper tube {tipo} {bit} hvac refrigeration price per kg"
        return result

    if "CHAPA" in tu or "GALVANIZ" in tu:
        result["material"] = "aco_galvanizado"
        result["detalhe"] = "galvanized steel sheet hvac duct price"
        return result

    return result

def gerar_queries(material, mercado, tipo="", bitola="", detalhe=""):
    base_hvac = "hvac air conditioning ventilation"

    if detalhe:
        base = detalhe
    elif material == "cobre":
        base = f"copper tube {tipo} {bitola} {base_hvac} price per kg"
    elif material == "elastomerico":
        base = f"elastomeric insulation tube {bitola} {base_hvac} price per meter"
    elif material == "aco_galvanizado":
        base = f"galvanized steel sheet {base_hvac} price"
    else:
        base = material

    mercado_hint = {
        "brasil": ["brazil", "brasil", "fornecedor", "preço"],
        "asia": ["china", "india", "vietnam", "supplier", "price"],
        "global": ["global", "supplier", "manufacturer", "price"]
    }.get(mercado, ["global", "supplier", "manufacturer", "price"])

    queries = [
        f"{base} {' '.join(mercado_hint)}",
        f"{base} supplier {' '.join(mercado_hint)}",
        f"{base} manufacturer {' '.join(mercado_hint)}",
    ]

    if material == "elastomerico" and mercado == "brasil":
        queries.extend([
            f"espuma elastomérica tubo {bitola} ar condicionado preço brasil",
            f"tubo de espuma elastomérica {bitola} preço brasil",
            f"borracha elastomérica tubo cobre {bitola} preço brasil",
        ])

    return list(dict.fromkeys([q.strip() for q in queries if q.strip()]))

# =========================
# EXTERNOS
# =========================
def buscar_serp(query, num=8):
    if not SERP_API_KEY:
        raise Exception("SERP_API_KEY não configurada")
    url = "https://serpapi.com/search.json"
    params = {
        "q": query,
        "api_key": SERP_API_KEY,
        "engine": "google",
        "num": num
    }
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    return r.json()

def extrair_preco_pagina(url, material):
    if not BRIGHT_API_KEY:
        return None, None, "", ""
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
        html = r.text[:120000]
        texto = strip_html(html)
        valor, moeda, trecho = extrair_preco(texto, material)
        evidencia = trecho or texto[:180]
        return valor, moeda, html, evidencia[:220]
    except:
        return None, None, "", ""

# =========================
# ETAPA 1 - BASE
# =========================
def buscar_base(material, mercado, tipo="", bitola="", detalhe="", lista_materiais=None):
    logs = []
    candidatos = []
    lista_materiais = lista_materiais or []

    itens = []
    if lista_materiais:
        for item in lista_materiais:
            itens.append(traduzir_item_detalhado(item))
    else:
        itens.append({
            "item_ref": detalhe or f"{material} {tipo} {bitola}".strip() or material,
            "material": material,
            "tipo": tipo,
            "bitola": bitola,
            "detalhe": detalhe,
        })

    deadline = time.time() + 10

    for cfg in itens:
        if time.time() > deadline:
            logs.append("⏱ Tempo limite da busca base atingido.")
            break

        logs.append(f"📌 Item: {cfg['item_ref'][:120]}")
        queries = gerar_queries(
            cfg["material"], mercado,
            cfg.get("tipo", ""), cfg.get("bitola", ""), cfg.get("detalhe", "")
        )[:2]

        logs.append(f"🔎 {len(queries)} estratégias de busca geradas")

        for q in queries:
            logs.append(f"🌐 Query: {q}")
            try:
                data = buscar_serp(q, num=5)
            except Exception as e:
                logs.append(f"⚠ Erro SERP: {str(e)}")
                continue

            for item in data.get("organic_results", [])[:5]:
                url = item.get("link", "")
                titulo = item.get("title", "")
                snippet = item.get("snippet", "")

                if not url or is_fonte_ruim(url):
                    continue

                candidatos.append({
                    "item_ref": cfg["item_ref"],
                    "material": cfg["material"],
                    "tipo": cfg.get("tipo", ""),
                    "bitola": cfg.get("bitola", ""),
                    "detalhe": cfg.get("detalhe", ""),
                    "titulo": titulo[:120],
                    "snippet": snippet[:220],
                    "link": url
                })

    # dedup
    unicos = []
    vistos = set()
    for c in candidatos:
        chave = (c["item_ref"], c["link"])
        if chave in vistos:
            continue
        vistos.add(chave)
        unicos.append(c)

    return unicos[:12], logs

# =========================
# ETAPA 2 - DETALHE
# =========================
def buscar_detalhe(material, mercado, candidatos):
    logs = []
    resultados = []

    deadline = time.time() + 12

    for c in candidatos[:8]:
        if time.time() > deadline:
            logs.append("⏱ Tempo limite do detalhamento atingido.")
            break

        valor, moeda, html, evidencia = extrair_preco_pagina(c["link"], c["material"])
        if not valor:
            continue

        classe = classificar_fonte(c["link"], c["titulo"], html)
        if classe == "X":
            continue

        if not validar_preco(c["material"], valor):
            continue

        pais = detectar_pais(c["link"], c["titulo"], html)
        if not validar_mercado(pais, mercado):
            continue

        peso = score_fonte(classe)
        if peso <= 0:
            continue

        tipo_cobre = detectar_tipo_cobre(c["titulo"]) if c["material"] == "cobre" else ""
        brasil = calcular_brasil(valor, pais, c["material"])

        resultados.append({
            "item_ref": c["item_ref"],
            "fornecedor": c["titulo"][:80],
            "pais": pais,
            "origem": round(valor, 2),
            "brasil": brasil,
            "tipo": tipo_cobre,
            "link": c["link"],
            "evidencia": (evidencia or c["snippet"] or "")[:220],
            "moeda": moeda,
            "score": peso,
            "classe": classe,
        })

    # dedup
    unicos = []
    vistos = set()
    for r in resultados:
        chave = (r.get("item_ref"), r.get("fornecedor"), r.get("pais"), r.get("origem"), r.get("link"))
        if chave in vistos:
            continue
        vistos.add(chave)
        unicos.append(r)

    if not unicos:
        logs.append("⚠ Nenhuma fonte válida encontrada")
        return [], logs, None, "C", "Sem dados confiáveis para análise.", {"labels": [], "valores": []}, {"labels": [], "valores": []}

    brasil_vals = [r["brasil"] for r in unicos if r.get("brasil") is not None]
    melhor = min(unicos, key=lambda x: x["brasil"] if x.get("brasil") is not None else 999999)

    pesos = [r.get("score", 0.3) for r in unicos]
    origens = [r.get("origem", 0) for r in unicos]
    soma_pesos = sum(pesos) if pesos else 0
    preco_estimado = round(sum(v * p for v, p in zip(origens, pesos)) / soma_pesos, 2) if soma_pesos else None

    confianca = calcular_confianca(brasil_vals)
    insight = gerar_insight(material, mercado, unicos, melhor)

    grafico = {
        "labels": [r["fornecedor"][:18] for r in unicos[:10]],
        "valores": [r["origem"] for r in unicos[:10]]
    }

    salvar_historico(material, {
        "mercado": mercado,
        "dados": unicos,
        "preco_estimado": preco_estimado,
        "confianca": confianca
    })

    hist = ler_historico(material)
    historico_grafico = {
        "labels": [h["data"] for h in hist[-10:]],
        "valores": [
            min([d["brasil"] for d in h.get("payload", {}).get("dados", []) if d.get("brasil") is not None], default=0)
            for h in hist[-10:]
        ]
    }

    logs.append(f"📊 {len(unicos)} fontes válidas")
    logs.append("✅ Detalhamento finalizado")

    return unicos, logs, preco_estimado, confianca, insight, grafico, historico_grafico

# =========================
# ROTAS
# =========================
@app.route("/")
def home():
    return jsonify({
        "ok": True,
        "service": "ERP ÍMPAR - Consulta de Preços",
        "status": "online",
        "engine": "V4 MONSTRÃO LOTEADO",
        "apis": {
            "serp": "ativa" if SERP_API_KEY else "erro",
            "brightdata": "ativa" if BRIGHT_API_KEY else "erro"
        }
    })

@app.route("/health")
def health():
    return jsonify({"ok": True, "status": "healthy"})

@app.route("/buscar_base", methods=["POST", "OPTIONS"])
def rota_buscar_base():
    try:
        data = request.get_json(silent=True) or {}

        material = data.get("material", "elastomerico")
        mercado = data.get("mercado", "global")
        tipo = data.get("tipo", "")
        bitola = data.get("bitola", "")
        detalhe = data.get("detalhe", "")
        lista_materiais = data.get("lista_materiais", [])

        candidatos, logs = buscar_base(
            material=material,
            mercado=mercado,
            tipo=tipo,
            bitola=bitola,
            detalhe=detalhe,
            lista_materiais=lista_materiais
        )

        job_id = str(uuid.uuid4())
        save_job(job_id, {
            "material": material,
            "mercado": mercado,
            "candidatos": candidatos
        })

        return jsonify({
            "ok": True,
            "job_id": job_id,
            "candidatos": candidatos,
            "logs": logs
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "logs": [f"❌ Erro em /buscar_base: {str(e)}"]
        }), 500

@app.route("/buscar_detalhe", methods=["POST", "OPTIONS"])
def rota_buscar_detalhe():
    try:
        data = request.get_json(silent=True) or {}
        job_id = data.get("job_id")

        if not job_id:
            return jsonify({"ok": False, "logs": ["❌ job_id não informado"]}), 400

        payload = load_job(job_id)
        if not payload:
            return jsonify({"ok": False, "logs": ["❌ job_id não encontrado"]}), 404

        material = payload["material"]
        mercado = payload["mercado"]
        candidatos = payload["candidatos"]

        dados, logs, preco_estimado, confianca, insight, grafico, historico_grafico = buscar_detalhe(
            material=material,
            mercado=mercado,
            candidatos=candidatos
        )

        gerar_excel_simples(dados)

        return jsonify({
            "ok": True,
            "dados": dados,
            "logs": logs,
            "preco_estimado": preco_estimado,
            "analise": f"Baseado em {len(dados)} fontes confiáveis HVAC" if dados else "Sem dados confiáveis para análise.",
            "confianca": confianca,
            "insight": insight,
            "grafico": grafico,
            "historico_grafico": historico_grafico
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "dados": [],
            "logs": [f"❌ Erro em /buscar_detalhe: {str(e)}"],
            "confianca": "C",
            "insight": "Falha interna no motor de consulta.",
            "grafico": {"labels": [], "valores": []},
            "historico_grafico": {"labels": [], "valores": []}
        }), 500

@app.route("/baixar")
def baixar():
    if os.path.exists(LAST_XLSX):
        return send_file(LAST_XLSX, as_attachment=True)
    return "Arquivo não encontrado", 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
