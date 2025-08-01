import pyautogui
import time

print("⏳ Você tem 5 segundos para posicionar o mouse sobre o botão de envio...")
time.sleep(5)
posicao = pyautogui.position()
print(f"📍 Posição do mouse: {posicao}")
