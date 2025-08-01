import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

telefone = sys.argv[1]
mensagem = sys.argv[2]

print(f"[🧪 TESTE VISUAL] Testando envio para {telefone}")

options = webdriver.ChromeOptions()
options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
service = Service("C:/IMPAR/chromedriver.exe")
driver = webdriver.Chrome(service=service, options=options)

try:
    driver.get(f"https://web.whatsapp.com/send?phone={telefone}&text&app_absent=0")
    print("🌐 Aguardando carregar WhatsApp...")
    time.sleep(40)

    print("🔍 Buscando todos os contenteditable='true'...")
    caixas = driver.find_elements(By.XPATH, "//div[@contenteditable='true']")
    print(f"📦 {len(caixas)} elementos encontrados.")

    sucesso = False

    for i, caixa in enumerate(caixas):
        try:
            print(f"\n🧪 Tentativa {i+1}...")
            driver.execute_script("arguments[0].style.border='2px solid red'", caixa)
            caixa.click()
            time.sleep(1)
            caixa.send_keys(mensagem)
            time.sleep(1)
            caixa.send_keys(Keys.ENTER)
            print("✅ Mensagem enviada!")
            sucesso = True
            time.sleep(5)
            break
        except Exception as e:
            print(f"❌ Falhou tentativa {i+1}: {e}")
            continue

    if not sucesso:
        print("❌ Nenhuma caixa funcionou.")

    print("🔚 Teste encerrado.")

except Exception as e:
    print("❌ Erro geral:", e)

finally:
    time.sleep(50)
    driver.quit()
