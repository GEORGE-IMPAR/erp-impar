import os
import re
import cv2
import fitz  # PyMuPDF
try:
    fitz.TOOLS.mupdf_display_errors(False)
    fitz.TOOLS.mupdf_display_warnings(False)
except Exception:
    pass
import numpy as np
import pytesseract
from pdf2image import convert_from_bytes
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import requests

ERP_SALVAR_ENDPOINT = os.getenv("ERP_SALVAR_ENDPOINT", "https://api.erpimpar.com.br/danfe/salvar_resultado.php")

# =============================
# CONFIGURAÇÕES
# =============================

app = FastAPI(title="ERP ÍMPAR - OCR DANFE em Lote - Motor Híbrido V3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================
# NORMALIZAÇÃO
# =============================

def normalizar_linha(linha):
    linha = linha.replace("|", " ")
    linha = linha.replace("]", " ")
    linha = linha.replace("[", " ")
    linha = linha.replace('"', " ")
    linha = linha.replace("'", " ")
    linha = linha.replace("â€”", "-").replace("—", "-").replace("–", "-")
    linha = re.sub(r"\s+", " ", linha)
    return linha.strip()



def normalizar_cfop(valor):
    """Normaliza CFOP: 5.102 / 5 102 / 5102 -> 5102."""
    if not valor:
        return ""
    cfop = re.sub(r"\D", "", str(valor))
    return cfop if re.fullmatch(r"[4-7]\d{3}", cfop) else ""

def limpar_material(material):
    material = re.split(
        r"\s+-?\s*TRIBUTOS|\s+TRIBUTOS|\s+IBPT|\s+-?\s*REF:|\s+FONTE\s+IBPT|\s+RES\.13/12\s+FCI:",
        material,
        flags=re.I
    )[0]
    material = re.sub(r"\s+", " ", material)
    return material.strip(" -|;:'")


def parece_cabecalho_tabela(linha_up):
    marcadores = ["DESCRIÇÃO", "DESCRICAO", "PRODUTO", "SERVIÇO", "SERVICO", "NCM", "CFOP", "QUANT", "UNIT"]
    return sum(1 for m in marcadores if m in linha_up) >= 2


def item_valido(item):
    material = (item.get("material") or "").upper().strip()
    qtd = item.get("quantidade") or ""
    valor = item.get("valor_unitario") or ""

    if not material or len(material) < 3:
        return False

    lixo = [
        "INFORMAÇÕES COMPLEMENTARES",
        "INFORMACOES COMPLEMENTARES",
        "RESERVADO AO FISCO",
        "DADOS ADICIONAIS",
        "CÁLCULO DO ISSQN",
        "CALCULO DO ISSQN",
    ]
    if any(x in material for x in lixo):
        return False

    if material in ["QA", "QÁ"]:
        return False

    if re.fullmatch(r"[0-9.,\s]+", material):
        return False

    if qtd in ["0", "0,00", "0,000", "0,0000"] and valor in ["0", "0,00", "0,000", "0,0000"]:
        return False

    return True


def score_item_local(item):
    score = 1000
    material = item.get("material", "")
    score += min(len(material), 140)

    if item.get("ncm"):
        score += 80
    if item.get("cfop"):
        score += 80
    if item.get("unidade"):
        score += 60

    mat_up = material.upper()
    if len(material.strip()) < 6:
        score -= 800
    if "INFORMA" in mat_up or "RESERVADO" in mat_up:
        score -= 1200
    if "0,00 0,00" in mat_up:
        score -= 1000

    return score

# =============================
# CHAVE / CABEÇALHO
# =============================

def chave_parece_valida(chave):
    if not chave or len(chave) != 44 or not chave.isdigit():
        return False
    if chave[20:22] not in {"55", "65"}:
        return False
    try:
        uf = int(chave[0:2])
        if uf < 11 or uf > 53:
            return False
    except Exception:
        return False
    return True


def extrair_chave(texto):
    """
    Extrai chave de acesso de 44 dígitos.
    Correções:
    - chave normal em uma linha;
    - chave com espaços/pontos/hífens;
    - chave quebrada em duas linhas, como na CRIOBRAS.
    """
    if not texto:
        return ""

    candidatos = re.findall(r"(?:\d[\s\.\-]*){44}", texto)
    for c in candidatos:
        chave = re.sub(r"\D", "", c)
        if chave_parece_valida(chave):
            return chave

    texto_up = texto.upper()

    for m in re.finditer(r"CHAVE\s+DE\s+ACESSO", texto_up):
        ini = max(0, m.start() - 450)
        fim = min(len(texto), m.end() + 700)
        janela = texto[ini:fim]
        digits = "".join(re.findall(r"\d+", janela))

        for i in range(0, max(0, len(digits) - 43)):
            cand = digits[i:i+44]
            if chave_parece_valida(cand):
                return cand

    digits = "".join(re.findall(r"\d+", texto))
    for i in range(0, max(0, len(digits) - 43)):
        cand = digits[i:i+44]
        if chave_parece_valida(cand):
            return cand

    for i in range(0, max(0, len(digits) - 43)):
        cand = digits[i:i+44]
        if len(cand) == 44:
            return cand

    return ""


def decodificar_chave(chave):
    if not chave or len(chave) != 44:
        return {}
    return {
        "uf_codigo": chave[0:2],
        "ano": "20" + chave[2:4],
        "mes": chave[4:6],
        "cnpj_emitente": chave[6:20],
        "modelo": chave[20:22],
        "serie": str(int(chave[22:25])) if chave[22:25].isdigit() else chave[22:25],
        "numero_nfe": str(int(chave[25:34])) if chave[25:34].isdigit() else chave[25:34],
        "tipo_emissao": chave[34:35],
        "codigo_numerico": chave[35:43],
        "dv": chave[43:44],
    }


def extrair_valor_total(texto):
    m = re.search(r"VALOR TOTAL DA NOTA[\s\S]{0,180}?(\d{1,3}(?:\.\d{3})*,\d{2})", texto, re.I)
    if m:
        return m.group(1)
    valores = re.findall(r"\d{1,3}(?:\.\d{3})*,\d{2}", texto)
    return valores[-1] if valores else ""

def extrair_data_saida(texto):
    """
    Data para validade da base de preço.
    Preferência:
    1) DATA DA SAÍDA / ENTRADA, DATA DE SAÍDA, DATA SAIDA
    2) DATA DA EMISSÃO / DATA EMISSÃO
    """
    if not texto:
        return ""

    linhas = [normalizar_linha(l) for l in texto.splitlines() if l.strip()]
    texto_norm = "\n".join(linhas)

    padroes_saida = [
        r"DATA\s+(?:DA\s+)?SA[ÍI]DA\s*/?\s*ENTRADA",
        r"DATA\s+(?:DE\s+|DA\s+)?SA[ÍI]DA",
        r"DT\s+ENTRADA\s*/?\s*SA[ÍI]DA",
        r"DATA\s+ENTRADA\s*/?\s*SA[ÍI]DA",
    ]

    padroes_emissao = [
        r"DATA\s+(?:DA\s+)?EMISS[ÃA]O",
        r"DATA\s+EMISS[ÃA]O",
        r"DT\s+EMISS[ÃA]O",
    ]

    def procura(padroes):
        for idx, linha in enumerate(linhas):
            up = linha.upper()
            for p in padroes:
                if re.search(p, up, re.I):
                    m = re.search(r"\b\d{2}/\d{2}/\d{4}\b", linha)
                    if m:
                        return m.group(0)

                    for prox in linhas[idx+1:idx+7]:
                        m = re.search(r"\b\d{2}/\d{2}/\d{4}\b", prox)
                        if m:
                            return m.group(0)
        return ""

    data = procura(padroes_saida)
    if data:
        return data

    data = procura(padroes_emissao)
    if data:
        return data

    m = re.search(r"\b\d{2}/\d{2}/\d{4}\b", texto_norm)
    return m.group(0) if m else ""


# =============================
# EXTRAÇÃO DIRETA DO PDF
# =============================

def extrair_texto_pdf_direto(pdf_bytes):
    textos = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            texto = page.get_text("text") or ""
            if texto.strip():
                textos.append(texto)
        doc.close()
    except Exception:
        return ""
    return "\n".join(textos)


def extrair_linhas_pdf_blocks(pdf_bytes):
    linhas = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            words = page.get_text("words")
            grupos = {}
            for w in words:
                x0, y0, x1, y1, text, block, line, word = w
                key = round(y0 / 3) * 3
                grupos.setdefault(key, []).append((x0, text))
            for key in sorted(grupos.keys()):
                partes = [t for x, t in sorted(grupos[key], key=lambda z: z[0])]
                linha = normalizar_linha(" ".join(partes))
                if linha:
                    linhas.append(linha)
        doc.close()
    except Exception:
        return ""
    return "\n".join(linhas)

# =============================
# OCR
# =============================

def gerar_imagens(img):
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

    normal = gray
    contraste = cv2.equalizeHist(gray)

    adapt = cv2.adaptiveThreshold(
        contraste, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31, 11
    )

    upscale = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    blur = cv2.GaussianBlur(upscale, (0, 0), 1.0)
    sharpen = cv2.addWeighted(upscale, 1.6, blur, -0.6, 0)

    h, w = gray.shape[:2]
    crop_tabela = gray[int(h * 0.48):int(h * 0.84), 0:w]
    crop_tabela = cv2.resize(crop_tabela, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
    crop_tabela = cv2.equalizeHist(crop_tabela)

    return [
        ("NORMAL", normal),
        ("CONTRASTE", contraste),
        ("ADAPTATIVO", adapt),
        ("UPSCALE", sharpen),
        ("CROP_TABELA", crop_tabela),
    ]


def ocr(img):
    config = "--oem 3 --psm 6"
    return pytesseract.image_to_string(img, lang="por", config=config)

# =============================
# PARSER
# =============================

def montar_item_por_cfop(linha, complemento_abaixo=""):
    linha_original = linha
    linha = normalizar_linha(linha)

    if re.search(r"TRIBUTOS|IBPT|FONTE|CÁLCULO|CALCULO|DADOS ADICIONAIS|FATURA|ISSQN", linha, re.I):
        return None

    unidades = r"UN|UNID|RL|PC|CX|KG|M|MT|LT|PÇ|M2|M3|CJ|JG|PAR|BD|GL|FD|SC|PCT"

    padrao = re.search(
        rf"\b([4-7][\.\s]?\d{{3}})\b\D{{0,25}}\b({unidades})\b\D{{0,30}}(\d+(?:,\d+)?)\D{{1,30}}(\d+(?:\.\d{{3}})*,\d+)",
        linha,
        re.I
    )

    if not padrao:
        return None

    cfop = re.sub(r"\D", "", padrao.group(1))
    unidade = padrao.group(2).upper()
    quantidade = padrao.group(3)
    valor_unit = padrao.group(4)

    antes_cfop = linha[:padrao.start()].strip(" -|;:'")

    ncm = ""
    ncm_matches = list(re.finditer(r"\b(\d{8})\b", antes_cfop))
    if ncm_matches:
        ncm_match = ncm_matches[-1]
        ncm = ncm_match.group(1)
        antes_ncm = antes_cfop[:ncm_match.start()].strip(" -|;:'")
    else:
        antes_ncm = antes_cfop

    codigo = ""
    codigo_match = re.search(r"\b([A-Z]*\d[A-Z0-9.\-]{1,})\b", antes_ncm, re.I)
    if codigo_match:
        codigo = codigo_match.group(1).strip(" -|;:'")
        material = antes_ncm[codigo_match.end():].strip(" -|;:'")
    else:
        material = antes_ncm

    if codigo:
        material = re.sub(rf"^\s*{re.escape(codigo)}\s*[-–—]?\s*", "", material).strip(" -|;:'")

    material = re.sub(r"\b(000|100|101|102|103|200|201|202|300|400|500|900|0/101|0/102)\b\s*$", "", material).strip()
    material = limpar_material(material)

    if complemento_abaixo:
        comp = limpar_material(complemento_abaixo)
        if (
            comp
            and len(comp) > 2
            and not re.search(r"TRIBUTOS|IBPT|FONTE|REF|CÁLCULO|CALCULO|DADOS|FATURA|ISSQN", comp, re.I)
            and not re.search(rf"\b([4-7]\d{{3}})\b\D{{0,25}}\b({unidades})\b", comp, re.I)
        ):
            material = (material + " " + comp).strip()

    item = {
        "codigo": codigo,
        "material": material,
        "ncm": ncm,
        "cfop": cfop,
        "unidade": unidade,
        "quantidade": quantidade,
        "valor_unitario": valor_unit,
        "linha_original": linha_original
    }

    if not item_valido(item):
        return None

    return item


def montar_item_por_tabela_vertical(linhas, i):
    unidades = {"UN", "UNID", "RL", "PC", "CX", "KG", "M", "MT", "LT", "PÇ", "M2", "M3", "CJ", "JG", "PAR", "BD", "GL", "FD", "SC", "PCT"}

    codigo = linhas[i].strip()
    if not re.fullmatch(r"[A-Z]*\d[A-Z0-9.\-]{2,}", codigo, re.I):
        return None

    janela = linhas[i:i+18]
    texto_janela = " ".join(janela)

    ncm_idx = None
    for j in range(1, min(8, len(janela))):
        if re.fullmatch(r"\d{8}", janela[j].strip()):
            ncm_idx = j
            break

    if ncm_idx is None:
        return None

    ncm = janela[ncm_idx].strip()

    cfop_idx = None
    for j in range(ncm_idx + 1, min(ncm_idx + 6, len(janela))):
        cfop_tmp = normalizar_cfop(janela[j].strip())
        if cfop_tmp:
            cfop_idx = j
            break

    if cfop_idx is None:
        return None

    cfop = normalizar_cfop(janela[cfop_idx].strip())

    un_idx = None
    for j in range(cfop_idx + 1, min(cfop_idx + 4, len(janela))):
        if janela[j].strip().upper() in unidades:
            un_idx = j
            break

    if un_idx is None or un_idx + 2 >= len(janela):
        return None

    unidade = janela[un_idx].strip().upper()
    quantidade = janela[un_idx + 1].strip()
    valor_unit = janela[un_idx + 2].strip()

    if not re.fullmatch(r"\d+(?:,\d+)?", quantidade):
        return None
    if not re.fullmatch(r"\d+(?:\.\d{3})*,\d+", valor_unit):
        return None

    descricao = " ".join(janela[1:ncm_idx])
    descricao = re.sub(rf"^\s*{re.escape(codigo)}\s*[-–—]?\s*", "", descricao).strip(" -|;:'")
    descricao = limpar_material(descricao)

    item = {
        "codigo": codigo,
        "material": descricao,
        "ncm": ncm,
        "cfop": cfop,
        "unidade": unidade,
        "quantidade": quantidade,
        "valor_unitario": valor_unit,
        "linha_original": texto_janela
    }

    if not item_valido(item):
        return None

    return item


def extrair_itens(texto):
    linhas = [normalizar_linha(l) for l in texto.splitlines() if l.strip()]
    if not linhas:
        return []

    itens_vertical = []
    vistos_vertical = set()
    for i in range(len(linhas)):
        item = montar_item_por_tabela_vertical(linhas, i)
        if item:
            chave = (item["codigo"], item["ncm"], item["cfop"], item["quantidade"], item["valor_unitario"])
            if chave not in vistos_vertical:
                vistos_vertical.add(chave)
                itens_vertical.append(item)

    if itens_vertical:
        return itens_vertical

    try:
        idx_fim = next(i for i, l in enumerate(linhas) if "DADOS ADICIONAIS" in l.upper())
    except StopIteration:
        idx_fim = len(linhas)

    itens = []
    complemento_abaixo = ""

    for i in range(idx_fim - 1, -1, -1):
        linha = linhas[i]
        linha_up = linha.upper()

        if "ISSQN" in linha_up:
            continue

        if re.search(r"INSCRIÇÃO MUNICIPAL|VALOR TOTAL DOS SERVIÇOS|BASE DE CÁLCULO|VALOR DO ISSQN", linha_up):
            continue

        if itens and parece_cabecalho_tabela(linha_up):
            break

        item = montar_item_por_cfop(linha, complemento_abaixo=complemento_abaixo)

        if not item and complemento_abaixo:
            item = montar_item_por_cfop(linha + " " + complemento_abaixo)

        if item:
            itens.append(item)
            complemento_abaixo = ""
            continue

        if (
            linha
            and not parece_cabecalho_tabela(linha_up)
            and not re.search(r"TRIBUTOS|IBPT|FONTE|REF|CÁLCULO|CALCULO|DADOS|FATURA|ISSQN", linha_up)
        ):
            complemento_abaixo = linha

    itens.reverse()

    final = []
    vistos = set()
    for item in itens:
        chave = (item.get("codigo", ""), item.get("material", "")[:50], item.get("quantidade", ""), item.get("valor_unitario", ""))
        if chave not in vistos:
            vistos.add(chave)
            final.append(item)

    return final

# =============================
# ESCOLHA DO MELHOR RESULTADO
# =============================

def escolher_melhor_texto(textos_com_modo):
    melhor = None

    for modo, texto in textos_com_modo:
        itens = extrair_itens(texto)
        score = len(extrair_chave(texto)) + sum(score_item_local(i) for i in itens)

        if modo.startswith("PDF_") and itens:
            score += 500

        atual = {
            "modo": modo,
            "texto": texto,
            "itens": itens,
            "score": score,
            "qtd_itens": len(itens)
        }

        if melhor is None or atual["score"] > melhor["score"]:
            melhor = atual

    return melhor


def escolher_melhor_ocr(img):
    textos = []
    for modo, imagem in gerar_imagens(img):
        texto = ocr(imagem)
        textos.append((modo, texto))
    return escolher_melhor_texto(textos)


# =============================
# SINCRONIZAÇÃO COM ERP / KINGHOST
# =============================

def enviar_resultado_para_erp(payload):
    """
    Envia o resultado consolidado para a API PHP do ERP ÍMPAR.
    A API PHP é quem grava oficialmente os JSONs no storage/data/danfe.
    """
    try:
        resp = requests.post(
            ERP_SALVAR_ENDPOINT,
            json=payload,
            timeout=120
        )

        try:
            resposta_json = resp.json()
        except Exception:
            resposta_json = {
                "ok": False,
                "status_code": resp.status_code,
                "texto": resp.text[:1000]
            }

        return {
            "ok": resp.ok,
            "status_code": resp.status_code,
            "resposta": resposta_json
        }

    except Exception as e:
        return {
            "ok": False,
            "erro": str(e)
        }

# =============================
# ENDPOINTS
# =============================

async def processar_arquivo(file: UploadFile):
    pdf_bytes = await file.read()

    candidatos_texto = []

    texto_pdf = extrair_texto_pdf_direto(pdf_bytes)
    if texto_pdf.strip():
        candidatos_texto.append(("PDF_TEXTO", texto_pdf))

    texto_blocks = extrair_linhas_pdf_blocks(pdf_bytes)
    if texto_blocks.strip():
        candidatos_texto.append(("PDF_BLOCKS", texto_blocks))

    melhor_pdf = escolher_melhor_texto(candidatos_texto) if candidatos_texto else None

    if melhor_pdf and melhor_pdf["itens"]:
        texto_total = melhor_pdf["texto"]
        chave = extrair_chave(texto_total)
        dados_chave = decodificar_chave(chave)

        return {
            "arquivo": file.filename,
            "ok": True,
            "modo": melhor_pdf["modo"],
            "chave": chave,
            "dados_chave": dados_chave,
            "numero_nfe": dados_chave.get("numero_nfe", ""),
            "serie": dados_chave.get("serie", ""),
            "cnpj_emitente": dados_chave.get("cnpj_emitente", ""),
            "valor_total_nota": extrair_valor_total(texto_total),
            "data_saida": extrair_data_saida(texto_total),
            "total_itens": len(melhor_pdf["itens"]),
            "itens": melhor_pdf["itens"],
            "ocr_bruto": texto_total
        }

    paginas = convert_from_bytes(pdf_bytes, dpi=300)

    todos_textos = []
    todos_itens = []
    melhor_modo = ""

    for pagina in paginas:
        img = np.array(pagina)
        melhor = escolher_melhor_ocr(img)

        todos_textos.append(melhor["texto"])
        todos_itens.extend(melhor["itens"])

        if not melhor_modo:
            melhor_modo = melhor["modo"]

    texto_total = "\n".join(todos_textos)

    if not todos_itens and melhor_pdf:
        texto_total = melhor_pdf["texto"]
        melhor_modo = melhor_pdf["modo"]

    chave = extrair_chave(texto_total)
    dados_chave = decodificar_chave(chave)

    return {
        "arquivo": file.filename,
        "ok": True,
        "modo": melhor_modo,
        "chave": chave,
        "dados_chave": dados_chave,
        "numero_nfe": dados_chave.get("numero_nfe", ""),
        "serie": dados_chave.get("serie", ""),
        "cnpj_emitente": dados_chave.get("cnpj_emitente", ""),
        "valor_total_nota": extrair_valor_total(texto_total),
        "data_saida": extrair_data_saida(texto_total),
        "total_itens": len(todos_itens),
        "itens": todos_itens,
        "ocr_bruto": texto_total
    }


@app.post("/processar-lote")
async def processar_lote(files: List[UploadFile] = File(...)):
    resultados = []

    for file in files:
        try:
            resultado = await processar_arquivo(file)
            resultados.append(resultado)
        except Exception as e:
            resultados.append({
                "arquivo": file.filename,
                "ok": False,
                "erro": str(e),
                "itens": []
            })

    payload = {
        "ok": True,
        "total_arquivos": len(resultados),
        "resultados": resultados
    }

    payload["erp_sync"] = enviar_resultado_para_erp(payload)

    return payload


@app.get("/")
def home():
    return {"status": "OCR DANFE ÍMPAR híbrido V3 ativo no Render", "endpoint": "/processar-lote", "erp_salvar_endpoint": ERP_SALVAR_ENDPOINT}
