#!/usr/bin/env python3
"""Lê as 4 planilhas exportadas e gera dados.json para o painel.

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


def ler_cod(sufixo, coluna_cod):
    f = achar(sufixo)
    df = pd.read_excel(f, dtype=str)
    df.columns = [c.strip() for c in df.columns]
    df = df[df[coluna_cod].fillna("").str.fullmatch(r"\d+")].copy()
    df = df.rename(columns={coluna_cod: "Cod. Projeto"})
    return f, df


def num(serie):
    return pd.to_numeric(serie, errors="coerce").fillna(0.0)


f1, t1 = ler("tabela1")  # cadastro do projeto
f2, t2 = ler("tabela2")  # equipe
f3, t3 = ler("tabela3")  # valores
f4, t4 = ler_cod("tabela4", "CODIGO_PROJETO")  # financiamento, km, situação atual, SGPe, link

f6, t6 = ler("tabela6")  # planejado e pago por fonte de recurso

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

esperadas4 = ["Cod. Projeto", "Nome Projeto Completo", "Município", "Financiamento", "KM Planejado",
              "KM Pavimentado", "$ Planejado", "$ Executado", "Situação Atual", "SGPe", "LINK"]
falt4 = [c for c in esperadas4 if c not in t4.columns]
if falt4:
    sys.exit(f"ERRO: tabela4 sem as colunas {falt4}")
if t4["Cod. Projeto"].duplicated().any():
    sys.exit("ERRO: código de projeto duplicado na tabela4")
t4 = t4[t4["Cod. Projeto"].isin(ids)].copy()
if ids - set(t4["Cod. Projeto"]):
    avisos.append(f"{len(ids - set(t4['Cod. Projeto']))} projetos sem linha na tabela4")
for c in ["KM Planejado", "KM Pavimentado", "$ Planejado", "$ Executado"]:
    t4[c] = num(t4[c])
t4 = t4.set_index("Cod. Projeto")

for c in ["VALOR_PLANEJADO", "Valor Conveniado", "Valor aportado", "Aportado - Badesc", "Aportado - BRDE"]:
    t3[c] = num(t3[c])
t3 = t3.set_index("Cod. Projeto")

# --- Fontes de recurso (tabela6): uma linha por projeto e fonte ---
falt6 = [c for c in ["Cod. Projeto", "Fonte de Recursos", "Valor Planejado", "Valor Total Pago"] if c not in t6.columns]
if falt6:
    sys.exit(f"ERRO: tabela6 sem as colunas {falt6}")
t6["Fonte de Recursos"] = t6["Fonte de Recursos"].fillna("").str.strip()  # há " Recursos Municipais" com espaço
t6 = t6[t6["Cod. Projeto"].isin(ids) & (t6["Fonte de Recursos"] != "")].copy()
for c in ["Valor Planejado", "Valor Total Pago"]:
    t6[c] = num(t6[c])
if t6.duplicated(["Cod. Projeto", "Fonte de Recursos"]).any():
    sys.exit("ERRO: projeto e fonte duplicados na tabela6")
FONTES_OK = {"Recursos Estaduais", "Financiamento BRDE", "Recursos Municipais", "Bens/Serviços", "Financiamento BADESC"}
outras = sorted(set(t6["Fonte de Recursos"]) - FONTES_OK)
if outras:
    avisos.append(f"fontes na tabela6 fora das 5 do painel (ignoradas no gráfico): {outras}")
fontes = {}
for _, r in t6.iterrows():
    fontes.setdefault(r["Cod. Projeto"], {})[r["Fonte de Recursos"]] = [round(float(r["Valor Planejado"]), 2), round(float(r["Valor Total Pago"]), 2)]
sem_fonte = ids - set(fontes)
if sem_fonte:
    avisos.append(f"{len(sem_fonte)} projetos sem linha na tabela6")

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
    q = t4.loc[cod] if cod in t4.index else None
    fin4 = (q["Financiamento"] if q is not None else "") or ""
    fin4 = {"Sem Financiamento": "Sem financiamento"}.get(fin4.strip(), fin4.strip()) or None
    link = (q["LINK"] if q is not None else None)
    link = link.strip() if isinstance(link, str) and link.strip().startswith("https://") else None
    if q is not None:
        if abs(float(q["$ Planejado"]) - plan) > 0.01:
            avisos.append(f"projeto {cod}: $ Planejado difere entre tabela3 e tabela4")
        if abs(float(q["$ Executado"]) - apor) > 0.01:
            avisos.append(f"projeto {cod}: $ Executado difere do valor aportado")
        if q["Município"].strip() != r["Município"].strip():
            avisos.append(f"projeto {cod}: município difere entre tabela1 e tabela4")
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
        "fin": fin4,
        "km": round(float(q["KM Planejado"]), 3) if q is not None else 0.0,
        "km_pav": round(float(q["KM Pavimentado"]), 3) if q is not None else 0.0,
        "exec": round(float(q["$ Executado"]), 2) if q is not None else 0.0,
        "sit_atual": ((q["Situação Atual"] if q is not None else "") or "").strip(),
        "sgpe": ((q["SGPe"] if q is not None else "") or "").strip(),
        "link": link,
        "fontes": fontes.get(cod, {}),
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
    "km_planejado": round(sum(p["km"] for p in projetos), 2),
    "km_pavimentado": round(sum(p["km_pav"] for p in projetos), 2),
}
fora = [p["id"] for p in projetos if p["apor_outros"] and p["fin"] != "Sem financiamento"]
if fora:
    avisos.append(f"{len(fora)} projetos com aporte fora de BRDE/Badesc mas com financiamento informado: {fora[:5]}")
sem_link = [p["id"] for p in projetos if not p["link"]]
if sem_link:
    avisos.append(f"{len(sem_link)} projetos sem link válido")
sem_gestor = ids - {e["id"] for e in equipe if e["funcao"].startswith("Gestor do Projeto")}
if sem_gestor:
    avisos.append(f"{len(sem_gestor)} projeto(s) sem 'Gestor do Projeto - Responsável'")

saida = {
    "meta": {
        "gerado_em": datetime.now().astimezone().isoformat(timespec="minutes"),
        "arquivos": [f1.name, f2.name, f3.name, f4.name, f6.name],
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
