const { STSClient, AssumeRoleCommand }                            = require("@aws-sdk/client-sts");
const { CostExplorerClient, GetCostAndUsageCommand }              = require("@aws-sdk/client-cost-explorer");
const { DynamoDBClient }                                          = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand }         = require("@aws-sdk/lib-dynamodb");

const sts      = new STSClient({});
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CLIENTS_TABLE     = process.env.CLIENTS_TABLE;
const DAILY_COSTS_TABLE = process.env.DAILY_COSTS_TABLE;
const ROLE_NAME         = "CrossAccountAccess-FinOpsCrossAccountReadOnlyRole";
const EXCLUDED_TYPES    = ["Tax", "Distributor Discount", "Refund"];
const DAYS              = 35;

function getPeriod() {
  const end   = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - DAYS);
  const fmt = d => d.toISOString().split("T")[0];
  return { Start: fmt(start), End: fmt(end) };
}

function toTTL(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setDate(d.getDate() + 90);
  return Math.floor(d.getTime() / 1000);
}

async function getCEForRole(accountId) {
  const assumed = await sts.send(new AssumeRoleCommand({
    RoleArn:         `arn:aws:iam::${accountId}:role/${ROLE_NAME}`,
    RoleSessionName: `finops-daily-${accountId}`,
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

function buildFilter(accessType, accountId) {
  const excludeTypes = { Not: { Dimensions: { Key: "RECORD_TYPE", Values: EXCLUDED_TYPES } } };
  if (accessType === "Individual") return excludeTypes;
  return {
    And: [
      { Dimensions: { Key: "LINKED_ACCOUNT", Values: [accountId] } },
      excludeTypes,
    ],
  };
}

async function fetchDailyCosts(nome, accountId, accessType) {
  const period = getPeriod();
  const ce = accessType === "Individual"
    ? await getCEForRole(accountId)
    : new CostExplorerClient({ region: "us-east-1" });

  const result = await ce.send(new GetCostAndUsageCommand({
    TimePeriod:  period,
    Granularity: "DAILY",
    Metrics:     ["UnblendedCost"],
    GroupBy:     [{ Type: "DIMENSION", Key: "SERVICE" }],
    Filter:      buildFilter(accessType, accountId),
  }));

  return (result.ResultsByTime || []).map(item => {
    const services  = {};
    let   totalCost = 0;
    for (const g of (item.Groups || [])) {
      const cost = parseFloat(g.Metrics.UnblendedCost.Amount);
      if (cost > 0) {
        services[g.Keys[0]]  = Math.round(cost * 10000) / 10000;
        totalCost            += cost;
      }
    }
    return {
      clienteNome: nome,
      data:        item.TimePeriod.Start,
      services,
      totalCost:   Math.round(totalCost * 10000) / 10000,
      ttl:         toTTL(item.TimePeriod.Start),
    };
  });
}

exports.handler = async () => {
  const { Items: clients } = await dynamodb.send(new ScanCommand({
    TableName:                 CLIENTS_TABLE,
    FilterExpression:          "weeklyReport = :t",
    ExpressionAttributeValues: { ":t": true },
  }));

  console.log(`📋 ${clients.length} clientes com weeklyReport habilitado`);

  let saved = 0, errors = 0;

  for (const client of clients) {
    const accountId  = client.contaPayer?.toString().trim().split(" ")[0];
    const accessType = client.acessoConta; // "Individual" | "Solvimm" | "Sem Acesso"

    if (!accountId || !["Individual", "Solvimm"].includes(accessType)) {
      console.log(`  ⏭  ${client.nome} — sem acesso configurado (${accessType})`);
      continue;
    }

    try {
      console.log(`  🔄 ${client.nome} (${accountId}) via ${accessType}`);
      const days = await fetchDailyCosts(client.nome, accountId, accessType);

      for (const day of days) {
        await dynamodb.send(new PutCommand({ TableName: DAILY_COSTS_TABLE, Item: day }));
      }

      console.log(`  ✓  ${client.nome} — ${days.length} dias gravados`);
      saved += days.length;
    } catch (err) {
      console.error(`  ✗  ${client.nome} — ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Concluído: ${saved} registros salvos | ${errors} erros`);
  return { statusCode: 200, saved, errors };
};
