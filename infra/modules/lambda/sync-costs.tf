# ── Lambda sync-costs ────────────────────────────────────────

data "archive_file" "sync_costs_zip" {
  type        = "zip"
  source_file = "${path.module}/sync-costs.js"
  output_path = "${path.module}/sync-costs.zip"
}

resource "aws_lambda_function" "sync_costs" {
  filename         = data.archive_file.sync_costs_zip.output_path
  source_code_hash = data.archive_file.sync_costs_zip.output_base64sha256
  function_name    = "${var.project}-${var.environment}-sync-costs"
  role             = var.lambda_role_arn
  handler          = "sync-costs.handler"
  runtime          = "nodejs20.x"
  timeout          = 300 # 5 min — processa ~40 contas
  memory_size      = 256

  environment {
    variables = {
      CLIENTS_TABLE           = var.clients_table_name
      BILLING_TABLE           = var.billing_table_name
      CROSS_ACCOUNT_ROLE_NAME = "CrossAccountAccess-FinOpsCrossAccountReadOnlyRole"
      SNS_TOPIC_ARN           = aws_sns_topic.cost_alerts.arn
      NODE_ENV                = var.environment
    }
  }
}

resource "aws_cloudwatch_log_group" "sync_costs" {
  name              = "/aws/lambda/${aws_lambda_function.sync_costs.function_name}"
  retention_in_days = 30
}

# ── EventBridge — todo dia 1º do mês às 9h (horário Brasília = 12h UTC) ──────

resource "aws_cloudwatch_event_rule" "monthly_sync" {
  name                = "${var.project}-${var.environment}-monthly-cost-sync"
  description         = "Sincroniza custos AWS de todos os clientes FinOps"
  schedule_expression = "cron(0 12 1 * ? *)" # Todo dia 1º às 12:00 UTC = 09:00 BRT
}

resource "aws_cloudwatch_event_target" "sync_costs" {
  rule      = aws_cloudwatch_event_rule.monthly_sync.name
  target_id = "SyncCostsLambda"
  arn       = aws_lambda_function.sync_costs.arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync_costs.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monthly_sync.arn
}

# ── SNS — alertas de mudança de nível ────────────────────────

resource "aws_sns_topic" "cost_alerts" {
  name = "${var.project}-${var.environment}-cost-alerts"
}

resource "aws_sns_topic_subscription" "email_alerts" {
  for_each  = toset(var.alert_emails)
  topic_arn = aws_sns_topic.cost_alerts.arn
  protocol  = "email"
  endpoint  = each.value
}
