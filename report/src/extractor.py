"""
Lê os dados exportados do AWS Cost Explorer (CSV) e retorna
DataFrames prontos para os geradores de Excel e PPTX.

Formato do CSV exportado pelo Cost Explorer:
  - Linha 1 : cabeçalho — "Service", "<Serviço1>($)", ..., "Total costs($)"
  - Linha 2 : "Service total" — totais acumulados (ignorada)
  - Linhas 3+: "YYYY-MM-DD" — custo mensal por serviço
"""
from datetime import date
from pathlib import Path

import pandas as pd
from dateutil.relativedelta import relativedelta

MESES_PT = {
    "January": "Janeiro", "February": "Fevereiro", "March": "Março",
    "April": "Abril",     "May": "Maio",            "June": "Junho",
    "July": "Julho",      "August": "Agosto",        "September": "Setembro",
    "October": "Outubro", "November": "Novembro",    "December": "Dezembro",
}


def _month_label(d: date) -> str:
    month_en, year = d.strftime("%B %Y").split(" ")
    return f"{MESES_PT[month_en]} {year}"


def _last_n_month_labels(reference: date, n: int) -> list[str]:
    """Retorna n rótulos de meses terminando no mês de referência (inclusive)."""
    labels = []
    d = date(reference.year, reference.month, 1)
    for i in range(n):
        labels.insert(0, _month_label(d))
        d = d - relativedelta(months=1)
    return labels


def _read_and_transpose(csv_path: Path) -> pd.DataFrame:
    """
    Lê o CSV e retorna DataFrame transposto com:
      - coluna 'Service': nome do serviço (sem '($)')
      - demais colunas: meses em português
    Inclui a linha 'Total costs'.
    """
    df_raw = pd.read_csv(csv_path, encoding="utf-8-sig")

    # Remove linha de totais acumulados
    df_raw = df_raw[df_raw["Service"] != "Service total"].copy()

    # Identifica linhas de meses (YYYY-MM-DD)
    df_raw["_date"] = pd.to_datetime(df_raw["Service"], errors="coerce")
    df_raw = df_raw.dropna(subset=["_date"])
    df_raw["_label"] = df_raw["_date"].dt.date.apply(_month_label)

    # Colunas de serviço — remove sufixo '($)' e espaços extras
    service_cols = [c for c in df_raw.columns if c.endswith("($)")]
    rename_map = {c: c.replace("($)", "").strip() for c in service_cols}
    df_raw = df_raw.rename(columns=rename_map)
    service_names = list(rename_map.values())

    # Converte para numérico
    for col in service_names:
        df_raw[col] = pd.to_numeric(df_raw[col], errors="coerce").fillna(0.0)

    # Transpõe: serviços como linhas, meses como colunas
    df_pivot = df_raw.set_index("_label")[service_names].T
    df_pivot.index.name = "Service"
    return df_pivot.reset_index()


def get_costs_by_service(csv_path: Path, reference: date,
                         n_months: int = 6) -> pd.DataFrame:
    """
    Retorna DataFrame (Service + últimos n_months) SEM a linha Total costs,
    ordenado pelo último mês decrescente.
    """
    df = _read_and_transpose(csv_path)
    month_cols = _last_n_month_labels(reference, n_months)
    available  = [m for m in month_cols if m in df.columns]

    if not available:
        raise ValueError(
            f"Nenhum mês encontrado no CSV para {reference}. "
            f"Disponíveis: {[c for c in df.columns if c != 'Service']}"
        )

    # Remove Total costs — vai para get_total_costs_by_month
    df = df[df["Service"] != "Total costs"].copy()

    # Seleciona colunas e remove serviços com custo zero em todos os meses
    df = df[["Service"] + available].copy()
    df = df[df[available].sum(axis=1) > 0].copy()

    # Arredonda e ordena
    for col in available:
        df[col] = df[col].round(2)

    df = df.sort_values(available[-1], ascending=False).reset_index(drop=True)
    return df


def get_total_costs_by_month(csv_path: Path, reference: date,
                              n_months: int = 6) -> dict:
    """
    Retorna dict {mês_pt: total} com o Total costs dos últimos n_months.
    """
    df = _read_and_transpose(csv_path)
    month_cols = _last_n_month_labels(reference, n_months)
    available  = [m for m in month_cols if m in df.columns]

    row = df[df["Service"] == "Total costs"]
    if row.empty:
        # Se não tiver linha explícita, soma todos os serviços
        df_services = df[df["Service"] != "Total costs"]
        return {m: round(df_services[m].sum(), 2) for m in available if m in df.columns}

    return {m: round(float(row[m].values[0]), 2)
            for m in available if m in row.columns}


def get_savings_plans_coverage(csv_path: Path = None,
                                reference: date = None) -> pd.DataFrame:
    return pd.DataFrame(columns=["Mês", "CoveragePercentage",
                                  "OnDemandCost", "SpendCoveredBySavingsPlans"])


def get_savings_plans_utilization(csv_path: Path = None,
                                   reference: date = None) -> pd.DataFrame:
    return pd.DataFrame(columns=["Mês", "UtilizationPercentage",
                                  "TotalCommitment", "UsedCommitment"])


def get_trusted_advisor_recommendations(csv_path: Path = None) -> list[dict]:
    return []
