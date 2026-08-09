import prisma from '../prismaClient';
import crypto from 'crypto';

export type TransactionRequest = {
  amount: number;
  merchant: string;
  agentId: string;
};

export type PolicyResult = {
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  riskScore?: number;
  settlementId?: string;
};

export async function evaluatePolicy(tx: TransactionRequest): Promise<PolicyResult> {
  const now = new Date();

  // Load config from DB (or bootstrap defaults)
  let config = await prisma.policyConfig.findFirst();
  if (!config) {
    config = await prisma.policyConfig.create({
      data: {
        maxTxLimit: 1000,
        dailyBudget: 2000,
        denylist: ['DarkWeb Compute', 'ShadyAI Services'],
        allowlistMode: false,
        allowlist: [],
        maxRiskScore: 80,
      }
    });
  }

  // ── Rule 1: Denylist check ────────────────────────────────────────────────
  const isDenied = config.denylist.some(m =>
    m.toLowerCase() === tx.merchant.toLowerCase()
  );
  if (isDenied) {
    return {
      status: 'BLOCKED',
      reason: `Merchant "${tx.merchant}" is on the denylist`,
      riskScore: 100
    };
  }

  // ── Rule 2: Allowlist mode (if enabled, only listed merchants pass) ───────
  if (config.allowlistMode && config.allowlist.length > 0) {
    const isAllowed = config.allowlist.some(m =>
      m.toLowerCase() === tx.merchant.toLowerCase()
    );
    if (!isAllowed) {
      return {
        status: 'BLOCKED',
        reason: `Allowlist mode active — merchant "${tx.merchant}" is not on the approved list`,
        riskScore: 85
      };
    }
  }

  // ── Rule 3: Per-transaction limit ─────────────────────────────────────────
  if (tx.amount > config.maxTxLimit) {
    return {
      status: 'BLOCKED',
      reason: `Exceeds per-transaction limit of $${config.maxTxLimit.toLocaleString()} (attempted $${tx.amount.toLocaleString()})`,
      riskScore: 80
    };
  }

  // ── Rule 4: Frequency cap (>3 tx/sec per agent) ───────────────────────────
  const oneSecondAgo = new Date(now.getTime() - 1000);
  const recentCount = await prisma.transaction.count({
    where: { agentId: tx.agentId, createdAt: { gt: oneSecondAgo } }
  });
  if (recentCount >= 3) {
    return {
      status: 'BLOCKED',
      reason: 'Frequency cap exceeded — too many requests in 1s window',
      riskScore: 90
    };
  }

  // ── Rule 5: Rolling 24h budget ────────────────────────────────────────────
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const agg = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { status: 'APPROVED', createdAt: { gt: oneDayAgo } }
  });
  const dailySpend = agg._sum.amount || 0;
  if (dailySpend + tx.amount > config.dailyBudget) {
    return {
      status: 'BLOCKED',
      reason: `Exceeds rolling 24h budget of $${config.dailyBudget.toLocaleString()} (${dailySpend.toFixed(2)} already spent)`,
      riskScore: 60
    };
  }

  // ── Rule 6: Risk score (configurable threshold) ───────────────────────────
  const knownMerchants = [
    'Vercel Infrastructure','AWS Compute','Stripe Payments','SendGrid Email',
    'Cloudflare CDN','OpenAI API','Twilio SMS','GitHub Actions',
    'Datadog Monitoring','PagerDuty Alerts','Sentry Errors','Notion Workspace'
  ];
  let riskScore = 10;
  if (!knownMerchants.includes(tx.merchant)) riskScore += 45;
  if (tx.amount > 500) riskScore += 25;
  riskScore = Math.min(100, riskScore);

  const threshold = config.maxRiskScore ?? 80;
  if (riskScore >= threshold) {
    return {
      status: 'FLAGGED',
      reason: `Risk score ${riskScore}/100 exceeds threshold of ${threshold} — flagged for review`,
      riskScore
    };
  }

  // ── APPROVED: generate settlement ID ──────────────────────────────────────
  const settlementId = `SXP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  return {
    status: 'APPROVED',
    reason: `All policy checks passed — settled as ${settlementId}`,
    riskScore,
    settlementId
  };
}
