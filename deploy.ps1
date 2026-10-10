# deploy.ps1 - CampusPulse Windows Deployment Script
# 
# Prerequisites:
#   - AWS CLI configured (aws configure OR set AWS_PROFILE)
#   - AWS SAM CLI installed
#   - Node.js 20+
#
# Usage:
#   .\deploy.ps1 [-StackName campuspulse] [-Region us-east-1]

param(
    [string]$StackName = "campuspulse",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

# Auto-detect Python Scripts and AWS CLI paths
$PythonScripts = "$HOME\AppData\Roaming\Python\Python314\Scripts"
if (Test-Path $PythonScripts) {
    $env:Path = "$PythonScripts;" + $env:Path
}
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User') + ';' + $env:Path
$env:SAM_CLI_TELEMETRY = 0

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CampusPulse AWS Deployment (Windows)" -ForegroundColor Cyan
Write-Host "  Stack: $StackName | Region: $Region" -ForegroundColor Cyan
Write-Host "============================================"
Write-Host ""

# Verify AWS CLI and Credentials
Write-Host "[0/6] Checking AWS credentials..." -ForegroundColor Yellow
$Identity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ AWS credentials are not configured or expired." -ForegroundColor Red
    Write-Host "   Please run 'aws configure' in your terminal and provide:" -ForegroundColor Yellow
    Write-Host "   - AWS Access Key ID" -ForegroundColor White
    Write-Host "   - AWS Secret Access Key" -ForegroundColor White
    Write-Host "   - Default region name (e.g. us-east-1)" -ForegroundColor White
    Write-Host "   Then re-run .\deploy.ps1" -ForegroundColor Yellow
    Write-Host ""
    exit 1
} else {
    Write-Host "  ✅ Connected as: $Identity" -ForegroundColor Green
}


# 1. Build backend
Write-Host "[1/6] Building backend TypeScript..." -ForegroundColor Yellow
Set-Location backend
npm install --production=false
npm run build
Set-Location ..

# 2. Generate admin token
$AdminToken = -join ((1..64) | ForEach-Object { '{0:X}' -f (Get-Random -Max 16) })
Write-Host ""
Write-Host "⚠️  ADMIN TOKEN (save this - shown only once):" -ForegroundColor Red
Write-Host "   ADMIN_TOKEN=$AdminToken" -ForegroundColor White
Write-Host ""
Write-Host "This token authenticates administrator status updates."
Read-Host "Press Enter to continue deployment"

# 3. SAM Build and Deploy
Write-Host ""
Write-Host "[2/6] SAM build..." -ForegroundColor Yellow
sam build

Write-Host ""
Write-Host "[3/6] SAM deploy to AWS..." -ForegroundColor Yellow
sam deploy `
    --stack-name $StackName `
    --region $Region `
    --capabilities CAPABILITY_IAM `
    --parameter-overrides "AdminToken=$AdminToken" `
    --resolve-s3 `
    --no-confirm-changeset

# 4. Get outputs
Write-Host ""
Write-Host "[4/6] Getting deployment outputs..." -ForegroundColor Yellow
$ApiEndpoint = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" `
    --output text

$FrontendBucket = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" `
    --output text

$FrontendUrl = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" `
    --output text

Write-Host "  API: $ApiEndpoint"
Write-Host "  Frontend Bucket: $FrontendBucket"
Write-Host "  Frontend URL: $FrontendUrl"

# 5. Build and deploy frontend
Write-Host ""
Write-Host "[5/6] Building frontend..." -ForegroundColor Yellow
Set-Location frontend
"VITE_API_BASE_URL=$ApiEndpoint" | Out-File -FilePath .env.local -Encoding utf8
npm run build

Write-Host ""
Write-Host "Uploading to S3..."
aws s3 sync dist/ "s3://$FrontendBucket/" --delete `
    --cache-control "public, max-age=31536000" `
    --exclude "*.html"

aws s3 sync dist/ "s3://$FrontendBucket/" `
    --exclude "*" `
    --include "*.html" `
    --cache-control "no-cache, no-store, must-revalidate"

Set-Location ..

# 6. Verify
Write-Host ""
Write-Host "[6/6] Verifying health..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$ApiEndpoint/health" | ConvertTo-Json

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✅ DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "============================================"
Write-Host ""
Write-Host "  🌐 Frontend: $FrontendUrl"
Write-Host "  🔌 API:      $ApiEndpoint"
Write-Host ""
Write-Host "Seed demo data:"
Write-Host "  node scripts/seed.js $ApiEndpoint"
Write-Host ""
Write-Host "Admin token (save this!):"
Write-Host "  ADMIN_TOKEN=$AdminToken" -ForegroundColor Yellow
Write-Host ""
Write-Host "Teardown:"
Write-Host "  sam delete --stack-name $StackName --region $Region"
