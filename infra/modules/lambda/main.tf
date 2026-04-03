data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/handler.js"
  output_path = "${path.module}/handler.zip"
}

resource "aws_lambda_function" "api" {
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  function_name    = "${var.project}-${var.environment}-api"
  role             = var.lambda_role_arn
  handler          = "handler.handler"
  runtime          = "nodejs20.x"
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      CLIENTS_TABLE = var.clients_table_name
      BILLING_TABLE = var.billing_table_name
      NODE_ENV      = var.environment
    }
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = 14
}
