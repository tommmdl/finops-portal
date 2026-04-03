"""
CLI principal do finops-report.

Uso:
    python main.py --client wilson-sons --month 2026-03 --csv caminho/costs.csv
    python main.py --client wilson-sons --month 2026-03  # busca CSV em input/wilson-sons/
    python main.py --all --month 2026-03
"""
import sys
from pathlib import Path
from datetime import date

import click
import yaml

sys.path.insert(0, str(Path(__file__).parent))

from extractor import (
    get_costs_by_service,
    get_total_costs_by_month,
    get_savings_plans_coverage,
    get_savings_plans_utilization,
    get_trusted_advisor_recommendations,
)
from excel_generator import generate as gen_excel
from pptx_generator import generate as gen_pptx

ROOT       = Path(__file__).parent.parent
CONFIG_DIR = ROOT / "config"
INPUT_DIR  = ROOT / "input"
TEMPLATE   = ROOT / "templates" / "template.pptx"
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

MESES_PT = {
    "January":"Janeiro","February":"Fevereiro","March":"Março",
    "April":"Abril","May":"Maio","June":"Junho","July":"Julho",
    "August":"Agosto","September":"Setembro","October":"Outubro",
    "November":"Novembro","December":"Dezembro"
}


def load_config(client_slug: str) -> dict:
    path = CONFIG_DIR / f"{client_slug}.yaml"
    if not path.exists():
        available = [p.stem for p in CONFIG_DIR.glob("*.yaml")]
        raise click.BadParameter(
            f"Config '{client_slug}' não encontrado. Disponíveis: {available}"
        )
    with open(path) as f:
        return yaml.safe_load(f)


def parse_month(month_str: str) -> date:
    try:
        y, m = month_str.split("-")
        return date(int(y), int(m), 1)
    except Exception:
        raise click.BadParameter("Formato esperado: YYYY-MM (ex: 2026-03)")


def find_csv(client_slug: str, reference: date, csv_override: str = None) -> Path:
    if csv_override:
        p = Path(csv_override)
        if not p.exists():
            raise click.FileError(csv_override, hint="Arquivo não encontrado.")
        return p

    # Busca em input/<client>/<YYYY-MM>/*.csv ou input/<client>/*.csv
    month_dir = INPUT_DIR / client_slug / reference.strftime("%Y-%m")
    client_dir = INPUT_DIR / client_slug

    for search_dir in [month_dir, client_dir]:
        if search_dir.exists():
            csvs = list(search_dir.glob("*.csv"))
            if csvs:
                return csvs[0]

    raise click.FileError(
        str(month_dir),
        hint=f"Coloque o CSV do Cost Explorer em input/{client_slug}/{reference.strftime('%Y-%m')}/"
    )


def run_client(cfg: dict, reference: date, only: str, csv_override: str = None):
    client_name = cfg["name"]
    client_slug = next(
        p.stem for p in CONFIG_DIR.glob("*.yaml")
        if yaml.safe_load(open(p))["name"] == client_name
    )
    usd_brl = cfg.get("usd_brl_rate", 5.5)
    mes_pt  = MESES_PT[reference.strftime("%B")] + reference.strftime(" %Y")

    click.echo(f"\n{'─'*52}")
    click.echo(f"  Cliente : {client_name}")
    click.echo(f"  Mês     : {mes_pt}")
    click.echo(f"{'─'*52}")

    csv_path = find_csv(client_slug, reference, csv_override)
    click.echo(f"  CSV     : {csv_path.name}")

    click.echo("  [1/3] Lendo dados do Cost Explorer...")
    costs_df       = get_costs_by_service(csv_path, reference)
    totals_by_month = get_total_costs_by_month(csv_path, reference)
    month_cols     = [c for c in costs_df.columns if c != "Service"]
    click.echo(f"         {len(costs_df)} serviços | {len(month_cols)} meses")

    coverage_df    = get_savings_plans_coverage(csv_path, reference)
    utilization_df = get_savings_plans_utilization(csv_path, reference)
    recommendations = get_trusted_advisor_recommendations()

    if only in ("excel", "all"):
        click.echo("  [2/3] Gerando Excel...")
        excel_path = gen_excel(
            costs_df=costs_df,
            totals_by_month=totals_by_month,
            month_cols=month_cols,
            client_name=client_name,
            reference=reference,
            usd_brl=usd_brl,
            output_dir=OUTPUT_DIR,
        )
        click.echo(f"  ✓ Excel  → output/{excel_path.name}")

    if only in ("pptx", "all"):
        click.echo("  [3/3] Gerando PowerPoint...")
        pptx_path = gen_pptx(
            costs_df=costs_df,
            coverage_df=coverage_df,
            utilization_df=utilization_df,
            recommendations=recommendations,
            client_name=client_name,
            reference=reference,
            template_path=TEMPLATE,
            output_dir=OUTPUT_DIR,
        )
        click.echo(f"  ✓ PPTX   → output/{pptx_path.name}")

    click.echo(f"\n  Concluído — {client_name}!")


@click.command()
@click.option("--client",  "-c", default=None,
              help="Slug do cliente (ex: wilson-sons). Use --all para todos.")
@click.option("--month",   "-m", required=True,
              help="Mês de referência YYYY-MM (ex: 2026-03).")
@click.option("--csv",     "-f", default=None,
              help="Caminho direto para o CSV (opcional).")
@click.option("--only",    "-o", default="all",
              type=click.Choice(["all", "excel", "pptx"]),
              help="Gerar só excel, só pptx, ou ambos (padrão: all).")
@click.option("--all",     "all_clients", is_flag=True,
              help="Rodar para todos os clientes configurados.")
def main(client, month, csv, only, all_clients):
    """Gerador automático de Reports Mensais FinOps."""
    reference = parse_month(month)

    if all_clients:
        configs = [load_config(p.stem) for p in sorted(CONFIG_DIR.glob("*.yaml"))]
        for cfg in configs:
            try:
                run_client(cfg, reference, only)
            except Exception as e:
                click.echo(f"  ✗ Erro em {cfg['name']}: {e}", err=True)
    elif client:
        run_client(load_config(client), reference, only, csv_override=csv)
    else:
        raise click.UsageError("Informe --client <slug> ou use --all.")


if __name__ == "__main__":
    main()
