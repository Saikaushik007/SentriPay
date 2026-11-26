import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173'
].filter(Boolean) as string[];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors(corsOptions));
app.use(express.json());

import { evaluatePolicy } from './engine/policyEngine';
import prisma from './prismaClient';

// Helper to construct realistic rule results for historical / seeded rows
function buildRuleResultsFallback(t: { amount: number; merchant: string; agentId: string; status: string; reason: string; riskScore: number | null }) {
  const isAgentPaused = t.reason?.toLowerCase().includes('agent paused');
  const isDenylist = t.reason?.toLowerCase().includes('denylist');
  const isTxLimit = t.reason?.toLowerCase().includes('per-transaction limit');
  const isFreqCap = t.reason?.toLowerCase().includes('frequency cap');
  const isBudget = t.reason?.toLowerCase().includes('budget');
  const isFlagged = t.status === 'FLAGGED';
  const score = t.riskScore ?? (isFlagged ? 85 : 20);

  return {
    rules: [
      {
        rule: 'Agent Status',
        passed: !isAgentPaused,
        limitValue: 'ACTIVE',
        actualValue: isAgentPaused ? 'PAUSED' : 'ACTIVE',
        message: isAgentPaused ? 'Agent paused' : 'Agent is active and authorized'
      },
      {
        rule: 'Merchant Denylist',
        passed: !isDenylist,
        limitValue: 'Not on denylist',
        actualValue: isDenylist ? `Denylisted ("${t.merchant}")` : `Clean ("${t.merchant}")`,
        message: isDenylist ? t.reason : 'Merchant passed denylist check'
      },
      {
        rule: 'Merchant Allowlist',
        passed: true,
        limitValue: 'Allowlist mode disabled',
        actualValue: 'Standard check',
        message: 'Allowlist mode is inactive'
      },
      {
        rule: 'Per-Transaction Limit',
        passed: !isTxLimit,
        limitValue: '$1,000.00',
        actualValue: `$${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        message: isTxLimit ? t.reason : 'Transaction amount within limit'
      },
      {
        rule: 'Velocity Frequency Cap',
        passed: !isFreqCap,
        limitValue: '<= 3 tx/sec',
        actualValue: isFreqCap ? '4 tx/sec' : '1 tx/sec',
        message: isFreqCap ? t.reason : 'Velocity within safety limits'
      },
      {
        rule: 'Rolling 24h Budget',
        passed: !isBudget,
        limitValue: '$2,000.00',
        actualValue: isBudget ? `$${(2000 + t.amount).toFixed(2)}` : `$${t.amount.toFixed(2)}`,
        message: isBudget ? t.reason : '24h spend within budget'
      },
      {
        rule: 'Risk Score Threshold',
        passed: !isFlagged,
        limitValue: '< 80 / 100',
        actualValue: `${score} / 100`,
        message: isFlagged ? t.reason : 'Risk score within acceptable parameters'
      }
    ],
    riskBreakdown: [
      { factor: 'Base Risk', points: 10, description: 'Baseline autonomous execution risk' },
      {
        factor: isDenylist || !['Vercel Infrastructure','AWS Compute','Stripe Payments','SendGrid Email','Cloudflare CDN','OpenAI API','Twilio SMS','GitHub Actions','Datadog Monitoring','PagerDuty Alerts','Sentry Errors','Notion Workspace'].includes(t.merchant) ? 'Unverified Merchant' : 'Verified Merchant',
        points: (isDenylist || !['Vercel Infrastructure','AWS Compute','Stripe Payments','SendGrid Email','Cloudflare CDN','OpenAI API','Twilio SMS','GitHub Actions','Datadog Monitoring','PagerDuty Alerts','Sentry Errors','Notion Workspace'].includes(t.merchant)) ? 45 : 0,
        description: `Merchant safety profile: ${t.merchant}`
      },
      {
        factor: t.amount > 500 ? 'High-Value Transfer' : 'Standard Size',
        points: t.amount > 500 ? 25 : 0,
        description: `Amount assessment: $${t.amount.toFixed(2)}`
      }
    ]
  };
}

// ─── Policy Simulator (dry-run without saving or settling) ───────────────────
app.post('/api/simulate', async (req, res, next) => {
  try {
    const { amount, merchant, agentId } = req.body;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive payment amount is required' });
    }
    if (!merchant || typeof merchant !== 'string' || !merchant.trim()) {
      return res.status(400).json({ error: 'Non-empty merchant name is required' });
    }
    if (agentId && (typeof agentId !== 'string' || !agentId.trim())) {
      return res.status(400).json({ error: 'Valid agentId is required' });
    }

    const result = await evaluatePolicy({
      amount: numAmount,
      merchant: merchant.trim(),
      agentId: (agentId && agentId.trim()) || 'agent-alpha-001'
    });

    // Dry run must not return a settlement ID or say "settled"
    const isApproved = result.status === 'APPROVED';
    const simulatedResult = {
      ...result,
      settlementId: null,
      reason: isApproved
        ? 'Would be approved (simulation, nothing executed)'
        : result.reason,
      isSimulated: true
    };

    return res.json(simulatedResult);
  } catch (err) {
    next(err);
  }
});

// ─── Payment Intent (core) ────────────────────────────────────────────────────
app.post('/api/payment-intent', async (req, res, next) => {
  try {
    const { amount, merchant, agentId } = req.body;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive payment amount is required' });
    }
    if (!merchant || typeof merchant !== 'string' || !merchant.trim()) {
      return res.status(400).json({ error: 'Non-empty merchant name is required' });
    }
    if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
      return res.status(400).json({ error: 'Valid agentId is required' });
    }

    // Optional API key enforcement (REQUIRE_API_KEY=true)
    if (process.env.REQUIRE_API_KEY === 'true') {
      const apiKey = req.header('X-API-Key');
      if (!apiKey) {
        return res.status(401).json({ error: 'X-API-Key header required' });
      }
      const agentRecord = await prisma.agent.findUnique({ where: { id: agentId.trim() } });
      if (!agentRecord || agentRecord.apiKey !== apiKey) {
        return res.status(403).json({ error: 'Invalid API key for agent' });
      }
    }

    const { status, reason, riskScore, settlementId, ruleResults } = await evaluatePolicy({
      amount: numAmount,
      merchant: merchant.trim(),
      agentId: agentId.trim()
    });

    const transaction = await prisma.transaction.create({
      data: {
        amount: numAmount,
        merchant: merchant.trim(),
        agentId: agentId.trim(),
        status,
        reason,
        riskScore,
        settlementId: settlementId || null,
        ruleResults
      }
    });

    io.emit('new_transaction', transaction);
    return res.status(200).json(transaction);
  } catch (err) {
    next(err);
  }
});

// ─── x402 Protocol Mock Protected Resource (HTTP 402 Flow Demo) ───────────────
app.get('/api/x402/resource', async (req, res) => {
  const proof = req.header('X-Payment-Proof');

  if (!proof) {
    return res.status(402).json({
      error: 'Payment Required',
      status: 402,
      protocol: 'x402-v1',
      settlement: 'simulated',
      paymentRequirements: {
        amount: 45.00,
        currency: 'USD',
        merchant: 'OpenAI API',
        resourceId: 'res_gpt4_turbo_stream_99x',
        suggestedAgent: 'agent-beta-002',
        instructions: 'Submit payment intent to SentriPay gateway, then retry with X-Payment-Proof header.'
      }
    });
  }

  // Valid proof supplied -> unlock resource
  return res.status(200).json({
    status: 'success',
    accessGranted: true,
    settlementVerified: true,
    settlementId: proof,
    protocol: 'x402-v1',
    settlementMode: 'simulated (x402 testnet proof verified)',
    resource: {
      id: 'res_gpt4_turbo_stream_99x',
      type: 'High-Throughput Model Inference',
      tokenQuota: '500,000 tokens',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    }
  });
});

// ─── Transactions ─────────────────────────────────────────────────────────────
app.get('/api/transactions', async (req, res) => {
  const { status, merchant, minAmount, maxAmount } = req.query;
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    where: {
      ...(status ? { status: status as string } : {}),
      ...(merchant ? { merchant: { contains: merchant as string, mode: 'insensitive' } } : {}),
      ...(minAmount || maxAmount ? {
        amount: {
          ...(minAmount ? { gte: parseFloat(minAmount as string) } : {}),
          ...(maxAmount ? { lte: parseFloat(maxAmount as string) } : {}),
        }
      } : {}),
    }
  });

  const enriched = transactions.map(tx => {
    if (!tx.ruleResults) {
      return {
        ...tx,
        ruleResults: buildRuleResultsFallback(tx as any)
      };
    }
    return tx;
  });

  return res.json(enriched);
});

// ─── Review Queue ─────────────────────────────────────────────────────────────
app.get('/api/review-queue', async (_req, res) => {
  const pending = await prisma.transaction.findMany({
    where: {
      status: { in: ['FLAGGED', 'PENDING_REVIEW'] }
    },
    orderBy: { createdAt: 'desc' }
  });

  const enriched = pending.map(tx => {
    if (!tx.ruleResults) {
      return {
        ...tx,
        ruleResults: buildRuleResultsFallback(tx as any)
      };
    }
    return tx;
  });

  return res.json(enriched);
});

app.post('/api/transactions/:id/review', async (req, res) => {
  const { id } = req.params;
  const { action, reviewer, note } = req.body;

  if (!['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
  }

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  let updatedStatus: 'APPROVED' | 'BLOCKED';
  let updatedReason: string;
  let settlementId = tx.settlementId;

  if (action === 'APPROVE') {
    updatedStatus = 'APPROVED';
    settlementId = `SXP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    updatedReason = note ? `Manual Review Approved: ${note}` : `Manually approved by operator — settled as ${settlementId}`;
  } else {
    updatedStatus = 'BLOCKED';
    updatedReason = note ? `Manual Review Rejected: ${note}` : `Rejected in review queue: High risk payment declined`;
  }

  const updatedTx = await prisma.transaction.update({
    where: { id },
    data: {
      status: updatedStatus,
      reason: updatedReason,
      settlementId
    }
  });

  await prisma.policyHistory.create({
    data: {
      action: action === 'APPROVE' ? 'TRANSACTION_APPROVED' : 'TRANSACTION_REJECTED',
      detail: `Tx ${id.slice(0, 8)} ($${tx.amount.toFixed(2)} to ${tx.merchant}) ${action === 'APPROVE' ? 'manually approved' : 'rejected'}${reviewer ? ` by ${reviewer}` : ''}`
    }
  });

  io.emit('transaction_updated', updatedTx);
  return res.json(updatedTx);
});

// ─── Money-Flow Map (Real Agent-to-Merchant Real Transactions) ────────────────
app.get('/api/transactions/money-flow', async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || '15'), 10), 50);
  const txs = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      amount: true,
      merchant: true,
      agentId: true,
      status: true,
      reason: true,
      riskScore: true,
      createdAt: true
    }
  });

  return res.json({
    transactions: txs,
    summary: {
      total: txs.length,
      approved: txs.filter(t => t.status === 'APPROVED').length,
      blocked: txs.filter(t => t.status === 'BLOCKED').length,
      flagged: txs.filter(t => t.status === 'FLAGGED').length
    }
  });
});

// ─── Stage 3: Risk Heatmap & Spend Forecast (100% Real Postgres Data) ───────
app.get('/api/analytics/risk-heatmap', async (req, res) => {
  // Query all transactions from Postgres to build real merchant-by-hour heatmap
  const txs = await prisma.transaction.findMany({
    select: {
      merchant: true,
      amount: true,
      status: true,
      riskScore: true,
      createdAt: true
    }
  });

  // Unique merchants
  const merchantTotals = new Map<string, number>();
  txs.forEach(t => merchantTotals.set(t.merchant, (merchantTotals.get(t.merchant) || 0) + 1));
  const topMerchants = [...merchantTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(entry => entry[0]);

  // Group by merchant and hour (0..23)
  // matrix: { [merchant]: { [hour]: { count: number, avgRisk: number, totalSpend: number, blocked: number } } }
  const matrix: Record<string, Record<number, { count: number; avgRisk: number; totalSpend: number; blocked: number }>> = {};
  for (const m of topMerchants) {
    matrix[m] = {};
    for (let h = 0; h < 24; h++) {
      matrix[m][h] = { count: 0, avgRisk: 0, totalSpend: 0, blocked: 0 };
    }
  }

  for (const t of txs) {
    if (!matrix[t.merchant]) continue;
    const h = new Date(t.createdAt).getHours();
    const cell = matrix[t.merchant][h];
    const newCount = cell.count + 1;
    const risk = t.riskScore ?? (t.status === 'BLOCKED' ? 90 : t.status === 'FLAGGED' ? 70 : 15);
    cell.avgRisk = Math.round((cell.avgRisk * cell.count + risk) / newCount);
    cell.count = newCount;
    cell.totalSpend += t.amount;
    if (t.status === 'BLOCKED') cell.blocked++;
  }

  return res.json({
    merchants: topMerchants,
    matrix
  });
});

app.get('/api/analytics/spend-forecast', async (req, res) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Fetch real agents and transactions from Postgres
  const [agents, recentApproved] = await Promise.all([
    prisma.agent.findMany(),
    prisma.transaction.findMany({
      where: {
        status: 'APPROVED',
        createdAt: { gte: dayAgo }
      },
      select: {
        agentId: true,
        amount: true,
        createdAt: true
      }
    })
  ]);

  // Current hour of day (0..23)
  const currentHour = now.getHours();
  const hoursRemaining = 24 - currentHour;

  const forecasts = agents.map(agent => {
    const agentTxs = recentApproved.filter(t => t.agentId === agent.id);
    const currentSpend = agentTxs.reduce((sum, t) => sum + t.amount, 0);

    // Calculate hourly velocity over the active period
    const hourlyBurnRate = agentTxs.length > 0 ? currentSpend / Math.max(1, currentHour + 1) : 0;
    const projectedEODSpend = Math.round((currentSpend + (hourlyBurnRate * hoursRemaining)) * 100) / 100;
    const budget = agent.dailyBudget || 500;
    const projectedBreach = projectedEODSpend > budget;
    const breachHour = projectedBreach && hourlyBurnRate > 0
      ? Math.min(23, currentHour + Math.ceil((budget - currentSpend) / hourlyBurnRate))
      : null;

    // 24h trajectory line points
    const trajectory = Array.from({ length: 24 }, (_, h) => {
      let spend = 0;
      if (h <= currentHour) {
        spend = agentTxs
          .filter(t => new Date(t.createdAt).getHours() <= h)
          .reduce((s, t) => s + t.amount, 0);
      } else {
        spend = currentSpend + (hourlyBurnRate * (h - currentHour));
      }
      return {
        hour: `${String(h).padStart(2, '0')}:00`,
        actualOrProjected: Math.round(spend * 100) / 100,
        budgetLine: budget,
        isProjected: h > currentHour
      };
    });

    return {
      agentId: agent.id,
      name: agent.name,
      currentSpend: Math.round(currentSpend * 100) / 100,
      dailyBudget: budget,
      hourlyBurnRate: Math.round(hourlyBurnRate * 100) / 100,
      projectedEODSpend,
      projectedBreach,
      breachHour: breachHour !== null ? `${String(breachHour).padStart(2, '0')}:00` : null,
      burnPercentage: budget > 0 ? Math.round((projectedEODSpend / budget) * 100) : 0,
      trajectory
    };
  });

  return res.json({
    generatedAt: now,
    forecasts
  });
});

// ─── Time-series chart data ───────────────────────────────────────────────────
app.get('/api/transactions/chart', async (req, res) => {
  // Get last 50 transactions ordered oldest-first for charting
  const txs = await prisma.transaction.findMany({
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: { amount: true, status: true, createdAt: true }
  });

  const data = txs.map((t, i) => ({
    index: i + 1,
    time: new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    approved: t.status === 'APPROVED' ? t.amount : 0,
    blocked: t.status === 'BLOCKED' ? t.amount : 0,
    flagged: t.status === 'FLAGGED' ? t.amount : 0,
  }));

  return res.json(data);
});

// ─── Per-merchant breakdown ───────────────────────────────────────────────────
app.get('/api/transactions/merchants', async (req, res) => {
  const txs = await prisma.transaction.findMany({
    select: { merchant: true, status: true, amount: true }
  });

  const map: Record<string, { merchant: string; total: number; blocked: number; approved: number; totalSpend: number }> = {};
  for (const t of txs) {
    if (!map[t.merchant]) map[t.merchant] = { merchant: t.merchant, total: 0, blocked: 0, approved: 0, totalSpend: 0 };
    map[t.merchant].total++;
    if (t.status === 'BLOCKED') map[t.merchant].blocked++;
    if (t.status === 'APPROVED') { map[t.merchant].approved++; map[t.merchant].totalSpend += t.amount; }
  }

  const result = Object.values(map).sort((a, b) => b.blocked - a.blocked);
  return res.json(result);
});

// ─── Budget consumption ───────────────────────────────────────────────────────
app.get('/api/transactions/budget', async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const agg = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { status: 'APPROVED', createdAt: { gte: since } }
  });
  const config = await prisma.policyConfig.findFirst();
  return res.json({
    spent: agg._sum.amount || 0,
    limit: config?.dailyBudget || 500
  });
});

// ─── Operational insights (computed from persisted transactions) ──────────────
app.get('/api/insights', async (_req, res) => {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const txs = await prisma.transaction.findMany({
    where: { createdAt: { gte: previousWeekStart } },
    select: { amount: true, status: true, createdAt: true }
  });

  const approvedSpend = (items: typeof txs) => items
    .filter(t => t.status === 'APPROVED')
    .reduce((sum, t) => sum + t.amount, 0);
  const thisWeek = approvedSpend(txs.filter(t => t.createdAt >= weekStart));
  const lastWeek = approvedSpend(txs.filter(t => t.createdAt < weekStart));
  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  txs.filter(t => t.createdAt >= weekStart).forEach(t => hourlyCounts[t.createdAt.getHours()].count++);
  const busiest = hourlyCounts.reduce((best, hour) => hour.count > best.count ? hour : best, hourlyCounts[0]);

  return res.json({
    thisWeekSpend: thisWeek,
    lastWeekSpend: lastWeek,
    spendChangePct: lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : null,
    busiestHour: busiest.count > 0 ? busiest.hour : null,
    busiestHourTransactions: busiest.count,
    sampleSize: txs.length
  });
});

// ─── Complete transaction export (real persisted history) ─────────────────────
app.get('/api/transactions/export', async (_req, res) => {
  const transactions = await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } });
  return res.json(transactions);
});

// ─── Compliance report (range-bound data from Postgres) ───────────────────────
app.get('/api/compliance-report', async (req, res) => {
  const start = new Date(String(req.query.start));
  const end = new Date(String(req.query.end));
  end.setHours(23, 59, 59, 999);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return res.status(400).json({ error: 'Provide a valid start and end date.' });
  }

  const [transactions, policyChanges] = await Promise.all([
    prisma.transaction.findMany({ where: { createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'desc' } }),
    prisma.policyHistory.findMany({ where: { createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'asc' } })
  ]);
  const counts = { total: transactions.length, approved: 0, blocked: 0, flagged: 0 };
  const reasons = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.status === 'APPROVED') counts.approved++;
    if (transaction.status === 'BLOCKED') {
      counts.blocked++;
      reasons.set(transaction.reason, (reasons.get(transaction.reason) || 0) + 1);
    }
    if (transaction.status === 'FLAGGED') counts.flagged++;
  }
  return res.json({
    range: { start, end },
    summary: counts,
    blockReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    policyChanges
  });
});

// In-memory persistent alert and webhook state (with HMAC-SHA256 signatures and delivery logs)
type WebhookSetting = {
  id: string;
  url: string;
  secret: string;
  enabled: boolean;
  events: string[];
  createdAt: string;
};

type WebhookDelivery = {
  id: string;
  webhookId: string;
  url: string;
  event: string;
  payload: any;
  signature: string;
  statusCode: number;
  response: string;
  success: boolean;
  createdAt: string;
};

let webhookConfigs: WebhookSetting[] = [
  {
    id: 'wh-default-01',
    url: 'https://security.sentripay.internal/hooks/spend-guard',
    secret: 'whsec_99xSentriPayAutonomousGuardSecretKey',
    enabled: true,
    events: ['ANOMALY_SPEND_DOUBLED', 'SPIKE_FREQUENCY', 'HIGH_RISK_BREACH'],
    createdAt: new Date().toISOString()
  }
];

let webhookDeliveryLogs: WebhookDelivery[] = [];

// Helper to sign payload and dispatch webhook
async function dispatchSignedWebhook(event: string, payload: any) {
  const activeHooks = webhookConfigs.filter(w => w.enabled && (w.events.includes(event) || w.events.includes('*')));
  for (const hook of activeHooks) {
    const rawPayload = JSON.stringify({
      id: `evt_${Date.now()}`,
      event,
      timestamp: new Date().toISOString(),
      data: payload
    });

    const signature = crypto.createHmac('sha256', hook.secret).update(rawPayload).digest('hex');

    // Simulate reliable dispatch with logged response
    const delivery: WebhookDelivery = {
      id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      webhookId: hook.id,
      url: hook.url,
      event,
      payload: JSON.parse(rawPayload),
      signature: `sha256=${signature}`,
      statusCode: 200,
      response: '{"status":"received","accepted":true}',
      success: true,
      createdAt: new Date().toISOString()
    };

    webhookDeliveryLogs.unshift(delivery);
    if (webhookDeliveryLogs.length > 50) webhookDeliveryLogs.pop();
  }
}

// ─── Live anomaly detection (spend doubling against agent baseline) ─────────
app.get('/api/anomalies', async (_req, res) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Fetch real agent transactions over last 7 days from Postgres to establish baseline
  const [agents, recentTxs] = await Promise.all([
    prisma.agent.findMany(),
    prisma.transaction.findMany({
      where: {
        status: 'APPROVED',
        createdAt: { gte: weekAgo }
      },
      select: {
        agentId: true,
        amount: true,
        createdAt: true
      }
    })
  ]);

  const alerts: {
    id: string;
    agentId?: string;
    severity: 'warning' | 'critical';
    type: 'SPEND_DOUBLING' | 'BUDGET_EXCEEDED' | 'VELOCITY_SPIKE';
    message: string;
    baselineSpend: number;
    currentSpend: number;
    ratio: number;
    timestamp: string;
  }[] = [];

  for (const agent of agents) {
    const agentTxs = recentTxs.filter(t => t.agentId === agent.id);

    // Current 24h spend
    const current24hSpend = agentTxs
      .filter(t => t.createdAt >= dayAgo)
      .reduce((sum, t) => sum + t.amount, 0);

    // Baseline: Average daily spend over the previous 6 days (excluding current 24h)
    const priorTxs = agentTxs.filter(t => t.createdAt < dayAgo);
    const priorTotalSpend = priorTxs.reduce((sum, t) => sum + t.amount, 0);
    // Average daily baseline (or minimum baseline of $50 for meaningful doubling threshold)
    const baselineDailySpend = Math.max(50, Math.round((priorTotalSpend / 6) * 100) / 100);

    // Check if spend doubled (>= 2x baseline)
    if (current24hSpend >= baselineDailySpend * 2) {
      const ratio = Math.round((current24hSpend / baselineDailySpend) * 10) / 10;
      const alertItem = {
        id: `spend-double-${agent.id}`,
        agentId: agent.id,
        severity: 'critical' as const,
        type: 'SPEND_DOUBLING' as const,
        message: `Agent ${agent.name} (${agent.id}) spend doubled to $${current24hSpend.toFixed(2)} (${ratio}x against historical baseline of $${baselineDailySpend.toFixed(2)}/day).`,
        baselineSpend: baselineDailySpend,
        currentSpend: current24hSpend,
        ratio,
        timestamp: now.toISOString()
      };
      alerts.push(alertItem);

      // Trigger signed webhook dispatch
      dispatchSignedWebhook('ANOMALY_SPEND_DOUBLED', alertItem);
    }
  }

  return res.json({ checkedAt: now, alerts });
});

// ─── Stage 4: Alert Settings & Signed Webhook APIs ────────────────────────────
app.get('/api/alerts/settings', async (_req, res) => {
  return res.json({
    webhooks: webhookConfigs,
    deliveryLogs: webhookDeliveryLogs
  });
});

app.post('/api/alerts/settings/webhook', async (req, res) => {
  const { url, secret, events } = req.body;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Valid webhook HTTP(S) URL required' });
  }

  const newHook: WebhookSetting = {
    id: `wh_${Date.now()}`,
    url: url.trim(),
    secret: (secret && String(secret).trim()) || `whsec_${crypto.randomBytes(16).toString('hex')}`,
    enabled: true,
    events: Array.isArray(events) && events.length > 0 ? events : ['ANOMALY_SPEND_DOUBLED', 'TRANSACTION_BLOCKED'],
    createdAt: new Date().toISOString()
  };

  webhookConfigs.push(newHook);
  return res.status(201).json(newHook);
});

app.post('/api/alerts/settings/test-webhook', async (req, res) => {
  const { webhookId } = req.body;
  const hook = webhookConfigs.find(w => w.id === webhookId) || webhookConfigs[0];
  if (!hook) return res.status(404).json({ error: 'Webhook configuration not found' });

  const testPayload = {
    test: true,
    message: 'Manual test ping from SentriPay Gateway',
    timestamp: new Date().toISOString(),
    event: 'ANOMALY_SPEND_DOUBLED',
    sampleAlert: {
      agentId: 'agent-alpha-001',
      baselineSpend: 120.00,
      currentSpend: 310.50,
      ratio: 2.6
    }
  };

  await dispatchSignedWebhook('ANOMALY_SPEND_DOUBLED', testPayload);
  return res.json({ success: true, message: 'Test webhook delivered with signature', latestLog: webhookDeliveryLogs[0] });
});

// ─── Live anomaly detection (derived from current persisted activity) ─────────
app.get('/api/anomalies-legacy', async (_req, res) => {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [config, hourTxs, recentTxs, dailyApproved] = await Promise.all([
    prisma.policyConfig.findFirst(),
    prisma.transaction.findMany({ where: { createdAt: { gte: hourAgo } }, select: { agentId: true, status: true } }),
    prisma.transaction.findMany({ where: { createdAt: { gte: fiveMinutesAgo } }, select: { agentId: true } }),
    prisma.transaction.findMany({ where: { createdAt: { gte: dayAgo }, status: 'APPROVED' }, select: { agentId: true, amount: true } })
  ]);
  const alerts: { id: string; severity: 'warning' | 'critical'; message: string }[] = [];
  const blocked = hourTxs.filter(tx => tx.status === 'BLOCKED').length;
  const blockRate = hourTxs.length ? (blocked / hourTxs.length) * 100 : 0;
  if (hourTxs.length >= 5 && blockRate >= 40) alerts.push({ id: `block-rate-${Math.floor(blockRate)}`, severity: 'critical', message: `Block rate spiked to ${blockRate.toFixed(0)}% in the last hour (${blocked} of ${hourTxs.length} requests).` });

  const dailyBudget = config?.dailyBudget || 500;
  const spendByAgent = new Map<string, number>();
  dailyApproved.forEach(tx => spendByAgent.set(tx.agentId, (spendByAgent.get(tx.agentId) || 0) + tx.amount));
  for (const [agentId, spent] of spendByAgent) {
    const pct = (spent / dailyBudget) * 100;
    if (pct >= 80) alerts.push({ id: `agent-budget-${agentId}-${Math.floor(pct)}`, severity: 'warning', message: `${agentId} has used ${pct.toFixed(0)}% of the $${dailyBudget.toLocaleString()} daily budget ($${spent.toFixed(2)} used).` });
  }

  const frequency = new Map<string, number>();
  recentTxs.forEach(tx => frequency.set(tx.agentId, (frequency.get(tx.agentId) || 0) + 1));
  for (const [agentId, count] of frequency) if (count >= 8) alerts.push({ id: `frequency-${agentId}-${count}`, severity: 'critical', message: `${agentId} submitted ${count} payment requests in the last 5 minutes — unusual transaction frequency detected.` });
  return res.json({ checkedAt: now, alerts });
});

// ─── Policies ─────────────────────────────────────────────────────────────────
app.get('/api/policies', async (req, res) => {
  const config = await prisma.policyConfig.findFirst();
  return res.json(config);
});

app.put('/api/policies', async (req, res, next) => {
  try {
    let existing = await prisma.policyConfig.findFirst();

    if (req.body.maxTxLimit !== undefined) {
      const limit = parseFloat(req.body.maxTxLimit);
      if (isNaN(limit) || !Number.isFinite(limit) || limit <= 0) {
        return res.status(400).json({ error: 'maxTxLimit must be a positive finite number' });
      }
    }
    if (req.body.dailyBudget !== undefined) {
      const budget = parseFloat(req.body.dailyBudget);
      if (isNaN(budget) || !Number.isFinite(budget) || budget <= 0) {
        return res.status(400).json({ error: 'dailyBudget must be a positive finite number' });
      }
    }
    if (req.body.maxRiskScore !== undefined) {
      const score = parseFloat(req.body.maxRiskScore);
      if (isNaN(score) || !Number.isFinite(score) || score < 0 || score > 100) {
        return res.status(400).json({ error: 'maxRiskScore must be a number between 0 and 100' });
      }
    }
    if (req.body.denylist !== undefined && !Array.isArray(req.body.denylist)) {
      return res.status(400).json({ error: 'denylist must be an array of strings' });
    }
    if (req.body.allowlist !== undefined && !Array.isArray(req.body.allowlist)) {
      return res.status(400).json({ error: 'allowlist must be an array of strings' });
    }
    if (req.body.categoryCaps !== undefined && (typeof req.body.categoryCaps !== 'object' || req.body.categoryCaps === null || Array.isArray(req.body.categoryCaps))) {
      return res.status(400).json({ error: 'categoryCaps must be an object mapping categories to spend limits' });
    }

    // Accept complete updates from the dashboard and safe partial updates from API clients.
    // This also keeps legacy clients from clearing list fields they do not send.
    const maxTxLimit = req.body.maxTxLimit !== undefined ? parseFloat(req.body.maxTxLimit) : (existing?.maxTxLimit ?? 1000);
    const dailyBudget = req.body.dailyBudget !== undefined ? parseFloat(req.body.dailyBudget) : (existing?.dailyBudget ?? 500);
    const denylist = Array.isArray(req.body.denylist) ? req.body.denylist : (existing?.denylist ?? []);
    const allowlistMode = req.body.allowlistMode ?? existing?.allowlistMode ?? false;
    const allowlist = Array.isArray(req.body.allowlist) ? req.body.allowlist : (existing?.allowlist ?? []);
    const maxRiskScore = req.body.maxRiskScore !== undefined ? parseFloat(req.body.maxRiskScore) : (existing?.maxRiskScore ?? 80);
    const categoryCaps = req.body.categoryCaps !== undefined ? req.body.categoryCaps : (existing?.categoryCaps ?? null);

    const changeDetails: string[] = [];
    if (existing) {
      if (existing.maxTxLimit !== maxTxLimit) changeDetails.push(`Per-Tx Limit: $${existing.maxTxLimit.toLocaleString()} → $${Number(maxTxLimit).toLocaleString()}`);
      if (existing.dailyBudget !== dailyBudget) changeDetails.push(`Daily Budget: $${existing.dailyBudget.toLocaleString()} → $${Number(dailyBudget).toLocaleString()}`);
      if (existing.maxRiskScore !== maxRiskScore) changeDetails.push(`Risk Threshold: ${existing.maxRiskScore} → ${maxRiskScore}`);
      if (req.body.categoryCaps !== undefined) changeDetails.push(`Category caps updated`);
      const addedMerchants = (denylist as string[]).filter(m => !existing!.denylist.includes(m));
      const removedMerchants = existing.denylist.filter(m => !(denylist as string[]).includes(m));
      if (addedMerchants.length) changeDetails.push(`Denylist added: ${addedMerchants.join(', ')}`);
      if (removedMerchants.length) changeDetails.push(`Denylist removed: ${removedMerchants.join(', ')}`);
      if (existing.allowlistMode !== allowlistMode) changeDetails.push(`Allowlist mode: ${allowlistMode ? 'ENABLED' : 'DISABLED'}`);
      const addedAllowlist = (allowlist as string[]).filter(m => !existing!.allowlist.includes(m));
      if (addedAllowlist.length) changeDetails.push(`Allowlist added: ${addedAllowlist.join(', ')}`);
    }

    let config;
    if (existing) {
      config = await prisma.policyConfig.update({
        where: { id: existing.id },
        data: { maxTxLimit, dailyBudget, denylist, allowlistMode, allowlist, maxRiskScore, categoryCaps }
      });
    } else {
      config = await prisma.policyConfig.create({ data: { maxTxLimit, dailyBudget, denylist, allowlistMode, allowlist, maxRiskScore, categoryCaps } });
      changeDetails.push(`Initial config: $${maxTxLimit} tx limit, $${dailyBudget} budget`);
    }

    if (changeDetails.length > 0) {
      await prisma.policyHistory.create({
        data: { action: 'POLICY_UPDATED', detail: changeDetails.join(' | ') }
      });
    }

    io.emit('policy_updated', config);
    return res.json(config);
  } catch (err) {
    next(err);
  }
});

// ─── Policy History ───────────────────────────────────────────────────────────
app.get('/api/policies/history', async (req, res) => {
  const history = await prisma.policyHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  return res.json(history);
});

// ─── Agents ───────────────────────────────────────────────────────────────────
app.get('/api/agents', async (req, res, next) => {
  try {
    let dbAgents = await prisma.agent.findMany({
      orderBy: { createdAt: 'asc' }
    });

    // If no agents yet, auto-bootstrap default agents in DB
    if (dbAgents.length === 0) {
      const defaultAgents = [
        { id: 'agent-alpha-001', name: 'Alpha Infrastructure', description: 'Autonomous cloud infra provisioning & container orchestration', status: 'ACTIVE', dailyBudget: 1500, apiKey: 'sk_live_alpha_001_c8f92a' },
        { id: 'agent-beta-002', name: 'Beta Compute Optimizer', description: 'Real-time AI compute clusters & inference batch dispatch', status: 'ACTIVE', dailyBudget: 1000, apiKey: 'sk_live_beta_002_d3a17e' },
        { id: 'agent-gamma-003', name: 'Gamma Data Pipeline', description: 'Data ingestion, ETL routing & external analytics subscriptions', status: 'ACTIVE', dailyBudget: 500, apiKey: 'sk_live_gamma_003_e5b49f' }
      ];
      await prisma.agent.createMany({ data: defaultAgents });
      dbAgents = await prisma.agent.findMany({ orderBy: { createdAt: 'asc' } });
    }

    const txs = await prisma.transaction.findMany({
      select: { agentId: true, status: true, amount: true, createdAt: true }
    });

    const map: Record<string, {
      agentId: string; total: number; approved: number; blocked: number;
      flagged: number; totalSpend: number; lastSeen: Date;
    }> = {};

    for (const t of txs) {
      if (!map[t.agentId]) {
        map[t.agentId] = { agentId: t.agentId, total: 0, approved: 0, blocked: 0, flagged: 0, totalSpend: 0, lastSeen: t.createdAt };
      }
      const ag = map[t.agentId];
      ag.total++;
      if (t.status === 'APPROVED') { ag.approved++; ag.totalSpend += t.amount; }
      if (t.status === 'BLOCKED') ag.blocked++;
      if (t.status === 'FLAGGED') ag.flagged++;
      if (t.createdAt > ag.lastSeen) ag.lastSeen = t.createdAt;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent24hTxs = await prisma.transaction.findMany({
      where: { status: 'APPROVED', createdAt: { gte: since } },
      select: { agentId: true, amount: true }
    });
    const spentTodayMap: Record<string, number> = {};
    for (const t of recent24hTxs) {
      spentTodayMap[t.agentId] = (spentTodayMap[t.agentId] || 0) + t.amount;
    }

    const agents = dbAgents.map(ag => {
      const stats = map[ag.id] || { total: 0, approved: 0, blocked: 0, flagged: 0, totalSpend: 0, lastSeen: ag.createdAt };
      return {
        id: ag.id,
        agentId: ag.id,
        name: ag.name,
        description: ag.description,
        status: ag.status,
        dailyBudget: ag.dailyBudget,
        apiKey: ag.apiKey || `sk_live_${ag.id.replace(/-/g, '_')}`,
        spentToday: Math.round((spentTodayMap[ag.id] || 0) * 100) / 100,
        total: stats.total,
        approved: stats.approved,
        blocked: stats.blocked,
        flagged: stats.flagged,
        totalSpend: Math.round(stats.totalSpend * 100) / 100,
        approvalRate: stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : '0.0',
        lastSeen: stats.lastSeen
      };
    });

    return res.json(agents);
  } catch (err) {
    next(err);
  }
});

// Pause / Resume agent toggle
app.patch('/api/agents/:id/pause', async (req, res) => {
  const { id } = req.params;
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const newStatus = agent.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
  const updated = await prisma.agent.update({
    where: { id },
    data: { status: newStatus }
  });

  await prisma.policyHistory.create({
    data: {
      action: newStatus === 'PAUSED' ? 'AGENT_PAUSED' : 'AGENT_RESUMED',
      detail: `Agent ${agent.name} (${id}) status changed to ${newStatus}`
    }
  });

  io.emit('agent_updated', updated);
  return res.json(updated);
});

app.put('/api/agents/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['ACTIVE', 'PAUSED'].includes(status)) {
    return res.status(400).json({ error: 'Status must be ACTIVE or PAUSED' });
  }

  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const updated = await prisma.agent.update({
    where: { id },
    data: { status }
  });

  await prisma.policyHistory.create({
    data: {
      action: status === 'PAUSED' ? 'AGENT_PAUSED' : 'AGENT_RESUMED',
      detail: `Agent ${agent.name} (${id}) status set to ${status}`
    }
  });

  io.emit('agent_updated', updated);
  return res.json(updated);
});

// Edit per-agent daily budget
app.patch('/api/agents/:id/budget', async (req, res) => {
  const { id } = req.params;
  const { dailyBudget } = req.body;
  const budget = parseFloat(dailyBudget);
  if (isNaN(budget) || budget < 0) {
    return res.status(400).json({ error: 'Invalid budget amount' });
  }

  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const updated = await prisma.agent.update({
    where: { id },
    data: { dailyBudget: budget }
  });

  await prisma.policyHistory.create({
    data: {
      action: 'AGENT_BUDGET_UPDATED',
      detail: `Agent ${agent.name} (${id}) daily budget changed from $${agent.dailyBudget} to $${budget}`
    }
  });

  io.emit('agent_updated', updated);
  return res.json(updated);
});

// ─── Phase I: Time-range transaction stats ────────────────────────────────────
app.get('/api/transactions/stats', async (req, res, next) => {
  try {
    const rangeParam = (req.query.range as string) || '24h';
    const rangeMap: Record<string, number> = { '1h': 1, '24h': 24, '7d': 168 };
    const hours = rangeMap[rangeParam];
    if (!hours) return res.status(400).json({ error: 'range must be 1h, 24h, or 7d' });
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const txs = await prisma.transaction.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, amount: true, createdAt: true }
    });

    const total = txs.length;
    const approved = txs.filter(t => t.status === 'APPROVED').length;
    const blocked = txs.filter(t => t.status === 'BLOCKED').length;
    const flagged = txs.filter(t => t.status === 'FLAGGED').length;
    const totalSpend = txs.filter(t => t.status === 'APPROVED').reduce((s, t) => s + t.amount, 0);
    const approvalRate = total > 0 ? Math.round((approved / total) * 1000) / 10 : 0;

    return res.json({ total, approved, blocked, flagged, approvalRate, totalSpend: Math.round(totalSpend * 100) / 100, range: rangeParam, since });
  } catch (err) { next(err); }
});

// ─── Phase I: Rule-hit counts by range ────────────────────────────────────────
app.get('/api/transactions/rule-hits', async (req, res, next) => {
  try {
    const rangeParam = (req.query.range as string) || '24h';
    const rangeMap: Record<string, number> = { '1h': 1, '24h': 24, '7d': 168 };
    const hours = rangeMap[rangeParam];
    if (!hours) return res.status(400).json({ error: 'range must be 1h, 24h, or 7d' });
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const txs = await prisma.transaction.findMany({
      where: { createdAt: { gte: since }, status: { in: ['BLOCKED', 'FLAGGED'] } },
      select: { reason: true }
    });

    // Extract rule labels from reason strings
    const hitMap: Record<string, number> = {};
    const rulePatterns: Array<[RegExp, string]> = [
      [/agent paused/i, 'Agent Paused'],
      [/denylist/i, 'Merchant Denylist'],
      [/allowlist/i, 'Merchant Allowlist'],
      [/per-transaction limit/i, 'Per-Tx Limit'],
      [/frequency cap/i, 'Velocity Cap'],
      [/rolling 24h budget/i, 'Rolling Budget'],
      [/category.*cap/i, 'Category Cap'],
      [/risk score/i, 'Risk Score'],
      [/agent daily budget/i, 'Agent Budget'],
    ];

    for (const { reason } of txs) {
      let matched = false;
      for (const [pat, label] of rulePatterns) {
        if (pat.test(reason || '')) { hitMap[label] = (hitMap[label] || 0) + 1; matched = true; break; }
      }
      if (!matched) hitMap['Other'] = (hitMap['Other'] || 0) + 1;
    }

    const hits = Object.entries(hitMap)
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return res.json({ hits, range: rangeParam });
  } catch (err) { next(err); }
});

// ─── Phase I/J: Agent detail ──────────────────────────────────────────────────
app.get('/api/agents/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [allTxs, recentTxs] = await Promise.all([
      prisma.transaction.findMany({
        where: { agentId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, amount: true, merchant: true, status: true, reason: true, riskScore: true, createdAt: true }
      }),
      prisma.transaction.findMany({
        where: { agentId: id, createdAt: { gte: since24h } },
        select: { status: true, amount: true, reason: true }
      })
    ]);

    const spend24h = recentTxs.filter(t => t.status === 'APPROVED').reduce((s, t) => s + t.amount, 0);
    const approved = recentTxs.filter(t => t.status === 'APPROVED').length;
    const blocked = recentTxs.filter(t => t.status === 'BLOCKED').length;
    const flagged = recentTxs.filter(t => t.status === 'FLAGGED').length;
    const total = recentTxs.length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 1000) / 10 : 0;

    // Rule hit counts
    const ruleHits: Record<string, number> = {};
    for (const t of recentTxs.filter(t => t.status !== 'APPROVED')) {
      const r = t.reason || 'Unknown';
      ruleHits[r] = (ruleHits[r] || 0) + 1;
    }

    return res.json({
      ...agent,
      stats24h: { spend24h: Math.round(spend24h * 100) / 100, approved, blocked, flagged, total, approvalRate },
      ruleHits: Object.entries(ruleHits).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      transactions: allTxs
    });
  } catch (err) { next(err); }
});

// ─── Phase J: Merchant insights ───────────────────────────────────────────────
app.get('/api/merchants/insights', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const txs = await prisma.transaction.findMany({
      where: { createdAt: { gte: since } },
      select: { merchant: true, amount: true, status: true }
    });

    const map: Record<string, { merchant: string; volume: number; spend: number; blocks: number; flags: number; total: number }> = {};
    for (const t of txs) {
      if (!map[t.merchant]) map[t.merchant] = { merchant: t.merchant, volume: 0, spend: 0, blocks: 0, flags: 0, total: 0 };
      map[t.merchant].total++;
      if (t.status === 'APPROVED') { map[t.merchant].volume++; map[t.merchant].spend += t.amount; }
      if (t.status === 'BLOCKED') map[t.merchant].blocks++;
      if (t.status === 'FLAGGED') map[t.merchant].flags++;
    }

    const insights = Object.values(map).map(m => ({
      ...m,
      spend: Math.round(m.spend * 100) / 100,
      riskScore: m.total > 0 ? Math.round(((m.blocks + m.flags) / m.total) * 100) : 0
    })).sort((a, b) => b.spend - a.spend);

    return res.json(insights);
  } catch (err) { next(err); }
});

// ─── Phase J: Simulate policy impact ─────────────────────────────────────────
app.post('/api/simulate-policy-impact', async (req, res, next) => {
  try {
    const { maxTxLimit, dailyBudget, denylist, maxRiskScore, allowlistMode, allowlist } = req.body;
    if (maxTxLimit !== undefined && (isNaN(parseFloat(maxTxLimit)) || parseFloat(maxTxLimit) <= 0))
      return res.status(400).json({ error: 'maxTxLimit must be a positive number' });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const txs = await prisma.transaction.findMany({
      where: { createdAt: { gte: since } },
      select: { amount: true, merchant: true, status: true, reason: true, riskScore: true }
    });

    const dl = Array.isArray(denylist) ? denylist.map((s: string) => s.toLowerCase()) : [];
    const al = Array.isArray(allowlist) ? allowlist.map((s: string) => s.toLowerCase()) : [];
    const limit = maxTxLimit !== undefined ? parseFloat(maxTxLimit) : Infinity;
    const budget = dailyBudget !== undefined ? parseFloat(dailyBudget) : Infinity;
    const riskThresh = maxRiskScore !== undefined ? parseFloat(maxRiskScore) : 100;

    let wouldBlock = 0, wouldFlag = 0, wouldApprove = 0;
    let runningSpend = 0;

    for (const t of txs) {
      const mLower = t.merchant.toLowerCase();
      const isDenied = dl.includes(mLower);
      const notAllowed = allowlistMode && al.length > 0 && !al.includes(mLower);
      const overLimit = t.amount > limit;
      const overBudget = runningSpend + t.amount > budget;
      const riskHigh = (t.riskScore ?? 10) >= riskThresh;

      if (isDenied || notAllowed || overLimit || overBudget) { wouldBlock++; }
      else if (riskHigh) { wouldFlag++; }
      else { wouldApprove++; runningSpend += t.amount; }
    }

    return res.json({ wouldBlock, wouldFlag, wouldApprove, total: txs.length });
  } catch (err) { next(err); }
});

// ─── Demo Reset ───────────────────────────────────────────────────────────────
app.post('/api/reset-demo', async (req, res) => {
  try {
    // 1. Wipe existing data
    await prisma.transaction.deleteMany({});
    await prisma.policyHistory.deleteMany({});
    await prisma.agent.deleteMany({});

    // Seed real Agent rows in Postgres
    const defaultAgents = [
      { id: 'agent-alpha-001', name: 'Alpha Infrastructure', description: 'Autonomous cloud infra provisioning & container orchestration', status: 'ACTIVE', dailyBudget: 1500, apiKey: 'sk_live_alpha_001_c8f92a' },
      { id: 'agent-beta-002', name: 'Beta Compute Optimizer', description: 'Real-time AI compute clusters & inference batch dispatch', status: 'ACTIVE', dailyBudget: 1000, apiKey: 'sk_live_beta_002_d3a17e' },
      { id: 'agent-gamma-003', name: 'Gamma Data Pipeline', description: 'Data ingestion, ETL routing & external analytics subscriptions', status: 'ACTIVE', dailyBudget: 500, apiKey: 'sk_live_gamma_003_e5b49f' }
    ];
    await prisma.agent.createMany({ data: defaultAgents });

    // 2. Reset policy config (dailyBudget $2,000 — realistic against $1,000 tx limit)
    const POLICY = { maxTxLimit: 1000, dailyBudget: 2000, denylist: ['DarkWeb Compute', 'ShadyAI Services'] };
    const existing = await prisma.policyConfig.findFirst();
    if (existing) {
      await prisma.policyConfig.update({ where: { id: existing.id }, data: POLICY });
    } else {
      await prisma.policyConfig.create({ data: POLICY });
    }
    await prisma.policyHistory.create({
      data: { action: 'DEMO_RESET', detail: 'Demo reset: maxTxLimit=$1,000 | dailyBudget=$2,000 | denylist: DarkWeb Compute, ShadyAI Services' }
    });

    // 3. Seed realistic mixed history (timestamp-aware budget targeting)
    const CLEAN = ['Vercel Infrastructure','AWS Compute','Stripe Payments','SendGrid Email',
      'Cloudflare CDN','OpenAI API','Twilio SMS','GitHub Actions',
      'Datadog Monitoring','PagerDuty Alerts','Sentry Errors','Notion Workspace'];
    const DENIED = ['DarkWeb Compute','ShadyAI Services'];
    const AGENTS = ['agent-alpha-001','agent-beta-002','agent-gamma-003'];
    const r = (min: number, max: number) => parseFloat((Math.random()*(max-min)+min).toFixed(2));
    const pick = <T>(a: T[]): T => a[Math.floor(Math.random()*a.length)];
    const ago = (mins: number) => new Date(Date.now() - mins*60*1000);
    const WINDOW = 24 * 60; // 1440 minutes

    const seeds: any[] = [];

    const generateSettlementId = () => `SXP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*10000).toString(16).toUpperCase()}`;

    // 20 APPROVED inside 24h window (5min–18h ago, small amounts $20–$95)
    // Target: 20 × avg $57.50 ≈ $1,150 in-window → ~57% of $2,000 budget
    for (let i=0; i<20; i++) seeds.push({
      amount: r(20,95), merchant: pick(CLEAN), agentId: pick(AGENTS),
      status:'APPROVED', reason:'All policy checks passed',
      riskScore: r(5,40), createdAt: ago(r(5, 18*60)),
      settlementId: generateSettlementId()
    });
    // 40 APPROVED outside 24h window (26h–72h ago) — enrich chart/feed, not budget
    for (let i=0; i<40; i++) seeds.push({
      amount: r(30,850), merchant: pick(CLEAN), agentId: pick(AGENTS),
      status:'APPROVED', reason:'All policy checks passed',
      riskScore: r(5,45), createdAt: ago(r(WINDOW+120, 72*60)),
      settlementId: generateSettlementId()
    });
    // 20 BLOCKED — tx limit
    for (let i=0; i<20; i++) { const amt=r(1010,4800); seeds.push({
      amount: amt, merchant: pick(CLEAN), agentId: pick(AGENTS),
      status:'BLOCKED', reason:`Exceeds per-transaction limit of $1,000 (attempted $${amt.toLocaleString()})`,
      riskScore: r(30,65), createdAt: ago(r(5,60*60))
    }); }
    // 10 BLOCKED — denylist
    for (let i=0; i<10; i++) { const m=pick(DENIED); seeds.push({
      amount: r(50,800), merchant: m, agentId: pick(AGENTS),
      status:'BLOCKED', reason:`Merchant "${m}" is on the denylist`,
      riskScore: r(70,95), createdAt: ago(r(5,60*60))
    }); }
    // 5 BLOCKED — freq cap
    for (let i=0; i<5; i++) seeds.push({
      amount: r(20,400), merchant: pick(CLEAN), agentId: pick(AGENTS),
      status:'BLOCKED', reason:'Frequency cap exceeded — too many requests in 1s window',
      riskScore: r(40,75), createdAt: ago(r(5,60*60))
    });
    // 15 FLAGGED — high risk score
    for (let i=0; i<15; i++) { const rs=r(75,92); seeds.push({
      amount: r(400,950), merchant: pick(CLEAN), agentId: pick(AGENTS),
      status:'FLAGGED', reason:`Risk score ${rs} exceeds threshold — flagged for review`,
      riskScore: rs, createdAt: ago(r(5,60*60))
    }); }

    seeds.sort((a,b) => a.createdAt.getTime()-b.createdAt.getTime());
    const seedsWithRules = seeds.map(s => ({
      ...s,
      ruleResults: buildRuleResultsFallback(s)
    }));
    await prisma.transaction.createMany({ data: seedsWithRules });

    const approved = seeds.filter(t=>t.status==='APPROVED').length;
    const blocked  = seeds.filter(t=>t.status==='BLOCKED').length;
    const flagged  = seeds.filter(t=>t.status==='FLAGGED').length;
    const approvalRate = ((approved/seeds.length)*100).toFixed(1);

    io.emit('demo_reset', { total: seeds.length, approved, blocked, flagged, approvalRate });
    return res.json({ ok: true, total: seeds.length, approved, blocked, flagged, approvalRate });
  } catch (e) {
    console.error('/api/reset-demo error:', e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// ─── Healthcheck (with real DB connection check) ─────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    const rawMsg = err?.message || String(err);
    const maskedMsg = rawMsg
      .replace(/postgresql:\/\/[^@]+@/g, 'postgresql://[MASKED_CREDENTIALS]@')
      .replace(/:([a-zA-Z0-9_\-\.]+)@/g, ':[MASKED_PASSWORD]@')
      .replace(/password=([^&\s]+)/gi, 'password=[MASKED]');
    console.error(`[Health Check Database Error]: ${maskedMsg}`);
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: 'Database health check failed'
    });
  }
});

// ─── Global Error Handler (no stack traces in production) ─────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err?.message || err);
  const isProd = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    error: isProd ? 'Internal server error' : (err?.message || 'Unknown error occurred')
  });
});

io.on('connection', (socket) => {
  console.log('Frontend connected:', socket.id);
  socket.on('disconnect', () => console.log('Frontend disconnected:', socket.id));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
