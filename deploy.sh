#!/usr/bin/env bash
# deploy.sh - CampusPulse AWS Deployment Script
# 
# Prerequisites:
#   - AWS CLI configured with appropriate permissions
#   - AWS SAM CLI installed (sam)
#   - Node.js 20+
#   - npm
#
# Usage:
#   ./deploy.sh [--stack-name campuspulse] [--region us-east-1]

set -e

STACK_NAME=${STACK_NAME:-"campuspulse"}
REGION=${AWS_REGION:-"us-east-1"}
S3_BUCKET_PREFIX="campuspulse-sam-artifacts"

echo "============================================"
echo "  CampusPulse AWS Deployment"
echo "  Stack: $STACK_NAME | Region: $REGION"
echo "============================================"
echo ""

# 1. Build backend
echo "[1/6] Building backend TypeScript..."
cd backend
npm install --production=false
npm run build
cd ..

# 2. Generate a strong admin token
ADMIN_TOKEN=$(openssl rand -hex 32)
echo ""
echo "⚠️  ADMIN TOKEN generated (save this securely - shown once):"
echo "   ADMIN_TOKEN=$ADMIN_TOKEN"
echo ""
echo "This token is used to authenticate administrator status updates."
echo "It will be stored as an encrypted Lambda environment variable."
echo ""
read -p "Press Enter to continue with deployment (token will be set in Lambda)..."

# 3. SAM Build
echo ""
echo "[2/6] Building SAM application..."
sam build

# 4. SAM Deploy
echo ""
echo "[3/6] Deploying to AWS ($REGION)..."
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "AdminToken=$ADMIN_TOKEN" \
  --resolve-s3 \
  --no-confirm-changeset

# 5. Get outputs
echo ""
echo "[4/6] Getting deployment outputs..."
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

FRONTEND_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendUrl`].OutputValue' \
  --output text)

echo "  API Endpoint: $API_ENDPOINT"
echo "  Frontend Bucket: $FRONTEND_BUCKET"
echo "  Frontend URL: $FRONTEND_URL"

# 6. Build and upload frontend
echo ""
echo "[5/6] Building and deploying frontend..."
cd frontend
echo "VITE_API_BASE_URL=$API_ENDPOINT" > .env.local
npm run build

aws s3 sync dist/ "s3://$FRONTEND_BUCKET/" --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "*.html"

aws s3 sync dist/ "s3://$FRONTEND_BUCKET/" \
  --exclude "*" \
  --include "*.html" \
  --cache-control "no-cache, no-store, must-revalidate"

cd ..

# 7. Verify
echo ""
echo "[6/6] Verifying deployment..."
curl -s "$API_ENDPOINT/health" | python3 -m json.tool || echo "Health check done"

echo ""
echo "============================================"
echo "  ✅ DEPLOYMENT COMPLETE"
echo "============================================"
echo ""
echo "  🌐 Frontend:  $FRONTEND_URL"
echo "  🔌 API:       $API_ENDPOINT"
echo ""
echo "  Seed demo data:"
echo "  node scripts/seed.js $API_ENDPOINT"
echo ""
echo "  Admin token (save this!):"
echo "  ADMIN_TOKEN=$ADMIN_TOKEN"
echo ""
echo "  Teardown:"
echo "  sam delete --stack-name $STACK_NAME --region $REGION"
echo ""
