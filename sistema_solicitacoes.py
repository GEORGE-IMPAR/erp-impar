import customtkinter as ctk
import pandas as pd
from tkinter import messagebox
from datetime import datetime

# Configurações do app
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

CAMINHO_PLANILHA = r"C:/IMPAR/SOLICITAÇÃO DE MATERIAS.xlsm"

class SistemaMateriais(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Sistema de Solicitação de Materiais")
        self.geometry("800x600")

        self.usuario_logado = None

        # Tela de login
        self.frame_login = ctk.CTkFrame(self)
        self.frame_login.pack(expand=True)

        self.lbl_login = ctk.CTkLabel(self.frame_login, text="Login", font=("Arial", 20))
        self.lbl_login.pack(pady=20)

        self.entry_email = ctk.CTkEntry(self.frame_login, placeholder_text="E-mail")
        self.entry_email.pack(pady=10)

        self.entry_senha = ctk.CTkEntry(self.frame_login, placeholder_text="Senha", show="*")
        self.entry_senha.pack(pady=10)

        self.btn_login = ctk.CTkButton(self.frame_login, text="Entrar", command=self.validar_login)
        self.btn_login.pack(pady=20)

    def validar_login(self):
        try:
            df = pd.read_excel(CAMINHO_PLANILHA, sheet_name="Solicitantes")
            email = self.entry_email.get().strip()
            senha = self.entry_senha.get().strip()

            usuario = df[(df["Email"] == email) & (df["Senha"] == senha)]
            if not usuario.empty:
                self.usuario_logado = usuario.iloc[0]["Nome"]
                messagebox.showinfo("Sucesso", f"Bem-vindo, {self.usuario_logado}!")
                self.frame_login.pack_forget()
                self.tela_principal()
            else:
                messagebox.showerror("Erro", "E-mail ou senha inválidos!")
        except Exception as e:
            messagebox.showerror("Erro", f"Falha ao validar login: {e}")

    def tela_principal(self):
        self.frame_main = ctk.CTkFrame(self)
        self.frame_main.pack(expand=True, fill="both")

        lbl = ctk.CTkLabel(self.frame_main, text=f"Olá, {self.usuario_logado}", font=("Arial", 18))
        lbl.pack(pady=20)

        btn_nova = ctk.CTkButton(self.frame_main, text="Nova Solicitação", command=self.nova_solicitacao)
        btn_nova.pack(pady=10)

        btn_listar = ctk.CTkButton(self.frame_main, text="Listar Solicitações", command=self.listar_solicitacoes)
        btn_listar.pack(pady=10)

    def nova_solicitacao(self):
        janela = ctk.CTkToplevel(self)
        janela.title("Nova Solicitação")
        janela.geometry("500x500")

        # Clientes
        try:
            df_clientes = pd.read_excel(CAMINHO_PLANILHA, sheet_name="Clientes e Centro de Custo")
            clientes = df_clientes["CLIENTE"].dropna().unique().tolist()
        except:
            clientes = []

        lbl_cliente = ctk.CTkLabel(janela, text="Cliente:")
        lbl_cliente.pack(pady=5)
        combo_cliente = ctk.CTkComboBox(janela, values=clientes)
        combo_cliente.pack(pady=5)

        lbl_material = ctk.CTkLabel(janela, text="Material:")
        lbl_material.pack(pady=5)
        entry_material = ctk.CTkEntry(janela)
        entry_material.pack(pady=5)

        lbl_qtd = ctk.CTkLabel(janela, text="Quantidade:")
        lbl_qtd.pack(pady=5)
        entry_qtd = ctk.CTkEntry(janela)
        entry_qtd.pack(pady=5)

        lbl_data = ctk.CTkLabel(janela, text="Data Limite (dd/mm/yyyy):")
        lbl_data.pack(pady=5)
        entry_data = ctk.CTkEntry(janela)
        entry_data.pack(pady=5)

        lbl_local = ctk.CTkLabel(janela, text="Local de entrega:")
        lbl_local.pack(pady=5)
        entry_local = ctk.CTkEntry(janela)
        entry_local.pack(pady=5)

        def salvar():
            try:
                df = pd.read_excel(CAMINHO_PLANILHA, sheet_name="Atualizar_Planilha_Status")
            except:
                df = pd.DataFrame(columns=["Obra", "Solicitante", "Fornecedor", "Material",
                                           "Quantidade", "Data Limite para Entrega", "Local de entrega", "Status"])

            nova = {
                "Obra": combo_cliente.get(),
                "Solicitante": self.usuario_logado,
                "Fornecedor": "",
                "Material": entry_material.get(),
                "Quantidade": entry_qtd.get(),
                "Data Limite para Entrega": entry_data.get(),
                "Local de entrega": entry_local.get(),
                "Status": "Pendente"
            }

            df = pd.concat([df, pd.DataFrame([nova])], ignore_index=True)
            df.to_excel(CAMINHO_PLANILHA, sheet_name="Atualizar_Planilha_Status", index=False)

            messagebox.showinfo("Sucesso", "Solicitação registrada!")
            janela.destroy()

        btn_salvar = ctk.CTkButton(janela, text="Salvar Solicitação", command=salvar)
        btn_salvar.pack(pady=20)

    def listar_solicitacoes(self):
        janela = ctk.CTkToplevel(self)
        janela.title("Solicitações Registradas")
        janela.geometry("750x500")

        try:
            df = pd.read_excel(CAMINHO_PLANILHA, sheet_name="Atualizar_Planilha_Status")
        except Exception as e:
            messagebox.showerror("Erro", f"Falha ao abrir planilha: {e}")
            return

        # Filtros
        frame_filtros = ctk.CTkFrame(janela)
        frame_filtros.pack(pady=10)

        clientes = ["Todos"] + df["Obra"].dropna().unique().tolist()
        status = ["Todos"] + df["Status"].dropna().unique().tolist()
        solicitantes = ["Todos"] + df["Solicitante"].dropna().unique().tolist()

        combo_cliente = ctk.CTkComboBox(frame_filtros, values=clientes)
        combo_cliente.set("Todos")
        combo_cliente.pack(side="left", padx=10)

        combo_status = ctk.CTkComboBox(frame_filtros, values=status)
        combo_status.set("Todos")
        combo_status.pack(side="left", padx=10)

        combo_solic = ctk.CTkComboBox(frame_filtros, values=solicitantes)
        combo_solic.set("Todos")
        combo_solic.pack(side="left", padx=10)

        box = ctk.CTkTextbox(janela, width=700, height=350)
        box.pack(pady=10)

        def aplicar_filtros():
            df_filtrado = df.copy()
            if combo_cliente.get() != "Todos":
                df_filtrado = df_filtrado[df_filtrado["Obra"] == combo_cliente.get()]
            if combo_status.get() != "Todos":
                df_filtrado = df_filtrado[df_filtrado["Status"] == combo_status.get()]
            if combo_solic.get() != "Todos":
                df_filtrado = df_filtrado[df_filtrado["Solicitante"] == combo_solic.get()]

            texto = ""
            for _, row in df_filtrado.iterrows():
                texto += (f"{row['Obra']} - {row['Material']} ({row['Quantidade']}) | "
                          f"{row['Solicitante']} | Status: {row['Status']}\n")

            box.configure(state="normal")
            box.delete("0.0", "end")
            box.insert("0.0", texto if texto else "Nenhum resultado encontrado.")
            box.configure(state="disabled")

        btn_aplicar = ctk.CTkButton(frame_filtros, text="Aplicar Filtros", command=aplicar_filtros)
        btn_aplicar.pack(side="left", padx=10)

        aplicar_filtros()

if __name__ == "__main__":
    app = SistemaMateriais()
    app.mainloop()
