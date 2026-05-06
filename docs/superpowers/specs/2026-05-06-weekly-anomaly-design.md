# Design: Dashboard Semanal de Cost Anomaly

**Data:** 2026-05-06  
**Projeto:** finops-portal  
**Status:** Aprovado

---

## Visão geral

Nova feature que permite monitoramento semanal de custos AWS por cliente, com detecção automática de anomalias e geração de texto de ticket pronto para envio.

Componentes criados:
- Tabela DynamoDB `finops-portal-prod-daily-costs`
- Lambda Node.js `finops-portal-prod-sync-daily-costs`
- Lambda Python `finops-portal-prod-weekly-report`
- Endpoint API Gateway `GET /weekly-report/{client_id}`
- Página frontend `Semanal.jsx`
- Toggle `weeklyReport` na página `Clients.jsx`

---

## Arquitetura

```
EventBridge 06:00 UTC
        │
        ▼
sync-daily-costs (Node.js)
  ├── Scan clients WHERE weeklyReport = true
  ├── Para cada cliente: GetCostAndUsage DAILY, 35 dias, GROUP BY SERVICE
  │     ├── role    → AssumeRole CrossAccountAccess-FinOpsCrossAccountReadOnlyRole
  │     └── solvimm → filter LINKED_ACCOUNT no Payer Solvimm
  └── PutItem → finops-portal-prod-daily-costs {clienteNome + data}

Frontend Semanal.jsx
  └── GET /weekly-report/{client_id}
              │
              ▼
        weekly-report Lambda (Python)
          ├── GetItem clients → resolve clienteNome a partir do client_id
          ├── Query daily-costs: clienteNome, últimos 35 dias
          ├── Calcula médias: semana atual (7 dias) vs 4 semanas anteriores
          ├── Detecta anomalias por serviço (variação > 20% no total diário)
          └── Retorna: dailyData[], anomalies[], ticketText
```

---

## Camada de dados

### Tabela `finops-portal-prod-daily-costs`

| Atributo     | Tipo   | Descrição                                         |
|--------------|--------|---------------------------------------------------|
| `clienteNome`| String | Partition Key — nome exato do cliente             |
| `data`       | String | Sort Key — formato `YYYY-MM-DD`                   |
| `services`   | Map    | `{ "Amazon EC2": 12.34, "AWS Lambda": 0.45, ... }`|
| `totalCost`  | Number | Soma de todos os serviços do dia                  |
| `ttl`        | Number | Epoch Unix (data + 90 dias) — auto-delete DynamoDB|

Acesso: Query por `clienteNome = :n AND #data BETWEEN :start AND :end` — sem GSI necessário.

### Alteração na tabela `finops-portal-prod-clients`

Adicionar atributo `weeklyReport` (Boolean, opcional — ausente equivale a `false`). Gerenciado via toggle na página Clients, usando o `PUT /clients/{id}` existente.

---

## Lambda: sync-daily-costs (Node.js)

**Runtime:** nodejs20.x  
**Timeout:** 300s  
**Memória:** 256MB  
**Schedule:** EventBridge `cron(0 6 * * ? *)` — todo dia às 06:00 UTC

**Lógica:**

1. Scan `finops-portal-prod-clients` com `FilterExpression: weeklyReport = :true`
2. Para cada cliente ativo com weeklyReport:
   - Determinar tipo de acesso via campo `acessoConta` do registro do cliente:
     - `"Individual"` → AssumeRole em `arn:aws:iam::{contaPayer}:role/CrossAccountAccess-FinOpsCrossAccountReadOnlyRole`
     - `"Solvimm"` → Cost Explorer do payer com `Filter.Dimensions.LINKED_ACCOUNT = [contaPayer]`
     - `"Sem Acesso"` → pular cliente silenciosamente
   - Chamar Cost Explorer com `Granularity: DAILY`, `GroupBy: SERVICE`, período = últimos 35 dias
   - Excluir charge types: `Tax`, `Distributor Discount`, `Refund` (via `Filter.Not.Dimensions.RECORD_TYPE`)
   - Para cada dia retornado: calcular `totalCost`, montar map `services`
   - PutItem idempotente em `daily-costs` com TTL = data + 90 dias em epoch

**Arquivo:** `infra/modules/lambda/sync-daily-costs.js`  
**Terraform:** `infra/modules/lambda/sync-daily-costs.tf`

---

## Lambda: weekly-report (Python)

**Runtime:** python3.12  
**Timeout:** 30s  
**Memória:** 256MB  
**Módulo Terraform:** `infra/modules/weekly_report_lambda/`

**Endpoint:** `GET /weekly-report/{client_id}` (autenticado via Cognito)

**Lógica:**

1. `GetItem` em `clients` com `id = client_id` → obtém `clienteNome` e valida que `weeklyReport = true`
2. `Query` em `daily-costs`: `clienteNome = :n AND #data BETWEEN :start AND :end` (35 dias)
3. Calcula anomalias:
   - **Semana atual:** últimos 7 dias com dados disponíveis
   - **Baseline:** os 28 dias anteriores à semana atual (4 semanas)
   - Para cada serviço: `variacao_pct = (media_semana_atual - media_baseline) / media_baseline * 100`
   - Anomalia = serviço com `variacao_pct > 20%` E custo absoluto > $1/dia (evita ruído)
   - Status do dia: 🟢 = sem anomalia, 🟡 = 10-20% variação total, 🔴 = >20% variação total
4. Gera `ticketText` baseado em template (ver seção Frontend)
5. Retorna JSON:

```json
{
  "clienteNome": "Wilson Sons",
  "weekDays": [
    {
      "data": "2026-05-06",
      "totalCost": 145.23,
      "variacao_pct": 8.5,
      "status": "yellow"
    }
  ],
  "anomalies": [
    {
      "service": "Amazon EC2",
      "media_atual": 98.50,
      "media_baseline": 72.30,
      "variacao_pct": 36.2
    }
  ],
  "chartData": [
    { "data": "2026-04-01", "totalCost": 130.00, "services": { "Amazon EC2": 90.0 } }
  ],
  "ticketText": "Prezados,\n..."
}
```

**Arquivo:** `infra/modules/weekly_report_lambda/lambda_function.py`

---

## API Gateway

Novo recurso `/weekly-report/{client_id}`:

- `GET` → autenticado (Cognito authorizer existente)
- `OPTIONS` → MOCK para CORS
- Integração AWS_PROXY → Lambda `weekly-report`
- CORS origin: `https://main.d4uovab8e7t0i.amplifyapp.com`

Adicionado ao `infra/modules/api_gateway/main.tf` existente, com trigger de redeployment atualizado.

---

## Frontend

### Alteração em `Clients.jsx`

Adicionar coluna "Semanal" na tabela de clientes com toggle (switch) que faz `PUT /clients/{id}` com `{ weeklyReport: !client.weeklyReport }`. Visual consistente com os demais campos editáveis.

### Nova página `Semanal.jsx`

**Localização:** `app/src/pages/Semanal.jsx`  
**Registro em:** `App.jsx` (nova rota `page === 'semanal'`) e `Sidebar.jsx` (novo item de menu)

**Biblioteca:** Recharts (instalar via `npm install recharts`)

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ [Topbar] Semanal  [Selector: cliente ▾]         │
├─────────────────────────────────────────────────┤
│ Tabela: 7 dias da semana atual                  │
│  Data | Total | Variação vs média | Status       │
├─────────────────────────────────────────────────┤
│ Gráfico de barras: 35 dias (BarChart Recharts)  │
│  Eixo X: datas | Eixo Y: custo USD              │
│  Barras empilhadas por top serviços             │
├─────────────────────────────────────────────────┤
│ Card "Anomalias detectadas"                     │
│  Lista de serviços com variação > 20%           │
│  [Botão: Copiar texto do ticket]                │
└─────────────────────────────────────────────────┘
```

**Status visual:**
- 🟢 verde (`var(--accent)`) — variação ≤ 10% no total diário
- 🟡 amarelo (`var(--accent3)`) — variação 10-20%
- 🔴 vermelho (`var(--accent4)`) — variação > 20%

**Texto do ticket sem anomalias:**
```
Prezados,
Concluímos o acompanhamento semanal dos custos em nuvem e não foram identificadas oscilações relevantes ou comportamentos atípicos nos gastos diários durante esse período.

📊 Resumo da semana:
- Custos mantiveram-se dentro do padrão esperado
- Nenhuma anomalia ou aumento repentino identificado
- Nenhuma nova recomendação de otimização foi gerada nesta semana

Continuamos monitorando o ambiente e, caso haja qualquer mudança relevante, enviaremos os devidos alertas e sugestões proativas.

Abraços,
Rafael Santiago
FinOps | E-Core
📞 +55 (51) 2391-1839
📧 finops@solvimm.atlassian.net
```

**Texto do ticket com anomalias:**
```
Prezados,
Durante o acompanhamento semanal identificamos variações relevantes nos custos em nuvem que gostaríamos de reportar.

📊 Resumo da semana:
- [SERVIÇO]: variou X% acima da média (de $Y para $Z/dia)

Estamos investigando e retornaremos com mais detalhes em breve.

Abraços,
Rafael Santiago
FinOps | E-Core
📞 +55 (51) 2391-1839
📧 finops@solvimm.atlassian.net
```

---

## Infraestrutura Terraform

### Módulos alterados

- `infra/modules/dynamodb/` — novo arquivo `daily-costs.tf`
- `infra/modules/lambda/` — novo arquivo `sync-daily-costs.tf` + `sync-daily-costs.js`
- `infra/modules/api_gateway/main.tf` — novos recursos `/weekly-report/{client_id}`
- `infra/modules/iam/` — nova policy `weekly-report-policy.tf` com permissões DynamoDB

### Novo módulo

- `infra/modules/weekly_report_lambda/` — Lambda Python + IAM role + CloudWatch logs

### Permissões IAM necessárias

**sync-daily-costs** (usa role existente do sync-costs):
- `dynamodb:Scan` em `clients`
- `dynamodb:PutItem` em `daily-costs`
- `sts:AssumeRole` para contas cross-account (já existente)

**weekly-report Lambda** (nova role):
- `dynamodb:GetItem` em `clients`
- `dynamodb:Query` em `daily-costs`

---

## Ordem de implementação sugerida

1. Terraform: tabela `daily-costs` + módulo `weekly_report_lambda`
2. Lambda Node: `sync-daily-costs.js` + `.tf`
3. Lambda Python: `lambda_function.py` + `requirements.txt`
4. API Gateway: novos recursos em `main.tf`
5. Frontend: toggle em `Clients.jsx` → `Semanal.jsx` → registro em `App.jsx` + `Sidebar.jsx`
6. Deploy e teste end-to-end com backfill manual (invocar sync com período estendido)
