# Adiciona permissões de STS e Cost Explorer à role da Lambda

resource "aws_iam_role_policy" "lambda_sts_ce" {
  name = "sts-cost-explorer-access"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Assume role em qualquer conta cliente
        Sid    = "AssumeClientRoles"
        Effect = "Allow"
        Action = "sts:AssumeRole"
        Resource = "arn:aws:iam::*:role/CrossAccountAccess-FinOpsCrossAccountReadOnlyRole"
      },
      {
        # Cost Explorer na própria conta (para contas tipo "solvimm")
        Sid    = "CostExplorerAccess"
        Effect = "Allow"
        Action = [
          "ce:GetCostAndUsage",
          "ce:GetCostForecast",
          "ce:GetDimensionValues"
        ]
        Resource = "*"
      },
      {
        # SNS para disparar alertas
        Sid    = "SNSPublish"
        Effect = "Allow"
        Action = "sns:Publish"
        Resource = "*"
      }
    ]
  })
}
