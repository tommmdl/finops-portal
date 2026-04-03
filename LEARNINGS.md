# FinOps Portal — O que aprendemos construindo esse projeto

Este documento registra tudo que foi feito para integrar e automatizar o **finops-portal**, explicando o raciocínio por trás de cada decisão técnica.

---

## 1. Monorepo — Por que unificar os projetos?

**O problema:** Tínhamos três repositórios separados:
- `finops-app` → frontend React
- `finops-terraform` → infraestrutura
- `finops-report` → Lambda Python

Isso causava fricção: para fazer uma mudança que envolvia os três (ex: nova rota na API + novo recurso terraform + novo código Python), precisávamos abrir PRs em repos diferentes, sem visibilidade do conjunto.

**A solução: Monorepo**

Um único repositório com subpastas por responsabilidade:
```
finops-portal/
├── app/      ← frontend
├── infra/    ← terraform
└── report/   ← lambda
```

**Conceitos aprendidos:**
- **Monorepo** não significa misturar código — cada pasta tem sua própria responsabilidade
- O Git enxerga tudo como um repositório, mas o CI/CD pode filtrar por pasta com `paths:`
- Ao mover arquivos entre pastas, o Git detecta automaticamente como `rename` (não delete + add) quando usa `git add -u`

---

## 2. Terraform — Infraestrutura como Código

O Terraform é uma ferramenta que descreve infraestrutura em arquivos `.tf` e aplica as mudanças na AWS.

### Como funciona o fluxo:

```
terraform init    → baixa providers e configura backend
terraform plan    → mostra o que vai mudar (sem aplicar)
terraform apply   → aplica as mudanças na AWS
```

### Backend remoto (S3 + DynamoDB)

Por padrão o terraform salva o estado localmente (`terraform.tfstate`). Em equipe (ou com CI/CD) isso é um problema — cada máquina teria um estado diferente.

**Solução:** salvar o estado no S3, com lock no DynamoDB para evitar dois applies simultâneos.

```hcl
backend "s3" {
  bucket         = "finops-portal-terraform-state"
  key            = "prod/terraform.tfstate"
  region         = "us-east-1"
  dynamodb_table = "finops-portal-terraform-lock"
  encrypt        = true
}
```

**O que é o state lock?**  
Quando o terraform roda, ele coloca um "cadeado" no DynamoDB. Se outro processo tentar rodar ao mesmo tempo, ele espera. Se um processo for cancelado abruptamente (como fizemos ao cancelar o workflow), o lock fica preso. Solução:
```bash
terraform force-unlock <ID_DO_LOCK>
```

### Módulos

Módulos são pastas de terraform reutilizáveis. Cada pasta em `infra/modules/` é um módulo:
- `iam/` → roles e permissões
- `cognito/` → autenticação de usuários
- `dynamodb/` → banco de dados
- `lambda/` → funções serverless
- `report_lambda/` → lambda específica dos reports
- `api_gateway/` → roteamento HTTP
- `amplify/` → hospedagem do frontend

### depends_on

O terraform paraleliza a criação de recursos por padrão. Quando um recurso depende de outro existir primeiro, usamos `depends_on`:

```hcl
resource "aws_api_gateway_deployment" "main" {
  depends_on = [
    aws_api_gateway_integration.integrations,
    aws_api_gateway_integration.reports_post,   # ← adicionamos isso
    aws_api_gateway_integration.reports_options, # ← e isso
  ]
}
```

**Por que isso importa?** O API Gateway precisa que todas as integrações (rotas) existam antes de criar o deployment. Sem o `depends_on`, o deployment poderia ser criado antes das rotas — e a API ficaria incompleta.

### terraform fmt

O terraform tem um formatador oficial. O CI/CD roda `terraform fmt -check` para garantir que o código está formatado corretamente. Para corrigir localmente:
```bash
terraform fmt -recursive
```

### Lambda Container (ECR)

Em vez de subir um `.zip` com o código Python, usamos uma **imagem Docker**. Isso permite:
- Instalar dependências do sistema (gcc, fontconfig para matplotlib)
- Reproduzir exatamente o mesmo ambiente em qualquer lugar
- Imagens maiores do que o limite de 250MB do zip

O fluxo é:
1. Criar o repositório ECR (Elastic Container Registry) via terraform
2. Fazer o build da imagem Docker
3. Fazer push para o ECR
4. O terraform cria a Lambda apontando para a imagem no ECR

**Atenção:** O terraform não consegue criar a Lambda se a imagem ainda não existe no ECR. Por isso a ordem importa:
1. `terraform apply` → cria o ECR
2. `docker build + push` → sobe a imagem
3. `terraform apply` novamente → cria a Lambda

---

## 3. Docker — Containerizando a Lambda

### Dockerfile.lambda

```dockerfile
FROM public.ecr.aws/lambda/python:3.12   # imagem base da AWS para Lambda

RUN dnf install -y gcc gcc-c++ fontconfig && dnf clean all  # deps do sistema

WORKDIR ${LAMBDA_TASK_ROOT}   # diretório padrão da Lambda

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/       ./
COPY config/    ./config/
COPY templates/ ./templates/

CMD ["lambda_handler.lambda_handler"]   # arquivo.função
```

**Conceitos:**
- `FROM public.ecr.aws/lambda/python:3.12` → imagem oficial da AWS, já configurada para rodar no ambiente Lambda
- `LAMBDA_TASK_ROOT` → variável de ambiente da AWS que aponta para `/var/task`
- `CMD` → define qual função Python será chamada quando a Lambda for invocada
- `--platform linux/amd64` → forçamos a arquitetura x86_64 mesmo buildando em Mac/ARM ou Windows, porque a Lambda roda em Linux x86

---

## 4. GitHub Actions — CI/CD Automatizado

### O que é CI/CD?

- **CI** (Continuous Integration) → a cada push, roda testes e validações automaticamente
- **CD** (Continuous Delivery/Deployment) → a cada merge na main, faz o deploy automaticamente

### Estrutura de um workflow

```yaml
name: Deploy Report Lambda          # nome que aparece no GitHub

on:                                 # quando dispara
  push:
    branches: [main]
    paths:
      - "report/**"                 # só quando muda algo em report/

jobs:
  deploy:
    runs-on: ubuntu-latest          # máquina virtual que vai executar
    steps:
      - uses: actions/checkout@v4  # baixa o código
      - run: echo "hello"          # comando shell
```

### paths — filtragem por pasta

Esse é o recurso que transforma um monorepo em CI/CD inteligente:

```yaml
# Só roda quando muda algo em report/
on:
  push:
    paths:
      - "report/**"

# Só roda quando muda algo em infra/
on:
  push:
    paths:
      - "infra/**"
```

Assim, mexer no frontend não dispara o deploy da Lambda, e vice-versa.

### Pull Request vs Push

```yaml
on:
  push:
    branches: [main]     # merge na main → terraform apply
  pull_request:
    branches: [main]     # PR aberto → terraform plan (só visualiza)
```

Isso cria um fluxo seguro:
1. Abre PR → CI roda o plan e comenta no PR o que vai mudar
2. Você revisa → mergeia
3. Merge na main → CI aplica as mudanças

---

## 5. OIDC — Autenticação sem Access Keys

### O problema das Access Keys

Access keys (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`) são credenciais estáticas:
- Podem ser vazadas se alguém tiver acesso ao repositório
- Precisam ser rotacionadas manualmente
- No nosso caso, o SSO da e-core rotaciona a cada 30 minutos — impossível usar

### A solução: OIDC (OpenID Connect)

OIDC é um protocolo de identidade. O GitHub funciona como um **provedor de identidade** — ele emite tokens que provam "este workflow está rodando no repositório X, branch Y".

A AWS confia nesse token e emite credenciais temporárias automaticamente.

**O fluxo:**
```
GitHub Actions                    AWS
     |                             |
     |  "Sou o repo tommmdl/      |
     |   finops-portal, preciso   |
     |   de credenciais"          |
     |─────────────────────────── →|
     |                             | verifica o token
     |← ─────────────────────────  |
     |  credenciais temporárias    |
     |  (expiram em ~1 hora)       |
```

**Como configuramos:**

1. No terraform, criamos o OIDC provider e uma IAM Role:
```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "github_actions" {
  assume_role_policy = jsonencode({
    Statement = [{
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          # Só o nosso repo pode assumir essa role
          "token.actions.githubusercontent.com:sub" = "repo:tommmdl/finops-portal:*"
        }
      }
    }]
  })
}
```

2. No workflow, trocamos access keys por:
```yaml
permissions:
  id-token: write    # permite pedir token OIDC

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${{ secrets.AWS_GITHUB_ACTIONS_ROLE_ARN }}
      aws-region: us-east-1
```

**Resultado:** Zero credencial estática. O GitHub Actions se autentica dinamicamente a cada run.

### Permissões mínimas (Principle of Least Privilege)

A IAM Role do GitHub Actions tem apenas as permissões necessárias:
- **ECR** → fazer push de imagens
- **Lambda** → atualizar o código da função
- **S3 + DynamoDB** → ler/escrever o state do terraform

Não tem acesso a nada mais. Se o token vazar, o dano é limitado.

---

## 6. Variáveis sensíveis no CI/CD

### O problema do tfvars

O arquivo `terraform.tfvars` tem valores como email e configurações — ele fica no `.gitignore` e não vai para o repositório. Mas o CI/CD não tem acesso a ele.

**Solução:** GitHub Secrets + variáveis de ambiente do terraform

O terraform lê automaticamente qualquer variável de ambiente que começa com `TF_VAR_`:

```yaml
- name: Terraform Plan
  env:
    TF_VAR_admin_email: ${{ secrets.TF_VAR_ADMIN_EMAIL }}
  run: terraform plan
```

Isso é equivalente a ter no `terraform.tfvars`:
```hcl
admin_email = "rafael.santiago@e-core.com"
```

### Secrets configurados no projeto

| Secret | Para que serve |
|--------|---------------|
| `AWS_GITHUB_ACTIONS_ROLE_ARN` | ARN da role OIDC para autenticar na AWS |
| `TF_VAR_ADMIN_EMAIL` | Email do admin do Cognito para o terraform |

---

## 7. API Gateway — Roteamento HTTP

O API Gateway recebe requisições HTTP e encaminha para a Lambda correta.

### A rota que integramos

```
POST /reports/generate
  → autenticação Cognito (JWT token)
  → report_lambda
  → gera Excel + PPTX
  → sobe para S3
  → retorna presigned URLs
```

### CORS (Cross-Origin Resource Sharing)

O browser bloqueia requisições de um domínio para outro por padrão. Para que o frontend (`amplifyapp.com`) consiga chamar o API Gateway, precisamos do CORS.

O preflight funciona assim:
1. Browser envia `OPTIONS /reports/generate` (pergunta: "posso fazer POST aqui?")
2. API Gateway responde com os headers permitidos
3. Browser faz o `POST` de verdade

Por isso criamos dois métodos para cada rota: `POST` (a chamada real) e `OPTIONS` (o preflight CORS).

---

## 8. Presigned URLs — Downloads seguros do S3

O S3 por padrão não permite acesso público. Para deixar o usuário baixar o Excel/PPTX sem expor o bucket, usamos **presigned URLs**:

```python
url = s3.generate_presigned_url(
    "get_object",
    Params={"Bucket": BUCKET, "Key": key},
    ExpiresIn=60 * 60 * 24   # expira em 24 horas
)
```

A URL gerada contém uma assinatura criptográfica que prova que foi gerada por alguém com acesso ao bucket. Qualquer pessoa com a URL pode baixar o arquivo, mas só por 24 horas.

---

## Próximos passos sugeridos para estudo

1. **Terraform avançado** — `for_each`, `dynamic blocks`, `locals` complexos
2. **Lambda cold start** — por que Lambdas containers demoram mais para iniciar e como mitigar
3. **CloudWatch** — monitorar logs e métricas da Lambda
4. **Cognito** — entender o fluxo completo de autenticação JWT
5. **GitHub Actions avançado** — matrix builds, cache de dependências, environments
6. **Least privilege IAM** — substituir o `AdministratorAccess` da role do terraform por uma policy customizada

---

*Documento gerado em 03/04/2026 após sessão de desenvolvimento do finops-portal.*
