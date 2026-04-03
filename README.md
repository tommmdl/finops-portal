# FinOps Portal

Portal interno para gestão e visualização de custos AWS de clientes, com geração automatizada de relatórios mensais em Excel e PowerPoint.

**Acesso:** https://main.d4uovab8e7t0i.amplifyapp.com

---

## Visão Geral

O FinOps Portal centraliza o acompanhamento de custos AWS por cliente, permitindo:

- Visualização de custos por serviço e evolução mensal
- Gestão de clientes e configurações
- Geração de relatórios mensais (Excel + PowerPoint) a partir de exports do Cost Explorer
- Download seguro via presigned URLs com validade de 24h

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                          │
│  push em app/   → Amplify deploy automático                     │
│  push em infra/ → Terraform plan/apply                         │
│  push em report/→ Build Docker → Push ECR → Update Lambda      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                           AWS Cloud                             │
│                                                                 │
│   ┌─────────────┐     ┌──────────────┐     ┌────────────────┐  │
│   │   Amplify   │     │ API Gateway  │     │    Cognito     │  │
│   │  (React SPA)│────▶│  REST API    │◀────│  (Auth/JWT)    │  │
│   └─────────────┘     └──────┬───────┘     └────────────────┘  │
│                              │                                  │
│               ┌──────────────┼──────────────┐                  │
│               │              │              │                  │
│               ▼              ▼              ▼                  │
│        ┌────────────┐ ┌────────────┐ ┌──────────────┐         │
│        │  Lambda    │ │  Lambda    │ │   DynamoDB   │         │
│        │ (API CRUD) │ │  (Report)  │ │  (Clientes + │         │
│        │  Node.js   │ │  Python    │ │   Billing)   │         │
│        └────────────┘ └─────┬──────┘ └──────────────┘         │
│                             │                                  │
│                             ▼                                  │
│                      ┌────────────┐                            │
│                      │     S3     │                            │
│                      │ (Reports)  │                            │
│                      └────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estrutura do Repositório

```
finops-portal/
├── app/                    # Frontend React (Vite)
│   ├── src/
│   │   ├── components/     # Sidebar, Topbar, BillingChart...
│   │   ├── pages/          # Dashboard, Clients, Reports
│   │   └── services/       # api.js (chamadas ao API Gateway)
│   └── package.json
│
├── infra/                  # Infraestrutura (Terraform)
│   ├── modules/
│   │   ├── amplify/        # Hospedagem frontend
│   │   ├── api_gateway/    # Roteamento HTTP + CORS
│   │   ├── cognito/        # Autenticação de usuários
│   │   ├── dynamodb/       # Tabelas de clientes e billing
│   │   ├── iam/            # Roles e OIDC (GitHub Actions)
│   │   ├── lambda/         # Lambda CRUD + sync de custos
│   │   └── report_lambda/  # Lambda de geração de reports
│   └── backend.tf          # State remoto no S3
│
├── report/                 # Lambda de Reports (Python)
│   ├── src/
│   │   ├── lambda_handler.py   # Entrypoint AWS Lambda
│   │   ├── extractor.py        # Leitura e parse do CSV
│   │   ├── excel_generator.py  # Geração do Excel
│   │   └── pptx_generator.py   # Geração do PowerPoint
│   ├── config/             # YAMLs de configuração por cliente
│   ├── templates/          # Template .pptx base
│   ├── Dockerfile.lambda   # Container para AWS Lambda
│   └── build-and-push.sh   # Script manual de deploy
│
├── .github/workflows/
│   ├── terraform.yml       # CI/CD do Terraform
│   └── report-lambda.yml   # CI/CD da Lambda de Reports
│
├── amplify.yml             # Build config Amplify (monorepo)
├── LEARNINGS.md            # Documentação técnica de aprendizado
└── README.md               # Este arquivo
```

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + AWS Amplify UI |
| Autenticação | AWS Cognito (User Pools + JWT) |
| API | AWS API Gateway REST + Lambda Node.js |
| Reports | AWS Lambda Python (Container) |
| Geração de arquivos | openpyxl, python-pptx, matplotlib, pandas |
| Banco de dados | AWS DynamoDB (on-demand) |
| Storage | AWS S3 (presigned URLs, expira em 24h) |
| Infraestrutura | Terraform 1.5+ |
| CI/CD | GitHub Actions + OIDC (sem access keys) |
| Hospedagem | AWS Amplify |
| Registry | AWS ECR (imagem Docker) |

---

## Fluxo de Geração de Reports

```
1. Usuário exporta CSV do AWS Cost Explorer
2. Acessa o portal → aba "Relatórios Mensais"
3. Seleciona cliente + mês + faz upload do CSV
4. Portal envia para POST /reports/generate (API Gateway)
5. Lambda Python:
   ├── Lê configuração do cliente (config/*.yaml)
   ├── Processa CSV → custos por serviço
   ├── Consulta Savings Plans (Coverage + Utilization)
   ├── Consulta Trusted Advisor (recomendações)
   ├── Gera Excel com gráficos e tabelas
   ├── Gera PowerPoint com slides formatados
   └── Sobe para S3 → gera presigned URLs (24h)
6. Portal exibe botões de download (Excel + PowerPoint)
```

---

## Custo AWS Mensal Estimado

> Estimativa para uso interno com ~6 clientes e ~50 reports/mês

| Serviço | Uso estimado | Custo/mês (USD) |
|---------|-------------|-----------------|
| **AWS Amplify** | Hosting + build (~500MB) | ~$0.01 |
| **API Gateway** | ~1.000 req/mês | ~$0.004 |
| **Lambda (CRUD)** | ~5.000 invocações, 256MB | ~$0.01 |
| **Lambda (Report)** | ~50 invocações, 2GB, ~30s | ~$0.15 |
| **DynamoDB** | On-demand, ~1MB | ~$0.00 |
| **S3 (Reports)** | ~500MB, lifecycle 7 dias | ~$0.01 |
| **ECR** | ~1.5GB imagem Docker | ~$0.15 |
| **Cognito** | < 50.000 MAU (free tier) | $0.00 |
| **CloudWatch Logs** | ~500MB logs/mês | ~$0.03 |
| **Cost Explorer API** | ~50 chamadas/mês | ~$0.05 |
| **Trusted Advisor** | Incluído no Business Support | ~$0.00 |
| | **Total estimado** | **~$0.40/mês** |

> A maior fatia de custo conforme o portal crescer será o **Lambda Report** (2GB/120s) e o **ECR**. Para escalar, considerar cache de reports já gerados no S3.

---

## Deploy e Configuração

### Pré-requisitos

- AWS CLI configurado
- Terraform >= 1.5
- Docker
- Node.js >= 18

### Primeiro deploy

```bash
# 1. Clonar o repositório
git clone https://github.com/tommmdl/finops-portal.git
cd finops-portal

# 2. Configurar variáveis do Terraform
cp infra/terraform.tfvars.example infra/terraform.tfvars
# Editar infra/terraform.tfvars com seus valores

# 3. Subir a infraestrutura
cd infra
terraform init
terraform apply

# 4. Buildar e publicar a imagem Docker da Lambda
cd ../report
./build-and-push.sh

# 5. Aplicar novamente para criar a Lambda (precisa da imagem no ECR)
cd ../infra
terraform apply
```

### Adicionar novo cliente

1. Criar o arquivo de configuração em `report/config/<slug>.yaml`:
```yaml
name: "Nome do Cliente"
usd_brl_rate: 5.70
```

2. Fazer push para a `main` — o CI/CD atualiza a Lambda automaticamente.

---

## CI/CD

### GitHub Actions Secrets necessários

| Secret | Descrição |
|--------|-----------|
| `AWS_GITHUB_ACTIONS_ROLE_ARN` | ARN da IAM Role com OIDC para o GitHub Actions |
| `TF_VAR_ADMIN_EMAIL` | Email do admin do Cognito |

### Autenticação AWS

O projeto usa **OIDC** — sem access keys estáticas. O GitHub Actions assume uma IAM Role temporária a cada execução.

```
Push em report/ → build Docker → push ECR → update Lambda
Push em infra/  → terraform apply (main) / terraform plan (PR)
```

---

## Desenvolvimento Local

```bash
# Frontend
cd app
cp ../app/env.local.download .env.local
# Preencher .env.local com as variáveis do terraform output
npm install
npm run dev

# Report Lambda (testes locais)
cd report
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python src/main.py  # execução local com CSV de teste
```

---

## Outputs do Terraform

Após o `terraform apply`, os principais valores:

```bash
terraform -chdir=infra output
```

```
api_url                  = "https://<id>.execute-api.us-east-1.amazonaws.com/prod"
amplify_app_url          = "https://main.<id>.amplifyapp.com"
cognito_user_pool_id     = "us-east-1_XXXXXXXX"
cognito_app_client_id    = "XXXXXXXXXXXXXXXX"
github_actions_role_arn  = "arn:aws:iam::<account>:role/finops-portal-prod-github-actions-role"
report_ecr_url           = "<account>.dkr.ecr.us-east-1.amazonaws.com/finops-portal-prod-report"
```

---

*Desenvolvido por Rafael Santiago — e-core*
