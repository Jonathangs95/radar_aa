from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "dados_fontes"
GNS = DATA_DIR / "GNS_Analise.xlsx"
OUT = ROOT / "demo" / "data" / "channel-data.json"

CARTEIRA_EXTENSIONS = {".xlsb", ".xlsx"}
MONTH_NAMES = {
    "janeiro": (1, "Janeiro"),
    "fevereiro": (2, "Fevereiro"),
    "marco": (3, "Março"),
    "março": (3, "Março"),
    "abril": (4, "Abril"),
    "maio": (5, "Maio"),
    "junho": (6, "Junho"),
    "julho": (7, "Julho"),
    "agosto": (8, "Agosto"),
    "setembro": (9, "Setembro"),
    "outubro": (10, "Outubro"),
    "novembro": (11, "Novembro"),
    "dezembro": (12, "Dezembro"),
}

GF_PHOTOS = {
    "EDUARDO ALVES DE QUEIROZ": "fotos/eduardo_alves_de_queiroz.png",
    "HELBER EMILIANO ZAROS": "fotos/helber_emiliano_zaros.png",
    "RAFAEL SILVEIRA DE CARVALHO": "fotos/rafael_silveira_de_carvalho.png",
    "VIVIANE TANGARI LEMOS PONTES": "fotos/viviane_tangari_lemos_pontes.png",
}


def normalized_person_name(name):
    return " ".join(str(name or "").strip().upper().split())


def gf_photo_file(name):
    return GF_PHOTOS.get(normalized_person_name(name))


def normalize_token(text):
    return unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode("ascii").lower()


def carteira_month(path):
    normalized = normalize_token(path.stem)
    for token, (_, label) in MONTH_NAMES.items():
        if normalize_token(token) in normalized:
            return label
    return path.stem.replace("_", " ").replace("-", " ").title()


def carteira_sort_key(path):
    normalized = normalize_token(path.stem)
    month_number = 0
    for token, (number_, _) in MONTH_NAMES.items():
        if normalize_token(token) in normalized:
            month_number = max(month_number, number_)
    return (month_number, path.stat().st_mtime, path.name.lower())


def find_carteira_files():
    if not DATA_DIR.exists():
        return []
    return sorted(
        [
            p for p in DATA_DIR.iterdir()
            if p.is_file()
            and p.name.lower().startswith("carteira_")
            and p.suffix.lower() in CARTEIRA_EXTENSIONS
        ],
        key=carteira_sort_key,
    )


def resolve_carteira_path(value=None):
    if value:
        path = Path(value)
        if not path.is_absolute():
            path = ROOT / path
        path = path.resolve()
        if not path.exists():
            raise FileNotFoundError(f"Carteira informada nao encontrada: {path}")
        if path.suffix.lower() not in CARTEIRA_EXTENSIONS:
            raise ValueError("A carteira precisa estar em .xlsb ou .xlsx")
        return path

    candidates = find_carteira_files()
    if not candidates:
        raise FileNotFoundError("Nenhuma carteira encontrada em dados_fontes com padrao carteira_*.xlsb ou carteira_*.xlsx")
    return candidates[-1].resolve()


def read_carteira(path):
    kwargs = {"sheet_name": "carteira"}
    if path.suffix.lower() == ".xlsb":
        kwargs["engine"] = "pyxlsb"
    return pd.read_excel(path, **kwargs)


METRICS = {
    "bl": ("Banda Larga", "VALIDAÇÃO BL"),
    "tv": ("TV", "VALIDAÇÃO TV"),
    "pos": ("Pós Total", "VALIDAÇÃO POS TOTAL"),
    "conta": ("Conta", "VALIDAÇÃO CONTA"),
    "controle": ("Controle", "VALIDAÇÃO CONTROLE"),
}


def number(v):
    if pd.isna(v):
        return None
    if isinstance(v, (int, float, np.integer, np.floating)):
        x = float(v)
        return None if math.isnan(x) else x
    s = str(v).strip()
    if not s:
        return None
    pct = "%" in s
    s = s.replace("%", "").replace(" ", "")
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", ".")
    try:
        x = float(s)
    except ValueError:
        return None
    return x / 100 if pct else x


def status(v):
    x = number(v)
    if x is None:
        return "Sem dado"
    if abs(x) < 1e-12:
        return "Zerado"
    if x < 0.50:
        return "Crítico"
    if x < 0.80:
        return "Baixa Performance"
    if x < 1.00:
        return "Oportunidade"
    return "Produtivo"


def status_counts(series):
    vals = [number(v) for v in series]
    vals = [v for v in vals if v is not None and math.isfinite(float(v))]
    out = {"Zerado": 0, "Crítico": 0, "Baixa Performance": 0, "Oportunidade": 0, "Produtivo": 0, "Alta Performance": 0}
    for v in vals:
        st = status(v)
        if st in out:
            out[st] += 1
        if v >= 1.20:
            out["Alta Performance"] += 1
    out["Baixa + Crítico"] = out["Crítico"] + out["Baixa Performance"]
    out["Com dado"] = len(vals)
    return out

def product_stats(df):
    result = {}
    perf = perf_obj(df)
    for key, (label, col) in METRICS.items():
        result[key] = {
            "label": label,
            "counts": status_counts(df[col]),
            "productivePct": pct_productive(df[col]),
            "avgAttainmentPct": perf[key]["avgAttainmentPct"],
        }
    return result

def slug(text):
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text


def short_cargo(cargo):
    s = str(cargo or "").upper()
    if s == "VAGO":
        return "Vago"
    if s.endswith(" III"):
        return "Cargo III"
    if s.endswith(" II"):
        return "Cargo II"
    if s.endswith(" I"):
        return "Cargo I"
    return str(cargo or "Não informado")


def initials(name):
    bits = [x for x in str(name).replace("(", " ").split() if x and not x.startswith("DDD")]
    if not bits:
        return "?"
    if len(bits) == 1:
        return bits[0][:2].upper()
    return (bits[0][0] + bits[-1][0]).upper()


def clean_label(value, default="Não informado"):
    text = " ".join(str(value or "").strip().split())
    if not text or text.lower() in {"nan", "none", ".", "-"}:
        return default
    return text


def haversine(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def greedy_route(rows):
    pts = []
    for r in rows:
        lat = number(r.get("LAT"))
        lon = number(r.get("LONG"))
        if lat is not None and lon is not None:
            pts.append({"code": str(r.get("CODIGO\nAGENTE")), "city": str(r.get("Cidade")), "lat": lat, "lon": lon})
    if len(pts) < 2:
        return pts, 0.0
    # Começa no ponto mais a oeste apenas para manter uma regra estável no protótipo.
    start = min(range(len(pts)), key=lambda i: pts[i]["lon"])
    order = [pts.pop(start)]
    dist = 0.0
    while pts:
        current = order[-1]
        nxt_idx = min(range(len(pts)), key=lambda i: haversine(current["lat"], current["lon"], pts[i]["lat"], pts[i]["lon"]))
        nxt = pts.pop(nxt_idx)
        dist += haversine(current["lat"], current["lon"], nxt["lat"], nxt["lon"])
        order.append(nxt)
    if len(order) > 2:
        dist += haversine(order[-1]["lat"], order[-1]["lon"], order[0]["lat"], order[0]["lon"])
    return order, dist


def pct_productive(series):
    vals = [number(v) for v in series]
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    return round(sum(v >= 1 for v in vals) / len(vals) * 100, 1)


def perf_obj(df):
    out = {}
    for key, (label, col) in METRICS.items():
        vals = [number(v) for v in df[col]]
        vals = [v for v in vals if v is not None and math.isfinite(float(v))]
        avg = round(float(np.mean(vals)) * 100, 1) if vals else None
        out[key] = {
            "label": label,
            "productivePct": pct_productive(df[col]),
            "avgAttainmentPct": avg,
        }
    return out



def performance_index(perf):
    """Índice comparativo: média do % de lojas produtivas nos cinco indicadores."""
    vals = [m.get("productivePct") for m in perf.values() if m.get("productivePct") is not None]
    return round(float(np.mean(vals)), 1) if vals else None


def performance_class(index):
    """Faixa visual do protótipo; não substitui os status comerciais oficiais."""
    if index is None:
        return "Sem dado"
    if index >= 80:
        return "Boa"
    if index >= 60:
        return "Intermediária"
    return "Atenção"


def parse_args():
    parser = argparse.ArgumentParser(description="Gera o JSON do Canal 360 a partir das bases de dados.")
    parser.add_argument(
        "--carteira",
        default=None,
        help="Arquivo da carteira em .xlsb ou .xlsx. Ex.: dados_fontes/carteira_agosto.xlsx",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    carteira_path = resolve_carteira_path(args.carteira)
    period = f"Carteira {carteira_month(carteira_path)}"

    print(f"Carteira selecionada: {carteira_path}")
    gns = pd.read_excel(GNS, sheet_name="BASE_DADOS")
    cart = read_carteira(carteira_path)
    gns.columns = [str(c).strip() for c in gns.columns]
    cart.columns = [str(c).strip() for c in cart.columns]

    ccols = ["Amdocs", "Nome GN", "Nome Gerente Filial", "CARGO GN", "Territorio", "TERR", "Nome Loja", "Mercado", "Tipo Cabo", "GR"]
    missing = [col for col in ccols if col not in cart.columns]
    if missing:
        raise ValueError(f"Colunas ausentes na carteira selecionada: {missing}")
    current = cart[ccols].copy().rename(columns={"Amdocs": "CODIGO\nAGENTE"})
    df = gns.merge(current, on="CODIGO\nAGENTE", how="left", suffixes=("", "_carteira"))

    # A carteira selecionada e a referencia de estrutura atual para nomes/cargos.
    df["GN_ATUAL"] = df["Nome GN"].fillna(df["GN"])
    df["GF_ATUAL"] = df["Nome Gerente Filial"].fillna(df["GF"])
    df["GR_ATUAL"] = df["GR_carteira"].fillna(df["GR"])
    terr_col = "TERR_carteira" if "TERR_carteira" in df.columns else "TERR"
    df["GT_ATUAL"] = df[terr_col].map(clean_label)

    stores = []
    for _, r in df.iterrows():
        p = {}
        for key, (label, col) in METRICS.items():
            x = number(r[col])
            p[key] = {
                "label": label,
                "value": None if x is None else round(x * 100, 1),
                "status": status(r[col]),
                "highPerformance": bool(x is not None and x >= 1.20),
            }
        lat = number(r["LAT"])
        lon = number(r["LONG"])
        stores.append({
            "code": str(r["CODIGO\nAGENTE"]),
            "name": str(r.get("Nome Loja") or r["CODIGO\nAGENTE"]),
            "group": str(r["GR_ATUAL"]),
            "city": str(r["Cidade"]),
            "ddd": int(number(r["DDD"])) if number(r["DDD"]) is not None else None,
            "gn": str(r["GN_ATUAL"]),
            "gf": str(r["GF_ATUAL"]),
            "gt": str(r["GT_ATUAL"]),
            "address": str(r["ENDEREÇO"]),
            "lat": lat,
            "lon": lon,
            "type": str(r["TIPO"]),
            "performance": p,
        })

    gns_out = []
    for gn, g in df.groupby("GN_ATUAL", sort=True):
        gf = str(g["GF_ATUAL"].dropna().iloc[0])
        gt = str(g["GT_ATUAL"].dropna().iloc[0])
        cargo_raw = g["CARGO GN"].dropna().mode()
        cargo_raw = cargo_raw.iloc[0] if len(cargo_raw) else "Não informado"
        route, route_km = greedy_route(g.to_dict("records"))
        perf = perf_obj(g)
        productive_avg = round(np.mean([m["productivePct"] for m in perf.values() if m["productivePct"] is not None]), 1)
        gns_out.append({
            "name": str(gn),
            "initials": initials(gn),
            "photoFile": None,
            "gf": gf,
            "gt": gt,
            "cargo": short_cargo(cargo_raw),
            "cargoRaw": str(cargo_raw),
            "stores": int(g["CODIGO\nAGENTE"].nunique()),
            "cities": int(g["Cidade"].nunique()),
            "ddds": int(g["DDD"].nunique()),
            "groups": int(g["GR_ATUAL"].nunique()),
            "cityList": sorted(g["Cidade"].dropna().astype(str).unique().tolist()),
            "dddList": sorted([int(x) for x in pd.to_numeric(g["DDD"], errors="coerce").dropna().unique().tolist()]),
            "performance": perf,
            "productStats": product_stats(g),
            "productiveAvg": productive_avg,
            "routePreviewKm": round(route_km, 1),
            "routePreview": route,
            "storeCodes": g["CODIGO\nAGENTE"].astype(str).tolist(),
        })

    gfs_out = []
    for gf, g in df.groupby("GF_ATUAL", sort=True):
        gn_names = sorted(g["GN_ATUAL"].dropna().astype(str).unique().tolist())
        gt_names = sorted(g["GT_ATUAL"].dropna().astype(str).unique().tolist())
        gfs_out.append({
            "name": str(gf),
            "initials": initials(gf),
            "photoFile": gf_photo_file(gf),
            "gt": gt_names[0] if len(gt_names) == 1 else "Múltiplos",
            "gtNames": gt_names,
            "gns": len(gn_names),
            "stores": int(g["CODIGO\nAGENTE"].nunique()),
            "cities": int(g["Cidade"].nunique()),
            "ddds": int(g["DDD"].nunique()),
            "groups": int(g["GR_ATUAL"].nunique()),
            "gnNames": gn_names,
            "cityList": sorted(g["Cidade"].dropna().astype(str).unique().tolist()),
            "dddList": sorted([int(x) for x in pd.to_numeric(g["DDD"], errors="coerce").dropna().unique().tolist()]),
            "performance": perf_obj(g),
            "productStats": product_stats(g),
        })

    gts_out = []
    for gt, g in df.groupby("GT_ATUAL", sort=True):
        gf_names = sorted(g["GF_ATUAL"].dropna().astype(str).unique().tolist())
        gn_names = sorted(g["GN_ATUAL"].dropna().astype(str).unique().tolist())
        gts_out.append({
            "name": str(gt),
            "initials": initials(gt),
            "gfs": len(gf_names),
            "gns": len(gn_names),
            "stores": int(g["CODIGO\nAGENTE"].nunique()),
            "cities": int(g["Cidade"].nunique()),
            "ddds": int(g["DDD"].nunique()),
            "groups": int(g["GR_ATUAL"].nunique()),
            "gfNames": gf_names,
            "gnNames": gn_names,
            "cityList": sorted(g["Cidade"].dropna().astype(str).unique().tolist()),
            "dddList": sorted([int(x) for x in pd.to_numeric(g["DDD"], errors="coerce").dropna().unique().tolist()]),
            "performance": perf_obj(g),
            "productStats": product_stats(g),
        })

    group_summaries = []
    for group, g in df.groupby("GR_ATUAL", sort=True):
        perf = perf_obj(g)
        idx = performance_index(perf)
        ps = product_stats(g)
        worst = min(ps.items(), key=lambda kv: (kv[1]["productivePct"] if kv[1]["productivePct"] is not None else 999))[0]
        problem_stores = 0
        for _, row in g.iterrows():
            vals = [number(row[col]) for _, col in METRICS.values()]
            if any(v is not None and v < 0.80 for v in vals):
                problem_stores += 1
        group_summaries.append({
            "name": str(group),
            "stores": int(g["CODIGO\nAGENTE"].nunique()),
            "cities": int(g["Cidade"].nunique()),
            "gns": int(g["GN_ATUAL"].nunique()),
            "gfs": int(g["GF_ATUAL"].nunique()),
            "gts": int(g["GT_ATUAL"].nunique()),
            "dddList": sorted([int(x) for x in pd.to_numeric(g["DDD"], errors="coerce").dropna().unique().tolist()]),
            "gnNames": sorted(g["GN_ATUAL"].dropna().astype(str).unique().tolist()),
            "gfNames": sorted(g["GF_ATUAL"].dropna().astype(str).unique().tolist()),
            "gtNames": sorted(g["GT_ATUAL"].dropna().astype(str).unique().tolist()),
            "cityList": sorted(g["Cidade"].dropna().astype(str).unique().tolist()),
            "storeCodes": g["CODIGO\nAGENTE"].astype(str).tolist(),
            "performance": perf,
            "productStats": ps,
            "performanceIndex": idx,
            "performanceClass": performance_class(idx),
            "worstProduct": worst,
            "problemStores": int(problem_stores),
        })

    ddd_summaries = []
    for ddd, g in df.groupby("DDD", sort=True):
        perf = perf_obj(g)
        idx = performance_index(perf)
        ddd_summaries.append({
            "ddd": int(number(ddd)) if number(ddd) is not None else None,
            "stores": int(g["CODIGO\nAGENTE"].nunique()),
            "cities": int(g["Cidade"].nunique()),
            "gns": int(g["GN_ATUAL"].nunique()),
            "gfs": int(g["GF_ATUAL"].nunique()),
            "gts": int(g["GT_ATUAL"].nunique()),
            "cityList": sorted(g["Cidade"].dropna().astype(str).unique().tolist()),
            "gnNames": sorted(g["GN_ATUAL"].dropna().astype(str).unique().tolist()),
            "gfNames": sorted(g["GF_ATUAL"].dropna().astype(str).unique().tolist()),
            "gtNames": sorted(g["GT_ATUAL"].dropna().astype(str).unique().tolist()),
            "performance": perf,
            "performanceIndex": idx,
            "performanceClass": performance_class(idx),
        })

    city_summaries = []
    for city, g in df.groupby("Cidade", sort=True):
        perf = perf_obj(g)
        idx = performance_index(perf)
        ddds = sorted([int(x) for x in pd.to_numeric(g["DDD"], errors="coerce").dropna().unique().tolist()])
        city_summaries.append({
            "city": str(city),
            "ddd": ddds[0] if len(ddds) == 1 else None,
            "dddList": ddds,
            "stores": int(g["CODIGO\nAGENTE"].nunique()),
            "gns": int(g["GN_ATUAL"].nunique()),
            "gfs": int(g["GF_ATUAL"].nunique()),
            "gts": int(g["GT_ATUAL"].nunique()),
            "groups": int(g["GR_ATUAL"].nunique()),
            "gnNames": sorted(g["GN_ATUAL"].dropna().astype(str).unique().tolist()),
            "gfNames": sorted(g["GF_ATUAL"].dropna().astype(str).unique().tolist()),
            "gtNames": sorted(g["GT_ATUAL"].dropna().astype(str).unique().tolist()),
            "performance": perf,
            "performanceIndex": idx,
            "performanceClass": performance_class(idx),
        })

    cargo_counts = {}
    for gn in gns_out:
        cargo_counts[gn["cargo"]] = cargo_counts.get(gn["cargo"], 0) + 1

    perf_channel = perf_obj(df)

    largest = max(gns_out, key=lambda x: x["stores"])
    widest = max(gns_out, key=lambda x: x["cities"])
    route_max = max(gns_out, key=lambda x: x["routePreviewKm"])
    weakest = min(gns_out, key=lambda x: x["productiveAvg"])
    vacants = sum(1 for x in gns_out if x["cargo"] == "Vago")

    out = {
        "meta": {
            "title": "Canal 360 • Agente Autorizado",
            "period": period,
            "sourceNote": f"{GNS.name} + {carteira_path.name}",
            "carteiraFile": carteira_path.name,
            "routeNote": "Circuito geográfico de protótipo por proximidade entre lojas (Haversine). Não representa KM viário nem KM realizado.",
        },
        "kpis": {
            "gts": int(df["GT_ATUAL"].nunique()),
            "gfs": int(df["GF_ATUAL"].nunique()),
            "gns": int(df["GN_ATUAL"].nunique()),
            "stores": int(df["CODIGO\nAGENTE"].nunique()),
            "cities": int(df["Cidade"].nunique()),
            "ddds": int(df["DDD"].nunique()),
            "groups": int(df["GR_ATUAL"].nunique()),
        },
        "cargoDistribution": [{"name": k, "value": v} for k, v in sorted(cargo_counts.items())],
        "performance": perf_channel,
        "productSummaries": product_stats(df),
        "groupSummaries": group_summaries,
        "dddSummaries": ddd_summaries,
        "citySummaries": city_summaries,
        "gts": gts_out,
        "gfs": gfs_out,
        "gns": gns_out,
        "stores": stores,
        "highlights": [
            {"type": "info", "title": "Maior carteira", "value": f"{largest['name']} • {largest['stores']} lojas"},
            {"type": "info", "title": "Maior cobertura em cidades", "value": f"{widest['name']} • {widest['cities']} cidades"},
            {"type": "warn", "title": "Menor média de lojas produtivas", "value": f"{weakest['name']} • {weakest['productiveAvg']}%"},
            {"type": "route", "title": "Maior circuito geográfico (prévia)", "value": f"{route_max['name']} • {route_max['routePreviewKm']} km"},
            {"type": "warn", "title": "Posições identificadas como vago", "value": f"{vacants} GNs"},
        ],
        "methodology": {
            "officialStatuses": [
                {"name": "Zerado", "rule": "0%", "description": "Sem atingimento no indicador."},
                {"name": "Crítico", "rule": "1% a 49%", "description": "Muito abaixo do objetivo."},
                {"name": "Baixa Performance", "rule": "50% a 79%", "description": "Abaixo do objetivo."},
                {"name": "Oportunidade", "rule": "80% a 99%", "description": "Próximo da meta."},
                {"name": "Produtivo", "rule": "≥ 100%", "description": "Atingiu ou superou a meta."}
            ],
            "highPerformance": "Sinalizador visual provisório do protótipo para atingimento ≥120%. Não é um status oficial da base.",
            "productivePct": "% lojas produtivas = lojas com atingimento ≥100% ÷ lojas com dado válido × 100.",
            "comparativeIndex": "Média simples do % de lojas produtivas em BL, TV, Pós, Conta e Controle, sem pesos."
        },
        "futureIntegrations": [
            {"name": "KM Planejamento", "description": "KM mensal realizado/planejado por GN e/ou GF."},
            {"name": "App de Visitas", "description": "Cobertura de lojas, frequência, recência e execução de visitas."},
            {"name": "Serviços", "description": "Proteção Móvel, Parcelex, Claro Up, Claro Troca e demais adesões."},
            {"name": "Rota viária", "description": "Sequência e KM por ruas/rodovias a partir do endereço/base do GN ou circuito entre lojas."},
        ],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    print(f"Gerado: {OUT}")
    print(f"Periodo: {period}")
    print(out["kpis"])


if __name__ == "__main__":
    main()
