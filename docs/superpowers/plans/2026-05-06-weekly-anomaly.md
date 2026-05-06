# Weekly Anomaly Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar monitoramento semanal de custos AWS por cliente com detecção automática de anomalias e geração de texto de ticket.

**Architecture:** Nova tabela DynamoDB `daily-costs` alimentada por Lambda Node.js (`sync-daily-costs`) agendado diariamente via EventBridge. Um Lambda Python (`weekly-report`) exposto via API Gateway calcula anomalias e serve o frontend `Semanal.jsx` com gráficos Recharts e geração de texto de ticket. O campo `weeklyReport` na tabela de clientes controla quais clientes são monitorados, gerenciado por toggle na página Clients.

**Tech Stack:** Node.js 20 (Lambda sync), Python 3.12 (Lambda report), Terraform AWS, React/Vite, Recharts

---

## File Map

| Ação | Arquivo |
|------|---------|
| Create | `infra/modules/dynamodb/daily-costs.tf` |
| Modify | `infra/modules/dynamodb/outputs.tf` |
| Modify | `infra/modules/iam/main.tf` |
| Modify | `infra/modules/lambda/handler.js` |
| Create | `infra/modules/lambda/sync-daily-costs.js` |
| Create | `infra/modules/lambda/sync-daily-costs.tf` |
| Modify | `infra/modules/lambda/variables.tf` |
| Create | `infra/modules/weekly_report_lambda/lambda_function.py` |
| Create | `infra/modules/weekly_report_lambda/test_lambda_function.py` |
| Create | `infra/modules/weekly_report_lambda/main.tf` |
| Create | `infra/modules/weekly_report_lambda/variables.tf` |
| Create | `infra/modules/weekly_report_lambda/outputs.tf` |
| Modify | `infra/modules/api_gateway/main.tf` |
| Modify | `infra/modules/api_gateway/variables.tf` |
| Modify | `infra/main.tf` |
| Modify | `app/src/services/api.js` |
| Modify | `app/src/pages/Clients.jsx` |
| Create | `app/src/pages/Semanal.jsx` |
| Modify | `app/src/App.jsx` |
| Modify | `app/src/components/Sidebar.jsx` |

---

## Task 1: DynamoDB — tabela daily-costs

**Files:**
- Create: `infra/modules/dynamodb/daily-costs.tf`
- Modify: `infra/modules/dynamodb/outputs.tf`

- [ ] **Step 1: Criar `infra/modules/dynamodb/daily-costs.tf`**

```hcl
resource "aws_dynamodb_table" "daily_costs" {
  name         = "${var.project}-${var.environment}-daily-costs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "clienteNome"
  range_key    = "data"

  attribute {
    name = "clienteNome"
    type = "S"
  }

  attribute {
    name = "data"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project}-${var.environment}-daily-costs"
  }
}
```

- [ ] **Step 2: Adicionar outputs em `infra/modules/dynamodb/outputs.tf`**

Append ao final do arquivo existente:

```hcl
output "daily_costs_table_name" { value = aws_dynamodb_table.daily_costs.name }
output "daily_costs_table_arn"  { value = aws_dynamodb_table.daily_costs.arn  }
```

- [ ] **Step 3: Commit**

```bash
git add infra/modules/dynamodb/daily-costs.tf infra/modules/dynamodb/outputs.tf
git commit -m "feat(infra): add daily-costs DynamoDB table with TTL"
```

---

## Task 2: IAM — adicionar daily-costs à policy do Lambda

**Files:**
- Modify: `infra/modules/iam/main.tf` (linhas 35-38 — Resource list de `lambda_dynamodb`)

- [ ] **Step 1: Adicionar daily-costs ao Resource list em `infra/modules/iam/main.tf`**

Localizar o bloco `aws_iam_role_policy.lambda_dynamodb` e adicionar 2 ARNs ao array `Resource` existente:

```hcl
# Adicionar após a linha com billing-history/index/*
"arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.project}-${var.environment}-daily-costs",
"arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.project}-${var.environment}-daily-costs/index/*"
```

O `Resource` completo fica:

```hcl
Resource = [
  "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.project}-${var.environment}-clients",
  "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.project}-${var.environment}-clients/index/*",
  "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.project}-${var.environment}-billing-history",
  "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.project}-${var.environment}-billing-history/index/*",
  "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.project}-${var.environment}-daily-costs",
  "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.project}-${var.environment}-daily-costs/index/*"
]
```

- [ ] **Step 2: Commit**

```bash
git add infra/modules/iam/main.tf
git commit -m "feat(infra): grant daily-costs DynamoDB access to Lambda role"
```

---

## Task 3: handler.js — adicionar weeklyReport ao PUT allowlist

**Files:**
- Modify: `infra/modules/lambda/handler.js` (linha 142 — array `allowed`)

- [ ] **Step 1: Adicionar `weeklyReport` ao array `allowed` em `handler.js`**

Localizar o array `allowed` na linha 142 e adicionar `"weeklyReport"`:

```js
const allowed = [
  "nome","razaoSocial","cnpj","ativo","consumo","responsavel",
  "nivel","amCliente","acessoConta","contaPayer","dashBI",
  "cms","pls","envioFatura","simplesNacional","weeklyReport"
];
```

- [ ] **Step 2: Commit**

```bash
git add infra/modules/lambda/handler.js
git commit -m "feat(lambda): allow weeklyReport field in PUT /clients/:id"
```

---

## Task 4: sync-daily-costs Lambda — código Node.js

**Files:**
- Create: `infra/modules/lambda/sync-daily-costs.js`

- [ ] **Step 1: Criar `infra/modules/lambda/sync-daily-costs.js`**

```js
const { STSClient, AssumeRoleCommand }                            = require("@aws-sdk/client-sts");
const { CostExplorerClient, GetCostAndUsageCommand }              = require("@aws-sdk/client-cost-explorer");
const { DynamoDBClient }                                          = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand }         = require("@aws-sdk/lib-dynamodb");

const sts      = new STSClient({});
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CLIENTS_TABLE     = process.env.CLIENTS_TABLE;
const DAILY_COSTS_TABLE = process.env.DAILY_COSTS_TABLE;
const ROLE_NAME         = "CrossAccountAccess-FinOpsCrossAccountReadOnlyRole";
const EXCLUDED_TYPES    = ["Tax", "Distributor Discount", "Refund"];
const DAYS              = 35;

function getPeriod() {
  const end   = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - DAYS);
  const fmt = d => d.toISOString().split("T")[0];
  return { Start: fmt(start), End: fmt(end) };
}

function toTTL(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setDate(d.getDate() + 90);
  return Math.floor(d.getTime() / 1000);
}

async function getCEForRole(accountId) {
  const assumed = await sts.send(new AssumeRoleCommand({
    RoleArn:         `arn:aws:iam::${accountId}:role/${ROLE_NAME}`,
    RoleSessionName: `finops-daily-${accountId}`,
    DurationSeconds: 900,
  }));
  return new CostExplorerClient({
    region: "us-east-1",
    credentials: {
      accessKeyId:     assumed.Credentials.AccessKeyId,
      secretAccessKey: assumed.Credentials.SecretAccessKey,
      sessionToken:    assumed.Credentials.SessionToken,
    },
  });
}

function buildFilter(accessType, accountId) {
  const excludeTypes = { Not: { Dimensions: { Key: "RECORD_TYPE", Values: EXCLUDED_TYPES } } };
  if (accessType === "Individual") return excludeTypes;
  return {
    And: [
      { Dimensions: { Key: "LINKED_ACCOUNT", Values: [accountId] } },
      excludeTypes,
    ],
  };
}

async function fetchDailyCosts(nome, accountId, accessType) {
  const period = getPeriod();
  const ce = accessType === "Individual"
    ? await getCEForRole(accountId)
    : new CostExplorerClient({ region: "us-east-1" });

  const result = await ce.send(new GetCostAndUsageCommand({
    TimePeriod:  period,
    Granularity: "DAILY",
    Metrics:     ["UnblendedCost"],
    GroupBy:     [{ Type: "DIMENSION", Key: "SERVICE" }],
    Filter:      buildFilter(accessType, accountId),
  }));

  return (result.ResultsByTime || []).map(item => {
    const services  = {};
    let   totalCost = 0;
    for (const g of (item.Groups || [])) {
      const cost = parseFloat(g.Metrics.UnblendedCost.Amount);
      if (cost > 0) {
        services[g.Keys[0]]  = Math.round(cost * 10000) / 10000;
        totalCost            += cost;
      }
    }
    return {
      clienteNome: nome,
      data:        item.TimePeriod.Start,
      services,
      totalCost:   Math.round(totalCost * 10000) / 10000,
      ttl:         toTTL(item.TimePeriod.Start),
    };
  });
}

exports.handler = async () => {
  const { Items: clients } = await dynamodb.send(new ScanCommand({
    TableName:                 CLIENTS_TABLE,
    FilterExpression:          "weeklyReport = :t",
    ExpressionAttributeValues: { ":t": true },
  }));

  console.log(`📋 ${clients.length} clientes com weeklyReport habilitado`);

  let saved = 0, errors = 0;

  for (const client of clients) {
    const accountId  = client.contaPayer?.toString().trim().split(" ")[0];
    const accessType = client.acessoConta; // "Individual" | "Solvimm" | "Sem Acesso"

    if (!accountId || !["Individual", "Solvimm"].includes(accessType)) {
      console.log(`  ⏭  ${client.nome} — sem acesso configurado (${accessType})`);
      continue;
    }

    try {
      console.log(`  🔄 ${client.nome} (${accountId}) via ${accessType}`);
      const days = await fetchDailyCosts(client.nome, accountId, accessType);

      for (const day of days) {
        await dynamodb.send(new PutCommand({ TableName: DAILY_COSTS_TABLE, Item: day }));
      }

      console.log(`  ✓  ${client.nome} — ${days.length} dias gravados`);
      saved += days.length;
    } catch (err) {
      console.error(`  ✗  ${client.nome} — ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Concluído: ${saved} registros salvos | ${errors} erros`);
  return { statusCode: 200, saved, errors };
};
```

- [ ] **Step 2: Commit**

```bash
git add infra/modules/lambda/sync-daily-costs.js
git commit -m "feat(lambda): add sync-daily-costs Node.js Lambda"
```

---

## Task 5: sync-daily-costs — Terraform + variável

**Files:**
- Create: `infra/modules/lambda/sync-daily-costs.tf`
- Modify: `infra/modules/lambda/variables.tf`

- [ ] **Step 1: Adicionar variável em `infra/modules/lambda/variables.tf`**

Append ao final do arquivo:

```hcl
variable "daily_costs_table_name" { type = string }
```

- [ ] **Step 2: Criar `infra/modules/lambda/sync-daily-costs.tf`**

```hcl
data "archive_file" "sync_daily_costs_zip" {
  type        = "zip"
  source_file = "${path.module}/sync-daily-costs.js"
  output_path = "${path.module}/sync-daily-costs.zip"
}

resource "aws_lambda_function" "sync_daily_costs" {
  filename         = data.archive_file.sync_daily_costs_zip.output_path
  source_code_hash = data.archive_file.sync_daily_costs_zip.output_base64sha256
  function_name    = "${var.project}-${var.environment}-sync-daily-costs"
  role             = var.lambda_role_arn
  handler          = "sync-daily-costs.handler"
  runtime          = "nodejs20.x"
  timeout          = 300
  memory_size      = 256

  environment {
    variables = {
      CLIENTS_TABLE     = var.clients_table_name
      DAILY_COSTS_TABLE = var.daily_costs_table_name
      NODE_ENV          = var.environment
    }
  }
}

resource "aws_cloudwatch_log_group" "sync_daily_costs" {
  name              = "/aws/lambda/${aws_lambda_function.sync_daily_costs.function_name}"
  retention_in_days = 30
}

resource "aws_cloudwatch_event_rule" "daily_sync" {
  name                = "${var.project}-${var.environment}-daily-cost-sync"
  description         = "Sincroniza custos diários AWS de clientes com weeklyReport habilitado"
  schedule_expression = "cron(0 6 * * ? *)"
}

resource "aws_cloudwatch_event_target" "sync_daily_costs" {
  rule      = aws_cloudwatch_event_rule.daily_sync.name
  target_id = "SyncDailyCostsLambda"
  arn       = aws_lambda_function.sync_daily_costs.arn
}

resource "aws_lambda_permission" "eventbridge_daily" {
  statement_id  = "AllowEventBridgeDailyInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync_daily_costs.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_sync.arn
}
```

- [ ] **Step 3: Commit**

```bash
git add infra/modules/lambda/sync-daily-costs.tf infra/modules/lambda/variables.tf
git commit -m "feat(infra): add sync-daily-costs Lambda Terraform + EventBridge schedule"
```

---

## Task 6: weekly-report Lambda — código Python + testes

**Files:**
- Create: `infra/modules/weekly_report_lambda/lambda_function.py`
- Create: `infra/modules/weekly_report_lambda/test_lambda_function.py`

- [ ] **Step 1: Escrever testes PRIMEIRO em `infra/modules/weekly_report_lambda/test_lambda_function.py`**

```python
import pytest
from lambda_function import calculate_anomalies, calculate_week_days, build_ticket_text

def make_item(data, total, services):
    return {"data": data, "totalCost": str(total), "services": {k: str(v) for k, v in services.items()}}

# ── calculate_anomalies ───────────────────────────────────────

def test_anomaly_detected_when_service_cost_increases_over_20pct():
    baseline = [make_item(f"2026-04-{i:02d}", 100, {"Amazon EC2": 80}) for i in range(1, 29)]
    week     = [make_item(f"2026-05-{i:02d}", 130, {"Amazon EC2": 110}) for i in range(1, 8)]
    anomalies = calculate_anomalies(week, baseline)
    assert len(anomalies) == 1
    assert anomalies[0]["service"] == "Amazon EC2"
    assert anomalies[0]["variacao_pct"] > 20

def test_no_anomaly_when_variation_under_20pct():
    baseline = [make_item(f"2026-04-{i:02d}", 100, {"Amazon EC2": 80}) for i in range(1, 29)]
    week     = [make_item(f"2026-05-{i:02d}", 110, {"Amazon EC2": 90}) for i in range(1, 8)]
    anomalies = calculate_anomalies(week, baseline)
    assert len(anomalies) == 0

def test_no_anomaly_when_service_cost_below_1_dollar():
    baseline = [make_item(f"2026-04-{i:02d}", 10, {"AWS CloudTrail": 0.05}) for i in range(1, 29)]
    week     = [make_item(f"2026-05-{i:02d}", 15, {"AWS CloudTrail": 0.80}) for i in range(1, 8)]
    anomalies = calculate_anomalies(week, baseline)
    assert len(anomalies) == 0

def test_empty_baseline_returns_no_anomalies():
    week = [make_item(f"2026-05-{i:02d}", 100, {"Amazon EC2": 80}) for i in range(1, 8)]
    assert calculate_anomalies(week, []) == []

# ── calculate_week_days ───────────────────────────────────────

def test_status_red_when_total_variation_over_20pct():
    week = [make_item("2026-05-06", 150, {})]
    days = calculate_week_days(week, baseline_total_mean=100.0)
    assert days[0]["status"] == "red"
    assert days[0]["variacao_pct"] == pytest.approx(50.0, rel=0.01)

def test_status_yellow_when_total_variation_between_10_and_20pct():
    week = [make_item("2026-05-06", 115, {})]
    days = calculate_week_days(week, baseline_total_mean=100.0)
    assert days[0]["status"] == "yellow"

def test_status_green_when_total_variation_under_10pct():
    week = [make_item("2026-05-06", 105, {})]
    days = calculate_week_days(week, baseline_total_mean=100.0)
    assert days[0]["status"] == "green"

# ── build_ticket_text ─────────────────────────────────────────

def test_ticket_without_anomalies_contains_ok_message():
    text = build_ticket_text([])
    assert "não foram identificadas oscilações" in text
    assert "Rafael Santiago" in text

def test_ticket_with_anomalies_lists_services():
    anomalies = [{"service": "Amazon EC2", "variacao_pct": 36.2, "media_atual": 98.50, "media_baseline": 72.30}]
    text = build_ticket_text(anomalies)
    assert "Amazon EC2" in text
    assert "36.2%" in text
    assert "$72.30" in text
    assert "$98.50" in text
```

- [ ] **Step 2: Verificar que os testes falham (funções ainda não existem)**

```bash
cd infra/modules/weekly_report_lambda
python -m pytest test_lambda_function.py -v 2>&1 | head -20
```

Esperado: `ImportError: cannot import name 'calculate_anomalies' from 'lambda_function'`

- [ ] **Step 3: Criar `infra/modules/weekly_report_lambda/lambda_function.py`**

```python
import json
import os
from datetime import datetime, timedelta
import boto3
from boto3.dynamodb.conditions import Key

CLIENTS_TABLE     = os.environ.get("CLIENTS_TABLE", "")
DAILY_COSTS_TABLE = os.environ.get("DAILY_COSTS_TABLE", "")
AMPLIFY_ORIGIN    = "https://main.d4uovab8e7t0i.amplifyapp.com"

_dynamodb = None

def _get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    return _dynamodb


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

        if mean_baseline <= 0 or mean_current <= 1:
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
    client_id = event["pathParameters"]["client_id"]

    db = _get_dynamodb()

    # 1. Resolve client
    clients_tbl = db.Table(CLIENTS_TABLE)
    resp        = clients_tbl.get_item(Key={"id": client_id})
    client      = resp.get("Item")

    if not client:
        return _resp(404, {"error": "Cliente não encontrado"})
    if not client.get("weeklyReport"):
        return _resp(403, {"error": "weeklyReport não habilitado para este cliente"})

    cliente_nome = client["nome"]

    # 2. Query last 35 days
    today      = datetime.utcnow().date()
    end_date   = today.isoformat()
    start_date = (today - timedelta(days=35)).isoformat()

    daily_tbl = db.Table(DAILY_COSTS_TABLE)
    result    = daily_tbl.query(
        KeyConditionExpression=Key("clienteNome").eq(cliente_nome) & Key("data").between(start_date, end_date),
        ScanIndexForward=True,
    )
    items = sorted(result.get("Items", []), key=lambda x: x["data"])

    if not items:
        return _resp(200, {
            "clienteNome": cliente_nome,
            "weekDays":    [],
            "anomalies":   [],
            "chartData":   [],
            "ticketText":  build_ticket_text([]),
        })

    # 3. Split: last 7 = current week, rest = baseline (up to 28 days)
    week_items     = items[-7:]
    baseline_items = items[:-7] if len(items) > 7 else []

    # 4. Calculate
    anomalies = calculate_anomalies(week_items, baseline_items)

    baseline_totals     = [float(i.get("totalCost", 0)) for i in baseline_items]
    baseline_total_mean = sum(baseline_totals) / len(baseline_totals) if baseline_totals else 0

    week_days = calculate_week_days(week_items, baseline_total_mean)

    # 5. Chart data (all 35 days)
    chart_data = [
        {
            "data":      item["data"],
            "totalCost": round(float(item.get("totalCost", 0)), 2),
            "services":  {k: round(float(v), 2) for k, v in item.get("services", {}).items()},
        }
        for item in items
    ]

    return _resp(200, {
        "clienteNome": cliente_nome,
        "weekDays":    week_days,
        "anomalies":   anomalies,
        "chartData":   chart_data,
        "ticketText":  build_ticket_text(anomalies),
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
```

- [ ] **Step 4: Rodar testes e verificar que passam**

```bash
cd infra/modules/weekly_report_lambda
python -m pytest test_lambda_function.py -v
```

Esperado:
```
test_anomaly_detected_when_service_cost_increases_over_20pct PASSED
test_no_anomaly_when_variation_under_20pct PASSED
test_no_anomaly_when_service_cost_below_1_dollar PASSED
test_empty_baseline_returns_no_anomalies PASSED
test_status_red_when_total_variation_over_20pct PASSED
test_status_yellow_when_total_variation_between_10_and_20pct PASSED
test_status_green_when_total_variation_under_10pct PASSED
test_ticket_without_anomalies_contains_ok_message PASSED
test_ticket_with_anomalies_lists_services PASSED
9 passed
```

- [ ] **Step 5: Commit**

```bash
git add infra/modules/weekly_report_lambda/lambda_function.py infra/modules/weekly_report_lambda/test_lambda_function.py
git commit -m "feat(lambda): add weekly-report Python Lambda with anomaly detection"
```

---

## Task 7: weekly-report — módulo Terraform

**Files:**
- Create: `infra/modules/weekly_report_lambda/variables.tf`
- Create: `infra/modules/weekly_report_lambda/outputs.tf`
- Create: `infra/modules/weekly_report_lambda/main.tf`

- [ ] **Step 1: Criar `infra/modules/weekly_report_lambda/variables.tf`**

```hcl
variable "project"               { type = string }
variable "environment"           { type = string }
variable "clients_table_name"    { type = string }
variable "clients_table_arn"     { type = string }
variable "daily_costs_table_name"{ type = string }
variable "daily_costs_table_arn" { type = string }
```

- [ ] **Step 2: Criar `infra/modules/weekly_report_lambda/outputs.tf`**

```hcl
output "lambda_invoke_arn"    { value = aws_lambda_function.weekly_report.invoke_arn }
output "lambda_function_name" { value = aws_lambda_function.weekly_report.function_name }
```

- [ ] **Step 3: Criar `infra/modules/weekly_report_lambda/main.tf`**

```hcl
data "archive_file" "weekly_report_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/weekly_report.zip"
}

resource "aws_iam_role" "weekly_report" {
  name = "${var.project}-${var.environment}-weekly-report-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "weekly_report" {
  name = "weekly-report-policy"
  role = aws_iam_role.weekly_report.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem"]
        Resource = var.clients_table_arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Query"]
        Resource = [var.daily_costs_table_arn, "${var.daily_costs_table_arn}/index/*"]
      }
    ]
  })
}

resource "aws_lambda_function" "weekly_report" {
  filename         = data.archive_file.weekly_report_zip.output_path
  source_code_hash = data.archive_file.weekly_report_zip.output_base64sha256
  function_name    = "${var.project}-${var.environment}-weekly-report"
  role             = aws_iam_role.weekly_report.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      CLIENTS_TABLE     = var.clients_table_name
      DAILY_COSTS_TABLE = var.daily_costs_table_name
    }
  }
}

resource "aws_cloudwatch_log_group" "weekly_report" {
  name              = "/aws/lambda/${aws_lambda_function.weekly_report.function_name}"
  retention_in_days = 14
}
```

- [ ] **Step 4: Commit**

```bash
git add infra/modules/weekly_report_lambda/
git commit -m "feat(infra): add weekly-report Lambda Terraform module"
```

---

## Task 8: API Gateway — endpoint /weekly-report/{client_id}

**Files:**
- Modify: `infra/modules/api_gateway/variables.tf`
- Modify: `infra/modules/api_gateway/main.tf`

- [ ] **Step 1: Adicionar variáveis em `infra/modules/api_gateway/variables.tf`**

Append ao final do arquivo:

```hcl
variable "weekly_report_lambda_invoke_arn"    { type = string }
variable "weekly_report_lambda_function_name" { type = string }
```

- [ ] **Step 2: Adicionar recursos no `infra/modules/api_gateway/main.tf`**

Adicionar antes do bloco `# ── Lambda permissions ────────────────────────────────────────` (linha 159):

```hcl
# ── Recurso /weekly-report/{client_id} ───────────────────────
resource "aws_api_gateway_resource" "weekly_report" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "weekly-report"
}

resource "aws_api_gateway_resource" "weekly_report_client" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.weekly_report.id
  path_part   = "{client_id}"
}

resource "aws_api_gateway_method" "weekly_report_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.weekly_report_client.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_method" "weekly_report_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.weekly_report_client.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "weekly_report_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.weekly_report_client.id
  http_method             = aws_api_gateway_method.weekly_report_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.weekly_report_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "weekly_report_options" {
  rest_api_id       = aws_api_gateway_rest_api.main.id
  resource_id       = aws_api_gateway_resource.weekly_report_client.id
  http_method       = aws_api_gateway_method.weekly_report_options.http_method
  type              = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "weekly_report_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.weekly_report_client.id
  http_method = aws_api_gateway_method.weekly_report_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "weekly_report_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.weekly_report_client.id
  http_method = aws_api_gateway_method.weekly_report_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://main.d4uovab8e7t0i.amplifyapp.com'"
  }
  depends_on = [aws_api_gateway_integration.weekly_report_options]
}

resource "aws_lambda_permission" "api_gw_weekly_report" {
  statement_id  = "AllowAPIGatewayInvokeWeeklyReport"
  action        = "lambda:InvokeFunction"
  function_name = var.weekly_report_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}
```

- [ ] **Step 3: Atualizar o trigger de redeployment em `infra/modules/api_gateway/main.tf`**

Localizar o bloco `resource "aws_api_gateway_deployment" "main"` e atualizar o campo `triggers`:

```hcl
triggers = {
  redeployment = sha1(jsonencode([
    aws_api_gateway_integration.integrations,
    aws_api_gateway_integration.reports_post,
    aws_api_gateway_integration.reports_options,
    aws_api_gateway_method_response.reports_options,
    aws_api_gateway_integration_response.reports_options,
    aws_api_gateway_resource.report_data,
    aws_api_gateway_integration.weekly_report_get,
    aws_api_gateway_integration.weekly_report_options,
    aws_api_gateway_integration_response.weekly_report_options,
  ]))
}
```

E atualizar `depends_on` do mesmo bloco:

```hcl
depends_on = [
  aws_api_gateway_integration.integrations,
  aws_api_gateway_integration.reports_post,
  aws_api_gateway_integration.reports_options,
  aws_api_gateway_integration.weekly_report_get,
  aws_api_gateway_integration.weekly_report_options,
]
```

- [ ] **Step 4: Commit**

```bash
git add infra/modules/api_gateway/main.tf infra/modules/api_gateway/variables.tf
git commit -m "feat(infra): add GET /weekly-report/{client_id} API Gateway endpoint"
```

---

## Task 9: Root main.tf — wiring dos novos módulos

**Files:**
- Modify: `infra/main.tf`

- [ ] **Step 1: Atualizar o bloco `module "lambda"` em `infra/main.tf`**

Adicionar o input `daily_costs_table_name` ao módulo existente:

```hcl
module "lambda" {
  source                 = "./modules/lambda"
  project                = var.project
  environment            = var.environment
  lambda_role_arn        = module.iam.lambda_role_arn
  clients_table_name     = module.dynamodb.clients_table_name
  clients_table_arn      = module.dynamodb.clients_table_arn
  billing_table_name     = module.dynamodb.billing_history_table_name
  billing_table_arn      = module.dynamodb.billing_history_table_arn
  daily_costs_table_name = module.dynamodb.daily_costs_table_name
}
```

- [ ] **Step 2: Adicionar o bloco `module "weekly_report_lambda"` após `module "report_lambda"`**

```hcl
module "weekly_report_lambda" {
  source                  = "./modules/weekly_report_lambda"
  project                 = var.project
  environment             = var.environment
  clients_table_name      = module.dynamodb.clients_table_name
  clients_table_arn       = module.dynamodb.clients_table_arn
  daily_costs_table_name  = module.dynamodb.daily_costs_table_name
  daily_costs_table_arn   = module.dynamodb.daily_costs_table_arn
}
```

- [ ] **Step 3: Atualizar o bloco `module "api_gateway"` para incluir o novo Lambda**

```hcl
module "api_gateway" {
  source                               = "./modules/api_gateway"
  project                              = var.project
  environment                          = var.environment
  lambda_invoke_arn                    = module.lambda.lambda_invoke_arn
  lambda_function_name                 = module.lambda.lambda_function_name
  cognito_user_pool_arn                = module.cognito.user_pool_arn
  report_lambda_invoke_arn             = module.report_lambda.lambda_invoke_arn
  report_lambda_function_name          = module.report_lambda.lambda_function_name
  weekly_report_lambda_invoke_arn      = module.weekly_report_lambda.lambda_invoke_arn
  weekly_report_lambda_function_name   = module.weekly_report_lambda.lambda_function_name
}
```

- [ ] **Step 4: Verificar que `terraform plan` não tem erros**

```bash
cd infra
terraform init
terraform plan
```

Esperado: plan mostra criação de ~10 recursos novos, zero erros de sintaxe ou referências faltando.

- [ ] **Step 5: Commit**

```bash
git add infra/main.tf
git commit -m "feat(infra): wire weekly-report and sync-daily-costs modules in root main.tf"
```

---

## Task 10: Frontend — api.js + toggle em Clients.jsx

**Files:**
- Modify: `app/src/services/api.js`
- Modify: `app/src/pages/Clients.jsx`

- [ ] **Step 1: Adicionar `getWeeklyReport` em `app/src/services/api.js`**

Append ao objeto `api` (antes do fechamento `}`):

```js
export const api = {
  // ... existentes ...
  getWeeklyReport: (clientId) => request('GET', `/weekly-report/${clientId}`),
}
```

- [ ] **Step 2: Adicionar coluna "Semanal" no header da tabela em `Clients.jsx`**

Localizar linha `['Cliente','Status','Nível','Consumo / mês','Responsável','Dash BI','Ações'].map(...)` e adicionar `'Semanal'`:

```jsx
{['Cliente','Status','Nível','Consumo / mês','Responsável','Dash BI','Semanal','Ações'].map(h => (
  <th key={h} style={th}>{h}</th>
))}
```

- [ ] **Step 3: Adicionar toggle inline na linha da tabela em `Clients.jsx`**

Adicionar `handleToggleWeekly` logo após `handleDelete`:

```jsx
async function handleToggleWeekly(c, e) {
  e.stopPropagation()
  try {
    await api.updateClient(c.id, { weeklyReport: !c.weeklyReport })
    showToast(`Weekly Report ${!c.weeklyReport ? 'habilitado' : 'desabilitado'} para ${c.nome}`)
    load()
  } catch { showToast('Erro ao atualizar.') }
}
```

- [ ] **Step 4: Adicionar célula toggle na linha da tabela, antes da célula de Ações**

Localizar o map de `slice.map(c => (` e adicionar após a `<td>` do Dash BI:

```jsx
<td style={td} onClick={e => handleToggleWeekly(c, e)}>
  <div style={{
    width: 36, height: 20, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s',
    background: c.weeklyReport ? 'var(--accent)' : 'var(--surface3)',
    position: 'relative', flexShrink: 0,
  }}>
    <div style={{
      position: 'absolute', top: 2, left: c.weeklyReport ? 18 : 2,
      width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
    }} />
  </div>
</td>
```

- [ ] **Step 5: Atualizar colSpan do estado vazio de 7 para 8**

Localizar `colSpan="7"` e atualizar para `colSpan="8"`.

- [ ] **Step 6: Commit**

```bash
git add app/src/services/api.js app/src/pages/Clients.jsx
git commit -m "feat(frontend): add weeklyReport toggle to Clients table"
```

---

## Task 11: Frontend — instalar Recharts

- [ ] **Step 1: Instalar Recharts**

```bash
cd app
npm install recharts
```

- [ ] **Step 2: Verificar que o build não quebra**

```bash
npm run build 2>&1 | tail -5
```

Esperado: `dist/` gerado sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore(frontend): add recharts dependency"
```

---

## Task 12: Frontend — Semanal.jsx

**Files:**
- Create: `app/src/pages/Semanal.jsx`

- [ ] **Step 1: Criar `app/src/pages/Semanal.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../services/api.js'
import Topbar from '../components/Topbar.jsx'

const fmt    = v => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = v => `${v > 0 ? '+' : ''}${Number(v || 0).toFixed(1)}%`
const fmtDate = s => {
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

const STATUS_COLOR = { green: 'var(--accent)', yellow: 'var(--accent3)', red: 'var(--accent4)' }
const STATUS_LABEL = { green: '🟢 Normal', yellow: '🟡 Atenção', red: '🔴 Anomalia' }

const SERVICE_COLORS = [
  '#00BEC8','#0096DC','#00d4aa','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899',
]

function getTopServices(chartData, n = 8) {
  const totals = {}
  for (const day of chartData) {
    for (const [svc, cost] of Object.entries(day.services || {})) {
      totals[svc] = (totals[svc] || 0) + cost
    }
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([svc]) => svc)
}

export default function Semanal() {
  const [clients,   setClients]   = useState([])
  const [clientId,  setClientId]  = useState('')
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [copied,    setCopied]    = useState(false)

  useEffect(() => {
    api.listClients().then(r => {
      const weekly = (r.items || []).filter(c => c.weeklyReport && c.ativo === 'Sim')
      setClients(weekly)
      if (weekly.length > 0) setClientId(weekly[0].id)
    })
  }, [])

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    setData(null)
    api.getWeeklyReport(clientId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [clientId])

  function handleCopy() {
    if (!data?.ticketText) return
    navigator.clipboard.writeText(data.ticketText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const card    = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:24 }
  const title   = { fontFamily:'Syne, sans-serif', fontSize:14, fontWeight:600, marginBottom:16 }
  const th      = { padding:'10px 16px', textAlign:'left', fontSize:11, fontFamily:'DM Mono, monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500 }
  const td      = { padding:'12px 16px', fontSize:13, borderTop:'1px solid var(--border)', verticalAlign:'middle' }

  const topServices = data ? getTopServices(data.chartData) : []

  return (
    <div>
      <Topbar title="Acompanhamento Semanal" actions={
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          style={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'9px 14px', fontSize:13, color:'var(--text)', fontFamily:'DM Sans, sans-serif', outline:'none', cursor:'pointer', minWidth:200 }}
        >
          {clients.length === 0 && <option value="">Nenhum cliente habilitado</option>}
          {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      } />

      <div style={{ padding:'28px 32px', display:'flex', flexDirection:'column', gap:24 }}>

        {/* Tabela semana atual */}
        <div style={card}>
          <div style={title}>Semana Atual — Últimos 7 dias</div>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontSize:13 }}>Carregando...</div>
          ) : !data || data.weekDays.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontSize:13 }}>
              {clients.length === 0 ? 'Nenhum cliente com Weekly Report habilitado.' : 'Sem dados para este cliente. Execute o sync primeiro.'}
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ background:'var(--surface2)' }}>
                <tr>
                  {['Data','Total do dia','Variação vs média','Status'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.weekDays.map(day => (
                  <tr key={day.data}>
                    <td style={{ ...td, fontFamily:'DM Mono, monospace' }}>{fmtDate(day.data)}</td>
                    <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--accent)' }}>{fmt(day.totalCost)}</td>
                    <td style={{ ...td, fontFamily:'DM Mono, monospace', color: day.variacao_pct > 10 ? STATUS_COLOR[day.status] : 'var(--muted)' }}>
                      {fmtPct(day.variacao_pct)}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize:12, color: STATUS_COLOR[day.status] }}>
                        {STATUS_LABEL[day.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Gráfico 35 dias */}
        {data && data.chartData.length > 0 && (
          <div style={card}>
            <div style={title}>Histórico — Últimas 5 semanas</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.chartData} margin={{ top:4, right:8, left:8, bottom:24 }}>
                <XAxis dataKey="data" tickFormatter={fmtDate} tick={{ fontSize:10, fill:'var(--muted)', fontFamily:'DM Mono, monospace' }} interval={6} />
                <YAxis tick={{ fontSize:10, fill:'var(--muted)', fontFamily:'DM Mono, monospace' }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
                  labelFormatter={fmtDate}
                  contentStyle={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:8, fontSize:12 }}
                />
                <Legend wrapperStyle={{ fontSize:11, fontFamily:'DM Mono, monospace' }} />
                {topServices.map((svc, i) => (
                  <Bar key={svc} dataKey={entry => (entry.services || {})[svc] || 0} name={svc} stackId="a"
                    fill={SERVICE_COLORS[i % SERVICE_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Card anomalias */}
        {data && (
          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={title}>
                {data.anomalies.length === 0
                  ? '🟢 Nenhuma anomalia detectada'
                  : `🔴 ${data.anomalies.length} anomalia${data.anomalies.length > 1 ? 's' : ''} detectada${data.anomalies.length > 1 ? 's' : ''}`
                }
              </div>
              <button
                onClick={handleCopy}
                style={{ background: copied ? 'var(--accent)' : 'var(--surface2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'8px 16px', fontSize:12, color: copied ? '#000' : 'var(--text)', cursor:'pointer', fontFamily:'DM Mono, monospace', transition:'all 0.2s' }}
              >
                {copied ? '✓ Copiado!' : 'Copiar texto do ticket'}
              </button>
            </div>

            {data.anomalies.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead style={{ background:'var(--surface2)' }}>
                  <tr>
                    {['Serviço','Média atual/dia','Média baseline/dia','Variação'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.anomalies.map(a => (
                    <tr key={a.service}>
                      <td style={td}>{a.service}</td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--accent4)' }}>{fmt(a.media_atual)}</td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>{fmt(a.media_baseline)}</td>
                      <td style={{ ...td, fontFamily:'DM Mono, monospace', color:'var(--accent4)', fontWeight:600 }}>
                        +{a.variacao_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/pages/Semanal.jsx
git commit -m "feat(frontend): add Semanal page with anomaly table, bar chart and ticket generator"
```

---

## Task 13: Frontend — registro em App.jsx e Sidebar.jsx

**Files:**
- Modify: `app/src/App.jsx`
- Modify: `app/src/components/Sidebar.jsx`

- [ ] **Step 1: Adicionar import e rota em `app/src/App.jsx`**

Adicionar import após `import Reports from './pages/Reports.jsx'`:

```jsx
import Semanal from './pages/Semanal.jsx'
```

Adicionar rota dentro do `<main>`, após a linha do `reports`:

```jsx
{page === 'semanal' && <Semanal />}
```

- [ ] **Step 2: Adicionar item de menu em `app/src/components/Sidebar.jsx`**

Localizar o `<NavItem>` de Relatórios e adicionar logo após:

```jsx
<NavItem active={page==='semanal'} onClick={() => setPage('semanal')} label="Semanal"
  icon={<>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    <circle cx="18" cy="5" r="3" fill="var(--accent4)" stroke="none"/>
  </>} />
```

- [ ] **Step 3: Commit**

```bash
git add app/src/App.jsx app/src/components/Sidebar.jsx
git commit -m "feat(frontend): register Semanal page in App routing and Sidebar nav"
```

---

## Task 14: Deploy e backfill

- [ ] **Step 1: Push para main para acionar o CI/CD**

```bash
git push origin main
```

Aguardar CI verde no GitHub Actions (Terraform apply + Deploy Report Lambda).

- [ ] **Step 2: Habilitar weeklyReport para os 7 clientes no portal**

Acessar `https://main.d4uovab8e7t0i.amplifyapp.com` → Clientes → ativar toggle "Semanal" para:
- Wilson Sons
- Compliance
- Rediseg Tecnologia
- Atende Simples
- Easycarros
- Ubots
- Delta Energia

- [ ] **Step 3: Executar backfill manual invocando o Lambda sync**

```bash
aws lambda invoke \
  --function-name finops-portal-prod-sync-daily-costs \
  --region us-east-1 \
  --payload '{}' \
  /tmp/sync-response.json && cat /tmp/sync-response.json
```

Esperado: `{"statusCode":200,"saved":245,"errors":0}` (7 clientes × 35 dias)

- [ ] **Step 4: Testar endpoint weekly-report com curl**

Obter token do Cognito via login no portal (devtools → Application → tokens) e substituir `TOKEN` e `CLIENT_ID`:

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://0xh33vwok1.execute-api.us-east-1.amazonaws.com/prod/weekly-report/CLIENT_ID"
```

Esperado: JSON com `weekDays`, `anomalies`, `chartData`, `ticketText`.

- [ ] **Step 5: Verificar página Semanal no portal**

Acessar portal → menu "Semanal" → selecionar cliente → confirmar:
- Tabela dos 7 dias renderiza com status correto
- Gráfico de barras exibe 35 dias empilhados por serviço
- Card de anomalias lista serviços com variação > 20%
- Botão "Copiar texto do ticket" copia texto correto para clipboard
