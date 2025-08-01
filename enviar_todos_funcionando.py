import pandas as pd
from datetime import datetime, timedelta
import subprocess
import os

CAMINHO_PLANILHA = "C:/IMPAR/aniversarios.xlsx"
CAMINHO_SCRIPT_ENVIO = "C:/IMPAR/enviar_whatsapp.py"
CAMINHO_ENVIADOS = "C:/IMPAR/enviados.txt"

def carregar_envios():
    if not os.path.exists(CAMINHO_ENVIADOS):
        return set()
    with open(CAMINHO_ENVIADOS, "r", encoding="utf-8") as f:
        return set(linha.strip() for linha in f if linha.strip())

def registrar_envio(chave):
    with open(CAMINHO_ENVIADOS, "a", encoding="utf-8") as f:
        f.write(chave + "\n")

def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Iniciando envio pela planilha...")
    try:
        df = pd.read_excel(CAMINHO_PLANILHA)
    except Exception as e:
        print(f"❌ Erro ao ler a planilha: {e}")
        return

    agora = datetime.now()
    enviados = carregar_envios()

    for i, row in df.iterrows():
        nome = row["Nome"]
        telefone = str(row["Telefone"])
        if not telefone.startswith("+"):
            telefone = "+" + telefone

        try:
            data_envio = row["Data"]
            hora_envio = row["Hora"]
            mensagem = str(row["Mensagem"])
        except Exception as e:
            print(f"❌ Erro nos dados da linha {i+2}: {e}")
            continue

        if isinstance(hora_envio, str):
            try:
                hora_envio = datetime.strptime(hora_envio, "%H:%M").time()
            except ValueError:
                print(f"❌ Hora inválida na linha {i+2}: {hora_envio}")
                continue

        data_hora_envio = datetime.combine(data_envio.date(), hora_envio)
        chave_envio = f"{telefone}-{data_envio.strftime('%d/%m/%Y')}-{hora_envio.strftime('%H:%M')}"

        janela_inicio = data_hora_envio - timedelta(minutes=10)
        janela_fim = data_hora_envio + timedelta(minutes=10)

        print(f"[{agora.strftime('%H:%M')}] Avaliando envio para {nome} ({telefone})...")
        print(f"     [HORA] Agora: {agora.strftime('%d/%m/%Y %H:%M')} | Agendado: {data_envio.strftime('%d/%m/%Y')} {hora_envio.strftime('%H:%M')}")

        if janela_inicio <= agora <= janela_fim and chave_envio not in enviados:
            print(f"[{agora.strftime('%H:%M')}] Enviando mensagem para {nome} ({telefone})...")
            try:
                subprocess.run(["python", CAMINHO_SCRIPT_ENVIO, telefone, mensagem], check=True)
                registrar_envio(chave_envio)
            except subprocess.CalledProcessError as e:
                print(f"❌ Erro ao enviar para {telefone}: {e}")
        else:
            print(f"[{agora.strftime('%H:%M')}] ❌ Fora da janela ou já enviado.")

    print("✅ Envio finalizado.")

if __name__ == "__main__":
    main()
