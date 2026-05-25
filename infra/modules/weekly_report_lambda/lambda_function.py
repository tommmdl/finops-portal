import json
import os
from calendar import monthrange
from datetime import datetime, timedelta, date
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

CLIENTS_TABLE     = os.environ.get("CLIENTS_TABLE", "")
DAILY_COSTS_TABLE = os.environ.get("DAILY_COSTS_TABLE", "")
AMPLIFY_ORIGIN    = "https://main.d4uovab8e7t0i.amplifyapp.com"

_dynamodb = None

def _get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return _dynamodb


MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
             'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']


def get_previous_month_range(today):
    """Returns (start_iso, end_iso, label) for the previous complete month."""
    if today.month == 1:
        year, month = today.year - 1, 12
    else:
        year, month = today.year, today.month - 1
    _, last_day = monthrange(year, month)
    start = date(year, month, 1)
    end   = date(year, month, last_day)
    label = f"{MONTHS_PT[month - 1]} {year}"
    return start.isoformat(), end.isoformat(), label


# ── Core calculation functions (testable without AWS) ─────────

def calculate_anomalies(week_items, baseline_items):
    """Returns list of anomalies: services with >20% increase and mean >$1/day."""
    if not baseline_items:
        return []

    all_services = set()
    for item in baseline_items:
        all_services.update(item.get("services", {}).keys())

    anomalies = []
    for service in all_services:
        baseline_costs = [float(item.get("services", {}).get(service, 0)) for item in baseline_items]
        week_costs     = [float(item.get("services", {}).get(service, 0)) for item in week_items]

        mean_baseline = sum(baseline_costs) / len(baseline_costs) if baseline_costs else 0
        mean_current  = sum(week_costs) / len(week_costs) if week_costs else 0

        if mean_baseline <= 0 or mean_current < 1:
            continue

        variacao_pct = (mean_current - mean_baseline) / mean_baseline * 100
        if variacao_pct > 20:
            anomalies.append({
                "service":        service,
                "media_atual":    round(mean_current, 2),
                "media_baseline": round(mean_baseline, 2),
                "variacao_pct":   round(variacao_pct, 1),
            })

    anomalies.sort(key=lambda x: x["variacao_pct"], reverse=True)
    return anomalies


def calculate_week_days(week_items, baseline_total_mean):
    """Returns week days with totalCost, variacao_pct and status (green/yellow/red)."""
    days = []
    for item in week_items:
        total = float(item.get("totalCost", 0))

        if baseline_total_mean > 0:
            variacao_pct = (total - baseline_total_mean) / baseline_total_mean * 100
        else:
            variacao_pct = 0

        if variacao_pct > 20:
            status = "red"
        elif variacao_pct > 10:
            status = "yellow"
        else:
            status = "green"

        days.append({
            "data":         item["data"],
            "totalCost":    round(total, 2),
            "variacao_pct": round(variacao_pct, 1),
            "status":       status,
        })
    return days


def build_ticket_text(anomalies):
    """Generates ticket text based on anomalies list."""
    if not anomalies:
        return (
            "Prezados,\n"
            "Concluímos o acompanhamento semanal dos custos em nuvem e não foram identificadas "
            "oscilações relevantes ou comportamentos atípicos nos gastos diários durante esse período.\n\n"
            "📊 Resumo da semana:\n"
            "- Custos mantiveram-se dentro do padrão esperado\n"
            "- Nenhuma anomalia ou aumento repentino identificado\n"
            "- Nenhuma nova recomendação de otimização foi gerada nesta semana\n\n"
            "Continuamos monitorando o ambiente e, caso haja qualquer mudança relevante, "
            "enviaremos os devidos alertas e sugestões proativas.\n\n"
            "Abraços,\n"
            "Rafael Santiago\n"
            "FinOps | E-Core\n"
            "📞 +55 (51) 2391-1839\n"
            "📧 finops@solvimm.atlassian.net"
        )

    lines = "\n".join(
        f"- {a['service']}: variou {a['variacao_pct']}% acima da média "
        f"(de ${a['media_baseline']:.2f} para ${a['media_atual']:.2f}/dia)"
        for a in anomalies
    )
    return (
        "Prezados,\n"
        "Durante o acompanhamento semanal identificamos variações relevantes nos custos em nuvem "
        "que gostaríamos de reportar.\n\n"
        f"📊 Resumo da semana:\n{lines}\n\n"
        "Estamos investigando e retornaremos com mais detalhes em breve.\n\n"
        "Abraços,\n"
        "Rafael Santiago\n"
        "FinOps | E-Core\n"
        "📞 +55 (51) 2391-1839\n"
        "📧 finops@solvimm.atlassian.net"
    )


# ── Lambda handler ────────────────────────────────────────────

def lambda_handler(event, context):
    params    = (event.get("pathParameters") or {})
    client_id = params.get("client_id")
    if not client_id:
        return _resp(400, {"error": "client_id ausente"})

    db = _get_dynamodb()

    try:
        # 1. Resolve client
        clients_tbl = db.Table(CLIENTS_TABLE)
        resp        = clients_tbl.get_item(Key={"id": client_id})
        client      = resp.get("Item")

        if not client:
            return _resp(404, {"error": "Cliente não encontrado"})
        if not client.get("weeklyReport"):
            return _resp(403, {"error": "weeklyReport não habilitado para este cliente"})

        cliente_nome = client.get("nome")
        if not cliente_nome:
            return _resp(500, {"error": "Registro de cliente sem campo nome"})

        today    = datetime.utcnow().date()
        daily_tbl = db.Table(DAILY_COSTS_TABLE)

        # 2a. Query last 35 days (chart + current week)
        end_date   = today.isoformat()
        start_date = (today - timedelta(days=35)).isoformat()

        result = daily_tbl.query(
            KeyConditionExpression=Key("clienteNome").eq(cliente_nome) & Key("data").between(start_date, end_date),
            ScanIndexForward=True,
        )
        items = sorted(result.get("Items", []), key=lambda x: x["data"])

        # 2b. Query previous complete month (baseline)
        prev_start, prev_end, baseline_month_label = get_previous_month_range(today)

        baseline_result = daily_tbl.query(
            KeyConditionExpression=Key("clienteNome").eq(cliente_nome) & Key("data").between(prev_start, prev_end),
            ScanIndexForward=True,
        )
        baseline_items = sorted(baseline_result.get("Items", []), key=lambda x: x["data"])

    except ClientError as e:
        return _resp(500, {"error": "Erro ao consultar DynamoDB", "detail": str(e)})

    if not items:
        return _resp(200, {
            "clienteNome":        cliente_nome,
            "weekDays":           [],
            "anomalies":          [],
            "chartData":          [],
            "baselineData":       [],
            "baselineMonthLabel": baseline_month_label,
            "ticketText":         build_ticket_text([]),
        })

    # 3. Current week = last 7 days of the 35-day query
    week_items = items[-7:]

    # 4. Calculate using previous month as baseline.
    # Exclude day 01: SP/RI upfront charges and consolidated Tax land there,
    # inflating the daily mean from ~$147 to ~$318 and making all % variations wrong.
    baseline_for_calc = [i for i in baseline_items if not i["data"].endswith("-01")]
    if not baseline_for_calc:
        baseline_for_calc = baseline_items  # fallback: month with only 1 day (edge case)

    anomalies = calculate_anomalies(week_items, baseline_for_calc)

    baseline_totals     = [float(i.get("totalCost", 0)) for i in baseline_for_calc]
    baseline_total_mean = sum(baseline_totals) / len(baseline_totals) if baseline_totals else 0

    week_days = calculate_week_days(week_items, baseline_total_mean)

    # 5. Chart data (last 35 days) + baseline data for service breakdown
    chart_data = [
        {
            "data":      item["data"],
            "totalCost": round(float(item.get("totalCost", 0)), 2),
            "services":  {k: round(float(v), 2) for k, v in item.get("services", {}).items()},
        }
        for item in items
    ]
    baseline_data = [
        {
            "data":      item["data"],
            "totalCost": round(float(item.get("totalCost", 0)), 2),
            "services":  {k: round(float(v), 2) for k, v in item.get("services", {}).items()},
        }
        for item in baseline_items
    ]

    return _resp(200, {
        "clienteNome":        cliente_nome,
        "weekDays":           week_days,
        "anomalies":          anomalies,
        "chartData":          chart_data,
        "baselineData":       baseline_data,
        "baselineMonthLabel": baseline_month_label,
        "baselineTotalMean":  round(baseline_total_mean, 2),
        "ticketText":         build_ticket_text(anomalies),
    })


def _resp(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type":                 "application/json",
            "Access-Control-Allow-Origin":  AMPLIFY_ORIGIN,
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }
