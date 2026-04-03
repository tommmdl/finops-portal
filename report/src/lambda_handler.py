"""
AWS Lambda handler — recebe CSV em base64, gera Excel + PPTX, sobe para S3
e retorna presigned URLs para download.

Body esperado (JSON):
  {
    "client_slug": "wilson-sons",
    "month": "2026-03",
    "csv_content": "<base64 do CSV>"
  }
"""
import base64
import json
import os
import tempfile
from datetime import date
from pathlib import Path

import boto3
import yaml

from extractor import (
    get_costs_by_service,
    get_total_costs_by_month,
    get_savings_plans_coverage,
    get_savings_plans_utilization,
    get_trusted_advisor_recommendations,
)
from excel_generator import generate as gen_excel
from pptx_generator import generate as gen_pptx

BUCKET         = os.environ["REPORT_BUCKET"]
PRESIGN_EXPIRY = 60 * 60 * 24   # 24 horas
CONFIG_DIR     = Path(__file__).parent / "config"
TEMPLATE_PATH  = Path(__file__).parent / "templates" / "template.pptx"


def _cors(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type":                "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    # ── OPTIONS (preflight CORS) ──────────────────────────────
    if event.get("httpMethod") == "OPTIONS":
        return _cors({})

    try:
        body = json.loads(event.get("body") or "{}")
        client_slug = body["client_slug"]
        month       = body["month"]          # "2026-03"
        csv_b64     = body["csv_content"]    # base64
    except (KeyError, json.JSONDecodeError) as e:
        return _cors({"error": f"Parâmetros inválidos: {e}"}, 400)

    # ── Carrega config do cliente ─────────────────────────────
    config_path = CONFIG_DIR / f"{client_slug}.yaml"
    if not config_path.exists():
        available = [p.stem for p in CONFIG_DIR.glob("*.yaml")]
        return _cors({"error": f"Cliente '{client_slug}' não encontrado. Disponíveis: {available}"}, 404)

    with open(config_path) as f:
        cfg = yaml.safe_load(f)

    client_name = cfg["name"]
    usd_brl     = cfg.get("usd_brl_rate", 5.5)

    # ── Parse mês ────────────────────────────────────────────
    try:
        y, m  = month.split("-")
        reference = date(int(y), int(m), 1)
    except Exception:
        return _cors({"error": "Formato de mês inválido. Use YYYY-MM."}, 400)

    # ── Decodifica CSV ────────────────────────────────────────
    try:
        csv_bytes = base64.b64decode(csv_b64)
    except Exception:
        return _cors({"error": "csv_content não é base64 válido."}, 400)

    # ── Processa em diretórios temporários ────────────────────
    with tempfile.TemporaryDirectory() as tmp_str:
        tmp_dir    = Path(tmp_str)
        csv_path   = tmp_dir / "costs.csv"
        output_dir = tmp_dir / "output"
        output_dir.mkdir()

        csv_path.write_bytes(csv_bytes)

        costs_df        = get_costs_by_service(csv_path, reference)
        totals_by_month = get_total_costs_by_month(csv_path, reference)
        month_cols      = [c for c in costs_df.columns if c != "Service"]

        coverage_df    = get_savings_plans_coverage()
        utilization_df = get_savings_plans_utilization()
        recommendations = get_trusted_advisor_recommendations()

        excel_path = gen_excel(
            costs_df=costs_df,
            totals_by_month=totals_by_month,
            month_cols=month_cols,
            client_name=client_name,
            reference=reference,
            usd_brl=usd_brl,
            output_dir=output_dir,
        )

        pptx_path = gen_pptx(
            costs_df=costs_df,
            coverage_df=coverage_df,
            utilization_df=utilization_df,
            recommendations=recommendations,
            client_name=client_name,
            reference=reference,
            template_path=TEMPLATE_PATH,
            output_dir=output_dir,
        )

        # ── Sobe para S3 ─────────────────────────────────────
        s3          = boto3.client("s3")
        prefix      = f"reports/{client_slug}/{month}"
        excel_key   = f"{prefix}/{excel_path.name}"
        pptx_key    = f"{prefix}/{pptx_path.name}"

        s3.upload_file(str(excel_path), BUCKET, excel_key)
        s3.upload_file(str(pptx_path),  BUCKET, pptx_key)

    # ── Presigned URLs ────────────────────────────────────────
    excel_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": excel_key},
        ExpiresIn=PRESIGN_EXPIRY,
    )
    pptx_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": pptx_key},
        ExpiresIn=PRESIGN_EXPIRY,
    )

    return _cors({
        "excel_url":   excel_url,
        "pptx_url":    pptx_url,
        "client_name": client_name,
        "month":       month,
        "services":    len(costs_df),
    })
