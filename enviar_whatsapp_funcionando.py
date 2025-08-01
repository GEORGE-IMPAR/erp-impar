# enviar_whatsapp.py
import sys
import time
import pyautogui
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
import pygetwindow as gw
import pyperclip

# Argumentos
telefone = sys.argv[1]
mensagem = sys.argv[2]

print("[*] Script iniciar...")
print(f"[*] Telefone: {telefone}")
print(f"[*] Mensagem: {mensagem}")

# Configurações do Chrome
chrome_options = Options()
chrome_options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
service = Service("C:/IMPAR/chromedriver.exe")
driver = webdriver.Chrome(service=service, options=chrome_options)

# Abre a conversa
print("[>] Acessando conversa do WhatsApp Web...")
driver.get(f"https://web.whatsapp.com/send?phone={telefone}")
time.sleep(15)  # tempo maior para o botão de envio se estabilizar

# Foco na janela do WhatsApp
print("🔍 Procurando janela com WhatsApp Web...")
whatsapp_window = None
for w in gw.getWindowsWithTitle("WhatsApp"):
    if "Google Chrome" in w.title:
        whatsapp_window = w
        break

if whatsapp_window is None:
    print("❌ Janela do WhatsApp Web não encontrada.")
    sys.exit(1)

whatsapp_window.activate()
time.sleep(1)

# Clique na caixa de mensagem e envie
print(f"[🖱️] Clicando na caixa de digitação (690, 687)...")
pyautogui.click(690, 687)
time.sleep(0.5)

print(f"[⌨️] Digitando a mensagem...")
pyperclip.copy(mensagem)
pyautogui.hotkey("ctrl", "v")
time.sleep(0.5)

print(f"[🖱️] Clicando no botão de envio (1322, 693)...")
pyautogui.click(1322, 693)
time.sleep(1)

print("✅ Mensagem enviada com sucesso!")
print("[✓] Finalizando script.")
driver.quit()
