const { STSClient, AssumeRoleCommand }                       = require("@aws-sdk/client-sts");
const { CostExplorerClient, GetCostAndUsageCommand }         = require("@aws-sdk/client-cost-explorer");
const { DynamoDBClient }                                     = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand }                          = require("@aws-sdk/client-sns");

const sts      = new STSClient({});
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns      = new SNSClient({});

const TABLE     = process.env.CLIENTS_TABLE;
const ROLE_NAME = "CrossAccountAccess-FinOpsCrossAccountReadOnlyRole";
const SNS_TOPIC = process.env.SNS_TOPIC_ARN;

// ─────────────────────────────────────────────────────────────
// Clientes ATIVOS do portal — mapeados pelo campo acessoConta
//   "role"    → assume CrossAccountAccess-FinOpsCrossAccountReadOnlyRole
//   "solvimm" → consulta via Payer Solvimm (linked account filter)
//   "skip"    → sem acesso, pula silenciosamente
// ─────────────────────────────────────────────────────────────
const ACCOUNT_ACCESS = {
  // ── ROLE — 18 contas com acesso direto ──────────────────────
  "304125469780": { type: "role",    nome: "Abbiamo"            },
  "431892402949": { type: "role",    nome: "Asaas"              },
  "909735747869": { type: "role",    nome: "Atende Simples"     },
  "304320104887": { type: "role",    nome: "Ativa GR"           },
  "311528621398": { type: "role",    nome: "Avita Seg"          },
  "249711940607": { type: "role",    nome: "Caju"               },
  "440744228568": { type: "role",    nome: "Compliance"         },
  "448656396405": { type: "role",    nome: "Delta Energia"      },
  "405894866151": { type: "role",    nome: "Easycarros"         },
  "436964453024": { type: "role",    nome: "Energisa"           },
  "229460349328": { type: "role",    nome: "Fiscontech"         },
  "189719934136": { type: "role",    nome: "GreenAnt"           },
  "722657063706": { type: "role",    nome: "Housi"              },
  "923005598552": { type: "role",    nome: "Rediseg Tecnologia" },
  "558589055054": { type: "role",    nome: "Robox + Rits"       },
  "896303551860": { type: "role",    nome: "Swap"               },
  "331249686118": { type: "role",    nome: "Ubots"              },
  "391747331706": { type: "role",    nome: "Wilson Sons"        },

  // ── SOLVIMM — 13 contas via Payer Solvimm ──────────────────
  "701367923443": { type: "solvimm", nome: "Bloxs"              },
  "718201927637": { type: "solvimm", nome: "Datora"             },
  "816826758843": { type: "solvimm", nome: "Digesto"            },
  "207619413001": { type: "solvimm", nome: "F360/P2CR"          },
  "084654069625": { type: "solvimm", nome: "ITS Rio"            },
  "095936478543": { type: "solvimm", nome: "Lead Energy"        },
  "466605545841": { type: "solvimm", nome: "Linux Solutions"    },
  "137899003623": { type: "solvimm", nome: "MailerWeb/Techcube" },
  "034262321566": { type: "solvimm", nome: "Previsiown"         },
  "191014678510": { type: "solvimm", nome: "Rolim Wainstok"     },
  "560942648759": { type: "solvimm", nome: "SN Informática"     },
  "495585640584": { type: "solvimm", nome: "StayFilm"           },
  "721690112786": { type: "solvimm", nome: "Telelaudo"          },

  // ── SKIP — 5 contas sem acesso ──────────────────────────────
  "138176362835": { type: "skip",    nome: "Bolsa OTC"          },
  "767398116076": { type: "skip",    nome: "Crefaz"             },
  "654654154725": { type: "skip",    nome: "Riverdata"          },
  "414138228043": { type: "skip",    nome: "Solfácil"           },
  "526113637205": { type: "skip",    nome: "Xvision"            },
};

function getLastMonthPeriod() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end   = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt   = d => d.toISOString().split("T")[0];
  return { Start: fmt(start), End: fmt(end) };
}

function calcNivel(consumo) {
  if (consumo >= 50000) return "Nível 1 - Acima de 50K";
  if (consumo >= 10000) return "Nível 2 - Entre 10k e 50K";
  if (consumo >= 5000)  return "Nível 3 - Entre 5K e 10K";
  return "Nível 4 - Abaixo de 5K";
}

async function getCEClientForAccount(accountId) {
  const assumed = await sts.send(new AssumeRoleCommand({
    RoleArn:         `arn:aws:iam::${accountId}:role/${ROLE_NAME}`,
    RoleSessionName: `finops-sync-${accountId}`,
    DurationSeconds: 900,
  }));
  return new CostExplorerClient({
    region: "us-east-1",
    credentials: {
      accessKeyId:     assumed.Credentials.AccessKeyId,
      secretAccessKey: assumed.Credentials.SecretAccessKey,
      sessionToken:    assumed.Credentials.SessionToken,
    },
  });
}

async function fetchCost(accountId, accessType) {
  const period = getLastMonthPeriod();

  if (accessType === "role") {
    const ce = await getCEClientForAccount(accountId);
    const r  = await ce.send(new GetCostAndUsageCommand({
      TimePeriod:  period,
      Granularity: "MONTHLY",
      Metrics:     ["UnblendedCost"],
    }));
    return parseFloat(r.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount || "0");
  }

  if (accessType === "solvimm") {
    const ce = new CostExplorerClient({ region: "us-east-1" });
    const r  = await ce.send(new GetCostAndUsageCommand({
      TimePeriod:  period,
      Granularity: "MONTHLY",
      Metrics:     ["UnblendedCost"],
      Filter: {
        Dimensions: { Key: "LINKED_ACCOUNT", Values: [accountId] },
      },
    }));
    return parseFloat(r.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount || "0");
  }
}

exports.handler = async () => {
  const period = getLastMonthPeriod();
  console.log(`🚀 Sync FinOps — ${period.Start} → ${period.End}\n`);

  const { Items: clients } = await dynamodb.send(new ScanCommand({
    TableName:        TABLE,
    FilterExpression: "ativo = :a",
    ExpressionAttributeValues: { ":a": "Sim" },
  }));

  console.log(`📋 ${clients.length} clientes ativos para processar\n`);

  const alerts = [];
  let updated = 0, skipped = 0, errors = 0;

  for (const client of clients) {
    const accountId  = client.contaPayer?.toString().trim().split(" ")[0];
    const accessInfo = ACCOUNT_ACCESS[accountId];

    if (!accessInfo) {
      console.log(`  ⚠️  ${client.nome} — Account ID "${accountId}" não mapeado`);
      skipped++; continue;
    }

    if (accessInfo.type === "skip") {
      console.log(`  ⏭  ${client.nome} — sem acesso configurado`);
      skipped++; continue;
    }

    try {
      console.log(`  🔄 ${client.nome} (${accountId}) via ${accessInfo.type.toUpperCase()}`);

      const raw     = await fetchCost(accountId, accessInfo.type);
      const consumo = Math.round(raw * 100) / 100;
      const oldNivel = client.nivel;
      const newNivel = calcNivel(consumo);

      await dynamodb.send(new UpdateCommand({
        TableName: TABLE,
        Key:       { id: client.id },
        UpdateExpression: "SET consumo = :c, nivel = :n, updatedAt = :u, lastSyncAt = :s",
        ExpressionAttributeValues: {
          ":c": consumo,
          ":n": newNivel,
          ":u": new Date().toISOString(),
          ":s": new Date().toISOString(),
        },
      }));

      const flag = oldNivel !== newNivel ? ` ⚠️  ${oldNivel} → ${newNivel}` : "";
      console.log(`  ✓  ${client.nome} → $${consumo.toLocaleString("en-US")}${flag}`);

      if (oldNivel !== newNivel) {
        alerts.push({ nome: client.nome, responsavel: client.responsavel, oldNivel, newNivel, consumo });
      }
      updated++;

    } catch (err) {
      console.error(`  ✗  ${client.nome} — ${err.message}`);
      errors++;
    }
  }

  if (alerts.length > 0 && SNS_TOPIC) {
    const lines = alerts.map(a =>
      `• ${a.nome} (${a.responsavel})\n  ${a.oldNivel} → ${a.newNivel} | $${a.consumo.toLocaleString("en-US")}`
    ).join("\n\n");

    await sns.send(new PublishCommand({
      TopicArn: SNS_TOPIC,
      Subject:  `[FinOps Portal] ${alerts.length} cliente(s) mudaram de nível`,
      Message:  `Olá,\n\nSincronização mensal de custos AWS concluída.\n\nMudanças de nível:\n\n${lines}\n\nPortal: https://main.d11g4emeakpbf5.amplifyapp.com`,
    }));
    console.log(`\n📧 Alerta enviado — ${alerts.length} mudança(s) de nível`);
  }

  console.log(`\n✅ Concluído: ${updated} atualizados | ${skipped} pulados | ${errors} erros`);
  return { statusCode: 200, updated, skipped, errors, levelChanges: alerts.length };
};
