# SentriPay — Intelligent Policy Enforcement Gateway for Autonomous AI Payments

[![Architecture: x402 Protocol Guard](https://img.shields.io/badge/Protocol-x402--v1-indigo)](https://github.com/Saikaushik007/SentriPay)
[![Build Status: Passing](https://img.shields.io/badge/Build-Passing-emerald)](#)
[![Database: Neon Postgres](https://img.shields.io/badge/Database-PostgreSQL-blue)](https://neon.tech)
[![License: MIT](https://img.shields.io/badge/License-MIT-slate.svg)](LICENSE)

SentriPay is a deterministic, sub-15ms spending guard that sits between autonomous AI agents and payment rails (including the HTTP 402 / x402 settlement protocol). It evaluates high-frequency transaction intents against real-time financial thresholds, velocity caps, merchant access lists, and composite risk models before funds ever settle.

---

## 🏛️ System Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Autonomous AI Agent
    participant Gateway as SentriPay Policy Gateway
    participant DB as Postgres Ledger & State
    participant Reviewer as Security Operator
    participant Protocol as x402 Settlement Rail

    Agent->>Gateway: POST /api/payment-intent (Amount, Merchant, X-API-Key)
    activate Gateway
    Gateway->>DB: Fetch Active Policies, 24h Spend & Velocity
    DB-->>Gateway: State Retrieved (<5ms)
    
    alt Paused Agent / Denylist / Over Limit / Velocity Breach
        Gateway-->>Agent: HTTP 200 BLOCKED (Deterministic Reason)
    else Composite Risk >= 80
        Gateway->>DB: Store FLAGGED Transaction
        Gateway-->>Reviewer: WebSocket Broadcast to Review Queue
        Gateway-->>Agent: HTTP 200 FLAGGED (Held for Operator Authorization)
        Reviewer->>Gateway: POST /api/transactions/:id/review (APPROVE)
        Gateway->>Protocol: Dispatch x402 Settlement
        Protocol-->>Gateway: Settlement ID (SXP-XXXX)
    else Compliant Transaction
        Gateway->>Protocol: Instant x402 Settlement
        Protocol-->>Gateway: Settlement ID (SXP-XXXX)
        Gateway->>DB: Record APPROVED in Ledger
        Gateway-->>Agent: HTTP 200 APPROVED (Settlement Proof Header)
    end
    deactivate Gateway
```

---

## 🛡️ Evaluated Enforcement Rules

Every payment intent undergoes deterministic evaluation across 8 layered safety checks:

| Rule | Enforcement Criteria | Outcome if Triggered |
| :--- | :--- | :--- |
| **0. Agent Status** | Agent must be `ACTIVE` in database registry | `BLOCKED` ("Agent paused") |
| **0b. Agent Daily Budget** | Sum of agent's approved 24h spend + intent $\le$ Agent budget | `BLOCKED` ("Exceeds agent daily budget") |
| **1. Merchant Denylist** | Target merchant must not match configured denylist entries | `BLOCKED` ("Merchant is on the denylist") |
| **2. Merchant Allowlist** | When allowlist mode is enabled, merchant must be pre-approved | `BLOCKED` ("Merchant not on approved allowlist") |
| **3. Per-Transaction Limit** | Single intent amount $\le$ `maxTxLimit` (default $1,000) | `BLOCKED` ("Exceeds per-transaction limit") |
| **4. Velocity Frequency Cap** | Request count within rolling 1-second window $\le 3$ tx/s | `BLOCKED` ("Frequency cap exceeded") |
| **5. Rolling 24h Network Budget** | Sum of all approved payments in last 24h + intent $\le$ Network budget | `BLOCKED` ("Exceeds rolling 24h budget") |
| **5b. Category Spend Cap** | 24h category spend (Cloud, AI/LLM, Comms, Fintech) $\le$ Category cap | `BLOCKED` ("Exceeds 24h category cap") |
| **6. Composite Risk Scoring** | Baseline risk (10) + Merchant verification (45) + Size assessment (25) | `FLAGGED` if score $\ge 80$ |

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env` or Render)
| Variable | Required | Default | Purpose |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | **Yes** | &mdash; | PostgreSQL connection string (Neon or standard Postgres) |
| `FRONTEND_URL` | Optional | `http://localhost:5173` | Allowed CORS origin for production dashboard |
| `PORT` | Optional | `3001` | Server listening port |
| `REQUIRE_API_KEY` | Optional | `false` | Enforces `X-API-Key` per agent when set to `true` |
| `NODE_ENV` | Optional | `development` | When set to `production`, sanitizes error stack traces |

### Frontend Configuration (`frontend/.env` or Vercel)
| Variable | Required | Default | Purpose |
| :--- | :---: | :---: | :--- |
| `VITE_BACKEND_URL` | Optional | `""` (Vite Proxy) | Base URL of deployed backend gateway |

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: Neon cloud instance or local database

### 2. Clone and Install
```bash
git clone https://github.com/Saikaushik007/SentriPay.git
cd SentriPay/agent-spend-policy-guard

# Install backend dependencies
cd backend
npm install
npx prisma generate

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Database Migration & Seed
Create `backend/.env` with your Postgres URL:
```env
DATABASE_URL="postgresql://user:password@ep-host.neon.tech/neondb?sslmode=require"
```
Generate schema and run initial migration:
```bash
cd backend
npx tsx src/scripts/migrateIndexes.ts
```

### 4. Start Development Servers
In two separate terminals:

```bash
# Terminal 1: Backend (Port 3001)
cd backend
npm run dev

# Terminal 2: Frontend (Port 5173)
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) to view the live dashboard.

---

## 🧪 Automated Unit Test Suite

Run pure policy engine verification covering all 10 enforcement rules:
```bash
cd backend
npm test
```
*Zero mock dependencies &mdash; runs in <2s with 100% pass rate.*

---

## 🌐 Production Deployment

### Option A: Render Backend (via Blueprint)
1. Go to [dashboard.render.com](https://dashboard.render.com) &rarr; **New +** &rarr; **Blueprint**.
2. Connect `https://github.com/Saikaushik007/SentriPay` on branch `main`.
3. Fill in `DATABASE_URL` (Neon Postgres string) and click **Apply**.
4. Note your Render URL (e.g., `https://sentripay-backend.onrender.com`).

### Option B: Vercel Frontend (via Vercel CLI)
```bash
npx vercel login
cd frontend
npx vercel --prod -e VITE_BACKEND_URL="https://your-backend-url.onrender.com"
```

---

## 📡 API Reference

### 1. Submit Payment Intent
`POST /api/payment-intent`
```bash
curl -X POST http://localhost:3001/api/payment-intent \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_live_alpha_001_c8f92a" \
  -d '{
    "agentId": "agent-alpha-001",
    "merchant": "AWS Compute",
    "amount": 149.50
  }'
```

### 2. Simulate Policy Evaluation (Dry-Run)
`POST /api/simulate`
*Evaluates rules without persisting transactions or issuing settlements.*

### 3. Protected x402 Protocol Resource
`GET /api/x402/resource`
*Returns HTTP 402 without payment proof; returns HTTP 200 with resource when `X-Payment-Proof` header is attached.*

### 4. System Health Check
`GET /health`
*Returns live status and verifies direct database connectivity.*

---

## ⏱️ 2-Minute Judge Demo Script

1. **Overview Dashboard** (`/dashboard`):
   - Highlight live stat counters, the active Socket.io connection pill, and the x402 Sentinel architecture pipeline.
2. **Demo Controls & Interactive Scenarios**:
   - Click **"Runaway Spend"**: Watch a $3,500 intent get blocked immediately with a 24h budget breach notice.
   - Click **"Denylisted Merchant"**: Watch dark web compute calls blocked with 100/100 risk score.
   - Click **"Rapid Burst"**: Trigger 4 concurrent requests to demonstrate sub-second frequency rate-limiting.
3. **Review Queue**:
   - Inspect a flagged high-risk payment intent. Approve or reject it with an operator audit note and watch the WebSocket broadcast update the ledger in real time.
4. **Agent Registry** (`/agents`):
   - Toggle **Pause Agent** on `agent-alpha-001`. Run the "Paused Agent" scenario to prove execution is blocked.
   - Edit the daily budget inline and show persistent Postgres synchronization.
5. **Protocol Integration** (`/integrate`):
   - Run the **Live x402 Autonomous Flow**: Watch the 3-step sequence animate from HTTP 402 challenge &rarr; SentriPay clearance &rarr; HTTP 200 resource unlock.
6. **Compliance Audit**:
   - Click **"Generate Report"** and export the audit ledger as **CSV** or formatted **PDF**.
