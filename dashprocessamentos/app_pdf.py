import os
import re
import json
import threading
from datetime import datetime
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True
)

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
MOTOR_CTRL_FILE = f"{JSON_DIR}/motor_ctrl.json"

for pasta in [ENTRADA, PROCESSADOS, ERRO, JSON_DIR, CSV_DIR]:
    os.makedirs(pasta, exist_ok=True)

motor_lock = threading.Lock()


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
    salvar_json(LOG_FILE, logs[-500:])


def motor_ctrl_default():
    return {
        "ligado": False,
        "processando": False,
        "parar_solicitado": False,
        "modo": "lote",
        "ultimo_comando": "desligado",
        "atualizado_em": agora_str()
    }


def ler_motor_ctrl():
    return carregar_json(MOTOR_CTRL_FILE, motor_ctrl_default())


def salvar_motor_ctrl(data):
    data["atualizado_em"] = agora_str()
    salvar_json(MOTOR_CTRL_FILE, data)


def atualizar_motor_ctrl(**kwargs):
    data = ler_motor_ctrl()
    data.update(kwargs)
    salvar_motor_ctrl(data)
    return data


def salvar_status(motor_status="aguardando", current_step="ler", itens=None, resumo=None):
    itens = itens or carregar_json(ITENS_FILE, [])
    resumo = resumo or carregar_json(RESUMO_FILE, [])

    qtd_fila = len([f for f in os.listdir(ENTRADA) if f.lower().endswith(".pdf")])
    qtd_processados = len([f for f in os.listdir(PROCESSADOS) if f.lower().endswith(".pdf")])

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
        "pdfs_fila": qtd_fila,
        "pdfs_processados": qtd_processados,
        "total_fila": qtd_fila + qtd_processados,
        "total_processado": qtd_processados,
        "itens_extraidos": len(itens),
        "itens": itens,
        "resumo": resumo,
        "logs": carregar_json(LOG_FILE, []),
        "timeline": timeline,
        "motor_ctrl": ler_motor_ctrl()
    }
    salvar_json(STATUS_FILE, payload)


def normalizar_texto(texto):
    texto = texto or ""
    texto = texto.replace("\r", "\n")
    texto = texto.replace("\ufeff", " ")
    texto = texto.replace("SERVIÃ‡O", "SERVIÇO")
    texto = texto.replace("DESCRIÃ‡ÃO", "DESCRIÇÃO")
    texto = texto.replace("EMISSÃƒO", "EMISSÃO")
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


def limpar_texto_nota(texto):
    texto_up = texto.upper()

    # corta boleto e tenta ficar só na parte da NF
    if "RECIBO DO PAGADOR" in texto_up and "DANFE" in texto_up:
        pos_danfe = texto_up.find("DANFE")
        if pos_danfe != -1:
            return texto[pos_danfe:]

    return texto


def extract_text_from_pdf(pdf_path):
    # 1) pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            texto = "\n".join((page.extract_text() or "") for page in pdf.pages)
        texto = normalizar_texto(texto)
        if len(texto.strip()) > 50:
            return texto
    except Exception:
        pass

    # 2) PyPDF2
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(pdf_path)
        texto = "\n".join((page.extract_text() or "") for page in reader.pages)
        texto = normalizar_texto(texto)
        if len(texto.strip()) > 50:
            return texto
    except Exception:
        pass

    # 3) OCR opcional - se libs/sistema existirem
    try:
        from pdf2image import convert_from_path
        import pytesseract

        imagens = convert_from_path(pdf_path)
        texto = []
        for img in imagens:
            texto.append(pytesseract.image_to_string(img, lang="por"))
        texto = normalizar_texto("\n".join(texto))
        if len(texto.strip()) > 20:
            return texto
    except Exception:
        pass

    raise RuntimeError("Não foi possível extrair texto do PDF.")


def extrair_numero_nota(texto, nome_arquivo):
    patterns = [
        r"N[º°]?\s*[:.]?\s*0*([0-9]{1,9})",
        r"NF-e\s+S[ÉE]RIE\s*[:.]?\s*\d+\s+N[º°]?\s*[:.]?\s*0*([0-9]{1,9})",
        r"N[º°]\s*0*([0-9]{1,9})",
        r"Nº[:.]?\s*0*([0-9]{1,9})",
        r"\b000\.0*([0-9]{1,9})\b",
        r"\b00000*([0-9]{1,9})\b"
    ]

    for p in patterns:
        m = re.search(p, texto, re.I)
        if m:
            return m.group(1)

    m = re.search(r"NF\s*([0-9]{1,9})", nome_arquivo, re.I)
    if m:
        return m.group(1)

    m = re.search(r"(\d{3,})", nome_arquivo)
    if m:
        return m.group(1)

    return ""


def extrair_data_emissao(texto):
    patterns = [
        r"DATA DA EMISS[ÃA]O\s+(\d{2}/\d{2}/\d{4})",
        r"DATA DE EMISS[ÃA]O\s+(\d{2}/\d{2}/\d{4})",
        r"EMISS[ÃA]O[: ]+(\d{2}/\d{2}/\d{4})"
    ]
    for p in patterns:
        m = re.search(p, texto, re.I)
        if m:
            return m.group(1)
    return ""


def extrair_valor_frete(texto):
    patterns = [
        r"VALOR DO FRETE\s+([\d\.,]+)",
        r"FRETE\s+([\d\.,]+)"
    ]
    for p in patterns:
        m = re.search(p, texto, re.I)
        if m:
            return br_to_float(m.group(1))
    return 0.0


def extrair_valor_total_nota(texto):
    patterns = [
        r"VALOR TOTAL DA NOTA\s+([\d\.,]+)",
        r"VALOR TOTAL DOS PRODUTOS\s+([\d\.,]+)"
    ]
    for p in patterns:
        m = re.search(p, texto, re.I)
        if m:
            return br_to_float(m.group(1))
    return 0.0


def extrair_fornecedor(texto):
    linhas = [x.strip() for x in texto.split("\n") if x.strip()]

    for i, linha in enumerate(linhas):
        if "DOCUMENTO AUXILIAR" in linha.upper() or "DANFE" in linha.upper():
            for j in range(max(0, i - 8), i):
                cand = linhas[j].strip()
                if cand and not re.search(
                    r"CHAVE DE ACESSO|NATUREZA DA OPERAÇÃO|INSCRIÇÃO ESTADUAL|CNPJ|PROTOCOLO|NF-E|FOLHA|SÉRIE|Nº|DOCUMENTO AUXILIAR|DANFE|0 - ENTRADA|1 - SAÍDA",
                    cand,
                    re.I
                ):
                    if len(cand) > 3:
                        return cand

    for linha in linhas:
        if "RECEBEMOS DE" in linha.upper():
            m = re.search(r"RECEBEMOS DE\s+(.+?)\s+OS PRODUTOS", linha, re.I)
            if m:
                return m.group(1).strip()

    for i, linha in enumerate(linhas):
        if "IDENTIFICAÇÃO DO EMITENTE" in linha.upper():
            for j in range(i + 1, min(i + 5, len(linhas))):
                cand = linhas[j].strip()
                if cand and not re.search(r"CNPJ|RUA |AVENIDA|CEP|FONE|TEL", cand, re.I):
                    return cand

    return "Fornecedor não identificado"


def extrair_bloco_produtos(texto):
    marcadores = [
        "DADOS DO PRODUTO / SERVIÇO",
        "DADOS DO PRODUTO/SERVIÇO",
        "DADOS DOS PRODUTOS/SERVIÇOS",
        "DADOS DOS PRODUTOS/SERVICOS",
        "DADOS DO PRODUTO / SERVICO",
        "DADOS DO PRODUTO/SERVICO",
    ]

    inicio = -1
    for marcador in marcadores:
        inicio = texto.upper().find(marcador.upper())
        if inicio != -1:
            break

    if inicio == -1:
        return ""

    resto = texto[inicio:]
    terminadores = [
        "CÁLCULO DO ISSQN",
        "CALCULO DO ISSQN",
        "DADOS ADICIONAIS",
        "RESERVADO AO FISCO",
        "INFORMAÇÕES COMPLEMENTARES",
        "INFORMACOES COMPLEMENTARES"
    ]

    resto_upper = resto.upper()
    fim_pos = None
    for termo in terminadores:
        p = resto_upper.find(termo.upper())
        if p != -1 and (fim_pos is None or p < fim_pos):
            fim_pos = p

    bloco = resto[:fim_pos].strip() if fim_pos is not None else resto.strip()
    bloco = bloco.replace("DADOS DO PRODUTO/SERVIÇO", "")
    bloco = bloco.replace("DADOS DO PRODUTO / SERVIÇO", "")
    bloco = bloco.replace("DADOS DOS PRODUTOS/SERVIÇOS", "")
    bloco = bloco.replace("DADOS DOS PRODUTOS/SERVICOS", "")
    return bloco.strip()


def limpar_descricao_item(desc):
    desc = (desc or "").strip()
    desc = re.sub(r"\s{2,}", " ", desc)
    desc = desc.replace(" .", ".")
    return desc


def parse_itens_danfe(bloco):
    itens = []
    if not bloco:
        return itens

    linhas = [x.strip() for x in bloco.split("\n") if x.strip()]
    buffer_desc = []

    for linha in linhas:
        if re.search(
            r"COD\.?|CÓD\.?|DESCRIÇÃO|DESCRICAO|NCM|CFOP|UNID|QUANT|V\.?UNIT|V\.?TOTAL|BC\.?ICMS|V\.?ICMS|V\.?IPI|ALIQUOTAS|CSOSN|CST",
            linha,
            re.I
        ):
            continue

        # padrão mais comum de linha final do item
        m = re.search(
            r"^(.*?)\s+(\d{8})\s+\d+\s+(\d{4})\s+([A-Z]{1,5})\s+(\d+,\d{2,4})\s+(\d+,\d{2,4})\s+(\d+,\d{2})",
            linha,
            re.I
        )

        # padrão alternativo com NCM + CST + CFOP + UN
        if not m:
            m = re.search(
                r"^(.*?)\s+(\d{8})\s+\d{3}\s+(\d{4})\s+([A-Z]{1,5})\s+(\d+,\d{2,4})\s+(\d+,\d{2,4})\s+(\d+,\d{2})",
                linha,
                re.I
            )

        if m:
            desc_ini = m.group(1).strip()
            qtd = br_to_float(m.group(5))
            unit = br_to_float(m.group(6))
            total = br_to_float(m.group(7))

            descricao_final = " ".join(buffer_desc + [desc_ini]).strip()
            descricao_final = limpar_descricao_item(descricao_final)

            itens.append({
                "descricao_item": descricao_final,
                "quantidade_item": qtd,
                "preco_unitario_item": unit,
                "preco_total_item": total
            })
            buffer_desc = []
            continue

        # padrão scan simplificado / linhas quebradas
        if re.search(r"\d+,\d{2,4}\s+\d+,\d{2,4}\s+\d+,\d{2}", linha):
            nums = re.findall(r"\d+,\d{2,4}", linha)
            if len(nums) >= 3:
                qtd = br_to_float(nums[-3])
                unit = br_to_float(nums[-2])
                total = br_to_float(nums[-1])
                descricao_final = limpar_descricao_item(" ".join(buffer_desc))
                if descricao_final:
                    itens.append({
                        "descricao_item": descricao_final,
                        "quantidade_item": qtd,
                        "preco_unitario_item": unit,
                        "preco_total_item": total
                    })
                buffer_desc = []
            continue

        if linha and not re.fullmatch(r"[- ]+", linha):
            buffer_desc.append(linha)

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


def processar_lote_background():
    with motor_lock:
        ctrl = ler_motor_ctrl()
        if ctrl.get("processando"):
            return

        atualizar_motor_ctrl(
            processando=True,
            parar_solicitado=False,
            ultimo_comando="processando_lote"
        )

        itens_existentes = carregar_json(ITENS_FILE, [])
        resumo_existente = carregar_json(RESUMO_FILE, [])

        itens_novos = []
        resumo_novo = []

        salvar_status("executando", "ler", itens_existentes, resumo_existente)
        adicionar_log("motor", "INFO", "Iniciando lote.")

        try:
            while True:
                ctrl = ler_motor_ctrl()

                if ctrl.get("parar_solicitado"):
                    adicionar_log("motor", "INFO", "Parada solicitada detectada. Encerrando lote.")
                    break

                arquivos = [f for f in os.listdir(ENTRADA) if f.lower().endswith(".pdf")]
                if not arquivos:
                    break

                nome = arquivos[0]
                caminho = os.path.join(ENTRADA, nome)

                adicionar_log("ler", "INFO", f"Lendo {nome}")

                try:
                    salvar_status("executando", "extrair", itens_existentes + itens_novos, resumo_existente + resumo_novo)

                    texto = extract_text_from_pdf(caminho)
                    texto = limpar_texto_nota(texto)

                    salvar_status("executando", "blocos", itens_existentes + itens_novos, resumo_existente + resumo_novo)

                    fornecedor = extrair_fornecedor(texto)
                    numero_nota = extrair_numero_nota(texto, nome)
                    data_emissao = extrair_data_emissao(texto)
                    valor_frete = extrair_valor_frete(texto)
                    valor_total_nota = extrair_valor_total_nota(texto)
                    bloco_produtos = extrair_bloco_produtos(texto)

                    salvar_status("executando", "normalizar", itens_existentes + itens_novos, resumo_existente + resumo_novo)

                    itens_nota = parse_itens_danfe(bloco_produtos)

                    resumo_item = {
                        "nome_arquivo": nome,
                        "fornecedor": fornecedor,
                        "numero_nota": numero_nota,
                        "data_emissao": data_emissao,
                        "valor_frete": valor_frete,
                        "valor_total_nota": valor_total_nota,
                        "quantidade_itens": len(itens_nota)
                    }
                    resumo_novo.append(resumo_item)

                    for item in itens_nota:
                        itens_novos.append({
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

                    itens_finais = itens_existentes + itens_novos
                    resumo_finais = resumo_existente + resumo_novo

                    salvar_json(RESUMO_FILE, resumo_finais)
                    salvar_json(ITENS_FILE, itens_finais)
                    salvar_status("executando", "json", itens_finais, resumo_finais)

                    gerar_csv(itens_finais)

                    os.rename(caminho, os.path.join(PROCESSADOS, nome))
                    adicionar_log("json", "OK", f"{nome} processado com sucesso.")

                    salvar_status("executando", "csv", itens_finais, resumo_finais)

                except Exception as e:
                    try:
                        os.rename(caminho, os.path.join(ERRO, nome))
                    except Exception:
                        pass
                    adicionar_log("motor", "ERRO", f"{nome}: {e}")

            itens_finais = carregar_json(ITENS_FILE, [])
            resumo_finais = carregar_json(RESUMO_FILE, [])
            salvar_status("concluido", "csv", itens_finais, resumo_finais)
            adicionar_log("motor", "OK", "Lote finalizado.")

        finally:
            ctrl_final = ler_motor_ctrl()
            atualizar_motor_ctrl(
                processando=False,
                parar_solicitado=False,
                ligado=ctrl_final.get("ligado", False),
                ultimo_comando="lote_finalizado"
            )


@app.route("/")
def home():
    return jsonify({"status": "ok", "msg": "Motor PDF rodando 🚀"})


@app.route("/pdf/status")
def status():
    itens = carregar_json(ITENS_FILE, [])
    resumo = carregar_json(RESUMO_FILE, [])
    logs = carregar_json(LOG_FILE, [])
    motor = ler_motor_ctrl()

    qtd_fila = len([f for f in os.listdir(ENTRADA) if f.lower().endswith(".pdf")])
    qtd_processados = len([f for f in os.listdir(PROCESSADOS) if f.lower().endswith(".pdf")])

    status_salvo = carregar_json(STATUS_FILE, {})

    if not motor.get("processando", False):
        return jsonify({
            "motor_status": "aguardando",
            "motor_status_label": "Aguardando",
            "current_step": "ler",
            "ultima_execucao": "",
            "pdfs_fila": qtd_fila,
            "pdfs_processados": qtd_processados,
            "total_fila": qtd_fila + qtd_processados,
            "total_processado": qtd_processados,
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
            },
            "motor_ctrl": motor
        })

    if status_salvo:
        status_salvo["itens"] = itens
        status_salvo["resumo"] = resumo
        status_salvo["logs"] = logs[-50:]
        status_salvo["pdfs_fila"] = qtd_fila
        status_salvo["pdfs_processados"] = qtd_processados
        status_salvo["total_fila"] = qtd_fila + qtd_processados
        status_salvo["total_processado"] = qtd_processados
        status_salvo["itens_extraidos"] = len(itens)
        status_salvo["motor_ctrl"] = motor
        return jsonify(status_salvo)

    return jsonify({
        "motor_status": "aguardando",
        "motor_status_label": "Aguardando",
        "current_step": "ler",
        "ultima_execucao": "",
        "pdfs_fila": qtd_fila,
        "pdfs_processados": qtd_processados,
        "total_fila": qtd_fila + qtd_processados,
        "total_processado": qtd_processados,
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
        },
        "motor_ctrl": motor
    })


@app.route("/pdf/rankings")
def rankings():
    return jsonify({
        "ok": True,
        "rankings": gerar_rankings()
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


@app.route("/pdf/motor", methods=["GET"])
def motor_status():
    return jsonify({
        "ok": True,
        "motor": ler_motor_ctrl()
    })


@app.route("/pdf/motor/ligar", methods=["POST"])
def motor_ligar():
    data = atualizar_motor_ctrl(
        ligado=True,
        processando=False,
        parar_solicitado=False,
        ultimo_comando="ligado"
    )

    salvar_status(
        motor_status="aguardando",
        current_step="ler"
    )

    adicionar_log("motor", "OK", "Motor ligado.")
    return jsonify({"ok": True, "motor": data})


@app.route("/pdf/motor/parar", methods=["POST"])
def motor_parar():
    data = atualizar_motor_ctrl(
        parar_solicitado=True,
        ligado=False,
        processando=False,
        ultimo_comando="parada_solicitada"
    )

    salvar_status(
        motor_status="aguardando",
        current_step="ler"
    )

    adicionar_log("motor", "INFO", "Parada solicitada.")
    return jsonify({"ok": True, "motor": data})


@app.route("/pdf/motor/processar-lote", methods=["POST"])
def motor_processar_lote():
    ctrl = ler_motor_ctrl()

    if not ctrl.get("ligado"):
        return jsonify({
            "ok": False,
            "erro": "Motor desligado. Ligue o motor antes de iniciar o lote."
        }), 400

    if ctrl.get("processando"):
        return jsonify({
            "ok": False,
            "erro": "Já existe um lote em processamento."
        }), 400

    thread = threading.Thread(target=processar_lote_background, daemon=True)
    thread.start()

    adicionar_log("motor", "INFO", "Processamento em lote iniciado em background.")
    return jsonify({
        "ok": True,
        "status": "processando",
        "mensagem": "Lote iniciado em background."
    })


@app.route("/pdf/csv", methods=["GET"])
def baixar_csv():
    if not os.path.exists(CSV_FILE):
        return jsonify({
            "ok": False,
            "erro": "CSV ainda não foi gerado."
        }), 404

    return send_file(
        CSV_FILE,
        as_attachment=True,
        download_name="materiais_extraidos.csv"
    )
