const { STSClient, AssumeRoleCommand }                       = require("@aws-sdk/client-sts");
const {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetSavingsPlansCoverageCommand,
  GetSavingsPlansUtilizationCommand,
  GetReservationCoverageCommand,
  GetReservationUtilizationCommand,
}                                                            = require("@aws-sdk/client-cost-explorer");
const { DynamoDBClient }                                     = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand }                          = require("@aws-sdk/client-sns");

const sts      = new STSClient({});
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns      = new SNSClient({});

const TABLE         = process.env.CLIENTS_TABLE;
const BILLING_TABLE = process.env.BILLING_TABLE;
const ROLE_NAME     = "CrossAccountAccess-FinOpsCrossAccountReadOnlyRole";
const SNS_TOPIC     = process.env.SNS_TOPIC_ARN;

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

// Retorna N períodos mensais fechados, do mais recente para o mais antigo.
// Com months=2 e hoje = 2026-05-04, retorna:
//   [{ Start: "2026-04-01", End: "2026-05-01", label: "2026-04" },
//    { Start: "2026-03-01", End: "2026-04-01", label: "2026-03" }]
function buildPeriods(months) {
  const now    = new Date();
  const fmt    = d => d.toISOString().split("T")[0];
  const result = [];

  for (let i = 1; i <= months; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i,     1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    result.push({
      Start: fmt(start),
      End:   fmt(end),
      label: fmt(start).slice(0, 7), // "2026-04"
    });
  }

  return result;
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

async function fetchSavingsPlans(ce, period, linkedAccountId = null) {
  const timePeriod = { Start: period.Start, End: period.End };
  const filter     = linkedAccountId
    ? { Dimensions: { Key: "LINKED_ACCOUNT", Values: [linkedAccountId] } }
    : undefined;

  const [covResp, utilResp] = await Promise.all([
    ce.send(new GetSavingsPlansCoverageCommand({
      TimePeriod:  timePeriod,
      Granularity: "MONTHLY",
      ...(filter && { Filter: filter }),
    })).catch(() => null),
    ce.send(new GetSavingsPlansUtilizationCommand({
      TimePeriod:  timePeriod,
      Granularity: "MONTHLY",
      ...(filter && { Filter: filter }),
    })).catch(() => null),
  ]);

  const cov  = covResp?.SavingsPlansCoverages?.[0]?.Coverage ?? {};
  const util = utilResp?.SavingsPlansUtilizationsByTime?.[0]?.Utilization ?? {};
  const sav  = utilResp?.SavingsPlansUtilizationsByTime?.[0]?.Savings ?? {};

  return {
    coveragePercent:   parseFloat(cov.CoveragePercentage        ?? 0),
    spendCoveredBySP:  parseFloat(cov.SpendCoveredBySavingsPlans ?? 0),
    onDemandCost:      parseFloat(cov.OnDemandCost              ?? 0),
    utilizationPercent: parseFloat(util.UtilizationPercentage   ?? 0),
    usedCommitment:    parseFloat(util.UsedCommitment           ?? 0),
    totalCommitment:   parseFloat(util.TotalCommitment          ?? 0),
    netSavings:        parseFloat(sav.NetSavings                ?? 0),
  };
}

async function fetchRICoverage(ce, period, linkedAccountId = null) {
  const timePeriod = { Start: period.Start, End: period.End };
  const filter     = linkedAccountId
    ? { Dimensions: { Key: "LINKED_ACCOUNT", Values: [linkedAccountId] } }
    : undefined;

  const [covResp, utilResp] = await Promise.all([
    ce.send(new GetReservationCoverageCommand({
      TimePeriod:  timePeriod,
      Granularity: "MONTHLY",
      ...(filter && { Filter: filter }),
    })).catch(() => null),
    ce.send(new GetReservationUtilizationCommand({
      TimePeriod:  timePeriod,
      Granularity: "MONTHLY",
      ...(filter && { Filter: filter }),
    })).catch(() => null),
  ]);

  const cov  = covResp?.Total?.CoverageHours ?? {};
  const util = utilResp?.Total ?? {};

  const coveragePercent    = parseFloat(cov.CoverageHoursPercentage ?? 0);
  const utilizationPercent = parseFloat(util.UtilizationPercentage  ?? 0);

  // Retorna {} quando não há RI (consistente com o schema existente)
  if (coveragePercent === 0 && utilizationPercent === 0) return {};

  return { coveragePercent, utilizationPercent };
}

function parseServicesBreakdown(resultsByTime) {
  const breakdown = {};
  for (const group of resultsByTime?.[0]?.Groups ?? []) {
    const name = group.Keys?.[0];
    const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");
    if (name && cost > 0) breakdown[name] = Math.round(cost * 100) / 100;
  }
  return breakdown;
}

// Consistent with sync-daily-costs.js — excludes Tax, Distributor Discount, Refund
// so monthly totals match the daily breakdown (Bug 2: portal showed ~$20/day more than CUR).
const EXCLUDED_RECORD_TYPES = ["Tax", "Distributor Discount", "Refund"];
const EXCLUDE_FILTER = { Not: { Dimensions: { Key: "RECORD_TYPE", Values: EXCLUDED_RECORD_TYPES } } };

async function fetchCost(accountId, accessType, period) {
  const groupBy = [{ Type: "DIMENSION", Key: "SERVICE" }];

  if (accessType === "role") {
    const ce = await getCEClientForAccount(accountId);
    const [r, savingsPlans, riCoverage] = await Promise.all([
      ce.send(new GetCostAndUsageCommand({
        TimePeriod:  { Start: period.Start, End: period.End },
        Granularity: "MONTHLY",
        Metrics:     ["UnblendedCost"],
        GroupBy:     groupBy,
        Filter:      EXCLUDE_FILTER,
      })),
      fetchSavingsPlans(ce, period),
      fetchRICoverage(ce, period),
    ]);
    const services = parseServicesBreakdown(r.ResultsByTime);
    const total    = Math.round(Object.values(services).reduce((s, v) => s + v, 0) * 100) / 100;
    return { total, services, savingsPlans, riCoverage };
  }

  if (accessType === "solvimm") {
    const ce = new CostExplorerClient({ region: "us-east-1" });
    const [r, savingsPlans, riCoverage] = await Promise.all([
      ce.send(new GetCostAndUsageCommand({
        TimePeriod:  { Start: period.Start, End: period.End },
        Granularity: "MONTHLY",
        Metrics:     ["UnblendedCost"],
        GroupBy:     groupBy,
        Filter: {
          And: [
            { Dimensions: { Key: "LINKED_ACCOUNT", Values: [accountId] } },
            EXCLUDE_FILTER,
          ],
        },
      })),
      fetchSavingsPlans(ce, period, accountId),
      fetchRICoverage(ce, period, accountId),
    ]);
    const services = parseServicesBreakdown(r.ResultsByTime);
    const total    = Math.round(Object.values(services).reduce((s, v) => s + v, 0) * 100) / 100;
    return { total, services, savingsPlans, riCoverage };
  }
}

exports.handler = async (event = {}) => {
  const backfill = event.backfill === true;
  const months   = backfill ? Math.max(1, parseInt(event.months) || 1) : 1;
  const periods  = buildPeriods(months);

  console.log(`🚀 Sync FinOps — ${backfill ? `backfill ${months}m` : "mensal"}`);
  console.log(`   Períodos: ${periods.map(p => p.label).join(", ")}\n`);

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
      console.log(`  🔄 ${client.nome} (${accountId}) via ${accessInfo.type.toUpperCase()} — ${periods.map(p => p.label).join(", ")}`);

      // Coleta todos os períodos solicitados
      const historico = {};
      for (const period of periods) {
        const { total, services, savingsPlans, riCoverage } = await fetchCost(accountId, accessInfo.type, period);
        historico[period.label] = { total, services, savingsPlans, riCoverage };
      }

      // O mês mais recente (periods[0]) é o consumo corrente
      const recentLabel  = periods[0].label;
      const consumo      = historico[recentLabel].total;
      const oldNivel     = client.nivel;
      const newNivel     = calcNivel(consumo);

      // Atributos flat: historico_2026_04, historico_2026_03, etc.
      // Nested paths (historico.2026-04) falham quando o mapa pai ainda não existe no item.
      const historicoKeys   = Object.keys(historico).map(l => l.replace("-", "_"));
      const historicoPaths  = historicoKeys.map(k => `historico_${k} = :h_${k}`).join(", ");
      const expressionValues = Object.entries(historico).reduce((acc, [label, { total: t }]) => {
        acc[`:h_${label.replace("-", "_")}`] = t;
        return acc;
      }, {
        ":c": consumo,
        ":n": newNivel,
        ":u": new Date().toISOString(),
        ":s": new Date().toISOString(),
      });

      await dynamodb.send(new UpdateCommand({
        TableName: TABLE,
        Key:       { id: client.id },
        UpdateExpression: `SET consumo = :c, nivel = :n, updatedAt = :u, lastSyncAt = :s, ${historicoPaths}`,
        ExpressionAttributeValues: expressionValues,
      }));

      // Grava cada período em billing-history preservando campos existentes (cotacao, valor_nf_brl, etc.)
      if (BILLING_TABLE) {
        await Promise.all(Object.entries(historico).map(([mesAno, { total, services, savingsPlans, riCoverage }]) =>
          dynamodb.send(new UpdateCommand({
            TableName: BILLING_TABLE,
            Key:       { clienteNome: client.nome, mesAno },
            UpdateExpression: "SET totalCost = :t, services = :s, savingsPlans = :sp, riCoverage = :ri, updatedAt = :u",
            ExpressionAttributeValues: {
              ":t":  total,
              ":s":  services,
              ":sp": savingsPlans,
              ":ri": riCoverage,
              ":u":  new Date().toISOString(),
            },
          }))
        ));
      }

      const historicoStr = Object.entries(historico)
        .map(([label, { total: t }]) => `${label}: $${t.toLocaleString("en-US")}`)
        .join(" | ");
      const flag = oldNivel !== newNivel ? ` ⚠️  ${oldNivel} → ${newNivel}` : "";
      console.log(`  ✓  ${client.nome} — ${historicoStr}${flag}`);

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
