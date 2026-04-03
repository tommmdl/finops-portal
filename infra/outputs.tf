output "api_url" {
  description = "URL base da API Gateway"
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
