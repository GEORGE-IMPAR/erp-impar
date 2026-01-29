"""worker_cn.py — versão CHINA (duplicada da estrutura BR)

- Busca na China (gl=cn, hl=zh-CN)
- Traduz PT->ZH antes de buscar (Google Translate gratuito)
- Converte CNY->BRL (exchangerate.host) para comparar em Reais
- Mantém estrutura de saída compatível com o front (price em BRL)
"""

import os, time, json, re, requests

SERPAPI_KEY = os.getenv("SERPAPI_KEY", "").strip()

def translate_free(text: str, sl: str = "pt", tl: str = "zh-CN") -> str:
    text = (text or "").strip()
    if not text:
        return text
    url = "https://translate.googleapis.com/translate_a/single"
    params = {"client":"gtx","sl":sl,"tl":tl,"dt":"t","q":text}
    try:
        r = requests.get(url, params=params, timeout=12)
        r.raise_for_status()
        data = r.json()
        out = "".join(chunk[0] for chunk in data[0] if chunk and chunk[0])
        return out.strip() or text
    except Exception:
        return text

def fx_cny_brl() -> float:
    url = "https://api.exchangerate.host/latest"
    params = {"base":"CNY","symbols":"BRL"}
    try:
        r = requests.get(url, params=params, timeout=12)
        r.raise_for_status()
        data = r.json()
        rate = data.get("rates", {}).get("BRL")
        return float(rate) if rate else 0.0
    except Exception:
        return 0.0

def parse_price_any(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    s = re.sub(r"[^0-9,\.]", "", s)
    if not s:
        return None
    last_comma = s.rfind(",")
    last_dot = s.rfind(".")
    if last_comma != -1 and last_dot != -1:
        if last_dot > last_comma:
            s = s.replace(",", "")
        else:
            s = s.replace(".", "")
            s = s.replace(",", ".")
    elif last_comma != -1:
        s = s.replace(",", ".")
    try:
        return float(s)
    except Exception:
        return None

def serpapi_google_shopping_cn(query_zh: str):
    url = "https://serpapi.com/search.json"
    params = {
        "engine": "google_shopping",
        "q": query_zh,
        "hl": "zh-CN",
        "gl": "cn",
        "api_key": SERPAPI_KEY,
    }
    r = requests.get(url, params=params, timeout=25)
    r.raise_for_status()
    return r.json()

def quote_items_cn(items):
    fx = fx_cny_brl()
    out = []
    total_best = 0.0
    for it in items:
        codigo = it.get("codigo","")
        desc = it.get("descricao","") or it.get("produto","")
        qtd = float(it.get("qtd", it.get("quantidade", 1)) or 1)
        kg_per_m = it.get("kg_per_m")
        kg_per_m = float(kg_per_m) if isinstance(kg_per_m,(int,float,str)) and str(kg_per_m).strip().replace(".","",1).isdigit() else None

        query_pt = (desc or codigo or "").strip()
        if not query_pt:
            continue

        query_zh = translate_free(query_pt, "pt", "zh-CN")
        data = serpapi_google_shopping_cn(query_zh)

        offers = []
        for r in data.get("shopping_results", []) or []:
            p_cny = parse_price_any(r.get("extracted_price") or r.get("price"))
            if p_cny is None:
                continue
            p_brl = p_cny * fx if fx > 0 else None
            if p_brl is None:
                continue
            title_zh = r.get("title") or ""
            title_pt = translate_free(title_zh, "zh-CN", "pt") if title_zh else ""
            brl_per_m = (p_brl * kg_per_m) if (kg_per_m is not None) else None

            offers.append({
                "title": title_pt or title_zh or "",
                "store": r.get("source") or r.get("seller"),
                "price": float(p_brl),
                "currency": "BRL",
                "link": r.get("link"),
                "source": "SERPAPI",
                "price_cny": float(p_cny),
                "fx_cny_brl": float(fx),
                "title_zh": title_zh,
                "brl_per_m": brl_per_m,
            })

        offers.sort(key=lambda x: x.get("price", 1e18))
        offers = offers[:8]
        best = offers[0] if offers else None
        if best:
            total_best += best["price"] * qtd

        out.append({
            "codigo": codigo,
            "descricao": desc,
            "qtd": qtd,
            "query": query_pt,
            "query_zh": query_zh,
            "kg_per_m": kg_per_m,
            "best_offer": best,
            "offers": offers,
        })

        time.sleep(0.12)
    return {"results": out, "total_best": total_best, "fx_cny_brl": fx}

if __name__ == "__main__":
    # exemplo rápido:
    example = [{"codigo":"TB-038","descricao":"tubo de cobre 3/8","qtd":10,"kg_per_m":0.19}]
    if not SERPAPI_KEY:
        raise SystemExit("Defina SERPAPI_KEY no ambiente.")
    print(json.dumps(quote_items_cn(example), ensure_ascii=False, indent=2))
