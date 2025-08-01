import pandas as pd
import json

def atualizar_jsons(caminho_usuarios, caminho_obras, caminho_materiais, pasta_saida):
    # Ler planilhas
    usuarios = pd.read_excel(caminho_usuarios)
    obras = pd.read_excel(caminho_obras)
    materiais = pd.read_excel(caminho_materiais)
    
    # Ordenar materiais alfabeticamente
    materiais_sorted = materiais.sort_values(by="MATERIAIS")

    # Converter para dicionários
    usuarios_json = usuarios.to_dict(orient="records")
    obras_json = obras.to_dict(orient="records")
    materiais_json = materiais_sorted.to_dict(orient="records")

    # Salvar arquivos JSON
    with open(f"{pasta_saida}/usuarios.json", "w", encoding="utf-8") as f:
        json.dump(usuarios_json, f, ensure_ascii=False, indent=4)
        
    with open(f"{pasta_saida}/obras.json", "w", encoding="utf-8") as f:
        json.dump(obras_json, f, ensure_ascii=False, indent=4)
        
    with open(f"{pasta_saida}/materiais.json", "w", encoding="utf-8") as f:
        json.dump(materiais_json, f, ensure_ascii=False, indent=4)
    
    print("✅ Arquivos JSON atualizados com sucesso!")

if __name__ == "__main__":
    # Ajuste os caminhos conforme sua estrutura de pastas
    caminho_usuarios = "C:/IMPAR/usuarios.xlsx"
    caminho_obras = "C:/IMPAR/obras.xlsx"
    caminho_materiais = "C:/IMPAR/materiais.xlsx"
    pasta_saida = "C:/IMPAR/ERP_JSON"

    atualizar_jsons(caminho_usuarios, caminho_obras, caminho_materiais, pasta_saida)
