terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Descomente para usar backend remoto no S3 (recomendado para produção)
  # backend "s3" {
  #   bucket = "seu-bucket-terraform-state"
  #   key    = "finops-portal/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "finops-portal"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ─── Módulos ────────────────────────────────────────────────────────────────

module "iam" {
  source      = "./modules/iam"
  project     = var.project
  environment = var.environment
}

module "cognito" {
  source              = "./modules/cognito"
  project             = var.project
  environment         = var.environment
  admin_email         = var.admin_email
  callback_urls       = var.callback_urls
}

module "dynamodb" {
  source      = "./modules/dynamodb"
  project     = var.project
  environment = var.environment
}

module "lambda" {
  source              = "./modules/lambda"
  project             = var.project
  environment         = var.environment
  lambda_role_arn     = module.iam.lambda_role_arn
  clients_table_name  = module.dynamodb.clients_table_name
  clients_table_arn   = module.dynamodb.clients_table_arn
  billing_table_name  = module.dynamodb.billing_history_table_name
  billing_table_arn   = module.dynamodb.billing_history_table_arn
}

module "report_lambda" {
  source      = "./modules/report_lambda"
  project     = var.project
  environment = var.environment
}

module "api_gateway" {
  source                        = "./modules/api_gateway"
  project                       = var.project
  environment                   = var.environment
  lambda_invoke_arn             = module.lambda.lambda_invoke_arn
  lambda_function_name          = module.lambda.lambda_function_name
  cognito_user_pool_arn         = module.cognito.user_pool_arn
  report_lambda_invoke_arn      = module.report_lambda.lambda_invoke_arn
  report_lambda_function_name   = module.report_lambda.lambda_function_name
}

module "amplify" {
  source              = "./modules/amplify"
  project             = var.project
  environment         = var.environment
  amplify_role_arn    = module.iam.amplify_role_arn
  github_repo         = var.github_repo
  github_token        = var.github_token
  api_url             = module.api_gateway.api_url
  cognito_user_pool_id     = module.cognito.user_pool_id
  cognito_app_client_id    = module.cognito.app_client_id
}
