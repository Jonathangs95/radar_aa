from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import tempfile
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "dados_fontes"
OUT = ROOT / "demo" / "data" / "channel-data.json"

CARTEIRA_EXTENSIONS = {".xlsb", ".xlsx"}
GNS_FILES = ("GNS_Analise_v2.xlsx", "GNS_Analise.xlsx")
CIDADES_SPI = DATA_DIR / "CIDADES_SPI.xlsx"
MUNICIPIOS = DATA_DIR / "municipios.csv"

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

METRICS = {
    "bl": {"label": "Banda Larga", "sheet": "BASE_BL", "target": "BL"},
    "tv": {"label": "TV", "sheet": "BASE_TV", "target": "TV"},
    "pos": {"label": "Pós Total", "sheet": "POS_TOTAL", "target": "POS_TOTAL"},
    "conta": {"label": "Conta", "sheet": "BASE_CONTA", "target": "CONTA"},
    "controle": {"label": "Controle", "sheet": "BASE_CONTROLE", "target": "CONTROLE"},
}

EXCEPTION_NAO_CABO = "Exceção Não Cabo"
STATUS_ORDER = ("Zerado", "Crítico", "Baixa Performance", "Oportunidade", "Produtivo", EXCEPTION_NAO_CABO)

GF_PHOTOS = {
    "EDUARDO ALVES DE QUEIROZ": "fotos/eduardo_alves_de_queiroz.png",
    "HELBER EMILIANO ZAROS": "fotos/helber_emiliano_zaros.png",
    "RAFAEL SILVEIRA DE CARVALHO": "fotos/rafael_silveira_de_carvalho.png",
    "VIVIANE TANGARI LEMOS PONTES": "fotos/viviane_tangari_lemos_pontes.png",
}

READ_SNAPSHOTS = {}


def normalize_text(text):
    return unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode("ascii")


def normalize_token(text):
    return normalize_text(text).lower()


def normalized_person_name(name):
    return " ".join(str(name or "").strip().upper().split())


def gf_photo_file(name):
    return GF_PHOTOS.get(normalized_person_name(name))


def normalize_code(value):
    if pd.isna(value):
        return ""
    if isinstance(value, (int, np.integer)):
        return str(int(value)).strip().upper()
    if isinstance(value, (float, np.floating)):
        return "" if math.isnan(float(value)) else str(int(value)).strip().upper()
    text = str(value).strip().upper()
    text = re.sub(r"\.0$", "", text)
    return text


def clean_label(value, default="Não informado"):
    if pd.isna(value):
        return default
    text = " ".join(str(value or "").strip().split())
    if not text or text.lower() in {"nan", "none", ".", "-"}:
        return default
    return text


def is_non_cabo(value):
    token = normalize_text(clean_label(value, "")).upper()
    token = re.sub(r"[^A-Z0-9]+", " ", token)
    return "NAO CABO" in token or token in {"NAOCABO", "NAO"}


def first_existing(df, candidates):
    normalized = {normalize_token(c).replace(" ", "").replace("_", ""): c for c in df.columns}
    for candidate in candidates:
        key = normalize_token(candidate).replace(" ", "").replace("_", "")
        if key in normalized:
            return normalized[key]
    return None


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
            raise FileNotFoundError(f"Carteira informada não encontrada: {path}")
        if path.suffix.lower() not in CARTEIRA_EXTENSIONS:
            raise ValueError("A carteira precisa estar em .xlsb ou .xlsx")
        return path

    candidates = find_carteira_files()
    if not candidates:
        raise FileNotFoundError("Nenhuma carteira encontrada em dados_fontes com padrão carteira_*.xlsb ou carteira_*.xlsx")
    return candidates[-1].resolve()


def resolve_gns_path(value=None):
    if value:
        path = Path(value)
        if not path.is_absolute():
            path = ROOT / path
        path = path.resolve()
        if not path.exists():
            raise FileNotFoundError(f"Base GNS informada não encontrada: {path}")
        return path

    for name in GNS_FILES:
        path = DATA_DIR / name
        if path.exists():
            return path.resolve()
    raise FileNotFoundError(f"Nenhuma base GNS encontrada. Esperado: {', '.join(GNS_FILES)}")


def read_excel(path, **kwargs):
    path = Path(path)
    if path.suffix.lower() == ".xlsb":
        kwargs.setdefault("engine", "pyxlsb")
    try:
        return pd.read_excel(path, **kwargs)
    except PermissionError:
        key = str(path.resolve())
        if key not in READ_SNAPSHOTS:
            snapshot = Path(tempfile.gettempdir()) / f"canal360_read_{path.name}"
            shutil.copy2(path, snapshot)
            READ_SNAPSHOTS[key] = snapshot
            print(f"Arquivo bloqueado em leitura; usando cópia temporária: {snapshot}")
        return pd.read_excel(READ_SNAPSHOTS[key], **kwargs)


def read_carteira(path):
    return read_excel(path, sheet_name="carteira")


def number(value):
    if pd.isna(value):
        return None
    if isinstance(value, (int, float, np.integer, np.floating)):
        x = float(value)
        return None if math.isnan(x) else x
    text = str(value).strip()
    if not text:
        return None
    is_pct = "%" in text
    text = text.replace("%", "").replace(" ", "")
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(",", ".")
    try:
        x = float(text)
    except ValueError:
        return None
    return x / 100 if is_pct else x


def status_from_pct(value):
    x = number(value)
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


def build_status_rules(param):
    rules = []
    for _, row in param.iloc[1:6, :3].iterrows():
        name = clean_label(row.iloc[0], "")
        if not name:
            continue
        min_v = number(row.iloc[1])
        max_v = number(row.iloc[2])
        if name.upper() == "ZERADO":
            rule = "0%"
        elif max_v is None:
            rule = f"≥ {round(min_v * 100)}%" if min_v is not None else ""
        else:
            rule = f"{round(min_v * 100)}% a {round(max_v * 100)}%"
        rules.append({"name": name, "rule": rule, "description": status_description(name)})
    return rules


def status_description(name):
    return {
        "ZERADO": "Sem atingimento no indicador.",
        "CRITICO": "Muito abaixo do objetivo.",
        "BAIXA PERFORMANCE": "Abaixo do objetivo.",
        "OPORTUNIDADE": "Próximo da meta.",
        "PRODUTIVO": "Atingiu ou superou a meta.",
    }.get(normalize_text(name).upper(), "")


def parse_targets(param):
    header_row = param.index[param.iloc[:, 0].astype(str).str.upper().eq("CLASSIFICACAO")]
    if len(header_row) == 0:
        raise ValueError("Não encontrei a tabela de metas na aba PARAMETRO.")
    start = int(header_row[0])
    target = param.iloc[start + 1 :, :8].copy()
    target.columns = [str(c).strip() for c in param.iloc[start, :8].tolist()]
    target = target.dropna(subset=["CHAVE"])
    target["CHAVE_KEY"] = target["CHAVE"].map(lambda x: clean_label(x, "").upper())
    out = {}
    for _, row in target.iterrows():
        out[row["CHAVE_KEY"]] = {m["target"]: number(row.get(m["target"])) for m in METRICS.values()}
    return out


def month_columns(df):
    out = []
    for col in df.columns:
        text = str(col).strip()
        if re.fullmatch(r"20\d{4}", text):
            out.append(text)
    return out


def detect_month(base_frames, requested=None):
    available = set(detect_months(base_frames))
    if not available:
        raise ValueError("Nenhuma coluna de mês no formato AAAAMM foi encontrada nas bases de produto.")
    if requested:
        month = str(requested).strip()
        if month not in available:
            raise ValueError(f"Mês {month} não encontrado nas bases. Disponíveis: {', '.join(sorted(available))}")
        return month
    return max(available)


def detect_months(base_frames):
    available = set()
    for df in base_frames.values():
        available.update(month_columns(df))
    return sorted(available)


def read_product_bases(gns_path):
    frames = {}
    for metric in METRICS.values():
        df = read_excel(gns_path, sheet_name=metric["sheet"])
        df.columns = [str(c).strip() for c in df.columns]
        if "CODIGO_AGENTE" not in df.columns:
            raise ValueError(f"Aba {metric['sheet']} precisa ter a coluna CODIGO_AGENTE.")
        df["CODE_KEY"] = df["CODIGO_AGENTE"].map(normalize_code)
        frames[metric["sheet"]] = df
    return frames


def build_realized_maps(base_frames, months):
    maps = {}
    for metric in METRICS.values():
        df = base_frames[metric["sheet"]].copy()
        maps[metric["target"]] = {}
        for month in months:
            month_col = next((c for c in df.columns if str(c).strip() == month), None)
            if month_col is None:
                maps[metric["target"]][month] = {}
                continue
            values = pd.to_numeric(df[month_col], errors="coerce").fillna(0)
            maps[metric["target"]][month] = values.groupby(df["CODE_KEY"]).sum().to_dict()
    return maps


def read_cidade_coords():
    if not MUNICIPIOS.exists():
        return pd.DataFrame(columns=["IBGE_KEY", "LAT", "LONG"])
    mun = pd.read_csv(MUNICIPIOS)
    ibge_col = first_existing(mun, ["codigo_ibge", "IBGE"])
    lat_col = first_existing(mun, ["latitude", "LAT"])
    lon_col = first_existing(mun, ["longitude", "LONG", "longitude"])
    if not ibge_col or not lat_col or not lon_col:
        return pd.DataFrame(columns=["IBGE_KEY", "LAT", "LONG"])
    coords = mun[[ibge_col, lat_col, lon_col]].copy()
    coords.columns = ["IBGE_KEY", "LAT", "LONG"]
    coords["IBGE_KEY"] = coords["IBGE_KEY"].map(normalize_code)
    coords["LAT"] = pd.to_numeric(coords["LAT"], errors="coerce")
    coords["LONG"] = pd.to_numeric(coords["LONG"], errors="coerce")
    return coords.dropna(subset=["IBGE_KEY"]).drop_duplicates("IBGE_KEY", keep="last")


def read_regional_cities():
    if not CIDADES_SPI.exists():
        return pd.DataFrame()
    cities = read_excel(CIDADES_SPI, sheet_name="municipios")
    cities.columns = [str(c).strip() for c in cities.columns]
    ibge_col = first_existing(cities, ["IBGE"])
    if ibge_col:
        cities["IBGE_KEY"] = cities[ibge_col].map(normalize_code)
    return cities


def metric_month_result(code, store_type, target_col, target, realized_map):
    is_xpto = str(code).startswith("XPTO")
    non_cabo = is_non_cabo(store_type)
    realized = number(realized_map.get(code))
    if realized is None and target is not None and not is_xpto:
        realized = 0.0

    if is_xpto and code not in realized_map:
        pct = None
    elif target is None or target <= 0 or realized is None:
        pct = None
    else:
        pct = realized / target

    exception = None
    eligible = True
    if non_cabo and target_col in {"BL", "TV"} and realized == 0:
        exception = "Não Cabo"
        if target_col == "BL":
            eligible = False

    status = EXCEPTION_NAO_CABO if target_col == "BL" and exception else status_from_pct(pct)
    return {
        "realized": realized,
        "target": target,
        "pct": pct,
        "status": status,
        "exception": exception,
        "eligible": eligible,
    }


def prepare_dataframe(carteira_path, gns_path, month):
    cart = read_carteira(carteira_path)
    dados = read_excel(gns_path, sheet_name="DADOS")
    param = read_excel(gns_path, sheet_name="PARAMETRO", header=None)
    base_frames = read_product_bases(gns_path)
    month = detect_month(base_frames, month)
    realized_maps = build_realized_maps(base_frames, [month])
    targets = parse_targets(param)

    cart.columns = [str(c).strip() for c in cart.columns]
    dados.columns = [str(c).strip() for c in dados.columns]
    required_cart = [
        "Amdocs",
        "GR",
        "Cidade",
        "Nome GN",
        "Nome Gerente Filial",
        "DDD PDV",
        "TERR",
        "Territorio",
        "IBGE",
        "Tipo Cabo",
        "CARGO GN",
        "Nome Loja",
    ]
    missing = [col for col in required_cart if col not in cart.columns]
    if missing:
        raise ValueError(f"Colunas ausentes na carteira selecionada: {missing}")
    if "CODIGO_AGENTE" not in dados.columns:
        raise ValueError("A aba DADOS precisa ter a coluna CODIGO_AGENTE.")

    cart["CODE_KEY"] = cart["Amdocs"].map(normalize_code)
    dados["CODE_KEY"] = dados["CODIGO_AGENTE"].map(normalize_code)
    cart = cart[cart["CODE_KEY"] != ""].drop_duplicates("CODE_KEY", keep="last")
    dados = dados.drop_duplicates("CODE_KEY", keep="last")

    dados_cols = [
        "CODE_KEY",
        "CODIGO_AGENTE",
        "GR",
        "Cidade",
        "DDD",
        "GN",
        "GF",
        "POP",
        "TIPO",
        "IBGE",
        "CLASSIFICACAO",
        "CHAVE",
    ]
    for col in dados_cols:
        if col not in dados.columns:
            dados[col] = np.nan
    dados_join = dados[dados_cols].rename(columns={col: f"{col}_dados" for col in dados_cols if col != "CODE_KEY"})
    df = cart.merge(dados_join, on="CODE_KEY", how="left")

    df["CODIGO_FINAL"] = df["CODE_KEY"]
    df["GR_ATUAL"] = df["GR"].combine_first(df["GR_dados"]).map(clean_label)
    df["CIDADE_ATUAL"] = df["Cidade"].combine_first(df["Cidade_dados"]).map(clean_label)
    df["DDD_ATUAL"] = df["DDD PDV"].combine_first(df["DDD_dados"])
    df["GN_ATUAL"] = df["Nome GN"].combine_first(df["GN_dados"]).map(clean_label)
    df["GF_ATUAL"] = df["Nome Gerente Filial"].combine_first(df["GF_dados"]).map(clean_label)
    df["GT_ATUAL"] = df["TERR"].map(clean_label)
    df["TERRITORIO_ATUAL"] = df["Territorio"].map(clean_label)
    df["IBGE_FINAL"] = df["IBGE"].combine_first(df["IBGE_dados"])
    df["IBGE_KEY"] = df["IBGE_FINAL"].map(normalize_code)
    df["TIPO_ATUAL"] = df["Tipo Cabo"].combine_first(df["TIPO_dados"]).map(clean_label)
    df["CHAVE_ATUAL"] = df["CHAVE_dados"].map(lambda x: clean_label(x, "").upper())

    coords = read_cidade_coords()
    if len(coords):
        df = df.merge(coords, on="IBGE_KEY", how="left")
    else:
        df["LAT"] = np.nan
        df["LONG"] = np.nan

    for key, metric in METRICS.items():
        target_col = metric["target"]
        df[f"META_{target_col}"] = df["CHAVE_ATUAL"].map(lambda chave: targets.get(chave, {}).get(target_col))

        realized_values = []
        pct_values = []
        status_values = []
        exception_values = []
        eligible_values = []
        for _, row in df.iterrows():
            code = str(row["CODE_KEY"])
            target = number(row[f"META_{target_col}"])
            current = metric_month_result(code, row["TIPO_ATUAL"], target_col, target, realized_maps[target_col].get(month, {}))
            realized_values.append(current["realized"])
            pct_values.append(current["pct"])
            status_values.append(current["status"])
            exception_values.append(current["exception"])
            eligible_values.append(current["eligible"])
        df[f"REAL_{target_col}"] = realized_values
        df[f"PCT_{target_col}"] = pct_values
        df[f"STATUS_{target_col}"] = status_values
        df[f"EXCEPTION_{target_col}"] = exception_values
        df[f"ELIGIBLE_{target_col}"] = eligible_values

    return df, param, read_regional_cities(), month


def status_counts(status_series, eligible_series=None, pct_series=None):
    out = {name: 0 for name in STATUS_ORDER}
    status_values = list(status_series)
    eligible_values = list(eligible_series) if eligible_series is not None else [True] * len(status_values)
    pct_values = list(pct_series) if pct_series is not None else [None] * len(status_values)
    valid = 0
    for st, eligible, pct in zip(status_values, eligible_values, pct_values):
        if pd.isna(st) or st == "Sem dado":
            continue
        if st == EXCEPTION_NAO_CABO:
            out[EXCEPTION_NAO_CABO] += 1
            continue
        if not eligible:
            continue
        valid += 1
        if st in out:
            out[st] += 1
    out["Baixa + Crítico"] = out["Crítico"] + out["Baixa Performance"]
    out["Com dado"] = valid
    return out


def pct_productive(series, eligible_series=None):
    raw_values = list(series)
    eligible_values = list(eligible_series) if eligible_series is not None else [True] * len(raw_values)
    values = [number(v) for v, eligible in zip(raw_values, eligible_values) if eligible]
    values = [v for v in values if v is not None and math.isfinite(float(v))]
    if not values:
        return None
    return round(sum(v >= 1 for v in values) / len(values) * 100, 1)


def perf_obj(df):
    out = {}
    for key, metric in METRICS.items():
        pct_col = f"PCT_{metric['target']}"
        eligible_col = f"ELIGIBLE_{metric['target']}"
        values = [number(v) for v, eligible in zip(df[pct_col], df[eligible_col]) if eligible]
        values = [v for v in values if v is not None and math.isfinite(float(v))]
        avg = round(float(np.mean(values)) * 100, 1) if values else None
        out[key] = {
            "label": metric["label"],
            "productivePct": pct_productive(df[pct_col], df[eligible_col]),
            "avgAttainmentPct": avg,
        }
    return out


def product_stats(df):
    result = {}
    perf = perf_obj(df)
    for key, metric in METRICS.items():
        pct_col = f"PCT_{metric['target']}"
        status_col = f"STATUS_{metric['target']}"
        eligible_col = f"ELIGIBLE_{metric['target']}"
        exception_col = f"EXCEPTION_{metric['target']}"
        result[key] = {
            "label": metric["label"],
            "counts": status_counts(df[status_col], df[eligible_col], df[pct_col]),
            "productivePct": pct_productive(df[pct_col], df[eligible_col]),
            "avgAttainmentPct": perf[key]["avgAttainmentPct"],
            "exceptionCount": int(df[exception_col].notna().sum()),
        }
    return result


def performance_index(perf):
    values = [m.get("productivePct") for m in perf.values() if m.get("productivePct") is not None]
    return round(float(np.mean(values)), 1) if values else None


def performance_class(index):
    if index is None:
        return "Sem dado"
    if index >= 80:
        return "Boa"
    if index >= 60:
        return "Intermediária"
    return "Atenção"


def short_cargo(cargo):
    text = str(cargo or "").upper()
    if text == "VAGO":
        return "Vago"
    if text.endswith(" III"):
        return "Cargo III"
    if text.endswith(" II"):
        return "Cargo II"
    if text.endswith(" I"):
        return "Cargo I"
    return str(cargo or "Não informado")


def initials(name):
    bits = [x for x in str(name).replace("(", " ").split() if x and not x.startswith("DDD")]
    if not bits:
        return "?"
    if len(bits) == 1:
        return bits[0][:2].upper()
    return (bits[0][0] + bits[-1][0]).upper()


def haversine(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def greedy_route(rows):
    pts = []
    for row in rows:
        lat = number(row.get("LAT"))
        lon = number(row.get("LONG"))
        if lat is not None and lon is not None:
            pts.append({"code": str(row.get("CODIGO_FINAL")), "city": str(row.get("CIDADE_ATUAL")), "lat": lat, "lon": lon})
    if len(pts) < 2:
        return pts, 0.0

    start = min(range(len(pts)), key=lambda i: pts[i]["lon"])
    order = [pts.pop(start)]
    dist = 0.0
    while pts:
        current = order[-1]
        next_idx = min(range(len(pts)), key=lambda i: haversine(current["lat"], current["lon"], pts[i]["lat"], pts[i]["lon"]))
        next_pt = pts.pop(next_idx)
        dist += haversine(current["lat"], current["lon"], next_pt["lat"], next_pt["lon"])
        order.append(next_pt)
    if len(order) > 2:
        dist += haversine(order[-1]["lat"], order[-1]["lon"], order[0]["lat"], order[0]["lon"])
    return order, dist


def store_has_problem(row):
    for metric in METRICS.values():
        value = number(row[f"PCT_{metric['target']}"])
        if value is not None and value < 0.80:
            return True
    return False


def ddd_list(series):
    return sorted([int(x) for x in pd.to_numeric(series, errors="coerce").dropna().unique().tolist()])


def non_empty_strings(series):
    return sorted(series.dropna().map(clean_label).loc[lambda s: s != "Não informado"].unique().tolist())


def make_stores(df, month):
    stores = []
    for _, row in df.iterrows():
        performance = {}
        for key, metric in METRICS.items():
            target_col = metric["target"]
            pct = number(row[f"PCT_{target_col}"])
            realized = number(row[f"REAL_{target_col}"])
            target = number(row[f"META_{target_col}"])
            eligible = bool(row[f"ELIGIBLE_{target_col}"])
            exception = row[f"EXCEPTION_{target_col}"] if not pd.isna(row[f"EXCEPTION_{target_col}"]) else None
            performance[key] = {
                "label": metric["label"],
                "value": None if pct is None else round(pct * 100, 1),
                "realized": None if realized is None else round(realized, 2),
                "target": None if target is None else round(target, 2),
                "status": row[f"STATUS_{target_col}"],
                "exception": exception,
                "exceptionLabel": exception,
                "productiveEligible": eligible,
                "month": month,
            }
        stores.append(
            {
                "code": str(row["CODIGO_FINAL"]),
                "name": clean_label(row.get("Nome Loja"), str(row["CODIGO_FINAL"])),
                "group": clean_label(row["GR_ATUAL"]),
                "city": clean_label(row["CIDADE_ATUAL"]),
                "ddd": int(number(row["DDD_ATUAL"])) if number(row["DDD_ATUAL"]) is not None else None,
                "gn": clean_label(row["GN_ATUAL"]),
                "gf": clean_label(row["GF_ATUAL"]),
                "gt": clean_label(row["GT_ATUAL"]),
                "territory": clean_label(row["TERRITORIO_ATUAL"]),
                "address": clean_label(row.get("NM_EQUIPE_VENDA"), ""),
                "lat": number(row["LAT"]),
                "lon": number(row["LONG"]),
                "type": clean_label(row["TIPO_ATUAL"]),
                "ibge": str(row["IBGE_KEY"]),
                "performance": performance,
            }
        )
    return stores


def build_summaries(df):
    gns_out = []
    for gn, group in df.groupby("GN_ATUAL", sort=True):
        perf = perf_obj(group)
        route, route_km = greedy_route(group.to_dict("records"))
        productive_values = [m["productivePct"] for m in perf.values() if m["productivePct"] is not None]
        cargo_mode = group["CARGO GN"].dropna().mode()
        cargo_raw = cargo_mode.iloc[0] if len(cargo_mode) else "Não informado"
        gns_out.append(
            {
                "name": str(gn),
                "initials": initials(gn),
                "photoFile": None,
                "gf": str(group["GF_ATUAL"].dropna().iloc[0]),
                "gt": str(group["GT_ATUAL"].dropna().iloc[0]),
                "cargo": short_cargo(cargo_raw),
                "cargoRaw": str(cargo_raw),
                "stores": int(group["CODIGO_FINAL"].nunique()),
                "cities": int(group["CIDADE_ATUAL"].nunique()),
                "ddds": int(pd.to_numeric(group["DDD_ATUAL"], errors="coerce").nunique()),
                "groups": int(group["GR_ATUAL"].nunique()),
                "cityList": non_empty_strings(group["CIDADE_ATUAL"]),
                "dddList": ddd_list(group["DDD_ATUAL"]),
                "performance": perf,
                "productStats": product_stats(group),
                "productiveAvg": round(float(np.mean(productive_values)), 1) if productive_values else None,
                "routePreviewKm": round(route_km, 1),
                "routePreview": route,
                "storeCodes": group["CODIGO_FINAL"].astype(str).tolist(),
            }
        )

    gfs_out = []
    for gf, group in df.groupby("GF_ATUAL", sort=True):
        gt_names = non_empty_strings(group["GT_ATUAL"])
        gn_names = non_empty_strings(group["GN_ATUAL"])
        gfs_out.append(
            {
                "name": str(gf),
                "initials": initials(gf),
                "photoFile": gf_photo_file(gf),
                "gt": gt_names[0] if len(gt_names) == 1 else "Múltiplos",
                "gtNames": gt_names,
                "gns": len(gn_names),
                "stores": int(group["CODIGO_FINAL"].nunique()),
                "cities": int(group["CIDADE_ATUAL"].nunique()),
                "ddds": int(pd.to_numeric(group["DDD_ATUAL"], errors="coerce").nunique()),
                "groups": int(group["GR_ATUAL"].nunique()),
                "gnNames": gn_names,
                "cityList": non_empty_strings(group["CIDADE_ATUAL"]),
                "dddList": ddd_list(group["DDD_ATUAL"]),
                "performance": perf_obj(group),
                "productStats": product_stats(group),
            }
        )

    gts_out = []
    for gt, group in df.groupby("GT_ATUAL", sort=True):
        gf_names = non_empty_strings(group["GF_ATUAL"])
        gn_names = non_empty_strings(group["GN_ATUAL"])
        gts_out.append(
            {
                "name": str(gt),
                "initials": initials(gt),
                "gfs": len(gf_names),
                "gns": len(gn_names),
                "stores": int(group["CODIGO_FINAL"].nunique()),
                "cities": int(group["CIDADE_ATUAL"].nunique()),
                "ddds": int(pd.to_numeric(group["DDD_ATUAL"], errors="coerce").nunique()),
                "groups": int(group["GR_ATUAL"].nunique()),
                "gfNames": gf_names,
                "gnNames": gn_names,
                "cityList": non_empty_strings(group["CIDADE_ATUAL"]),
                "dddList": ddd_list(group["DDD_ATUAL"]),
                "performance": perf_obj(group),
                "productStats": product_stats(group),
            }
        )

    group_summaries = []
    for group_name, group in df.groupby("GR_ATUAL", sort=True):
        perf = perf_obj(group)
        idx = performance_index(perf)
        ps = product_stats(group)
        worst = min(ps.items(), key=lambda kv: (kv[1]["productivePct"] if kv[1]["productivePct"] is not None else 999))[0]
        group_summaries.append(
            {
                "name": str(group_name),
                "stores": int(group["CODIGO_FINAL"].nunique()),
                "cities": int(group["CIDADE_ATUAL"].nunique()),
                "gns": int(group["GN_ATUAL"].nunique()),
                "gfs": int(group["GF_ATUAL"].nunique()),
                "gts": int(group["GT_ATUAL"].nunique()),
                "dddList": ddd_list(group["DDD_ATUAL"]),
                "gnNames": non_empty_strings(group["GN_ATUAL"]),
                "gfNames": non_empty_strings(group["GF_ATUAL"]),
                "gtNames": non_empty_strings(group["GT_ATUAL"]),
                "cityList": non_empty_strings(group["CIDADE_ATUAL"]),
                "storeCodes": group["CODIGO_FINAL"].astype(str).tolist(),
                "performance": perf,
                "productStats": ps,
                "performanceIndex": idx,
                "performanceClass": performance_class(idx),
                "worstProduct": worst,
                "problemStores": int(group.apply(store_has_problem, axis=1).sum()),
            }
        )

    ddd_summaries = []
    for ddd, group in df.groupby("DDD_ATUAL", sort=True):
        perf = perf_obj(group)
        idx = performance_index(perf)
        ddd_summaries.append(
            {
                "ddd": int(number(ddd)) if number(ddd) is not None else None,
                "stores": int(group["CODIGO_FINAL"].nunique()),
                "cities": int(group["CIDADE_ATUAL"].nunique()),
                "gns": int(group["GN_ATUAL"].nunique()),
                "gfs": int(group["GF_ATUAL"].nunique()),
                "gts": int(group["GT_ATUAL"].nunique()),
                "cityList": non_empty_strings(group["CIDADE_ATUAL"]),
                "gnNames": non_empty_strings(group["GN_ATUAL"]),
                "gfNames": non_empty_strings(group["GF_ATUAL"]),
                "gtNames": non_empty_strings(group["GT_ATUAL"]),
                "performance": perf,
                "performanceIndex": idx,
                "performanceClass": performance_class(idx),
            }
        )

    city_summaries = []
    for city, group in df.groupby("CIDADE_ATUAL", sort=True):
        perf = perf_obj(group)
        idx = performance_index(perf)
        ddds = ddd_list(group["DDD_ATUAL"])
        city_summaries.append(
            {
                "city": str(city),
                "ddd": ddds[0] if len(ddds) == 1 else None,
                "dddList": ddds,
                "stores": int(group["CODIGO_FINAL"].nunique()),
                "gns": int(group["GN_ATUAL"].nunique()),
                "gfs": int(group["GF_ATUAL"].nunique()),
                "gts": int(group["GT_ATUAL"].nunique()),
                "groups": int(group["GR_ATUAL"].nunique()),
                "gnNames": non_empty_strings(group["GN_ATUAL"]),
                "gfNames": non_empty_strings(group["GF_ATUAL"]),
                "gtNames": non_empty_strings(group["GT_ATUAL"]),
                "performance": perf,
                "performanceIndex": idx,
                "performanceClass": performance_class(idx),
            }
        )

    return gns_out, gfs_out, gts_out, group_summaries, ddd_summaries, city_summaries


def build_coverage(df, regional_cities):
    if regional_cities is None or regional_cities.empty or "IBGE_KEY" not in regional_cities.columns:
        return None
    regional_ibge = {x for x in regional_cities["IBGE_KEY"].map(normalize_code) if x}
    channel_ibge = {x for x in df["IBGE_KEY"].map(normalize_code) if x}
    return {
        "regionalCities": len(regional_ibge),
        "channelCities": len(channel_ibge & regional_ibge),
        "regionalCitiesWithoutStore": max(len(regional_ibge - channel_ibge), 0),
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Gera o JSON do Canal 360 a partir das bases de dados.")
    parser.add_argument("--carteira", default=None, help="Arquivo da carteira em .xlsb ou .xlsx.")
    parser.add_argument("--gns", default=None, help="Arquivo GNS_Analise em .xlsx.")
    parser.add_argument("--mes", default=None, help="Mês de cálculo no formato AAAAMM. Se vazio, usa o mês mais recente.")
    return parser.parse_args()


def main():
    args = parse_args()
    carteira_path = resolve_carteira_path(args.carteira)
    gns_path = resolve_gns_path(args.gns)
    df, param, regional_cities, month = prepare_dataframe(carteira_path, gns_path, args.mes)

    period = f"Carteira {carteira_month(carteira_path)} • Dados {month}"
    stores = make_stores(df, month)
    gns_out, gfs_out, gts_out, group_summaries, ddd_summaries, city_summaries = build_summaries(df)

    cargo_counts = {}
    for gn in gns_out:
        cargo_counts[gn["cargo"]] = cargo_counts.get(gn["cargo"], 0) + 1

    perf_channel = perf_obj(df)
    largest = max(gns_out, key=lambda x: x["stores"])
    widest = max(gns_out, key=lambda x: x["cities"])
    route_max = max(gns_out, key=lambda x: x["routePreviewKm"])
    weakest = min(gns_out, key=lambda x: x["productiveAvg"] if x["productiveAvg"] is not None else 999)
    vacants = sum(1 for x in gns_out if x["cargo"] == "Vago")
    xpto_count = int(df["CODIGO_FINAL"].astype(str).str.startswith("XPTO").sum())

    out = {
        "meta": {
            "title": "Canal 360 • Agente Autorizado",
            "period": period,
            "dataMonth": month,
            "sourceNote": f"{gns_path.name} + {carteira_path.name}",
            "carteiraFile": carteira_path.name,
            "routeNote": "Circuito geográfico de protótipo por proximidade entre lojas (Haversine). Não representa KM viário nem KM realizado.",
            "coverage": build_coverage(df, regional_cities),
            "pendingProductsNote": "Arquivos em dados_fontes/produtos ainda não foram integrados nesta etapa.",
        },
        "kpis": {
            "gts": int(df["GT_ATUAL"].nunique()),
            "gfs": int(df["GF_ATUAL"].nunique()),
            "gns": int(df["GN_ATUAL"].nunique()),
            "stores": int(df["CODIGO_FINAL"].nunique()),
            "cities": int(df["CIDADE_ATUAL"].nunique()),
            "ddds": int(pd.to_numeric(df["DDD_ATUAL"], errors="coerce").nunique()),
            "groups": int(df["GR_ATUAL"].nunique()),
            "xptoStores": xpto_count,
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
            "officialStatuses": build_status_rules(param),
            "productivePct": "% lojas produtivas = lojas com atingimento ≥100% ÷ lojas com dado válido × 100.",
            "comparativeIndex": "Média simples do % de lojas produtivas em BL, TV, Pós, Conta e Controle, sem pesos.",
            "targetRule": "Realizado do mês dividido pela meta da aba PARAMETRO, usando a CHAVE da aba DADOS.",
            "storeUniverse": "A carteira selecionada é o universo oficial de lojas. Códigos XPTO contam como loja e ficam sem dado de produtividade enquanto não existirem nas bases mensais.",
            "nonCaboRule": "Lojas Não Cabo zeradas em BL são identificadas como Exceção Não Cabo e não entram na régua de problema/produtividade de BL. Em TV, a zerada mantém o status oficial e recebe o marcador Não Cabo.",
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
    print(f"Carteira selecionada: {carteira_path}")
    print(f"Base selecionada: {gns_path}")
    print(f"Gerado: {OUT}")
    print(f"Periodo: {period}")
    print(out["kpis"])


if __name__ == "__main__":
    main()
