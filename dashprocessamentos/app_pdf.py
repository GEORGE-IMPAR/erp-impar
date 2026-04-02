import os
import re
import json
import shutil
from datetime import datetime
from typing import List, Dict, Any

from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PDF_BASE = os.getenv("PDF_BASE_DIR", os.path.join(BASE_DIR, "pdfs"))
ENTRADA_DIR = os.path.join(PDF_BASE, "entrada")
PROCESSADOS_DIR = os.path.join(PDF_BASE, "processados")
ERRO_DIR = os.path.join(PDF_BASE, "erro")
JSON_DIR = os.path.join(PDF_BASE, "json")
CSV_DIR = os.path.join(PDF_BASE, "csv")

STATUS_FILE = os.path.join(JSON_DIR, "status_motor_pdf.json")
LOG_FILE = os.path.join(JSON_DIR, "logs_motor_pdf.json")
ITENS_FILE = os.path.join(JSON_DIR, "itens_materiais.json")
RESUMO_FILE = os.path.join(JSON_DIR, "notas_resumo.json")
CSV_FILE = os.path.join(CSV_DIR, "materiais_extraidos.csv")

for path in [ENTRADA_DIR, PROCESSADOS_DIR, ERRO_DIR, JSON_DIR, CSV_DIR]:
    os.makedirs(path, exist_ok=True)


def now_str() -> str:
    return datetime.now().strftime("%d/%m/%Y, %H:%M:%S")


def respond(ok=True, **kwargs):
    payload = {"ok": ok}
    payload.update(kwargs)
    return jsonify(payload)


def load_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path: str, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def append_log(etapa: str, status: str, mensagem: str):
    logs = load_json(LOG_FILE, [])
    logs.append({
        "data_hora": now_str(),
        "etapa": etapa,
        "status": status,
        "mensagem": mensagem
    })
    logs = logs[-300:]
    save_json(LOG_FILE, logs)


def save_status(status: str, current_step: str = "ler", extra: Dict[str, Any] | None = None):
    payload = {
        "motor_status": status,
        "motor_status_label": status.capitalize(),
        "current_step": current_step,
        "ultima_execucao": now_str(),
        "timeline": {
            "ler": "done" if current_step not in ["ler"] else ("running" if status == "executando" else "pending"),
            "extrair": "done" if current_step not in ["ler", "extrair"] else ("running" if current_step == "extrair" and status == "executando" else "pending"),
            "blocos": "done" if current_step not in ["ler", "extrair", "blocos"] else ("running" if current_step == "blocos" and status == "executando" else "pending"),
            "normalizar": "done" if current_step not in ["ler", "extrair", "blocos", "normalizar"] else ("running" if current_step == "normalizar" and status == "executando" else "pending"),
            "json": "done" if current_step not in ["ler", "extrair", "blocos", "normalizar", "json"] else ("running" if current_step == "json" and status == "executando" else "pending"),
            "csv": "done" if status == "concluido" else ("running" if current_step == "csv" and status == "executando" else "pending"),
        }
    }
    if extra:
        payload.update(extra)
    save_json(STATUS_FILE, payload)


def list_pdfs() -> List[str]:
    return sorted([
        os.path.join(ENTRADA_DIR, x)
        for x in os.listdir(ENTRADA_DIR)
        if x.lower().endswith(".pdf")
    ])


def br_to_float(v: str) -> float:
    v = (v or "").strip()
    if not v:
        return 0.0
    v = re.sub(r"[^\d,.-]", "", v)
    v = v.replace(".", "").replace(",", ".")
    try:
        return float(v)
    except Exception:
        return 0.0


def normalizar_texto(txt: str) -> str:
    txt = txt.replace("\r", "\n")
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"\n{2,}", "\n", txt)
    return txt.strip()


def extract_text_from_pdf(pdf_path: str) -> str:
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                pages.append(page.extract_text() or "")
        return normalizar_texto("\n".join(pages))
    except Exception:
        pass

    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(pdf_path)
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return normalizar_texto("\n".join(pages))
    except Exception as e:
        raise RuntimeError(f"Falha ao extrair texto do PDF: {e}")


def extrair_fornecedor(texto: str) -> str:
    bloco = ""
    m = re.search(r"IDENTIFICAÇÃO DO EMITENTE(.*?)(DANFE|DOCUMENTO AUXILIAR|NATUREZA DA OPERAÇÃO)", texto, re.S | re.I)
    if m:
        bloco = m.group(1).strip()

    if bloco:
        linhas = [x.strip() for x in bloco.split("\n") if x.strip()]
        for linha in linhas:
            if not re.search(r"CNPJ|IE|CEP|Telefone|Fone|Rua|Avenida|Endere|Município", linha, re.I):
                return linha

    return "Fornecedor não identificado"


def extrair_numero_nota(texto: str, nome_arquivo: str) -> str:
    m = re.search(r"N[º°]?\s*[:.]?\s*(\d{1,9})", texto, re.I)
    if m:
        return m.group(1)
    m = re.search(r"NF\s*([0-9]{1,9})", nome_arquivo, re.I)
    if m:
        return m.group(1)
    return ""


def extrair_data_emissao(texto: str) -> str:
    m = re.search(r"DATA DE EMISS[ÃA]O\s+(\d{2}/\d{2}/\d{4})", texto, re.I)
    return m.group(1) if m else ""


def extrair_valor_frete(texto: str) -> float:
    m = re.search(r"VALOR DO FRETE\s+([\d\.,]+)", texto, re.I)
    return br_to_float(m.group(1)) if m else 0.0


def extrair_valor_total_nota(texto: str) -> float:
    m = re.search(r"VALOR TOTAL DA NOTA\s+([\d\.,]+)", texto, re.I)
    return br_to_float(m.group(1)) if m else 0.0


def extrair_bloco_produtos(texto: str) -> str:
    inicio = texto.upper().find("DADOS DO PRODUTO / SERVIÇO")
    if inicio == -1:
        inicio = texto.upper().find("DADOS DO PRODUTO/SERVIÇO")
    if inicio == -1:
        return ""

    resto = texto[inicio:]
    terminadores = [
        "CÁLCULO DO ISSQN",
        "DADOS ADICIONAIS",
        "RESERVADO AO FISCO",
        "INFORMAÇÕES COMPLEMENTARES"
    ]

    fim_pos = None
    resto_upper = resto.upper()
    for termo in terminadores:
        p = resto_upper.find(termo.upper())
        if p != -1:
            if fim_pos is None or p < fim_pos:
                fim_pos = p

    return resto[:fim_pos].strip() if fim_pos is not None else resto.strip()


def limpar_descricao_item(desc: str) -> str:
    return re.sub(r"\s{2,}", " ", desc or "").strip()


def parse_itens_danfe(bloco: str) -> List[Dict[str, Any]]:
    itens = []
    if not bloco:
        return itens

    linhas = [x.strip() for x in bloco.split("\n") if x.strip()]
    limpas = []
    for linha in linhas:
        if re.search(r"CÓD\.?\s*PROD|DESCRIÇÃO DO PRODUTO|V\.\s*UNIT|V\.\s*TOTAL|QUANT|NCM|CFOP", linha, re.I):
            continue
        limpas.append(linha)

    texto = "\n".join(limpas)

    pattern = re.compile(r"""
        (?:^|\n)
        \s*
        (\d{1,20})
        \s+
        (.*?)
        \s+
        (\d{4,10})
        \s+
        (\d{2,4})
        \s+
        (\d{4})
        \s+
        ([A-Z]{1,6}|[A-Z]{1,6}\.)
        \s+
        (\d{1,3}(?:\.\d{3})*,\d+|\d+,\d+)
        \s+
        (\d{1,3}(?:\.\d{3})*,\d+|\d+,\d+)
        \s+
        (\d{1,3}(?:\.\d{3})*,\d+|\d+,\d+)
    """, re.S | re.X | re.I)

    matches = pattern.findall(texto)
    for m in matches:
        descricao = limpar_descricao_item(m[1])
        if not descricao:
            continue
        if re.search(r"CHAVE DE ACESSO|PARCELA|FATURA|DUPLICATA|FONTE IBPT|PEDIDO CLIENTE", descricao, re.I):
            continue

        itens.append({
            "descricao_item": descricao,
            "quantidade_item": br_to_float(m[6]),
            "preco_unitario_item": br_to_float(m[7]),
            "preco_total_item": br_to_float(m[8]),
        })
    return itens


def gerar_csv(itens: List[Dict[str, Any]]):
    import csv
    with open(CSV_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow([
            "NomeArquivo", "Fornecedor", "NumeroNota", "DataEmissao",
            "ValorFrete", "ValorTotalNota", "DescricaoItem",
            "QuantidadeItem", "PrecoUnitarioItem", "PrecoTotalItem"
        ])
        for i in itens:
            writer.writerow([
                i.get("nome_arquivo", ""),
                i.get("fornecedor", ""),
                i.get("numero_nota", ""),
                i.get("data_emissao", ""),
                f"{float(i.get('valor_frete', 0)):.2f}".replace(".", ","),
                f"{float(i.get('valor_total_nota', 0)):.2f}".replace(".", ","),
                i.get("descricao_item", ""),
                f"{float(i.get('quantidade_item', 0)):.2f}".replace(".", ","),
                f"{float(i.get('preco_unitario_item', 0)):.2f}".replace(".", ","),
                f"{float(i.get('preco_total_item', 0)):.2f}".replace(".", ","),
            ])


def processar_todos_pdfs():
    arquivos = list_pdfs()
    itens_all = []
    resumo_all = []

    save_status("executando", current_step="ler", extra={
        "pdfs_fila": len(arquivos),
        "pdfs_processados": 0,
        "itens_extraidos": 0
    })
    append_log("motor", "INFO", f"Iniciando processamento de {len(arquivos)} PDF(s).")

    for idx, pdf_path in enumerate(arquivos, start=1):
        nome_arquivo = os.path.basename(pdf_path)
        try:
            save_status("executando", current_step="ler")
            append_log("ler", "INFO", f"Lendo arquivo {nome_arquivo}.")
            texto = extract_text_from_pdf(pdf_path)
            texto = normalizar_texto(texto)

            save_status("executando", current_step="blocos")
            fornecedor = extrair_fornecedor(texto)
            numero_nota = extrair_numero_nota(texto, nome_arquivo)
            data_emissao = extrair_data_emissao(texto)
            valor_frete = extrair_valor_frete(texto)
            valor_total_nota = extrair_valor_total_nota(texto)
            bloco_produtos = extrair_bloco_produtos(texto)

            save_status("executando", current_step="normalizar")
            itens_nota = parse_itens_danfe(bloco_produtos)

            resumo_all.append({
                "nome_arquivo": nome_arquivo,
                "fornecedor": fornecedor,
                "numero_nota": numero_nota,
                "data_emissao": data_emissao,
                "valor_frete": valor_frete,
                "valor_total_nota": valor_total_nota,
                "quantidade_itens": len(itens_nota)
            })

            for item in itens_nota:
                itens_all.append({
                    "nome_arquivo": nome_arquivo,
                    "fornecedor": fornecedor,
                    "numero_nota": numero_nota,
                    "data_emissao": data_emissao,
                    "valor_frete": valor_frete,
                    "valor_total_nota": valor_total_nota,
                    "descricao_item": item["descricao_item"],
                    "quantidade_item": item["quantidade_item"],
                    "preco_unitario_item": item["preco_unitario_item"],
                    "preco_total_item": item["preco_total_item"]
                })

            shutil.move(pdf_path, os.path.join(PROCESSADOS_DIR, nome_arquivo))
        except Exception as e:
            append_log("motor", "ERRO", f"{nome_arquivo}: {e}")
            try:
                shutil.move(pdf_path, os.path.join(ERRO_DIR, nome_arquivo))
            except Exception:
                pass

        save_status("executando", current_step="json", extra={
            "pdfs_fila": max(0, len(arquivos) - idx),
            "pdfs_processados": len(resumo_all),
            "itens_extraidos": len(itens_all)
        })

    save_json(ITENS_FILE, itens_all)
    save_json(RESUMO_FILE, resumo_all)

    save_status("executando", current_step="csv")
    gerar_csv(itens_all)

    save_status("concluido", current_step="csv", extra={
        "pdfs_fila": 0,
        "pdfs_processados": len(resumo_all),
        "itens_extraidos": len(itens_all),
        "itens": itens_all,
        "resumo": resumo_all
    })
    append_log("motor", "OK", "Processamento concluído com sucesso.")

    return {
        "pdfs_processados": len(resumo_all),
        "itens_extraidos": len(itens_all),
        "resumo": resumo_all,
        "itens": itens_all
    }


def gerar_rankings():
    itens = load_json(ITENS_FILE, [])
    resumo = load_json(RESUMO_FILE, [])

    fornecedor_valor = {}
    fornecedor_frete = {}
    produto_preco = {}
    produto_valor = {}
    produto_qtd = {}

    for r in resumo:
        forn = r.get("fornecedor") or "Fornecedor não identificado"
        fornecedor_valor[forn] = fornecedor_valor.get(forn, 0.0) + float(r.get("valor_total_nota", 0) or 0)
        fornecedor_frete[forn] = fornecedor_frete.get(forn, 0.0) + float(r.get("valor_frete", 0) or 0)

    for i in itens:
        prod = i.get("descricao_item") or "Item não identificado"
        produto_preco[prod] = max(produto_preco.get(prod, 0.0), float(i.get("preco_unitario_item", 0) or 0))
        produto_valor[prod] = produto_valor.get(prod, 0.0) + float(i.get("preco_total_item", 0) or 0)
        produto_qtd[prod] = produto_qtd.get(prod, 0.0) + float(i.get("quantidade_item", 0) or 0)

    def top10(d):
        return sorted([{"nome": k, "valor": v} for k, v in d.items()], key=lambda x: x["valor"], reverse=True)[:10]

    return {
        "fornecedor_maior_valor": top10(fornecedor_valor),
        "produto_maior_preco_unitario": top10(produto_preco),
        "produto_maior_valor": top10(produto_valor),
        "produto_maior_quantidade": top10(produto_qtd),
        "fornecedor_maior_frete": top10(fornecedor_frete),
    }


@app.route("/pdf/status", methods=["GET"])
def pdf_status():
    status = load_json(STATUS_FILE, {
        "motor_status": "aguardando",
        "motor_status_label": "Aguardando",
        "current_step": "ler",
        "ultima_execucao": now_str(),
        "pdfs_fila": len(list_pdfs()),
        "pdfs_processados": len(load_json(RESUMO_FILE, [])),
        "itens_extraidos": len(load_json(ITENS_FILE, [])),
        "timeline": {
            "ler": "pending",
            "extrair": "pending",
            "blocos": "pending",
            "normalizar": "pending",
            "json": "pending",
            "csv": "pending",
        },
        "itens": load_json(ITENS_FILE, []),
        "resumo": load_json(RESUMO_FILE, []),
    })
    status["logs"] = load_json(LOG_FILE, [])[-50:]
    return jsonify(status)


@app.route("/pdf/processar", methods=["POST"])
def pdf_processar():
    try:
        resultado = processar_todos_pdfs()
        return respond(True, message="Processamento concluído com sucesso.",
                       pdfs_processados=resultado["pdfs_processados"],
                       itens_extraidos=resultado["itens_extraidos"])
    except Exception as e:
        append_log("motor", "ERRO", str(e))
        save_status("erro", current_step="json")
        return respond(False, error=str(e)), 500


@app.route("/pdf/rankings", methods=["GET"])
def pdf_rankings():
    return respond(True, rankings=gerar_rankings())


@app.route("/pdf/logs", methods=["GET"])
def pdf_logs():
    return respond(True, logs=load_json(LOG_FILE, []))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8765, debug=True)
