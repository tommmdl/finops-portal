"""
AWS Lambda handler — recebe client_id + month, lê billing-history do DynamoDB,
gera PPTX e retorna presigned URL válida por 5 minutos.

Body esperado (JSON):
  {
    "client_id": "uuid-do-cliente",
    "month": "2026-03"
  }
"""
import json
import os
import re
import tempfile
from datetime import date
from pathlib import Path

import boto3
from boto3.dynamodb.conditions import Key
import yaml

from extractor import (
    build_costs_df_from_dynamo,
    build_totals_from_dynamo,
    build_savings_plans_dfs,
    get_trusted_advisor_recommendations,
)
from pptx_generator import generate as gen_pptx

BUCKET        = os.environ["REPORT_BUCKET"]
CLIENTS_TABLE = os.environ["CLIENTS_TABLE"]
BILLING_TABLE = os.environ["BILLING_TABLE"]
PRESIGN_EXPIRY = 300  # 5 minutos

CONFIG_DIR    = Path(__file__).parent / "config"
TEMPLATE_PATH = Path(__file__).parent / "templates" / "template.pptx"

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
s3       = boto3.client("s3",        region_name="us-east-1")


def _cors(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type":                 "application/json",
            "Access-Control-Allow-Origin":  "https://main.d4uovab8e7t0i.amplifyapp.com",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _cors({})

    try:
        body      = json.loads(event.get("body") or "{}")
        client_id = body["client_id"]
        month     = body["month"]        # "2026-03"
    except (KeyError, json.JSONDecodeError) as e:
        return _cors({"error": f"Parâmetros inválidos: {e}"}, 400)

    try:
        y, m      = month.split("-")
        reference = date(int(y), int(m), 1)
    except Exception:
        return _cors({"error": "Formato de mês inválido. Use YYYY-MM."}, 400)

    # ── Busca cliente no DynamoDB ─────────────────────────────
    clients_tbl = dynamodb.Table(CLIENTS_TABLE)
    client = clients_tbl.get_item(Key={"id": client_id}).get("Item")
    if not client:
        return _cors({"error": f"Cliente '{client_id}' não encontrado."}, 404)

    client_name = client["nome"]
    client_slug = _slugify(client_name)

    # Taxa USD/BRL do config YAML (fallback 5.5)
    usd_brl = 5.5
    config_path = CONFIG_DIR / f"{client_slug}.yaml"
    if config_path.exists():
        with open(config_path) as f:
            usd_brl = yaml.safe_load(f).get("usd_brl_rate", 5.5)

    # ── Busca billing-history ────────────────────────────────
    billing_tbl  = dynamodb.Table(BILLING_TABLE)
    billing_items = billing_tbl.query(
        KeyConditionExpression=Key("clienteNome").eq(client_name)
    ).get("Items", [])

    if not billing_items:
        return _cors({
            "error": f"Sem dados de billing para '{client_name}'. Execute o sync-costs primeiro."
        }, 404)

    # ── Constrói DataFrames ───────────────────────────────────
    costs_df        = build_costs_df_from_dynamo(billing_items, reference)
    totals_by_month = build_totals_from_dynamo(billing_items, reference)
    month_cols      = [c for c in costs_df.columns if c != "Service"]
    # 3 meses para o slide de cobertura/utilização
    coverage_df, utilization_df, ri_coverage_df = build_savings_plans_dfs(billing_items, reference, n_months=3)

    # YTD para economia acumulada (todos os meses do ano de referência)
    _, utilization_df_ytd, _ = build_savings_plans_dfs(billing_items, reference, n_months=reference.month)

    recommendations = get_trusted_advisor_recommendations()

    # ── Gera PPTX ────────────────────────────────────────────
    with tempfile.TemporaryDirectory() as tmp_str:
        output_dir = Path(tmp_str) / "output"
        output_dir.mkdir()

        pptx_path = gen_pptx(
            costs_df=costs_df,
            coverage_df=coverage_df,
            utilization_df=utilization_df,
            ri_coverage_df=ri_coverage_df,
            utilization_df_ytd=utilization_df_ytd,
            recommendations=recommendations,
            client_name=client_name,
            reference=reference,
            usd_brl=usd_brl,
            template_path=TEMPLATE_PATH,
            output_dir=output_dir,
        )

        # ── Upload S3 ────────────────────────────────────────
        key = f"reports/{client_slug}/{month}/relatorio-{client_slug}-{month}.pptx"
        s3.upload_file(str(pptx_path), BUCKET, key)

    # ── Presigned URL (5 min) ─────────────────────────────────
    pptx_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=PRESIGN_EXPIRY,
    )

    return _cors({
        "pptx_url":    pptx_url,
        "client_name": client_name,
        "month":       month,
        "services":    len(costs_df),
    })
