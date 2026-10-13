#!/usr/bin/env python3
"""Monta o painel: modelo visual + dados.json -> um único HTML.

Uso:  python3 build.py [dados.json] [modelo_original.html]
Gera: painel.html (arquivo completo) e painel_artifact.html (sem <html>/<head>/<body>, para publicar como artifact)
"""
import sys
from pathlib import Path

dados = Path(sys.argv[1] if len(sys.argv) > 1 else "dados.json").read_text(encoding="utf-8")
modelo = Path(sys.argv[2] if len(sys.argv) > 2 else "modelo_original.html").read_text(encoding="utf-8").split("\n")

# Estrutura do modelo original (linhas 1-based):
#  4-9   meta, título e fontes | 10-235 CSS | 236 </style> | 459 malha municipal do IBGE (uma linha enorme)
assert modelo[9].startswith("<style>") and modelo[235] == "</style>", "modelo mudou: confira as linhas do CSS"
assert modelo[458].startswith("const SC=[["), "modelo mudou: confira a linha da malha do mapa"

head = "\n".join(modelo[3:9]).replace("<title>Painel Estrada Boa Rural (Copy)</title>", "<title>Estrada Boa Rural</title>")
css = "\n".join(modelo[10:235])
extra = Path("extra.css").read_text(encoding="utf-8")
body = Path("body.html").read_text(encoding="utf-8")
js = Path("script.js").read_text(encoding="utf-8")

assert "</" not in dados.replace("</", "<\\/") or True
dados_seguro = dados.replace("</", "<\\/")  # evita fechar a tag <script> por engano
body = body.replace("__DADOS__", dados_seguro)
js = js.replace("/*__SC__*/", modelo[458])

fragmento = f"{head}\n<style>\n{css}\n{extra}\n</style>\n{body}\n<script>\n{js}\n</script>\n"
Path("painel_artifact.html").write_text(fragmento, encoding="utf-8")

completo = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n' +
            fragmento.replace("</style>\n<header", "</style>\n</head>\n<body>\n<header", 1) +
            "</body>\n</html>\n")
Path("painel.html").write_text(completo, encoding="utf-8")
print("OK painel.html", round(len(completo) / 1024), "KB |", "painel_artifact.html", round(len(fragmento) / 1024), "KB")
