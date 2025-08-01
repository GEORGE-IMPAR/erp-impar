import sys
import time
import pyautogui
import pyperclip
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

# Forçar UTF-8 no terminal (Windows)
sys.stdout.reconfigure(encoding='utf-8')

# Receber telefone e mensagem da função principal
def enviar_mensagem(telefone, mensagem):
    print("[*] Script iniciar...")
    print(f"[*] Telefone: {telefone}")
    print(f"[*] Mensagem: {mensagem}")

    url = f"https://web.whatsapp.com/send?phone={telefone}&text="
    print("🌐 Acessando conversa com o número...")
    
    # Conectar ao Chrome já aberto
    chrome_options = Options()
    chrome_options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
    service = Service("C:/IMPAR/chromedriver.exe")
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.get(url)

    print("⏳ Aguardando carregamento da caixa de mensagem...")
    time.sleep(15)

    # Detectar posição via imagem da caixa
    for tentativa in range(5):
        print(f"🔍 Tentativa {tentativa+1} de localizar a imagem da caixa de mensagem...")
        try:
            pos_caixa = pyautogui.locateCenterOnScreen("C:\IMPAR\imagens\caixa_msg.png", confidence=0.8)
            if pos_caixa:
                print(f"📍 Caixa encontrada em: {pos_caixa}")
                break
        except Exception as e:
            print(f"⚠️ Erro na detecção da imagem: {e}")
        time.sleep(5)
    else:
        print("❌ Caixa de mensagem NÃO encontrada após várias tentativas.")
        return

    try:
        # Clicar na caixa
        pyautogui.click(pos_caixa)
        time.sleep(0.5)

        # Copiar e colar a mensagem com pyperclip (100% compatível com emoji e acentos)
        pyperclip.copy(mensagem)
        pyautogui.hotkey("ctrl", "v")
        time.sleep(0.5)

        # Enviar (botão enviar fixo na posição, ajustar se necessário)
        pos_botao_enviar = (1322, 693)  # ← ajuste se tiver mudado
        pyautogui.click(pos_botao_enviar)

        print("✅ Mensagem enviada com sucesso!")

    except Exception as erro:
        print("❌ Erro ao enviar a mensagem.")
        print("Erro:", erro)

# Execução direta via subprocesso
if __name__ == "__main__":
    telefone = sys.argv[1]
    mensagem = sys.argv[2]
    enviar_mensagem(telefone, mensagem)
