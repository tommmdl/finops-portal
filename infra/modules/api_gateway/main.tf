resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project}-${var.environment}"
  description = "FinOps Portal REST API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# ── Authorizer Cognito ────────────────────────────────────────
resource "aws_api_gateway_authorizer" "cognito" {
  name                   = "cognito-authorizer"
  rest_api_id            = aws_api_gateway_rest_api.main.id
  type                   = "COGNITO_USER_POOLS"
  identity_source        = "method.request.header.Authorization"
  provider_arns          = [var.cognito_user_pool_arn]
}

# ── Recurso /clients ──────────────────────────────────────────
resource "aws_api_gateway_resource" "clients" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "clients"
}

resource "aws_api_gateway_resource" "client_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.clients.id
  path_part   = "{id}"
}

# ── Recurso /billing ──────────────────────────────────────────
resource "aws_api_gateway_resource" "billing" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "billing"
}

resource "aws_api_gateway_resource" "billing_cliente" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "{clienteNome}"
}

# ── Métodos ───────────────────────────────────────────────────
locals {
  methods = {
    "GET_clients"         = { resource = aws_api_gateway_resource.clients.id,         http = "GET" }
    "POST_clients"        = { resource = aws_api_gateway_resource.clients.id,         http = "POST" }
    "GET_client"          = { resource = aws_api_gateway_resource.client_id.id,       http = "GET" }
    "PUT_client"          = { resource = aws_api_gateway_resource.client_id.id,       http = "PUT" }
    "DELETE_client"       = { resource = aws_api_gateway_resource.client_id.id,       http = "DELETE" }
    "OPTIONS_clients"     = { resource = aws_api_gateway_resource.clients.id,         http = "OPTIONS" }
    "OPTIONS_client"      = { resource = aws_api_gateway_resource.client_id.id,       http = "OPTIONS" }
    "GET_billing"         = { resource = aws_api_gateway_resource.billing_cliente.id, http = "GET" }
    "OPTIONS_billing"     = { resource = aws_api_gateway_resource.billing_cliente.id, http = "OPTIONS" }
  }
}

resource "aws_api_gateway_method" "methods" {
  for_each = local.methods

  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = each.value.resource
  http_method   = each.value.http
  authorization = startswith(each.key, "OPTIONS") ? "NONE" : "COGNITO_USER_POOLS"
  authorizer_id = startswith(each.key, "OPTIONS") ? null : aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "integrations" {
  for_each = local.methods

  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = each.value.resource
  http_method             = aws_api_gateway_method.methods[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arn
}

# ── Recurso /reports/generate ─────────────────────────────────
resource "aws_api_gateway_resource" "reports" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "reports"
}

resource "aws_api_gateway_resource" "reports_generate" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.reports.id
  path_part   = "generate"
}

resource "aws_api_gateway_method" "reports_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.reports_generate.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_method" "reports_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.reports_generate.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "reports_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.reports_generate.id
  http_method             = aws_api_gateway_method.reports_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.report_lambda_invoke_arn
}

resource "aws_api_gateway_integration" "reports_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.reports_generate.id
  http_method = aws_api_gateway_method.reports_options.http_method
  type        = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "reports_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.reports_generate.id
  http_method = aws_api_gateway_method.reports_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "reports_options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.reports_generate.id
  http_method = aws_api_gateway_method.reports_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.reports_options]
}

# ── Lambda permissions ────────────────────────────────────────
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_report" {
  statement_id  = "AllowAPIGatewayInvokeReport"
  action        = "lambda:InvokeFunction"
  function_name = var.report_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# ── Deployment ────────────────────────────────────────────────
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  depends_on = [aws_api_gateway_integration.integrations]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      requestTime    = "$context.requestTime"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/api-gateway/${var.project}-${var.environment}"
  retention_in_days = 14
}
