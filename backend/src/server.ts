import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
};

const io = new Server(server, {
  cors: corsOptions
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
app.post('/api/simulate', async (req, res) => {
  const { amount, merchant, agentId } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }
  if (!merchant || !merchant.trim()) {
    return res.status(400).json({ error: 'Merchant name is required' });
  }

  const result = await evaluatePolicy({
    amount: numAmount,
    merchant: merchant.trim(),
    agentId: agentId || 'agent-alpha-001'
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
});

// ─── Payment Intent (core) ────────────────────────────────────────────────────
app.post('/api/payment-intent', async (req, res) => {
  const { amount, merchant, agentId } = req.body;
  const { status, reason, riskScore, settlementId, ruleResults } = await evaluatePolicy({ amount, merchant, agentId });

  const transaction = await prisma.transaction.create({
    data: { amount, merchant, agentId, status, reason, riskScore, settlementId: settlementId || null, ruleResults }
  });

  io.emit('new_transaction', transaction);
  return res.status(200).json(transaction);
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

// ─── Live anomaly detection (derived from current persisted activity) ─────────
app.get('/api/anomalies', async (_req, res) => {
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

app.put('/api/policies', async (req, res) => {
  let existing = await prisma.policyConfig.findFirst();

  // Accept complete updates from the dashboard and safe partial updates from API clients.
  // This also keeps legacy clients from clearing list fields they do not send.
  const maxTxLimit = req.body.maxTxLimit ?? existing?.maxTxLimit ?? 1000;
  const dailyBudget = req.body.dailyBudget ?? existing?.dailyBudget ?? 500;
  const denylist = Array.isArray(req.body.denylist) ? req.body.denylist : (existing?.denylist ?? []);
  const allowlistMode = req.body.allowlistMode ?? existing?.allowlistMode ?? false;
  const allowlist = Array.isArray(req.body.allowlist) ? req.body.allowlist : (existing?.allowlist ?? []);
  const maxRiskScore = req.body.maxRiskScore ?? existing?.maxRiskScore ?? 80;

  const changeDetails: string[] = [];
  if (existing) {
    if (existing.maxTxLimit !== maxTxLimit) changeDetails.push(`Per-Tx Limit: $${existing.maxTxLimit.toLocaleString()} → $${Number(maxTxLimit).toLocaleString()}`);
    if (existing.dailyBudget !== dailyBudget) changeDetails.push(`Daily Budget: $${existing.dailyBudget.toLocaleString()} → $${Number(dailyBudget).toLocaleString()}`);
    if (existing.maxRiskScore !== maxRiskScore) changeDetails.push(`Risk Threshold: ${existing.maxRiskScore} → ${maxRiskScore}`);
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
      data: { maxTxLimit, dailyBudget, denylist, allowlistMode, allowlist, maxRiskScore }
    });
  } else {
    config = await prisma.policyConfig.create({ data: { maxTxLimit, dailyBudget, denylist, allowlistMode, allowlist, maxRiskScore } });
    changeDetails.push(`Initial config: $${maxTxLimit} tx limit, $${dailyBudget} budget`);
  }

  if (changeDetails.length > 0) {
    await prisma.policyHistory.create({
      data: { action: 'POLICY_UPDATED', detail: changeDetails.join(' | ') }
    });
  }

  io.emit('policy_updated', config);
  return res.json(config);
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
app.get('/api/agents', async (req, res) => {
  let dbAgents = await prisma.agent.findMany({
    orderBy: { createdAt: 'asc' }
  });

  // If no agents yet, auto-bootstrap default agents in DB
  if (dbAgents.length === 0) {
    const defaultAgents = [
      { id: 'agent-alpha-001', name: 'Alpha Infrastructure', description: 'Autonomous cloud infra provisioning & container orchestration', status: 'ACTIVE', dailyBudget: 1500 },
      { id: 'agent-beta-002', name: 'Beta Compute Optimizer', description: 'Real-time AI compute clusters & inference batch dispatch', status: 'ACTIVE', dailyBudget: 1000 },
      { id: 'agent-gamma-003', name: 'Gamma Data Pipeline', description: 'Data ingestion, ETL routing & external analytics subscriptions', status: 'ACTIVE', dailyBudget: 500 }
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

// ─── Demo Reset ───────────────────────────────────────────────────────────────
app.post('/api/reset-demo', async (req, res) => {
  try {
    // 1. Wipe existing data
    await prisma.transaction.deleteMany({});
    await prisma.policyHistory.deleteMany({});
    await prisma.agent.deleteMany({});

    // Seed real Agent rows in Postgres
    const defaultAgents = [
      { id: 'agent-alpha-001', name: 'Alpha Infrastructure', description: 'Autonomous cloud infra provisioning & container orchestration', status: 'ACTIVE', dailyBudget: 1500 },
      { id: 'agent-beta-002', name: 'Beta Compute Optimizer', description: 'Real-time AI compute clusters & inference batch dispatch', status: 'ACTIVE', dailyBudget: 1000 },
      { id: 'agent-gamma-003', name: 'Gamma Data Pipeline', description: 'Data ingestion, ETL routing & external analytics subscriptions', status: 'ACTIVE', dailyBudget: 500 }
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

// ─── Healthcheck ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

io.on('connection', (socket) => {
  console.log('Frontend connected:', socket.id);
  socket.on('disconnect', () => console.log('Frontend disconnected:', socket.id));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
