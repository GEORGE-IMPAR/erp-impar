import sys
sys.stdout.reconfigure(encoding='utf-8')

import pandas as pd
import time
from datetime import datetime
import subprocess
import os

CAMINHO_PLANILHA = "C:/IMPAR/aniversarios.xlsx"
CAMINHO_SCRIPT_ENVIO = "C:/IMPAR/enviar_whatsapp.py"
CAMINHO_ENVIADOS = "C:/IMPAR/enviados.txt"
TOLERANCIA_MINUTOS = 10

def ja_foi_enviado(chave):
    if not os.path.exists(CAMINHO_ENVIADOS):
        return False
    with open(CAMINHO_ENVIADOS, "r", encoding="utf-8") as f:
        return chave in f.read()

def marcar_como_enviado(chave):
    with open(CAMINHO_ENVIADOS, "a", encoding="utf-8") as f:
        f.write(chave + "\n")

def main():
    print(f"[{datetime.now():%H:%M}] Iniciando envio pela planilha...")

    try:
        df = pd.read_excel(CAMINHO_PLANILHA)
    except Exception as e:
        print(f"[ERRO] Falha ao ler a planilha: {e}")
        return

    agora = datetime.now()

    for i, row in df.iterrows():
        nome = str(row["Nome"])
        telefone = str(row["Telefone"])
        data_envio = row["Data"]
        hora_envio = row["Hora"]
        mensagem = str(row["Mensagem"])

        if not telefone.startswith("+"):
            telefone = "+" + telefone

        chave = f"{telefone}-{data_envio}-{hora_envio}"
        print(f"[{agora:%H:%M}] Avaliando envio para {nome} ({telefone})...")

        if ja_foi_enviado(chave):
            print("     [SKIP] Já enviado anteriormente.")
            continue

        try:
            agendado = datetime.combine(data_envio, datetime.strptime(hora_envio, "%H:%M").time())
            diferenca = abs((agora - agendado).total_seconds()) / 60
            print(f"     [HORA] Agora: {agora:%d/%m/%Y %H:%M} | Agendado: {agendado:%d/%m/%Y %H:%M}")

            if diferenca > TOLERANCIA_MINUTOS:
                print("     [SKIP] Fora da janela de tolerância.")
                continue
        except Exception as e:
            print(f"     [ERRO] Falha ao comparar horários: {e}")
            continue

        print(f"[{agora:%H:%M}] Enviando mensagem para {nome} ({telefone})...")
        try:
            subprocess.run(
                ["python", CAMINHO_SCRIPT_ENVIO, telefone.replace("+", ""), mensagem],
                check=True
            )
            marcar_como_enviado(chave)
        except subprocess.CalledProcessError as e:
            print(f"[ERRO] Falha ao enviar para {telefone}: {e}")

    print("✅ Envio finalizado.")

if __name__ == "__main__":
    main()
