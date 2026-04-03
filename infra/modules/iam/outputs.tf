output "lambda_role_arn" { value = aws_iam_role.lambda.arn }
output "amplify_role_arn" { value = aws_iam_role.amplify.arn }
output "github_actions_role_arn" { value = aws_iam_role.github_actions.arn }
