resource "aws_dynamodb_table" "billing_history" {
  name         = "${var.project}-${var.environment}-billing-history"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "clienteNome"
  range_key    = "mesAno"

  attribute {
    name = "clienteNome"
    type = "S"
  }

  attribute {
    name = "mesAno"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project}-${var.environment}-billing-history"
  }
}
