# FinOps Portal — Infraestrutura AWS com Terraform

Portal de controle de clientes FinOps rodando em AWS com:
- **Cognito** — autenticação e controle de acesso por grupo
- **DynamoDB** — banco serverless com backup automático
- **Lambda + API Gateway** — API REST protegida por JWT
- **Amplify Hosting** — front-end React com HTTPS e CI/CD

---

## Pré-requisitos

| Ferramenta | Versão mínima | Verificar |
|---|---|---|
| Terraform | 1.5+ | `terraform -version` |
| AWS CLI | 2.x | `aws --version` |
| Node.js | 18+ | `node -version` |

Conta AWS configurada:
```bash
aws sts get-caller-identity   # deve retornar seu Account ID
```

---

## Estrutura do projeto

```
finops-terraform/
├── main.tf                  # Entrypoint — orquestra todos os módulos
├── variables.tf             # Definição das variáveis
├── outputs.tf               # Outputs após o deploy
├── terraform.tfvars.example # Copie e preencha como terraform.tfvars
├── modules/
│   ├── iam/                 # Roles para Lambda e Amplify
│   ├── cognito/             # User Pool, grupos admin/viewer, usuário inicial
│   ├── dynamodb/            # Tabela clients com GSIs e PITR
│   ├── lambda/              # Função Node.js com CRUD completo
│   ├── api_gateway/         # REST API com authorizer Cognito
│   └── amplify/             # Hosting do front-end React
└── scripts/
    └── import-clients.js    # Importa os 46 clientes para o DynamoDB
```

---

## Deploy passo a passo

### 1. Configurar variáveis

```bash
cp terraform.tfvars.example terraform.tfvars
# Edite terraform.tfvars com seu editor favorito
```

Campos obrigatórios no `terraform.tfvars`:
```hcl
admin_email = "seu@email.com"   # receberá senha temporária por e-mail
```

### 2. Inicializar Terraform

```bash
terraform init
```

### 3. Revisar o plano

```bash
terraform plan
# ~25 recursos serão criados
```

### 4. Aplicar infraestrutura

```bash
terraform apply
# Digite "yes" quando solicitado
# Aguarde ~3-5 minutos
```

Ao final você verá os outputs:
```
api_url              = "https://XXXX.execute-api.us-east-1.amazonaws.com/prod"
cognito_user_pool_id = "us-east-1_XXXXXXX"
cognito_app_client_id = "XXXXXXXXXXXXXXXXXX"
dynamodb_table_name  = "finops-portal-prod-clients"
amplify_app_url      = "https://main.XXXXXXXXXX.amplifyapp.com"
```

### 5. Importar dados dos clientes

```bash
cd scripts
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
node import-clients.js \
  --table finops-portal-prod-clients \
  --region us-east-1
```

### 6. (Opcional) Conectar repositório GitHub para CI/CD

Adicione no `terraform.tfvars`:
```hcl
github_repo  = "seu-usuario/finops-portal"
github_token = "ghp_XXXXXXXXXXXXXXXX"
```

E rode `terraform apply` novamente.

### 7. Atualizar callback URL do Cognito

Após o Amplify gerar a URL pública, adicione-a no `terraform.tfvars`:
```hcl
callback_urls = [
  "http://localhost:3000",
  "https://main.XXXXXXXXXX.amplifyapp.com"
]
```

E rode `terraform apply` novamente (atualiza só o Cognito, segundos).

---

## Gestão de usuários

### Criar novo usuário via AWS CLI

```bash
# Criar usuário
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXX \
  --username novo@email.com \
  --user-attributes Name=email,Value=novo@email.com Name=email_verified,Value=true \
  --temporary-password "FinOps@2024!"

# Adicionar ao grupo viewer (somente leitura)
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_XXXXXXX \
  --username novo@email.com \
  --group-name viewer

# Ou ao grupo admin (acesso total)
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_XXXXXXX \
  --username novo@email.com \
  --group-name admin
```

---

## API Reference

Todos os endpoints exigem header `Authorization: Bearer <id_token>`.

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/clients` | Lista todos os clientes |
| GET | `/clients?responsavel=Felipe+Gomes` | Filtra por responsável |
| GET | `/clients?nivel=Nível+1+-+Acima+de+50K` | Filtra por nível |
| GET | `/clients?ativo=Sim` | Filtra por status |
| GET | `/clients/{id}` | Busca cliente por ID |
| POST | `/clients` | Cria novo cliente |
| PUT | `/clients/{id}` | Atualiza cliente |
| DELETE | `/clients/{id}` | Remove cliente |

---

## Custos estimados (us-east-1)

| Serviço | Estimativa |
|---|---|
| Cognito | Grátis até 50.000 MAUs |
| DynamoDB (PAY_PER_REQUEST) | ~$1–3/mês |
| Lambda + API Gateway | ~$0–2/mês (free tier cobre) |
| Amplify Hosting | ~$1–3/mês |
| CloudWatch Logs | ~$0,50/mês |
| **Total** | **~$3–10/mês** |

---

## Destruir infraestrutura

```bash
terraform destroy
# ATENÇÃO: remove todos os dados. Faça backup do DynamoDB antes.
```

---

## Variáveis de ambiente do front-end React

O Amplify injeta automaticamente estas variáveis no build:

```env
VITE_API_URL=https://XXXX.execute-api.us-east-1.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXX
VITE_AWS_REGION=us-east-1
```

No código React:
```js
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: import.meta.env.VITE_AWS_REGION,
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
    userPoolWebClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  },
  API: {
    endpoints: [{
      name: 'finops',
      endpoint: import.meta.env.VITE_API_URL,
    }]
  }
});
```
