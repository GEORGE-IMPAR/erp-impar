import os
from apscheduler.schedulers.blocking import BlockingScheduler
from datetime import datetime

# 🔹 Caminho do BAT correto
CAMINHO_BAT = r"C:\IMPAR\whatsapp.bat"

def executar_bat():
    agora = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    print(f"[{agora}] Executando: {CAMINHO_BAT}")
    os.system(f'start "" "{CAMINHO_BAT}"')

# 🔹 Configuração do agendador
scheduler = BlockingScheduler()

# ✅ Rodar todos os dias às 00:01
scheduler.add_job(executar_bat, 'cron', hour=0, minute=1)

print("✅ Agendador iniciado. O BAT será executado todos os dias às 00:01")
print("Pressione CTRL+C para parar.")

try:
    scheduler.start()
except (KeyboardInterrupt, SystemExit):
    print("⛔ Agendador finalizado.")
