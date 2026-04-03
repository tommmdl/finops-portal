#!/usr/bin/env node
/**
 * import-billing-history.js
 * Importa o histórico de faturamento mensal para o DynamoDB.
 *
 * Uso:
 *   node scripts/import-billing-history.js \
 *     --table finops-portal-prod-billing-history \
 *     --region us-east-1
 */

const { DynamoDBClient }                             = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand }         = require("@aws-sdk/lib-dynamodb");
const fs                                             = require("fs");
const path                                           = require("path");

const args    = process.argv.slice(2);
const getArg  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i+1] : null; };
const TABLE   = getArg("--table")  || "finops-portal-prod-billing-history";
const REGION  = getArg("--region") || "us-east-1";

const client = new DynamoDBClient({ region: REGION });
const db     = DynamoDBDocumentClient.from(client);

const dataPath = path.join(__dirname, "billing_consolidated.json");
const data     = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

async function run() {
  let total = 0;
  Object.values(data).forEach(m => total += Object.keys(m).length);
  console.log(`\n🚀 Importando histórico: ${Object.keys(data).length} clientes | ${total} registros mensais\n`);

  let ok = 0, fail = 0;

  for (const [clienteNome, meses] of Object.entries(data)) {
    for (const [mesAno, valores] of Object.entries(meses)) {
      try {
        await db.send(new PutCommand({
          TableName: TABLE,
          Item: {
            clienteNome,
            mesAno,
            consumo_usd:  valores.consumo_usd  || 0,
            valor_nf_brl: valores.valor_nf_brl || 0,
            cotacao:      valores.cotacao       || 0,
            updatedAt:    new Date().toISOString(),
          },
        }));
        ok++;
      } catch (err) {
        console.error(`  ✗  ${clienteNome} / ${mesAno} — ${err.message}`);
        fail++;
      }
    }
    console.log(`  ✓  ${clienteNome} — ${Object.keys(meses).length} meses importados`);
  }

  console.log(`\n✅ Concluído: ${ok} registros importados | ${fail} erros\n`);
}

run();
