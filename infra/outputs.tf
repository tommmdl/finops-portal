output "api_url" {
  description = "URL base da API Gateway (endpoint do API Gateway REST)"
  value       = module.api_gateway.api_url
}

output "cognito_user_pool_id" {
  description = "ID do User Pool do Cognito"
  value       = module.cognito.user_pool_id
}

output "cognito_app_client_id" {
  description = "App Client ID do Cognito"
  value       = module.cognito.app_client_id
}

output "dynamodb_table_name" {
  description = "Nome da tabela DynamoDB de clientes"
  value       = module.dynamodb.clients_table_name
}

output "amplify_app_url" {
  description = "URL pública do portal no Amplify"
  value       = module.amplify.app_url
}

output "amplify_app_id" {
  description = "ID do app no Amplify (para CI/CD)"
  value       = module.amplify.app_id
}

output "report_ecr_url" {
  description = "URL do repositório ECR da report-lambda"
  value       = module.report_lambda.ecr_repository_url
}

output "report_lambda_name" {
  description = "Nome da função Lambda de reports"
  value       = module.report_lambda.lambda_function_name
}

output "aws_region" {
  description = "Região AWS do deploy"
  value       = var.aws_region
}

output "github_actions_role_arn" {
  description = "ARN da role IAM usada pelo GitHub Actions (OIDC)"
  value       = module.iam.github_actions_role_arn
}
