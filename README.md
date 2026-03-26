# FinOps Portal — Front-end React

## Setup local

```bash
npm install
```

Crie um arquivo `.env.local` na raiz:
```env
VITE_API_URL=https://XXXX.execute-api.us-east-1.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXX
VITE_AWS_REGION=us-east-1
```

```bash
npm run dev    # http://localhost:5173
npm run build  # gera pasta dist/
```

## Deploy no Amplify (via AWS CLI)

### Opção 1 — Deploy manual via zip (sem GitHub)

```bash
# Build
npm run build

# Zipar a pasta dist
cd dist && zip -r ../deploy.zip . && cd ..

# Enviar para o Amplify
aws amplify start-deployment \
  --app-id d11g4emeakpbf5 \
  --branch-name main \
  --source-url s3://SEU-BUCKET/deploy.zip
```

### Opção 2 — Deploy direto com Amplify CLI

```bash
# Instalar Amplify CLI se não tiver
npm install -g @aws-amplify/cli

# Build e deploy em um comando
npm run build && \
aws amplify start-job \
  --app-id d11g4emeakpbf5 \
  --branch-name main \
  --job-type RELEASE
```

### Opção 3 — Conectar GitHub (CI/CD automático)

1. Vá no console AWS → Amplify → `d11g4emeakpbf5`
2. Clique em **Connect branch**
3. Selecione seu repositório GitHub e branch `main`
4. A partir daí, cada `git push` faz deploy automático

## Variáveis de ambiente no Amplify

No console AWS → Amplify → Environment variables, adicione:

| Chave | Valor |
|---|---|
| `VITE_API_URL` | URL do API Gateway (output do Terraform) |
| `VITE_COGNITO_USER_POOL_ID` | User Pool ID (output do Terraform) |
| `VITE_COGNITO_CLIENT_ID` | App Client ID (output do Terraform) |
| `VITE_AWS_REGION` | `us-east-1` |
