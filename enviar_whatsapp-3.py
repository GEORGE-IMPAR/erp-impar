import sys
import time
import urllib.parse
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# === DEBUG INICIAL ===
print("[*] Script iniciar...")

if len(sys.argv) < 3:
    print("❌ Número de argumentos inválido.")
    print("Uso: python enviar_whatsapp.py +554899999999 'Mensagem'")
    sys.exit()

telefone = sys.argv[1]
mensagem = sys.argv[2]
print(f"[*] Telefone: {telefone}")
print(f"[*] Mensagem: {mensagem}")

# === CONFIGURAÇÃO CHROME ===
options = webdriver.ChromeOptions()
options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")

service = Service("C:/IMPAR/chromedriver.exe")
driver = webdriver.Chrome(service=service, options=options)

def enviar_mensagem(driver, telefone, mensagem, timeout=60):
    print("[*] Iniciando função enviar_mensagem()...")
    mensagem_url = urllib.parse.quote(mensagem)
    url = f"https://web.whatsapp.com/send?phone={telefone}&text={mensagem_url}"
    print(f"[>] Acessando {url}")
    driver.get(url)

    wait = WebDriverWait(driver, timeout)

    try:
        print("⏳ Aguardando caixa de digitação...")
        caixa = wait.until(EC.presence_of_element_located((
            By.CSS_SELECTOR, "div[contenteditable='true'][data-tab]"
        )))
        time.sleep(1)
        caixa.send_keys(Keys.ENTER)
        print("✅ Mensagem enviada com sucesso!")

    except Exception as e:
        print("❌ Erro ao enviar:", e)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"C:/IMPAR/prints/erro_envio_{telefone}_{timestamp}.png"
        try:
            driver.save_screenshot(screenshot_path)
            print(f"📸 Screenshot salvo em: {screenshot_path}")
        except:
            print("⚠️ Não foi possível salvar screenshot.")

# === EXECUTA A FUNÇÃO ===
enviar_mensagem(driver, telefone, mensagem)
