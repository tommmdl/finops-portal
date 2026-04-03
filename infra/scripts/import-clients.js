#!/usr/bin/env node
/**
 * import-clients.js
 * Importa os clientes da planilha FinOps para o DynamoDB.
 *
 * Uso:
 *   node scripts/import-clients.js --table finops-portal-prod-clients --region us-east-1
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const TABLE  = getArg("--table")  || process.env.CLIENTS_TABLE  || "finops-portal-prod-clients";
const REGION = getArg("--region") || process.env.AWS_REGION     || "us-east-1";

const client = new DynamoDBClient({ region: REGION });
const db     = DynamoDBDocumentClient.from(client);

const CLIENTS = [
  { nome: "3SAT", razaoSocial: "3SAT TECNOLOGIA LTDA", cnpj: "11.898.365/0001-00", ativo: "Não", consumo: 3617.60, responsavel: "N/A", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "589462084970", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Abbiamo", razaoSocial: "", cnpj: "", ativo: "Sim", consumo: 3000.00, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "", acessoConta: "Individual", contaPayer: "304125469780", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Asaas", razaoSocial: "ASAAS Gestão Financeira Instituição de Pagamento S.A.", cnpj: "19.540.550/0001-21", ativo: "Sim", consumo: 85691.41, responsavel: "Felipe Gomes", nivel: "Nível 1 - Acima de 50K", amCliente: "Ana Alves / Pedro Viana", acessoConta: "Individual", contaPayer: "431892402949", dashBI: "Liberar", cms: "Sim", pls: "Sim", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Atende Simples", razaoSocial: "DIGITALPRONTO SOLUCOES EMPRESARIAIS", cnpj: "18.341.365/0001-45", ativo: "Sim", consumo: 15009.03, responsavel: "Rafael Santiago", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Bernardo Ferreira / Pedro Viana", acessoConta: "Individual", contaPayer: "909735747869", dashBI: "Acessando", cms: "Sim", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Ativa GR", razaoSocial: "ATIVA GERENCIAMENTO DE RECURSOS SA", cnpj: "03.871.618/0001-15", ativo: "Sim", consumo: 3582.83, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "304320104887", dashBI: "Sem Acesso", cms: "Sim", pls: "Não", envioFatura: "Data Corte - dia 10", simplesNacional: "Não" },
  { nome: "Avita Seg", razaoSocial: "AVITA CORRETORA DE SEGUROS LTDA.", cnpj: "32.922.789/0001-24", ativo: "Sim", consumo: 516.27, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "311528621398", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Bloxs", razaoSocial: "BTR Serviços de Plataforma Eletrônica e Consultoria Empresarial LTDA", cnpj: "29.131.261/0001-22", ativo: "Sim", consumo: 1700.00, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "", acessoConta: "Solvimm", contaPayer: "701367923443", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Bolsa OTC", razaoSocial: "BOLSA OTC BRASIL LTDA", cnpj: "32.560.275/0001-76", ativo: "Sim", consumo: 5833.11, responsavel: "Rafael Santiago", nivel: "Nível 3 - Entre 5K e 10K", amCliente: "Levi Santos", acessoConta: "Sem Acesso", contaPayer: "138176362835", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Caju", razaoSocial: "EMPRESA BRASILEIRA BENEFICIOS LTDA", cnpj: "33.449.007/0001-44", ativo: "Sim", consumo: 162536.48, responsavel: "Felipe Gomes", nivel: "Nível 1 - Acima de 50K", amCliente: "Ana Alves / Pedro Viana", acessoConta: "Individual", contaPayer: "249711940607", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Compliance", razaoSocial: "Compliance Solucoes em Tecnologia e Servicos LTDA", cnpj: "20.319.833/0001-27", ativo: "Sim", consumo: 33905.85, responsavel: "Rafael Santiago", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "440744228568", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Crefaz", razaoSocial: "CREFAZ SOCIEDADE DE CREDITO AO MICROEMPREENDEDOR E A EMPRESA DE PEQUENO PORTE LTDA", cnpj: "18.188.384/0001-83", ativo: "Sim", consumo: 4332.69, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "", acessoConta: "Sem Acesso", contaPayer: "767398116076", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Datora", razaoSocial: "DATORA PARTICIPAÇÕES SERVICOS S.A.", cnpj: "07.704.246/0001-93", ativo: "Sim", consumo: 0.00, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "718201927637", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Delta Energia", razaoSocial: "Delta Comercializadora de Energia Ltda.", cnpj: "04.802.543/0001-83", ativo: "Sim", consumo: 26016.66, responsavel: "Rafael Santiago", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "448656396405", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Digesto", razaoSocial: "DIGESTO PESQUI E BANCO DE DADOS SA", cnpj: "17.866.399/0001-90", ativo: "Sim", consumo: 28629.42, responsavel: "Felipe Gomes", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "816826758843", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Easycarros", razaoSocial: "Easycarro Serviços de Tecnologia LTDA.", cnpj: "21.590.695/0001-89", ativo: "Sim", consumo: 14797.36, responsavel: "Rafael Santiago", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "405894866151", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Energisa", razaoSocial: "ENERGISA S/A", cnpj: "00.864.214/0001-06", ativo: "Sim", consumo: 19036.54, responsavel: "Felipe Gomes", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Rafael Santiago / Aline Lopes", acessoConta: "Individual", contaPayer: "436964453024", dashBI: "Liberar", cms: "Sim", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "F360/P2CR", razaoSocial: "P2CR SERVICOS DE INFORMATICA SA", cnpj: "18.519.837/0001-07", ativo: "Sim", consumo: 2600.00, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "207619413001", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Fiscontech", razaoSocial: "FISCONTECH DESENVOLVIMENTO E LICENCIAMENTO DE PROGRAMAS LTDA", cnpj: "32.125.987/0001-67", ativo: "Sim", consumo: 1530.93, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "229460349328", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Granito", razaoSocial: "Granito Instituição de Pagamentos SA.", cnpj: "22.177.858/0001-69", ativo: "Não", consumo: 36302.22, responsavel: "N/A", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Lucas Telles / Aline Lopes", acessoConta: "Sem Acesso", contaPayer: "924202243230", dashBI: "Liberar", cms: "Sim", pls: "Não", envioFatura: "Data Corte - dia 10", simplesNacional: "Não" },
  { nome: "GreenAnt", razaoSocial: "GREENANT BRASIL SISTEMAS INFORMA SA", cnpj: "21.855.107/0001-91", ativo: "Sim", consumo: 7068.41, responsavel: "Felipe Gomes", nivel: "Nível 3 - Entre 5K e 10K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "189719934136", dashBI: "Sem Acesso", cms: "Sim", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Housi", razaoSocial: "HOUSI GESTÃO PATRIMONIAL LTDA", cnpj: "30.032.993/0001-44", ativo: "Sim", consumo: 3779.78, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "722657063706", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Data Corte - dia 10", simplesNacional: "Não" },
  { nome: "IAPAJUS", razaoSocial: "IAPA - INSTITUTO DE APERFEICOAMENTO EM PRATICA DA ADVOCACIA LTDA", cnpj: "17.982.283/0001-17", ativo: "Não", consumo: 708.52, responsavel: "N/A", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "573071978455", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "ITS Rio", razaoSocial: "", cnpj: "", ativo: "Sim", consumo: 2000.00, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "", acessoConta: "Solvimm", contaPayer: "084654069625", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Jadlog", razaoSocial: "JADLOG LOGISTICA S.A.", cnpj: "04.884.082/0001-35", ativo: "Não", consumo: 11804.59, responsavel: "N/A", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Lucas Telles / Pedro Viana", acessoConta: "Individual", contaPayer: "285235263164", dashBI: "Acessando", cms: "Sim", pls: "Não", envioFatura: "Data Corte - dia 10", simplesNacional: "Não" },
  { nome: "Kovi", razaoSocial: "KOVI TECNOLOGIA LTDA", cnpj: "30.980.329/0001-27", ativo: "Não", consumo: 48677.51, responsavel: "N/A", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "905418001114", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Lead Energy", razaoSocial: "Lead Energy", cnpj: "38.422.829/0001-55", ativo: "Sim", consumo: 442.24, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "095936478543", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Linux Solutions", razaoSocial: "LINUX SOLUTIONS INFORMATICA EIRELI", cnpj: "03.519.862/0001-13", ativo: "Sim", consumo: 102.80, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "466605545841", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "MailerWeb/Techcube", razaoSocial: "TECHCUBE SOLUCOES EM TECNOLOGIA LTDA", cnpj: "11.335.921/0001-21", ativo: "Sim", consumo: 4347.21, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Ana Alves / Pedro Viana", acessoConta: "Solvimm", contaPayer: "137899003623", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "MobileMed", razaoSocial: "MOBILEMED SOLUCOES EM TECNOLOGIA PARA MEDICINA LTDA", cnpj: "11.004.614/0001-68", ativo: "Não", consumo: 19910.66, responsavel: "N/A", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Levi Santos", acessoConta: "Sem Acesso", contaPayer: "349519067826", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "OneLaudos", razaoSocial: "ONE LAUDOS DIAGNOSTICOS MEDICOS", cnpj: "24.516.372/0001-33", ativo: "Não", consumo: 0.00, responsavel: "N/A", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "031091896136", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "PedBot", razaoSocial: "", cnpj: "", ativo: "Não", consumo: 0.00, responsavel: "N/A", nivel: "Nível 1 - Acima de 50K", amCliente: "", acessoConta: "", contaPayer: "", dashBI: "Não", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Previsiown", razaoSocial: "PREVISIOWN SISTEMAS INFORMACAO LTDA", cnpj: "34.884.945/0001-35", ativo: "Sim", consumo: 2561.71, responsavel: "Rafael Santiago", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "034262321566", dashBI: "Sem Acesso", cms: "Sim", pls: "Não", envioFatura: "Padrão", simplesNacional: "Sim" },
  { nome: "Rediseg Tecnologia", razaoSocial: "REDISEG TECNOLOGIA SA", cnpj: "26.661.946/0001-92", ativo: "Sim", consumo: 31379.32, responsavel: "Rafael Santiago", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "923005598552", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Riverdata", razaoSocial: "RIVERDATA AI SYSTEMS LTDA", cnpj: "30.959.249/0001-90", ativo: "Sim", consumo: 0.00, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "", acessoConta: "Sem Acesso", contaPayer: "654654154725", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Robox + Rits", razaoSocial: "ROBOX SOLUCOES EM TECNOLOGIA LTDA", cnpj: "37.748.300/0001-63", ativo: "Sim", consumo: 1107.36, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "558589055054", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Sim" },
  { nome: "Rolim Wainstok", razaoSocial: "ROLIM WAINSTOK ADVOGADOS ASSOCIADOS", cnpj: "10.645.153/0002-20", ativo: "Sim", consumo: 2053.24, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "191014678510", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "SN Informática", razaoSocial: "SN INFORMÁTICA LTDA", cnpj: "04.226.144/0001-11", ativo: "Sim", consumo: 1.44, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "560942648759", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Solfácil", razaoSocial: "Solfacil Energia Solar Tecnologia e Serviços Financeiros Ltda", cnpj: "31.931.053/0001-50", ativo: "Sim", consumo: 66279.11, responsavel: "Felipe Gomes", nivel: "Nível 1 - Acima de 50K", amCliente: "Bernardo Ferreira / Pedro Viana", acessoConta: "Sem Acesso", contaPayer: "414138228043", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Data Corte - dia 10", simplesNacional: "Não" },
  { nome: "StayFilm", razaoSocial: "Stayfilm Servicos Online LTDA", cnpj: "16.694.056/0001-23", ativo: "Sim", consumo: 1644.95, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "495585640584", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Swap", razaoSocial: "SWAP MEIOS DE PAGAMENTOS INSTITUICAO DE PAGAMENTO S.A.", cnpj: "31.680.151/0001-61", ativo: "Sim", consumo: 103453.77, responsavel: "Felipe Gomes", nivel: "Nível 1 - Acima de 50K", amCliente: "Bernardo Ferreira / Pedro Viana", acessoConta: "Individual", contaPayer: "896303551860", dashBI: "Liberar", cms: "Sim", pls: "Sim", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Telelaudo", razaoSocial: "TELELAUDO TECNOLOGIA MÉDICA LTDA", cnpj: "11.217.530/0001-02", ativo: "Sim", consumo: 11143.95, responsavel: "Felipe Gomes", nivel: "Nível 3 - Entre 5K e 10K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "721690112786", dashBI: "Sem Acesso", cms: "Sim", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Tem Saude", razaoSocial: "TEM ADMINISTRADORA DE CARTOES S.A.", cnpj: "09.216.007/0001-10", ativo: "Não", consumo: 22715.58, responsavel: "N/A", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "Levi Santos", acessoConta: "Individual", contaPayer: "064521993999", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Truckpag", razaoSocial: "CIOTPAG MEIOS DE PAGAMENTO S/A", cnpj: "33.534.217/0001-30", ativo: "Não", consumo: 9267.65, responsavel: "N/A", nivel: "Nível 3 - Entre 5K e 10K", amCliente: "Levi Santos", acessoConta: "Solvimm", contaPayer: "794399191098", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Ubots", razaoSocial: "", cnpj: "", ativo: "Sim", consumo: 12054.65, responsavel: "Rafael Santiago", nivel: "Nível 2 - Entre 10k e 50K", amCliente: "", acessoConta: "Individual", contaPayer: "331249686118", dashBI: "Liberar", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
  { nome: "Wilson Sons", razaoSocial: "WILSON SONS SERVIÇOS MARITIMOS LTDA", cnpj: "03.562.124/0014-73", ativo: "Sim", consumo: 87051.77, responsavel: "Rafael Santiago", nivel: "Nível 1 - Acima de 50K", amCliente: "Rafael Santiago / Aline Lopes", acessoConta: "Individual", contaPayer: "391747331706", dashBI: "Acessando", cms: "Sim", pls: "Não", envioFatura: "Data Corte - dia 10", simplesNacional: "Não" },
  { nome: "Xvision", razaoSocial: "Xvision Tecnologia da Informação SA", cnpj: "17.114.355/0001-04", ativo: "Sim", consumo: 3217.37, responsavel: "Felipe Gomes", nivel: "Nível 4 - Abaixo de 5K", amCliente: "Levi Santos", acessoConta: "Sem Acesso", contaPayer: "526113637205", dashBI: "Sem Acesso", cms: "Não", pls: "Não", envioFatura: "Padrão", simplesNacional: "Não" },
];

async function run() {
  console.log(`\n🚀 Importando ${CLIENTS.length} clientes para ${TABLE} (${REGION})...\n`);
  let ok = 0, fail = 0;

  for (const c of CLIENTS) {
    try {
      await db.send(new PutCommand({
        TableName: TABLE,
        Item: {
          id:        randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...c,
        },
      }));
      console.log(`  ✓ ${c.nome}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${c.nome} — ${err.message}`);
      fail++;
    }
  }

  console.log(`\n✅ Importação concluída: ${ok} ok | ${fail} erros\n`);
}

run();
