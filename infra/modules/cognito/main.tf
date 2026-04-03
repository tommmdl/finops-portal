resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-${var.environment}"

  # Política de senha
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  # Atributos do usuário
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  # E-mail de boas-vindas
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "FinOps Portal — Código de verificação"
    email_message        = "Seu código de verificação é: {####}"
  }

  # Grupos de acesso
  # Criados separadamente abaixo (admin / viewer)

  tags = {
    Name = "${var.project}-${var.environment}-user-pool"
  }
}

# ── App Client ────────────────────────────────────────────────
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  callback_urls                        = var.callback_urls
  logout_urls                          = var.callback_urls
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  access_token_validity  = 8
  id_token_validity      = 8
  refresh_token_validity = 30
}

# ── Domain ────────────────────────────────────────────────────
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project}-${var.environment}-auth"
  user_pool_id = aws_cognito_user_pool.main.id
}

# ── Grupos ────────────────────────────────────────────────────
resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  description  = "Acesso total — pode criar, editar e inativar clientes"
  user_pool_id = aws_cognito_user_pool.main.id
  precedence   = 1
}

resource "aws_cognito_user_group" "viewer" {
  name         = "viewer"
  description  = "Somente leitura — visualiza dashboard e clientes"
  user_pool_id = aws_cognito_user_pool.main.id
  precedence   = 2
}

# ── Usuário admin inicial ─────────────────────────────────────
resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = var.admin_email

  attributes = {
    email          = var.admin_email
    email_verified = true
  }

  # Senha temporária — usuário precisará trocar no primeiro login
  temporary_password = "FinOps@2024!"
}

resource "aws_cognito_user_in_group" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = aws_cognito_user.admin.username
  group_name   = aws_cognito_user_group.admin.name
}
