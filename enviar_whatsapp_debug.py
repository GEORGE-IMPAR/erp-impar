import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

telefone = sys.argv[1]
mensagem = sys.argv[2]

print(f"[🧪 DEBUG] Testando envio para {telefone}")

options = webdriver.ChromeOptions()
options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
service = Service("C:/IMPAR/chromedriver.exe")
driver = webdriver.Chrome(service=service, options=options)

try:
    driver.get(f"https://web.whatsapp.com/send?phone={telefone}&text&app_absent=0")
    print("🌐 Aguardando carregar WhatsApp...")
    time.sleep(10)  # aguarda carregamento visual

    print("🔍 Procurando elementos contenteditable='true'...")
    elementos = driver.find_elements(By.XPATH, "//div[@contenteditable='true']")
    print(f"📦 {len(elementos)} encontrados.")

    for i, el in enumerate(elementos):
        try:
            texto = el.text.strip()
            testid = el.get_attribute("data-testid")
            tab = el.get_attribute("data-tab")
            classe = el.get_attribute("class")
            print(f"\n🧩 Elemento {i+1}")
            print(f"  ↪ class: {classe}")
            print(f"  ↪ data-testid: {testid}")
            print(f"  ↪ data-tab: {tab}")
            print(f"  ↪ texto atual: {texto}")
        except Exception as e:
            print(f"  ⚠️ Erro ao acessar atributos: {e}")

    print("\n🛑 Pausando 60s para visualização manual no navegador...")
    time.sleep(60)

except Exception as e:
    print("❌ Erro inesperado:")
    print(e)

finally:
    driver.quit()
