# CampusPulse — Serverless Campus Issue Tracker

> **AWS Cloud Innovation Challenge Submission**  
> A serverless, real-time campus facility management system built on AWS Lambda, DynamoDB, API Gateway, and S3.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org)
[![AWS SAM](https://img.shields.io/badge/AWS-SAM-orange.svg)](https://aws.amazon.com/serverless/sam/)

---

## 🎯 The Problem

Students on campus regularly encounter broken classroom equipment, Wi-Fi outages, hostel maintenance issues, and electrical problems. Currently these issues are reported through fragmented channels — email, WhatsApp, or in-person — making it impossible to track their status, measure response times, or identify recurring problems.

**This creates a frustrating experience for students and an operational blind spot for facilities teams.**

---

## 💡 The Solution

CampusPulse is a lightweight, serverless issue-tracking platform where:

- **Students** report issues in under 30 seconds with category, location, priority, and description
- **Facilities administrators** update issue statuses with a protected admin workflow  
- **Everyone** can browse and search issues with live data from DynamoDB
- **Dashboard** shows real-time counts: Open, In Progress, Resolved

No servers to maintain. No infrastructure to manage. Scales from 0 to thousands of reports automatically.

---

## 🏗️ Architecture

```
Student Browser
      │
      │  HTTPS
      ▼
┌─────────────────┐        ┌──────────────────────┐
│   Amazon S3     │        │  Amazon API Gateway   │
│  (React SPA)    │───────▶│   HTTP API (prod)     │
│  Static hosting │        │  CORS-enabled         │
└─────────────────┘        └──────────┬───────────┘
                                      │  AWS_PROXY
                                      ▼
                           ┌──────────────────────┐
                           │   AWS Lambda          │
                           │  Node.js 20.x         │
                           │  TypeScript compiled  │
                           │  Least-privilege IAM  │
                           └──────────┬───────────┘
                                      │  AWS SDK v3
                                      ▼
                           ┌──────────────────────┐
                           │   Amazon DynamoDB     │
                           │  On-demand billing    │
                           │  PAY_PER_REQUEST      │
                           │  GSI: status+date     │
                           └──────────────────────┘
```

### How Each AWS Service Contributes

| Service | Role | Why |
|---|---|---|
| **Amazon S3** | Hosts React SPA static assets | Zero server cost, infinitely scalable, built-in static website hosting |
| **API Gateway HTTP API** | Routes HTTP requests, handles CORS | Fully managed, auto-scales, sub-millisecond overhead vs REST API |
| **AWS Lambda** | Executes business logic and validation | Pay-per-request, zero idle cost, auto-scales to demand |
| **Amazon DynamoDB** | Persists all issue data | Single-digit ms latency, serverless, on-demand capacity, zero maintenance |

### Why Serverless?

- **Zero idle cost**: Lambda only charges for actual execution time
- **Auto-scaling**: Handles 1 request or 10,000 with no configuration
- **No server maintenance**: No OS patching, no capacity planning
- **High availability**: Multi-AZ by default across all services

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- AWS CLI configured (`aws configure`)
- AWS SAM CLI ([install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- An AWS account with Lambda, DynamoDB, API Gateway, S3, and IAM permissions

### Deploy to AWS (5–10 minutes)

**Windows (PowerShell):**
```powershell
# Clone and enter project
git clone https://github.com/YOUR_USERNAME/CampusPulse.git
cd CampusPulse

# Configure AWS credentials
aws configure

# Deploy everything
.\deploy.ps1 -StackName campuspulse -Region us-east-1
```

**Linux/macOS (bash):**
```bash
git clone https://github.com/YOUR_USERNAME/CampusPulse.git
cd CampusPulse
aws configure
chmod +x deploy.sh
./deploy.sh
```

The deployment script will:
1. Build the TypeScript backend
2. Generate a secure admin token (shown once — save it!)
3. Deploy Lambda + API Gateway + DynamoDB via SAM
4. Build the React frontend with the live API endpoint
5. Upload frontend to S3

### Seed Demo Data

After deployment, populate 5 realistic sample issues:

```bash
node scripts/seed.js https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod
```

---

## 🔧 Manual Deployment Steps

If you prefer to deploy step-by-step:

```bash
# 1. Build backend
cd backend
npm install
npm run build
cd ..

# 2. Generate a secure admin token
ADMIN_TOKEN=$(openssl rand -hex 32)

# 3. SAM build and deploy
sam build
sam deploy \
  --stack-name campuspulse \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "AdminToken=$ADMIN_TOKEN" \
  --resolve-s3

# 4. Get API endpoint from outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name campuspulse \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# 5. Build and deploy frontend
cd frontend
echo "VITE_API_BASE_URL=$API_ENDPOINT" > .env.local
npm install
npm run build
aws s3 sync dist/ s3://$(aws cloudformation describe-stacks \
  --stack-name campuspulse \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)/
```

---

## 🔒 Security Design

### Administrator Token

The status-update endpoint (`PATCH /issues/{id}`) requires a secret administrator token:

- **Never embedded** in the frontend bundle
- **Generated at deploy time** using `openssl rand -hex 32`
- **Stored as an encrypted Lambda environment variable** (AWS encrypts at rest)
- **Transmitted only over HTTPS** in the `X-Admin-Token` header
- **Compared server-side** with constant-time awareness (no logging)
- **Frontend prompts at runtime** — token stays in memory only while the admin panel is open

### Security Limitations (Prototype)

⚠️ **This is a demonstration prototype, not production software:**

- No real user authentication or role-based access control
- The admin token is a shared secret, not per-user credentials
- DynamoDB Scan is used for listing (suitable for < 10,000 items; add Query with GSI for production scale)
- No rate limiting on the API (add AWS WAF or API Gateway throttling for production)
- S3 static website hosting uses public read access (use CloudFront + OAC for production)

---

## 📡 API Documentation

Base URL: `https://{api-id}.execute-api.{region}.amazonaws.com/prod`

### `GET /health`
Returns API health status.

```json
{
  "status": "healthy",
  "service": "CampusPulse API",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### `GET /issues`
List all issues with optional filters.

**Query Parameters:**
- `status`: `open | in_progress | resolved | closed`
- `category`: `wifi | classroom_equipment | maintenance | electrical | plumbing | security | lost_found | other`
- `priority`: `low | medium | high | critical`

```bash
curl "$API/issues?status=open&priority=high"
```

### `GET /issues/{id}`
Get a single issue by ID.

```bash
curl "$API/issues/550e8400-e29b-41d4-a716-446655440000"
```

### `POST /issues`
Create a new issue.

**Required fields:** `title`, `description`, `category`, `location`, `priority`  
**Optional:** `reporterName`

```bash
curl -X POST "$API/issues" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Projector broken in CS101",
    "description": "The projector has been blank since Monday, blocking all lectures.",
    "category": "classroom_equipment",
    "location": "CS Building - Room 101",
    "priority": "high",
    "reporterName": "Alex Chen"
  }'
```

### `PATCH /issues/{id}`
Update issue status. **Requires admin token.**

```bash
curl -X PATCH "$API/issues/{id}" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -d '{"status": "in_progress"}'
```

---

## 🧪 Running Tests

```bash
cd backend
npm test

# With coverage
npm run test:coverage
```

Tests are **unit tests with mocked DynamoDB** — no AWS credentials required.

**21 tests covering:**
- Input validation (all required fields, min/max lengths)
- Issue creation, retrieval, and listing
- Invalid category/priority/status rejection
- Missing issue (404) handling
- Admin token authentication
- Invalid token rejection
- Missing ADMIN_TOKEN configuration
- Empty list handling

---

## 💻 Local Development & Evaluation (Offline / No AWS required)

You can run and evaluate the complete full-stack application locally in 60 seconds with zero AWS credentials:

### 1. Start the Local API Server
```bash
cd backend
npm install
npm run dev
# Server starts on http://localhost:3001 with In-Memory storage (USE_LOCAL_STORAGE=true)
# Default Admin Token: campuspulse-admin-token-2026
```

### 2. Seed Sample Data (Optional)
In another terminal:
```bash
node scripts/seed.js http://localhost:3001
```

### 3. Start the Frontend
In another terminal:
```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:3001" > .env.local
npm run dev
# Frontend runs on http://localhost:3000
```

### 4. Or use SAM Local (with Docker)
```bash
sam local start-api --env-vars backend/.env.example
```

---

## 💰 Cost Considerations

This architecture is designed to run within or near AWS Free Tier:

| Service | Free Tier | Typical Cost After |
|---|---|---|
| Lambda | 1M requests/month, 400K GB-s | ~\$0.20 per 1M requests |
| DynamoDB | 25 GB storage, 25 RCU/WCU | On-demand: \$1.25/M writes, \$0.25/M reads |
| API Gateway | 1M HTTP API calls/month | \$1.00 per 1M calls |
| S3 | 5 GB storage, 20K GET requests | < \$1/month for typical frontend |
| CloudWatch | Basic metrics free | Minimal cost |

**Estimated monthly cost for a small campus (< 1,000 issues):** \$0–\$5/month

---

## 🧹 Teardown / Cleanup

```bash
# Delete all AWS resources (Lambda, DynamoDB, API Gateway, S3 bucket)
sam delete --stack-name campuspulse --region us-east-1

# Note: The S3 frontend bucket must be emptied before deletion
aws s3 rm s3://YOUR_FRONTEND_BUCKET --recursive
```

⚠️ **DynamoDB data will be permanently deleted.** Export any data you want to keep first.

---

## 📋 Demo Script (2–3 minutes)

1. **Open frontend** — Show the dashboard (live counts from DynamoDB)
2. **Dashboard overview** — Point out status cards: Open, In Progress, Resolved
3. **Submit new issue** — Fill in: "Fire exit blocked in hostel" | Maintenance | High
4. **Verify in list** — Navigate to Browse Issues, see the new report at the top
5. **Refresh page** — Dashboard updates, confirming DynamoDB persistence
6. **Open issue detail** — Click the issue, show all metadata
7. **Admin update** — Click "Update status (Administrator)", enter token, change to "In Progress"
8. **Dashboard reflects change** — Navigate back, Open count decreased, In Progress increased

---

## 📁 Project Structure

```
CampusPulse/
├── template.yaml          # AWS SAM infrastructure-as-code
├── deploy.sh              # Linux/macOS deployment script
├── deploy.ps1             # Windows PowerShell deployment script
├── .gitignore
├── LICENSE
├── README.md
│
├── backend/               # Lambda function source
│   ├── src/
│   │   ├── handler.ts     # Lambda entry point + routing
│   │   ├── routes/
│   │   │   ├── health.ts  # GET /health
│   │   │   └── issues.ts  # CRUD for issues
│   │   ├── db/
│   │   │   └── dynamodb.ts # DynamoDB operations
│   │   └── types/
│   │       └── issue.ts   # TypeScript types
│   ├── tests/
│   │   ├── helpers.ts     # Test utilities
│   │   └── issues.test.ts # Unit tests (21 tests)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/              # React SPA
│   ├── src/
│   │   ├── App.tsx        # Complete UI (Dashboard, Form, List, Detail)
│   │   ├── api.ts         # Axios-based API client
│   │   ├── types.ts       # Shared TypeScript types
│   │   └── index.css      # Tailwind + custom styles
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
└── scripts/
    └── seed.js            # Demo data seeding script
```

---

## 🛠️ Tech Stack

**Backend:**
- Node.js 20.x (Lambda runtime)
- TypeScript 5.5
- AWS SDK for JavaScript v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`)
- UUID v10 for issue IDs
- Jest + ts-jest for unit testing

**Frontend:**
- React 18 + TypeScript
- Vite 5 (build tool)
- Tailwind CSS (utility-first styling)
- Lucide React (icons)
- Axios (HTTP client)

**Infrastructure:**
- AWS SAM (CloudFormation transform)
- DynamoDB on-demand billing
- API Gateway HTTP API
- Lambda Node.js 20.x
- S3 static website hosting

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and run tests: `npm test`
4. Commit with a descriptive message
5. Push and open a Pull Request

---

## 📄 License

[MIT License](LICENSE) — See LICENSE file for details.
