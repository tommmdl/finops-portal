# ── Lambda sync-daily-costs ────────────────────────────────────────

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

# ── EventBridge — todo dia às 06:00 UTC ──────

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
