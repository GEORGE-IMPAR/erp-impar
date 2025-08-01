
import sys
import subprocess
import pandas as pd
from datetime import datetime, timedelta
from enviar_whatsapp import enviar_mensagem

sys.stdout.reconfigure(encoding='utf-8')

CAMINHO_PLANILHA = "C:/IMPAR/aniversarios.xlsx"
CAMINHO_ARQUIVO_ENVIADOS = "C:/IMPAR/enviados.txt"
TOLERANCIA_MINUTOS = 10

def ja_enviado(telefone, data, hora):
    try:
        with open(CAMINHO_ARQUIVO_ENVIADOS, "r", encoding="utf-8") as f:
            enviados = f.read().splitlines()
        return f"{telefone};{data} {hora}" in enviados
    except FileNotFoundError:
        return False

def registrar_envio(telefone, data, hora):
    with open(CAMINHO_ARQUIVO_ENVIADOS, "a", encoding="utf-8") as f:
        f.write(f"{telefone};{data} {hora}\n")

def main():
    print(f"[{datetime.now():%H:%M}] Iniciando envio pela planilha...")
    df = pd.read_excel(CAMINHO_PLANILHA)

    agora = datetime.now()

    for i, row in df.iterrows():
        nome = row["Nome"]
        telefone = str(row["Telefone"])
        if not telefone.startswith("+"):
            telefone = "+" + telefone

        data_envio = row["Data"].date() if isinstance(row["Data"], datetime) else datetime.strptime(row["Data"], "%d/%m/%Y").date()
        hora_envio = row["Hora"]
        if isinstance(hora_envio, str):
            hora_envio = datetime.strptime(hora_envio, "%H:%M").time()

        mensagem = str(row["Mensagem"])

        dt_envio = datetime.combine(data_envio, hora_envio)
        delta = abs((agora - dt_envio).total_seconds()) / 60

        print(f"[{agora:%H:%M}] Avaliando envio para {nome} ({telefone})...")
        print(f"     [HORA] Agora: {agora:%d/%m/%Y %H:%M} | Agendado: {dt_envio:%d/%m/%Y %H:%M}")

        if delta > TOLERANCIA_MINUTOS:
            print("     [SKIP] Fora da janela de tolerância.")
            continue

        if ja_enviado(telefone, data_envio.strftime("%d/%m/%Y"), hora_envio.strftime("%H:%M")):
            print("     [SKIP] Já enviado anteriormente.")
            continue

        print(f"[{agora:%H:%M}] Enviando mensagem para {nome} ({telefone})...")
        try:
            enviar_mensagem(telefone, mensagem)
            registrar_envio(telefone, data_envio.strftime("%d/%m/%Y"), hora_envio.strftime("%H:%M"))
        except Exception as e:
            print(f"[ERRO] Falha ao enviar para {telefone}: {str(e)}")

    print("✅ Envio finalizado.")

if __name__ == "__main__":
    main()
