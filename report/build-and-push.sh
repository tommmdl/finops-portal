#!/usr/bin/env bash
# Builda a imagem Docker do report-lambda e faz push para o ECR.
#
# Uso:
#   ./build-and-push.sh                        # usa outputs do terraform (infra/)
#   ./build-and-push.sh <ecr_url> [região]     # passa a URL manualmente
#
# Exemplos:
#   ./build-and-push.sh
#   ./build-and-push.sh 123456789.dkr.ecr.us-east-1.amazonaws.com/finops-portal-prod-report
#   ./build-and-push.sh 123456789.dkr.ecr.us-east-1.amazonaws.com/finops-portal-prod-report us-east-1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra"

# ── Parâmetros ────────────────────────────────────────────────
if [ $# -ge 1 ]; then
  ECR_URL="$1"
  AWS_REGION="${2:-us-east-1}"
else
  echo "Buscando ECR URL via terraform output..."
  cd "$INFRA_DIR"
  ECR_URL=$(terraform output -raw report_ecr_url 2>/dev/null)
  AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-east-1")
  cd "$SCRIPT_DIR"
fi

if [ -z "$ECR_URL" ]; then
  echo "Erro: não foi possível obter a URL do ECR."
  echo "Execute 'terraform apply' em infra/ ou passe a URL como argumento."
  exit 1
fi

AWS_ACCOUNT_ID=$(echo "$ECR_URL" | cut -d'.' -f1)
IMAGE_TAG="latest"
FULL_IMAGE="$ECR_URL:$IMAGE_TAG"

echo ""
echo "ECR URL  : $ECR_URL"
echo "Região   : $AWS_REGION"
echo "Imagem   : $FULL_IMAGE"
echo ""

# ── Login no ECR ──────────────────────────────────────────────
echo "[ 1/3 ] Login no ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# ── Build ─────────────────────────────────────────────────────
echo ""
echo "[ 2/3 ] Build da imagem (plataforma linux/amd64)..."
docker build \
  --platform linux/amd64 \
  -f "$SCRIPT_DIR/Dockerfile.lambda" \
  -t "$FULL_IMAGE" \
  "$SCRIPT_DIR"

# ── Push ──────────────────────────────────────────────────────
echo ""
echo "[ 3/3 ] Push para o ECR..."
docker push "$FULL_IMAGE"

echo ""
echo "Imagem publicada com sucesso: $FULL_IMAGE"
echo ""
echo "Para atualizar a Lambda sem re-aplicar o terraform:"
echo "  aws lambda update-function-code \\"
echo "    --function-name \$(cd $INFRA_DIR && terraform output -raw report_lambda_name) \\"
echo "    --image-uri $FULL_IMAGE \\"
echo "    --region $AWS_REGION"
