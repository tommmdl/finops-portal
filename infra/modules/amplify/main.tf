resource "aws_amplify_app" "main" {
  name                 = "${var.project}-${var.environment}"
  repository           = var.github_repo != "" ? "https://github.com/${var.github_repo}" : null
  access_token         = var.github_token != "" ? var.github_token : null
  iam_service_role_arn = var.amplify_role_arn

  build_spec = <<-EOT
    version: 1
    applications:
      - frontend:
          phases:
            preBuild:
              commands:
                - npm ci
            build:
              commands:
                - npm run build
          artifacts:
            baseDirectory: dist
            files:
              - '**/*'
          cache:
            paths:
              - node_modules/**/*
        appRoot: app
  EOT

  environment_variables = {
    VITE_API_URL              = var.api_url
    VITE_COGNITO_USER_POOL_ID = var.cognito_user_pool_id
    VITE_COGNITO_CLIENT_ID    = var.cognito_app_client_id
    VITE_AWS_REGION           = "us-east-1"
  }

  # Redireciona rotas SPA para index.html
  custom_rule {
    source = "/<*>"
    status = "404-200"
    target = "/index.html"
  }

  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>"
    status = "200"
    target = "/index.html"
  }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.main.id
  branch_name = "main"
  stage       = "PRODUCTION"

  environment_variables = {
    VITE_ENV = var.environment
  }
}
