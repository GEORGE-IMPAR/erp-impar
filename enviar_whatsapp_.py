import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime

# Argumentos: telefone e mensagem
telefone = sys.argv[1]
mensagem = sys.argv[2]

print(f"[{datetime.now().strftime('%H:%M')}] Enviando mensagem para {telefone}")

# Configuração do Chrome com depuração remota
options = webdriver.ChromeOptions()
options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")

# Caminho para o ChromeDriver (versão 64 bits correta)
service = Service(r"C:\IMPAR\chromedriver.exe")
driver = webdriver.Chrome(service=service, options=options)

try:
    print("📨 Acessando conversa com o número...")
    driver.get(f"https://web.whatsapp.com/send?phone={telefone}")

    print("⏳ Aguardando caixa de digitação...")
    caixa_msg = WebDriverWait(driver, 30).until(
        EC.presence_of_element_located((By.XPATH, "//div[@data-testid='conversation-compose-box-input' and @contenteditable='true']"))
    )

    time.sleep(1)
    caixa_msg.click()
    caixa_msg.send_keys(mensagem)
    caixa_msg.send_keys(Keys.ENTER)

    print("✅ Mensagem enviada com sucesso.")
    sys.exit(0)

except Exception as e:
    print("❌ Erro ao enviar a mensagem.")
    print("Erro:", e)
    sys.exit(1)
