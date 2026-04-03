output "clients_table_name" { value = aws_dynamodb_table.clients.name }
output "clients_table_arn" { value = aws_dynamodb_table.clients.arn }
output "billing_history_table_name" { value = aws_dynamodb_table.billing_history.name }
output "billing_history_table_arn" { value = aws_dynamodb_table.billing_history.arn }
