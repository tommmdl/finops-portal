data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# ── ECR ───────────────────────────────────────────────────────
resource "aws_ecr_repository" "report" {
  name                 = "${var.project}-${var.environment}-report"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_lifecycle_policy" "report" {
  repository = aws_ecr_repository.report.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Manter apenas as 3 últimas imagens"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
      }
      action = { type = "expire" }
    }]
  })
}

# ── S3 — bucket de reports ────────────────────────────────────
resource "aws_s3_bucket" "reports" {
  bucket        = "${var.project}-${var.environment}-reports-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  rule {
    id     = "expire-reports"
    status = "Enabled"
    filter { prefix = "reports/" }
    expiration { days = 7 }
  }
}

resource "aws_s3_bucket_cors_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_public_access_block" "reports" {
  bucket                  = aws_s3_bucket.reports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── IAM Role da Lambda ────────────────────────────────────────
resource "aws_iam_role" "report_lambda" {
  name = "${var.project}-${var.environment}-report-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "report_lambda" {
  name = "report-lambda-policy"
  role = aws_iam_role.report_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "${aws_s3_bucket.reports.arn}/reports/*"
      }
    ]
  })
}

# ── Lambda Container ──────────────────────────────────────────
resource "aws_lambda_function" "report" {
  function_name = "${var.project}-${var.environment}-report"
  role          = aws_iam_role.report_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.report.repository_url}:latest"

  timeout     = 120
  memory_size = 2048

  environment {
    variables = {
      REPORT_BUCKET = aws_s3_bucket.reports.bucket
    }
  }

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_cloudwatch_log_group" "report_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.report.function_name}"
  retention_in_days = 14
}
