const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const TABLE         = process.env.CLIENTS_TABLE;
const BILLING_TABLE = process.env.BILLING_TABLE;

const resp = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://main.d4uovab8e7t0i.amplifyapp.com",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path   = event.path;
  const id     = event.pathParameters?.id;

  // Preflight CORS
  if (method === "OPTIONS") return resp(200, {});

  try {
    // ── GET /clients ──────────────────────────────────────────
    if (method === "GET" && path === "/clients") {
      const qp = event.queryStringParameters || {};
      let items;

      if (qp.responsavel) {
        const r = await db.send(new QueryCommand({
          TableName: TABLE,
          IndexName: "ByResponsavel",
          KeyConditionExpression: "responsavel = :r",
          ExpressionAttributeValues: { ":r": qp.responsavel },
        }));
        items = r.Items;
      } else if (qp.nivel) {
        const r = await db.send(new QueryCommand({
          TableName: TABLE,
          IndexName: "ByNivel",
          KeyConditionExpression: "nivel = :n",
          ExpressionAttributeValues: { ":n": qp.nivel },
        }));
        items = r.Items;
      } else if (qp.ativo) {
        const r = await db.send(new QueryCommand({
          TableName: TABLE,
          IndexName: "ByAtivo",
          KeyConditionExpression: "ativo = :a",
          ExpressionAttributeValues: { ":a": qp.ativo },
        }));
        items = r.Items;
      } else {
        const r = await db.send(new ScanCommand({ TableName: TABLE }));
        items = r.Items;
      }

      // Ordenar por consumo decrescente
      items.sort((a, b) => (b.consumo || 0) - (a.consumo || 0));
      return resp(200, { items, count: items.length });
    }

    // ── GET /clients/:id/report-data ─────────────────────────
    if (method === "GET" && id && path.endsWith("/report-data")) {
      const clientResp = await db.send(new GetCommand({ TableName: TABLE, Key: { id } }));
      if (!clientResp.Item) return resp(404, { error: "Cliente não encontrado" });

      const clienteNome = clientResp.Item.nome;
      const now = new Date();
      const mesAnoValues = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (i + 1), 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      });

      const billingResp = await db.send(new QueryCommand({
        TableName: BILLING_TABLE,
        KeyConditionExpression: "clienteNome = :n",
        ExpressionAttributeValues: { ":n": clienteNome },
      }));

      const billingHistory = (billingResp.Items || [])
        .filter(item => mesAnoValues.includes(item.mesAno))
        .sort((a, b) => a.mesAno.localeCompare(b.mesAno));

      return resp(200, { client: clientResp.Item, billingHistory });
    }

    // ── GET /clients/:id ──────────────────────────────────────
    if (method === "GET" && id) {
      const r = await db.send(new GetCommand({ TableName: TABLE, Key: { id } }));
      if (!r.Item) return resp(404, { error: "Cliente não encontrado" });
      return resp(200, r.Item);
    }

    // ── POST /clients ─────────────────────────────────────────
    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (!body.nome) return resp(400, { error: "Campo 'nome' é obrigatório" });

      const item = {
        id:              randomUUID(),
        nome:            body.nome,
        razaoSocial:     body.razaoSocial     || "",
        cnpj:            body.cnpj            || "",
        ativo:           body.ativo           || "Sim",
        consumo:         Number(body.consumo) || 0,
        responsavel:     body.responsavel     || "",
        nivel:           body.nivel           || "Nível 4 - Abaixo de 5K",
        amCliente:       body.amCliente       || "",
        acessoConta:     body.acessoConta     || "",
        contaPayer:      body.contaPayer      || "",
        dashBI:          body.dashBI          || "Sem Acesso",
        cms:             body.cms             || "Não",
        pls:             body.pls             || "Não",
        envioFatura:     body.envioFatura     || "Padrão",
        simplesNacional: body.simplesNacional || "Não",
        createdAt:       new Date().toISOString(),
        updatedAt:       new Date().toISOString(),
      };

      await db.send(new PutCommand({ TableName: TABLE, Item: item }));
      return resp(201, item);
    }

    // ── PUT /clients/:id ──────────────────────────────────────
    if (method === "PUT" && id) {
      const body = JSON.parse(event.body || "{}");
      const allowed = [
        "nome","razaoSocial","cnpj","ativo","consumo","responsavel",
        "nivel","amCliente","acessoConta","contaPayer","dashBI",
        "cms","pls","envioFatura","simplesNacional"
      ];

      const updates = [];
      const names   = {};
      const values  = { ":updatedAt": new Date().toISOString() };

      allowed.forEach(field => {
        if (body[field] !== undefined) {
          updates.push(`#${field} = :${field}`);
          names[`#${field}`]  = field;
          values[`:${field}`] = body[field];
        }
      });

      if (updates.length === 0) return resp(400, { error: "Nenhum campo para atualizar" });
      updates.push("#updatedAt = :updatedAt");
      names["#updatedAt"] = "updatedAt";

      const r = await db.send(new UpdateCommand({
        TableName:                 TABLE,
        Key:                       { id },
        UpdateExpression:          `SET ${updates.join(", ")}`,
        ExpressionAttributeNames:  names,
        ExpressionAttributeValues: values,
        ReturnValues:              "ALL_NEW",
      }));

      return resp(200, r.Attributes);
    }

    // ── DELETE /clients/:id ───────────────────────────────────
    if (method === "DELETE" && id) {
      await db.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
      return resp(200, { message: "Cliente removido com sucesso" });
    }

    // ── GET /billing/:clienteNome ─────────────────────────────
    if (method === "GET" && path.startsWith("/billing/")) {
      const clienteNome = decodeURIComponent(path.replace("/billing/", ""));
      const r = await db.send(new QueryCommand({
        TableName: BILLING_TABLE,
        KeyConditionExpression: "clienteNome = :n",
        ExpressionAttributeValues: { ":n": clienteNome },
      }));
      const items = (r.Items || []).sort((a, b) => a.mesAno.localeCompare(b.mesAno));
      return resp(200, { items, count: items.length });
    }

    return resp(404, { error: "Rota não encontrada" });

  } catch (err) {
    console.error("Lambda error:", err);
    return resp(500, { error: "Erro interno do servidor" });
  }
};

// ── GET /billing/:clienteNome ─────────────────────────────────
// (adicionar dentro do handler principal, antes do return 404)
