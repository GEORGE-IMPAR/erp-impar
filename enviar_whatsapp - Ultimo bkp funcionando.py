import sys
sys.stdout.reconfigure(encoding='utf-8')

import time
import pyautogui
from selenium import webdriver
from selenium.webdriver.chrome.service import Service

telefone = sys.argv[1]
mensagem = sys.argv[2]

print("[*] Script iniciar...")
print(f"[*] Telefone: {telefone}")
print(f"[*] Mensagem: {mensagem}")

chrome_options = webdriver.ChromeOptions()
chrome_options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
service = Service("C:/IMPAR/chromedriver.exe")
driver = webdriver.Chrome(service=service, options=chrome_options)

url = f"https://web.whatsapp.com/send?phone={telefone}"
print("[>] Acessando conversa...")
driver.get(url)

print("⏳ Aguardando carregamento do WhatsApp Web...")
time.sleep(15)

pyautogui.click(690, 687)  # Caixa de mensagem
time.sleep(1)
pyautogui.typewrite(mensagem)
time.sleep(1)
pyautogui.click(1322, 693)  # Botão de envio
time.sleep(1)

print("✅ Mensagem enviada com sucesso.")
