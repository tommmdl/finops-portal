resource "aws_dynamodb_table" "daily_costs" {
  name         = "${var.project}-${var.environment}-daily-costs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "clienteNome"
  range_key    = "data"

  attribute {
    name = "clienteNome"
    type = "S"
  }

  attribute {
    name = "data"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project}-${var.environment}-daily-costs"
  }
}
