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
