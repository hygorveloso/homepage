#!/usr/bin/env python3
"""Troca só o bloco de dados do index.html pelo conteúdo de dados.json. O resto da página não é tocado.

Uso:  python3 atualizar.py [dados.json] [index.html]
"""
import re, sys
from pathlib import Path

dados = Path(sys.argv[1] if len(sys.argv) > 1 else "dados.json")
alvo = Path(sys.argv[2] if len(sys.argv) > 2 else "index.html")

html = alvo.read_text(encoding="utf-8")
novo = dados.read_text(encoding="utf-8").replace("</", "<\\/")  # nunca fecha a tag <script> por engano
padrao = re.compile(r'(<script id="dados" type="application/json">)(.*?)(</script>)', re.S)
assert len(padrao.findall(html)) == 1, "bloco <script id=\"dados\"> não encontrado (ou repetido) no index.html"
alvo.write_text(padrao.sub(lambda m: m.group(1) + novo + m.group(3), html, count=1), encoding="utf-8")
print(f"OK: dados de {dados} gravados em {alvo} ({len(novo)/1024:.0f} KB)")
