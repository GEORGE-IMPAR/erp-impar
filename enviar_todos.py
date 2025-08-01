import pandas as pd
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time, pyautogui, os, textwrap, pyperclip

# 🔹 Configurações fixas
CAMINHO_CHROMEDRIVER = "C:/IMPAR/chromedriver.exe"
NOME_GRUPO = "Fala Clementino"
CAMINHO_PLANILHA = r"C:/IMPAR/Mensagens_Aniversario_Completo.xlsx"
LOG_DIR = r"C:/IMPAR/LOGS"
LIMITE_MSG = 2000  # limite de caracteres por parte

# 🔹 Garante que a pasta de logs existe
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

LOG_FILE = os.path.join(
    LOG_DIR,
    f"log_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.txt"
)

def log(msg, end="\n"):
    """Escreve no console e no arquivo de log"""
    linha = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(linha, end=end)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(linha + end)

def enviar_mensagem_grupo(driver, mensagem, nome_grupo):
    try:
        log(f"🌐 Procurando grupo: {nome_grupo}")
        # Localiza e usa a barra de pesquisa
        caixa_busca = WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.XPATH, "//div[@contenteditable='true'][@data-tab='3']"))
        )
        caixa_busca.click()
        time.sleep(1)
        caixa_busca.clear()
        caixa_busca.send_keys(nome_grupo)
        time.sleep(2)

        # Seleciona o grupo
        grupo = WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.XPATH, f"//span[@title='{nome_grupo}']"))
        )
        grupo.click()
        time.sleep(3)

        # Divide mensagem em partes se for muito longa
        partes = textwrap.wrap(mensagem, LIMITE_MSG, break_long_words=False, replace_whitespace=False)
        total_partes = len(partes)

        for i, parte in enumerate(partes, start=1):
            cabecalho = f"[{i}/{total_partes}] "
            conteudo = cabecalho + parte

            if not conteudo.strip():
                log("⚠️ Mensagem vazia detectada, pulando envio.")
                continue

            try:
                # 🔹 Focar na caixa de mensagem
                caixa_msg = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.XPATH, "//footer//div[@contenteditable='true']"))
                )
                caixa_msg.click()
                time.sleep(1)

                # 🔹 Copiar para a área de transferência e colar (mantém emojis)
                pyperclip.copy(conteudo)
                pyautogui.hotkey("ctrl", "v")

                log(f"✅ Parte {i}/{total_partes} colada via clipboard (com emojis).")
                time.sleep(1)
            except:
                # 🔹 Fallback para digitação simples
                log(f"⚠️ Falha ao colar mensagem, usando PyAutoGUI para parte {i}/{total_partes}...")
                pyautogui.click(690, 687)
                time.sleep(1)
                pyautogui.typewrite(conteudo)

            pyautogui.click(1322, 693)  # botão enviar
            log(f"✅ Parte {i}/{total_partes} enviada.")
            time.sleep(2)

        log(f"✅ Mensagem completa enviada para o grupo '{nome_grupo}'.")

    except Exception as e:
        log(f"❌ Erro ao enviar mensagem para o grupo: {e}")

def main():
    hoje = datetime.now().strftime("%d/%m")
    log(f"Verificando aniversariantes de hoje ({hoje})...")

    try:
        df = pd.read_excel(CAMINHO_PLANILHA, sheet_name="Sheet1")
    except Exception as e:
        log(f"❌ Erro ao abrir planilha: {e}")
        return

    aniversariantes = df[df["Data de Aniversário"] == hoje]

    if aniversariantes.empty:
        log("ℹ️ Nenhum aniversariante hoje.")
        return

    log(f"🎂 Aniversariantes encontrados hoje ({hoje}):")
    for nome in aniversariantes["Nome"].tolist():
        log(f" - {nome}")

    mensagem = "🎉 Hoje temos aniversariantes no grupo Fala Clementino! 🎉\n\n"
    for _, row in aniversariantes.iterrows():
        nome = row["Nome"]
        msg_personalizada = row["Mensagem"]
        mensagem += f"👉 {nome}: {msg_personalizada}\n"

    log("📨 Mensagem completa montada para envio:")
    for linha in mensagem.splitlines():
        log(linha)

    try:
        options = webdriver.ChromeOptions()
        options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
        service = Service(CAMINHO_CHROMEDRIVER)
        driver = webdriver.Chrome(service=service, options=options)

        enviar_mensagem_grupo(driver, mensagem, NOME_GRUPO)
    except Exception as e:
        log(f"❌ Erro ao conectar no Chrome: {e}")

if __name__ == "__main__":
    log("🚀 Execução iniciada")
    main()
    log("🏁 Execução finalizada")
