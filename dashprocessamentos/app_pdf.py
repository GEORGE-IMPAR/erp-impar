import os
import re
import json
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_PATH = "/data/pdfs"

ENTRADA = f"{BASE_PATH}/entrada"
PROCESSADOS = f"{BASE_PATH}/processados"
ERRO = f"{BASE_PATH}/erro"
JSON_DIR = f"{BASE_PATH}/json"
CSV_DIR = f"{BASE_PATH}/csv"

STATUS_FILE = f"{JSON_DIR}/status_motor_pdf.json"
LOG_FILE = f"{JSON_DIR}/logs_motor_pdf.json"
RESUMO_FILE = f"{JSON_DIR}/resumo.json"
ITENS_FILE = f"{JSON_DIR}/itens.json"
CSV_FILE = f"{CSV_DIR}/materiais_extraidos.csv"

for pasta in [ENTRADA, PROCESSADOS, ERRO, JSON_DIR, CSV_DIR]:
    os.makedirs(pasta, exist_ok=True)


def agora_str():
    return datetime.now().strftime("%d/%m/%Y, %H:%M:%S")


def carregar_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def salvar_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def adicionar_log(etapa, status, mensagem):
    logs = carregar_json(LOG_FILE, [])
    logs.append({
        "data_hora": agora_str(),
        "etapa": etapa,
        "status": status,
        "mensagem": mensagem
    })
    logs = logs[-300:]
    salvar_json(LOG_FILE, logs)


def salvar_status(motor_status="aguardando", current_step="ler", itens=None, resumo=None):
    itens = itens or carregar_json(ITENS_FILE, [])
    resumo = resumo or carregar_json(RESUMO_FILE, [])

    timeline = {
        "ler": "pending",
        "extrair": "pending",
        "blocos": "pending",
        "normalizar": "pending",
        "json": "pending",
        "csv": "pending",
    }

    ordem = ["ler", "extrair", "blocos", "normalizar", "json", "csv"]
    if current_step in ordem:
        idx = ordem.index(current_step)
        for i, etapa in enumerate(ordem):
            if motor_status == "concluido":
                timeline[etapa] = "done"
            elif i < idx:
                timeline[etapa] = "done"
            elif i == idx and motor_status == "executando":
                timeline[etapa] = "running"

    payload = {
        "motor_status": motor_status,
        "motor_status_label": motor_status.capitalize(),
        "current_step": current_step,
        "ultima_execucao": agora_str(),
        "pdfs_fila": len([f for f in os.listdir(ENTRADA) if f.lower().endswith(".pdf")]),
        "pdfs_processados": len([f for f in os.listdir(PROCESSADOS) if f.lower().endswith(".pdf")]),
        "itens_extraidos": len(itens),
        "itens": itens,
        "resumo": resumo,
        "logs": carregar_json(LOG_FILE, []),
        "timeline": timeline
    }
    salvar_json(STATUS_FILE, payload)


def normalizar_texto(texto):
    texto = texto.replace("\r", "\n")
    texto = re.sub(r"[ \t]+", " ", texto)
    texto = re.sub(r"\n{2,}", "\n", texto)
    return texto.strip()


def br_to_float(valor):
    valor = (valor or "").strip()
    if not valor:
        return 0.0
    valor = re.sub(r"[^\d,.-]", "", valor)
    valor = valor.replace(".", "").replace(",", ".")
    try:
        return float(valor)
    except Exception:
        return 0.0


def extract_text_from_pdf(pdf_path):
    try:
        import pdfplumber
        partes = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                partes.append(page.extract_text() or "")
        return normalizar_texto("\n".join(partes))
    except Exception:
        pass

    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(pdf_path)
        partes = []
        for page in reader.pages:
            partes.append(page.extract_text() or "")
        return normalizar_texto("\n".join(partes))
    except Exception as e:
        raise RuntimeError(f"Falha ao extrair texto do PDF: {e}")


def extrair_numero_nota(texto, nome_arquivo):
    m = re.search(r"\bN[º°]?\s*[:.]?\s*(\d{1,9})\b", texto, re.I)
    if m:
        return m.group(1)

    m = re.search(r"\bNF\s*([0-9]{1,9})\b", nome_arquivo, re.I)
    if m:
        return m.group(1)

    return ""


def extrair_data_emissao(texto):
    m = re.search(r"DATA DE EMISS[ÃA]O\s+(\d{2}/\d{2}/\d{4})", texto, re.I)
    return m.group(1) if m else ""


def extrair_valor_frete(texto):
    m = re.search(r"VALOR DO FRETE\s+([\d\.,]+)", texto, re.I)
    return br_to_float(m.group(1)) if m else 0.0


def extrair_valor_total_nota(texto):
    m = re.search(r"VALOR TOTAL DA NOTA\s+([\d\.,]+)", texto, re.I)
    return br_to_float(m.group(1)) if m else 0.0


def extrair_fornecedor(texto):
    bloco = ""
    m = re.search(
        r"IDENTIFICAÇÃO DO EMITENTE(.*?)(DANFE|DOCUMENTO AUXILIAR|NATUREZA DA OPERAÇÃO)",
        texto,
        re.S | re.I
    )
    if m:
        bloco = m.group(1).strip()

    if bloco:
        linhas = [x.strip() for x in bloco.split("\n") if x.strip()]
        for linha in linhas:
            if not re.search(
                r"CNPJ|IE|CEP|Telefone|Fone|Rua|Avenida|Endere|Município|Bairro|UF",
                linha,
                re.I
            ):
                return linha

    return "Fornecedor não identificado"


def extrair_bloco_produtos(texto):
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

    resto_upper = resto.upper()
    fim_pos = None
    for termo in terminadores:
        p = resto_upper.find(termo.upper())
        if p != -1:
            if fim_pos is None or p < fim_pos:
                fim_pos = p

    return resto[:fim_pos].strip() if fim_pos is not None else resto.strip()


def limpar_descricao_item(desc):
    return re.sub(r"\s{2,}", " ", desc or "").strip()


def parse_itens_danfe(bloco):
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

    pattern = re.compile(
        r"""
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
        """,
        re.S | re.X | re.I
    )

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


def gerar_csv(itens):
    import csv

    with open(CSV_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow([
            "NomeArquivo",
            "Fornecedor",
            "NumeroNota",
            "DataEmissao",
            "ValorFrete",
            "ValorTotalNota",
            "DescricaoItem",
            "QuantidadeItem",
            "PrecoUnitarioItem",
            "PrecoTotalItem"
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


def gerar_rankings():
    itens = carregar_json(ITENS_FILE, [])
    resumo = carregar_json(RESUMO_FILE, [])

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
        return sorted(
            [{"nome": k, "valor": v} for k, v in d.items()],
            key=lambda x: x["valor"],
            reverse=True
        )[:10]

    return {
        "fornecedor_maior_valor": top10(fornecedor_valor),
        "produto_maior_preco_unitario": top10(produto_preco),
        "produto_maior_valor": top10(produto_valor),
        "produto_maior_quantidade": top10(produto_qtd),
        "fornecedor_maior_frete": top10(fornecedor_frete),
    }


@app.route("/")
def home():
    return jsonify({"status": "ok", "msg": "Motor PDF rodando 🚀"})


@app.route("/pdf/status")
def status():
    itens = carregar_json(ITENS_FILE, [])
    resumo = carregar_json(RESUMO_FILE, [])
    logs = carregar_json(LOG_FILE, [])

    if os.path.exists(STATUS_FILE):
        status_salvo = carregar_json(STATUS_FILE, {})
        if status_salvo:
            status_salvo["itens"] = itens
            status_salvo["resumo"] = resumo
            status_salvo["logs"] = logs[-50:]
            status_salvo["pdfs_fila"] = len([f for f in os.listdir(ENTRADA) if f.lower().endswith(".pdf")])
            status_salvo["pdfs_processados"] = len([f for f in os.listdir(PROCESSADOS) if f.lower().endswith(".pdf")])
            status_salvo["itens_extraidos"] = len(itens)
            return jsonify(status_salvo)

    return jsonify({
        "motor_status": "aguardando",
        "motor_status_label": "Aguardando",
        "current_step": "ler",
        "ultima_execucao": "",
        "pdfs_fila": len([f for f in os.listdir(ENTRADA) if f.lower().endswith(".pdf")]),
        "pdfs_processados": len([f for f in os.listdir(PROCESSADOS) if f.lower().endswith(".pdf")]),
        "itens_extraidos": len(itens),
        "itens": itens,
        "resumo": resumo,
        "logs": logs[-50:],
        "timeline": {
            "ler": "pending",
            "extrair": "pending",
            "blocos": "pending",
            "normalizar": "pending",
            "json": "pending",
            "csv": "pending"
        }
    })


@app.route("/pdf/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"ok": False, "erro": "sem arquivo"}), 400

    arquivo = request.files["file"]

    if not arquivo.filename:
        return jsonify({"ok": False, "erro": "arquivo inválido"}), 400

    destino = os.path.join(ENTRADA, arquivo.filename)
    arquivo.save(destino)

    adicionar_log("upload", "OK", f"Arquivo {arquivo.filename} enviado para entrada.")
    salvar_status("aguardando", "ler")

    return jsonify({
        "ok": True,
        "status": "ok",
        "arquivo": arquivo.filename
    })


@app.route("/pdf/processar")
def processar():
    logs_exec = []
    resumo = []
    itens = []

    salvar_status("executando", "ler", itens, resumo)
    adicionar_log("motor", "INFO", "Iniciando processamento dos PDFs.")

    arquivos = [f for f in os.listdir(ENTRADA) if f.lower().endswith(".pdf")]

    for nome in arquivos:
        caminho = os.path.join(ENTRADA, nome)
        logs_exec.append(f"Processando {nome}")
        adicionar_log("ler", "INFO", f"Lendo {nome}")

        try:
            salvar_status("executando", "extrair", itens, resumo)
            texto = extract_text_from_pdf(caminho)

            salvar_status("executando", "blocos", itens, resumo)
            fornecedor = extrair_fornecedor(texto)
            numero_nota = extrair_numero_nota(texto, nome)
            data_emissao = extrair_data_emissao(texto)
            valor_frete = extrair_valor_frete(texto)
            valor_total_nota = extrair_valor_total_nota(texto)
            bloco_produtos = extrair_bloco_produtos(texto)

            salvar_status("executando", "normalizar", itens, resumo)
            itens_nota = parse_itens_danfe(bloco_produtos)

            resumo.append({
                "nome_arquivo": nome,
                "fornecedor": fornecedor,
                "numero_nota": numero_nota,
                "data_emissao": data_emissao,
                "valor_frete": valor_frete,
                "valor_total_nota": valor_total_nota,
                "quantidade_itens": len(itens_nota)
            })

            for item in itens_nota:
                itens.append({
                    "nome_arquivo": nome,
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

            salvar_status("executando", "json", itens, resumo)
            os.rename(caminho, os.path.join(PROCESSADOS, nome))
            adicionar_log("json", "OK", f"{nome} processado com sucesso.")

        except Exception as e:
            os.rename(caminho, os.path.join(ERRO, nome))
            logs_exec.append(str(e))
            adicionar_log("motor", "ERRO", f"{nome}: {e}")

    salvar_json(RESUMO_FILE, resumo)
    salvar_json(ITENS_FILE, itens)

    salvar_status("executando", "csv", itens, resumo)
    gerar_csv(itens)

    rankings = gerar_rankings()
    salvar_status("concluido", "csv", itens, resumo)
    adicionar_log("motor", "OK", "Processamento concluído com sucesso.")

    return jsonify({
        "status": "ok",
        "processados": len(resumo),
        "itens_extraidos": len(itens),
        "rankings": rankings,
        "logs": logs_exec
    })


@app.route("/pdf/rankings")
def rankings():
    return jsonify({
        "ok": True,
        "rankings": gerar_rankings()
    })
