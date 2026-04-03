terraform {
  backend "s3" {
    bucket         = "finops-portal-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "finops-portal-terraform-lock"
    encrypt        = true
  }
}
