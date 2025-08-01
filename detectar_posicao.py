import pyautogui
import time

print("🖱️ Posicione o mouse exatamente sobre a caixa de digitação do WhatsApp Web.")
time.sleep(5)
x, y = pyautogui.position()
print(f"📍 Posição detectada da caixa de mensagem: ({x}, {y})")
