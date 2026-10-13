#!/usr/bin/env python3
"""Lê as 3 planilhas exportadas e gera dados.json para o painel.

Uso:  python3 etl.py [pasta_das_planilhas] [saida.json]

Troque esta etapa por uma consulta ao banco quando a fonte definitiva existir.
O painel só depende do formato do dados.json, não de onde ele veio.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

PASTA = Path(sys.argv[1] if len(sys.argv) > 1 else "entrada")
SAIDA = Path(sys.argv[2] if len(sys.argv) > 2 else "dados.json")


def achar(sufixo):
    arqs = sorted(PASTA.glob(f"*{sufixo}*.xlsx"))
    if not arqs:
        sys.exit(f"ERRO: nenhuma planilha *{sufixo}*.xlsx em {PASTA}")
    return arqs[0]


def ler(sufixo):
    f = achar(sufixo)
    df = pd.read_excel(f, dtype=str)
    df.columns = [c.strip() for c in df.columns]
    # Remove linhas de rodapé do export ("Filtros aplicados...") e linhas vazias
    cod = "Cod. Projeto"
    df = df[df[cod].fillna("").str.fullmatch(r"\d+")].copy()
    return f, df


def num(serie):
    return pd.to_numeric(serie, errors="coerce").fillna(0.0)


f1, t1 = ler("tabela1")  # cadastro do projeto
f2, t2 = ler("tabela2")  # equipe
f3, t3 = ler("tabela3")  # valores

avisos = []

# --- Validações de estrutura (falha cedo, não publica dado quebrado) ---
esperadas = {
    "tabela1": (t1, ["Cod. Projeto", "Município", "ASSOCIACAO", "REGIAO", "Situação do Projeto", "Nome Projeto Completo"]),
    "tabela2": (t2, ["Cod. Projeto", "Equipe", "Função"]),
    "tabela3": (t3, ["Cod. Projeto", "VALOR_PLANEJADO", "Valor Conveniado", "Valor aportado", "Aportado - Badesc", "Aportado - BRDE"]),
}
for nome, (df, cols) in esperadas.items():
    falt = [c for c in cols if c not in df.columns]
    if falt:
        sys.exit(f"ERRO: {nome} sem as colunas {falt}")

if t1["Cod. Projeto"].duplicated().any():
    sys.exit("ERRO: código de projeto duplicado na tabela1")

# A tabela 3 traz o portfólio inteiro; o painel só usa os projetos da tabela 1
ids = set(t1["Cod. Projeto"])
t3 = t3[t3["Cod. Projeto"].isin(ids)].copy()
if t3["Cod. Projeto"].duplicated().any():
    sys.exit("ERRO: código de projeto duplicado na tabela3")
faltam_valor = ids - set(t3["Cod. Projeto"])
if faltam_valor:
    avisos.append(f"{len(faltam_valor)} projetos sem linha de valores na tabela3")
t2 = t2[t2["Cod. Projeto"].isin(ids)].copy()
sem_equipe = ids - set(t2["Cod. Projeto"])
if sem_equipe:
    avisos.append(f"{len(sem_equipe)} projetos sem equipe na tabela2")

for c in ["VALOR_PLANEJADO", "Valor Conveniado", "Valor aportado", "Aportado - Badesc", "Aportado - BRDE"]:
    t3[c] = num(t3[c])
t3 = t3.set_index("Cod. Projeto")

# --- Projetos ---
projetos = []
for _, r in t1.iterrows():
    cod = r["Cod. Projeto"]
    v = t3.loc[cod] if cod in t3.index else None
    plan = float(v["VALOR_PLANEJADO"]) if v is not None else 0.0
    conv = float(v["Valor Conveniado"]) if v is not None else 0.0
    apor = float(v["Valor aportado"]) if v is not None else 0.0
    ab = float(v["Aportado - Badesc"]) if v is not None else 0.0
    ar = float(v["Aportado - BRDE"]) if v is not None else 0.0
    outros = round(apor - ab - ar, 2)
    if ab > 0 and ar > 0:
        fin = "BRDE e Badesc"
    elif ar > 0:
        fin = "BRDE"
    elif ab > 0:
        fin = "Badesc"
    else:
        fin = None  # financiador ainda não vem da fonte para projetos sem aporte
    projetos.append({
        "id": cod,
        "nome": r["Nome Projeto Completo"].strip(),
        "mun": r["Município"].strip(),
        "assoc": (r["ASSOCIACAO"] or "").strip(),
        "regiao": (r["REGIAO"] or "").strip(),
        "sit": (r["Situação do Projeto"] or "").strip(),
        "plan": round(plan, 2),
        "conv": round(conv, 2),
        "apor": round(apor, 2),
        "apor_badesc": round(ab, 2),
        "apor_brde": round(ar, 2),
        "apor_outros": outros if abs(outros) > 0.01 else 0.0,
        "fin": fin,
    })

equipe = [
    {"id": r["Cod. Projeto"], "pessoa": r["Equipe"].strip(), "funcao": r["Função"].strip()}
    for _, r in t2.dropna(subset=["Equipe", "Função"]).iterrows()
]

# --- Conferência de totais (vira aviso se mudar de forma inesperada) ---
tot = {
    "projetos": len(projetos),
    "municipios": len({p["mun"] for p in projetos}),
    "planejado": round(sum(p["plan"] for p in projetos), 2),
    "conveniado": round(sum(p["conv"] for p in projetos), 2),
    "aportado": round(sum(p["apor"] for p in projetos), 2),
    "aportado_badesc": round(sum(p["apor_badesc"] for p in projetos), 2),
    "aportado_brde": round(sum(p["apor_brde"] for p in projetos), 2),
}
if any(p["apor_outros"] for p in projetos):
    n = sum(1 for p in projetos if p["apor_outros"])
    avisos.append(f"{n} projetos com aportado maior que Badesc + BRDE (origem não identificada)")
sem_gestor = ids - {e["id"] for e in equipe if e["funcao"].startswith("Gestor do Projeto")}
if sem_gestor:
    avisos.append(f"{len(sem_gestor)} projeto(s) sem 'Gestor do Projeto - Responsável'")

saida = {
    "meta": {
        "gerado_em": datetime.now().astimezone().isoformat(timespec="minutes"),
        "arquivos": [f1.name, f2.name, f3.name],
        "totais_conferencia": tot,
        "avisos": avisos,
    },
    "projetos": projetos,
    "equipe": equipe,
}
SAIDA.write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

print(f"OK  {SAIDA}  ({SAIDA.stat().st_size/1024:.0f} KB)")
for k, v in tot.items():
    print(f"  {k:16s} {v:,.2f}" if isinstance(v, float) else f"  {k:16s} {v}")
for a in avisos:
    print("  AVISO:", a)
