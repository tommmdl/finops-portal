variable "aws_region" {
  description = "Região AWS onde os recursos serão criados"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Nome do projeto (usado como prefixo nos recursos)"
  type        = string
  default     = "finops-portal"
}

variable "environment" {
  description = "Ambiente de deploy"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment deve ser: dev, staging ou prod."
  }
}

variable "admin_email" {
  description = "E-mail do usuário administrador inicial (Cognito)"
  type        = string
}

variable "callback_urls" {
  description = "URLs de callback OAuth do Cognito (URL do Amplify após deploy)"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "github_repo" {
  description = "Repositório GitHub no formato 'usuario/repo'"
  type        = string
  default     = ""
}

variable "github_token" {
  description = "Token de acesso pessoal do GitHub para o Amplify"
  type        = string
  sensitive   = true
  default     = ""
}
