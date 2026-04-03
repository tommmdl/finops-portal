output "lambda_invoke_arn"   { value = aws_lambda_function.report.invoke_arn }
output "lambda_function_name" { value = aws_lambda_function.report.function_name }
output "ecr_repository_url"   { value = aws_ecr_repository.report.repository_url }
output "reports_bucket"        { value = aws_s3_bucket.reports.bucket }
