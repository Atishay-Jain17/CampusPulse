# CampusPulse — Manual AWS Deployment Guide
# For use when SAM CLI is unavailable
# Uses AWS CLI + CloudFormation + Lambda zip deployment

$ErrorActionPreference = "Stop"
$Region = "us-east-1"
$StackName = "campuspulse"
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CampusPulse Manual AWS CLI Deployment" -ForegroundColor Cyan
Write-Host "  Stack: $StackName | Region: $Region" -ForegroundColor Cyan
Write-Host "============================================"
Write-Host ""

# Verify AWS credentials
Write-Host "[0/7] Verifying AWS credentials..." -ForegroundColor Yellow
aws sts get-caller-identity
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ AWS credentials not configured. Run: aws configure" -ForegroundColor Red
    Write-Host "   You need: AWS Access Key ID, Secret Access Key, Region (us-east-1)" -ForegroundColor Yellow
    exit 1
}

# 1. Build backend
Write-Host ""
Write-Host "[1/7] Building backend TypeScript..." -ForegroundColor Yellow
Set-Location backend
npm install --production=false
npm run build
Set-Location ..

# 2. Create Lambda deployment package
Write-Host ""
Write-Host "[2/7] Creating Lambda deployment package..." -ForegroundColor Yellow
Set-Location backend
npm install --production  # Only production deps
Compress-Archive -Path dist\*, node_modules\* -DestinationPath ..\lambda-package.zip -Force
npm install  # Restore dev deps
Set-Location ..
Write-Host "  Created lambda-package.zip ($('{0:N1}' -f ((Get-Item lambda-package.zip).Length / 1MB)) MB)"

# 3. Create S3 bucket for Lambda code and frontend
$AccountId = (aws sts get-caller-identity --query Account --output text)
$LambdaBucket = "campuspulse-deployment-$AccountId-$Region"
$FrontendBucket = "campuspulse-frontend-$AccountId-$Region"

Write-Host ""
Write-Host "[3/7] Creating S3 buckets..." -ForegroundColor Yellow
# Lambda artifacts bucket
aws s3 mb "s3://$LambdaBucket" --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Bucket $LambdaBucket already exists - OK"
}

# Upload Lambda zip
aws s3 cp lambda-package.zip "s3://$LambdaBucket/lambda-package.zip"
Write-Host "  Uploaded Lambda package to S3"

# 4. Generate admin token
$AdminToken = -join ((1..64) | ForEach-Object { '{0:X}' -f (Get-Random -Max 16) })
Write-Host ""
Write-Host "⚠️  ADMIN TOKEN (save this - shown only once):" -ForegroundColor Red
Write-Host "   ADMIN_TOKEN=$AdminToken" -ForegroundColor White

# 5. Deploy CloudFormation stack
Write-Host ""
Write-Host "[4/7] Deploying CloudFormation stack..." -ForegroundColor Yellow

# Create CloudFormation template with S3 reference
$CFTemplate = @"
AWSTemplateFormatVersion: '2010-09-09'
Description: CampusPulse via CloudFormation (no SAM)

Parameters:
  AdminToken:
    Type: String
    NoEcho: true
  LambdaS3Bucket:
    Type: String
  LambdaS3Key:
    Type: String

Resources:
  IssuesTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: campuspulse-issues
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH

  LambdaRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: campuspulse-lambda-role
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: DynamoDBAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:GetItem
                  - dynamodb:PutItem
                  - dynamodb:UpdateItem
                  - dynamodb:Scan
                  - dynamodb:Query
                Resource: !GetAtt IssuesTable.Arn

  LambdaFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: campuspulse-api
      Runtime: nodejs24.x
      Handler: dist/handler.handler
      Role: !GetAtt LambdaRole.Arn
      Code:
        S3Bucket: !Ref LambdaS3Bucket
        S3Key: !Ref LambdaS3Key
      Timeout: 30
      MemorySize: 256
      Environment:
        Variables:
          TABLE_NAME: !Ref IssuesTable
          ADMIN_TOKEN: !Ref AdminToken

  HttpApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: campuspulse-api
      ProtocolType: HTTP
      CorsConfiguration:
        AllowOrigins:
          - '*'
        AllowMethods:
          - GET
          - POST
          - PATCH
          - OPTIONS
        AllowHeaders:
          - Content-Type
          - X-Admin-Token

  ApiIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref HttpApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !GetAtt LambdaFunction.Arn
      PayloadFormatVersion: '2.0'

  ApiRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref HttpApi
      RouteKey: '$default'
      Target: !Sub 'integrations/${ApiIntegration}'

  ApiStage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      ApiId: !Ref HttpApi
      StageName: prod
      AutoDeploy: true

  LambdaPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !GetAtt LambdaFunction.Arn
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${HttpApi}/*'

  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'campuspulse-frontend-${AWS::AccountId}-${AWS::Region}'
      WebsiteConfiguration:
        IndexDocument: index.html
        ErrorDocument: index.html

  FrontendBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref FrontendBucket
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal: '*'
            Action: s3:GetObject
            Resource: !Sub '${FrontendBucket.Arn}/*'

Outputs:
  ApiEndpoint:
    Value: !Sub 'https://${HttpApi}.execute-api.${AWS::Region}.amazonaws.com/prod'
  FrontendBucketName:
    Value: !Ref FrontendBucket
  FrontendUrl:
    Value: !GetAtt FrontendBucket.WebsiteURL
"@

$CFTemplate | Out-File -FilePath cf-template.yaml -Encoding utf8

aws cloudformation deploy `
    --template-file cf-template.yaml `
    --stack-name $StackName `
    --region $Region `
    --capabilities CAPABILITY_NAMED_IAM `
    --parameter-overrides `
        "AdminToken=$AdminToken" `
        "LambdaS3Bucket=$LambdaBucket" `
        "LambdaS3Key=lambda-package.zip"

# 6. Get outputs
Write-Host ""
Write-Host "[5/7] Getting deployment outputs..." -ForegroundColor Yellow
$ApiEndpoint = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" `
    --output text

$FrontendBucketName = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" `
    --output text

$FrontendUrl = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" `
    --output text

Write-Host "  API Endpoint: $ApiEndpoint"
Write-Host "  Frontend Bucket: $FrontendBucketName"
Write-Host "  Frontend URL: $FrontendUrl"

# 7. Build and deploy frontend
Write-Host ""
Write-Host "[6/7] Building and deploying frontend..." -ForegroundColor Yellow
Set-Location frontend
"VITE_API_BASE_URL=$ApiEndpoint" | Out-File -FilePath .env.local -Encoding utf8
npm run build
aws s3 sync dist/ "s3://$FrontendBucketName/" --delete
Set-Location ..

# 8. Verify
Write-Host ""
Write-Host "[7/7] Verifying deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Invoke-RestMethod -Uri "$ApiEndpoint/health" | ConvertTo-Json

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✅ DEPLOYMENT COMPLETE (No SAM needed!)" -ForegroundColor Green
Write-Host "============================================"
Write-Host ""
Write-Host "  🌐 Frontend: $FrontendUrl"
Write-Host "  🔌 API:      $ApiEndpoint"
Write-Host ""
Write-Host "  Seed demo data:"
Write-Host "  node scripts/seed.js $ApiEndpoint"
Write-Host ""
Write-Host "  Admin token (save this!):"
Write-Host "  ADMIN_TOKEN=$AdminToken" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Teardown:"
Write-Host "  aws cloudformation delete-stack --stack-name $StackName --region $Region"
Write-Host "  aws s3 rm s3://$FrontendBucketName --recursive"
Write-Host "  aws s3 rm s3://$LambdaBucket --recursive"
