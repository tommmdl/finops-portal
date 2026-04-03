resource "aws_dynamodb_table" "clients" {
  name         = "${var.project}-${var.environment}-clients"
  billing_mode = "PAY_PER_REQUEST"   # Sem custo fixo — paga só pelo uso
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "responsavel"
    type = "S"
  }

  attribute {
    name = "nivel"
    type = "S"
  }

  attribute {
    name = "ativo"
    type = "S"
  }

  # GSI para filtrar por responsável
  global_secondary_index {
    name            = "ByResponsavel"
    hash_key        = "responsavel"
    projection_type = "ALL"
  }

  # GSI para filtrar por nível
  global_secondary_index {
    name            = "ByNivel"
    hash_key        = "nivel"
    projection_type = "ALL"
  }

  # GSI para filtrar ativos/inativos
  global_secondary_index {
    name            = "ByAtivo"
    hash_key        = "ativo"
    projection_type = "ALL"
  }

  # Point-in-time recovery — backup automático
  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project}-${var.environment}-clients"
  }
}
