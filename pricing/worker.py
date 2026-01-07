#!/usr/bin/env python3
"""
ERP ÍMPAR — Pricing Worker (produção)
- Lê cotações JSON em ./api/pricing/storage (ou PRICING_QUOTES_DIR)
- Para cada item: consulta SerpAPI (google_shopping)
- Salva ofertas + melhor/2º/3º + total por item
"""

import os, json, time, argparse, datetime, re
from pathlib import Path
import requests

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def to_float_price(s):
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    txt = str(s)
    # strip currency and spaces
    txt = txt.replace("R$", "").strip()
    # "74,43" -> 74.43
    txt = txt.replace(".", "").replace(",", ".")
    m = re.search(r"[-+]?[0-9]*\.?[0-9]+", txt)
    return float(m.group(0)) if m else None

def serp_search(query, api_key, hl="pt", gl="br", num=10):
    url = "https://serpapi.com/search.json"
    params = {
        "engine": "google_shopping",
        "q": query,
        "hl": hl,
        "gl": gl,
        "num": num,
        "api_key": api_key
    }
    r = requests.get(url, params=params, timeout=60)
    r.raise_for_status()
    return r.json()

def extract_offers(data):
    offers = []
    for item in data.get("shopping_results", []) or []:
        title = item.get("title") or ""
        price = item.get("price") or item.get("extracted_price")
        if price is None:
            price = to_float_price(item.get("price"))
        else:
            price = float(price) if isinstance(price, (int,float)) else to_float_price(price)
        if price is None:
            continue
        store = item.get("source") or item.get("seller") or item.get("store_name") or ""
        link = item.get("link") or item.get("product_link") or item.get("thumbnail") or None
        offers.append({
            "title": title,
            "loja": store,
            "preco": price,
            "moeda": "BRL",
            "link": link,
            "fonte": "SERPAPI"
        })
    offers.sort(key=lambda x: x["preco"])
    return offers

def process_quote(path: Path, serp_key: str):
    raw = path.read_text(encoding="utf-8", errors="ignore")
    q = json.loads(raw)
    payload = q.get("carga_util") or q.get("payload") or {}
    itens = payload.get("itens") or payload.get("items") or []
    obra_id = payload.get("obra_id") or payload.get("obra_nome") or ""

    results = []
    errors = []
    for it in itens:
        codigo = it.get("codigo") or it.get("código") or ""
        produto = it.get("produto") or it.get("descricao") or it.get("descrição") or ""
        ncm = it.get("ncm") or ""
        qtd = it.get("quantidade") or it.get("qtd") or 1
        try:
            qtd = float(qtd)
        except Exception:
            qtd = 1.0

        query = produto.strip() or str(codigo)
        if not query:
            continue

        try:
            log(f"Consultando: {query}")
            data = serp_search(query, serp_key)
            offers = extract_offers(data)
            best_offer = offers[0] if offers else None
            results.append({
                "codigo": codigo,
                "produto": produto,
                "ncm": ncm or None,
                "quantidade": qtd,
                "consulta": query,
                "melhor_oferta": best_offer,
                "ofertas": offers[:10]
            })
            if best_offer:
                log(f"OK: {query} -> melhor={best_offer['preco']}")
            else:
                log(f"SEM OFERTAS: {query}")
        except Exception as e:
            msg = f"{query} -> {e}"
            log(f"ERRO: {msg}")
            errors.append(msg)
            results.append({
                "codigo": codigo,
                "produto": produto,
                "ncm": ncm or None,
                "quantidade": qtd,
                "consulta": query,
                "melhor_oferta": None,
                "ofertas": []
            })

        time.sleep(1.0)  # respeitar SERPAPI

    q["resultados"] = results
    q["erros"] = errors
    q["status"] = "completed" if not errors else "completed_with_errors"
    q["updated_at"] = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).isoformat()

    path.write_text(json.dumps(q, ensure_ascii=False, indent=2), encoding="utf-8")
    return q["status"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quote-id", default=None, help="Processar apenas um quote_id (Q-...)")
    ap.add_argument("--dir", default=os.environ.get("PRICING_QUOTES_DIR","./api/pricing/storage"), help="Diretório das cotações")
    ap.add_argument("--serpapi-key", default=os.environ.get("SERPAPI_KEY",""), help="Chave SerpAPI (env SERPAPI_KEY)")
    args = ap.parse_args()

    if not args.serpapi_key:
        raise SystemExit("ERRO: SERPAPI_KEY não definido (use env SERPAPI_KEY ou --serpapi-key)")

    d = Path(args.dir)
    d.mkdir(parents=True, exist_ok=True)

    files = sorted(d.glob("Q-*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if args.quote_id:
        target = d / (args.quote_id if args.quote_id.endswith(".json") else args.quote_id + ".json")
        if not target.exists():
            raise SystemExit(f"Não achei {target}")
        files = [target]

    if not files:
        log("Nenhuma cotação para processar.")
        return

    for f in files:
        try:
            raw = f.read_text(encoding="utf-8", errors="ignore")
            q = json.loads(raw)
            st = q.get("status","")
            if args.quote_id is None and st not in ("queued","draft","processing"):
                continue
            q["status"] = "processing"
            q["updated_at"] = datetime.datetime.now().isoformat()
            f.write_text(json.dumps(q, ensure_ascii=False, indent=2), encoding="utf-8")

            log(f"Processando {f.name}")
            status = process_quote(f, args.serpapi_key)
            log(f"FINALIZADO: {f.name} -> {status}")
        except Exception as e:
            log(f"FALHA {f.name}: {e}")

if __name__ == "__main__":
    main()
