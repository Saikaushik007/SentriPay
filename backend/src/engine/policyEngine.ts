import prisma from '../prismaClient';
import crypto from 'crypto';

export type TransactionRequest = {
  amount: number;
  merchant: string;
  agentId: string;
};

export type RuleEvaluation = {
  rule: string;
  passed: boolean;
  limitValue: string;
  actualValue: string;
  message: string;
};

export type RiskBreakdownItem = {
  factor: string;
  points: number;
  description: string;
};

export type RuleResults = {
  rules: RuleEvaluation[];
  riskBreakdown: RiskBreakdownItem[];
};

export type PolicyResult = {
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  riskScore: number;
  settlementId?: string;
  ruleResults: RuleResults;
};

export function getMerchantCategory(merchant: string): string {
  const m = merchant.toLowerCase();
  if (m.includes('aws') || m.includes('vercel') || m.includes('cloudflare') || m.includes('compute')) {
    return 'Cloud Infrastructure';
  }
  if (m.includes('openai') || m.includes('anthropic') || m.includes('ai') || m.includes('hugging')) {
    return 'AI & LLM Services';
  }
  if (m.includes('sendgrid') || m.includes('twilio') || m.includes('email') || m.includes('sms')) {
    return 'Communications';
  }
  if (m.includes('stripe') || m.includes('paypal') || m.includes('payment')) {
    return 'Financial Services';
  }
  if (m.includes('github') || m.includes('datadog') || m.includes('sentry') || m.includes('pagerduty') || m.includes('notion')) {
    return 'DevOps & Tooling';
  }
  return 'General Services';
}

export type PolicyEngineContext = {
  agent: { id: string; name?: string; status: string; dailyBudget: number } | null;
  config: {
    maxTxLimit: number;
    dailyBudget: number;
    denylist: string[];
    allowlistMode: boolean;
    allowlist: string[];
    maxRiskScore: number;
    categoryCaps?: Record<string, number>;
  };
  agent24hSpend: number;
  rolling24hSpend: number;
  recent1sCount: number;
  category24hSpend?: number;
};

export function evaluateRules(tx: TransactionRequest, ctx: PolicyEngineContext): PolicyResult {
  const { agent, config, agent24hSpend, rolling24hSpend, recent1sCount } = ctx;
  const rules: RuleEvaluation[] = [];

  // ── Rule 0: Agent Pause Check ─────────────────────────────────────────────
  const isAgentPaused = agent ? agent.status === 'PAUSED' : false;
  rules.push({
    rule: 'Agent Status',
    passed: !isAgentPaused,
    limitValue: 'ACTIVE',
    actualValue: agent?.status || 'ACTIVE',
    message: isAgentPaused ? 'Agent paused' : 'Agent is active and authorized'
  });

  // ── Rule 0b: Per-agent daily budget ───────────────────────────────────────
  let agentBudgetFailed = false;
  if (agent && agent.dailyBudget > 0) {
    agentBudgetFailed = (agent24hSpend + tx.amount > agent.dailyBudget);
    rules.push({
      rule: 'Agent Daily Budget',
      passed: !agentBudgetFailed,
      limitValue: `$${agent.dailyBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      actualValue: `$${(agent24hSpend + tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${agent24hSpend.toFixed(2)} spent)`,
      message: agentBudgetFailed
        ? `Exceeds agent daily budget of $${agent.dailyBudget.toLocaleString()} ($${agent24hSpend.toFixed(2)} already spent)`
        : 'Spend within agent daily budget'
    });
  } else {
    rules.push({
      rule: 'Agent Daily Budget',
      passed: true,
      limitValue: 'No budget limit',
      actualValue: '$0.00',
      message: 'No agent daily budget restriction configured'
    });
  }

  // ── Rule 1: Denylist check ────────────────────────────────────────────────
  const isDenied = config.denylist.some(m =>
    m.toLowerCase() === tx.merchant.toLowerCase()
  );
  rules.push({
    rule: 'Merchant Denylist',
    passed: !isDenied,
    limitValue: 'Not on denylist',
    actualValue: isDenied ? `Denylisted ("${tx.merchant}")` : `Clean ("${tx.merchant}")`,
    message: isDenied ? `Merchant "${tx.merchant}" is on the denylist` : 'Merchant passed denylist check'
  });

  // ── Rule 2: Allowlist mode (if enabled) ───────────────────────────────────
  let allowlistFailed = false;
  if (config.allowlistMode && config.allowlist.length > 0) {
    const isAllowed = config.allowlist.some(m =>
      m.toLowerCase() === tx.merchant.toLowerCase()
    );
    allowlistFailed = !isAllowed;
    rules.push({
      rule: 'Merchant Allowlist',
      passed: isAllowed,
      limitValue: 'Must be on allowlist',
      actualValue: isAllowed ? 'Included' : `Not on allowlist ("${tx.merchant}")`,
      message: isAllowed ? 'Merchant is verified on allowlist' : `Allowlist mode active — merchant "${tx.merchant}" is not on the approved list`
    });
  } else {
    rules.push({
      rule: 'Merchant Allowlist',
      passed: true,
      limitValue: 'Allowlist mode disabled',
      actualValue: 'Standard check',
      message: 'Allowlist mode is inactive'
    });
  }

  // ── Rule 3: Per-transaction limit ─────────────────────────────────────────
  const txLimitFailed = tx.amount > config.maxTxLimit;
  rules.push({
    rule: 'Per-Transaction Limit',
    passed: !txLimitFailed,
    limitValue: `$${config.maxTxLimit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    actualValue: `$${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    message: txLimitFailed
      ? `Exceeds per-transaction limit of $${config.maxTxLimit.toLocaleString()} (attempted $${tx.amount.toLocaleString()})`
      : 'Transaction amount within limit'
  });

  // ── Rule 4: Frequency cap (>3 tx/sec per agent) ───────────────────────────
  const freqCapFailed = recent1sCount >= 3;
  rules.push({
    rule: 'Velocity Frequency Cap',
    passed: !freqCapFailed,
    limitValue: '<= 3 tx/sec',
    actualValue: `${recent1sCount + 1} tx/sec`,
    message: freqCapFailed ? 'Frequency cap exceeded — too many requests in 1s window' : 'Velocity within safety limits'
  });

  // ── Rule 5: Rolling 24h budget ────────────────────────────────────────────
  const budgetFailed = rolling24hSpend + tx.amount > config.dailyBudget;
  rules.push({
    rule: 'Rolling 24h Budget',
    passed: !budgetFailed,
    limitValue: `$${config.dailyBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    actualValue: `$${(rolling24hSpend + tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${rolling24hSpend.toFixed(2)} already spent)`,
    message: budgetFailed
      ? `Exceeds rolling 24h budget of $${config.dailyBudget.toLocaleString()} (${rolling24hSpend.toFixed(2)} already spent)`
      : '24h spend within budget'
  });

  // ── Rule 5b: Merchant Category Spend Cap ──────────────────────────────────
  const category = getMerchantCategory(tx.merchant);
  const categoryCap = config.categoryCaps ? config.categoryCaps[category] : undefined;
  const currentCatSpend = ctx.category24hSpend ?? 0;
  let categoryCapFailed = false;

  if (categoryCap !== undefined && categoryCap > 0) {
    categoryCapFailed = (currentCatSpend + tx.amount > categoryCap);
    rules.push({
      rule: 'Merchant Category Cap',
      passed: !categoryCapFailed,
      limitValue: `$${categoryCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${category})`,
      actualValue: `$${(currentCatSpend + tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ($${currentCatSpend.toFixed(2)} spent)`,
      message: categoryCapFailed
        ? `Exceeds 24h cap for category "${category}" (Limit: $${categoryCap.toLocaleString()}, Attempted: $${(currentCatSpend + tx.amount).toFixed(2)})`
        : `Spend within "${category}" category budget`
    });
  } else {
    rules.push({
      rule: 'Merchant Category Cap',
      passed: true,
      limitValue: 'No category cap',
      actualValue: `${category} ($${tx.amount.toFixed(2)})`,
      message: `No spend cap assigned to category "${category}"`
    });
  }

  // ── Rule 6: Risk score calculation & breakdown ────────────────────────────
  const knownMerchants = [
    'Vercel Infrastructure','AWS Compute','Stripe Payments','SendGrid Email',
    'Cloudflare CDN','OpenAI API','Twilio SMS','GitHub Actions',
    'Datadog Monitoring','PagerDuty Alerts','Sentry Errors','Notion Workspace'
  ];

  const riskBreakdown: RiskBreakdownItem[] = [
    { factor: 'Base Risk', points: 10, description: 'Baseline autonomous execution risk' }
  ];

  let calculatedRisk = 10;
  if (!knownMerchants.includes(tx.merchant)) {
    calculatedRisk += 45;
    riskBreakdown.push({
      factor: 'Unverified Merchant',
      points: 45,
      description: `Merchant "${tx.merchant}" is not in the known ecosystem`
    });
  } else {
    riskBreakdown.push({
      factor: 'Verified Merchant',
      points: 0,
      description: `Known ecosystem merchant: "${tx.merchant}"`
    });
  }

  if (tx.amount > 500) {
    calculatedRisk += 25;
    riskBreakdown.push({
      factor: 'High-Value Transfer',
      points: 25,
      description: `Transaction amount > $500 ($${tx.amount.toFixed(2)})`
    });
  } else {
    riskBreakdown.push({
      factor: 'Standard Size',
      points: 0,
      description: `Standard payment amount <= $500 ($${tx.amount.toFixed(2)})`
    });
  }

  const finalRiskScore = Math.min(100, isAgentPaused || isDenied ? 100 : calculatedRisk);
  const threshold = config.maxRiskScore ?? 80;
  const riskThresholdFailed = finalRiskScore >= threshold;

  rules.push({
    rule: 'Risk Score Threshold',
    passed: !riskThresholdFailed,
    limitValue: `< ${threshold} / 100`,
    actualValue: `${finalRiskScore} / 100`,
    message: riskThresholdFailed
      ? `Risk score ${finalRiskScore}/100 exceeds threshold of ${threshold} — flagged for review`
      : 'Risk score within acceptable parameters'
  });

  const ruleResults: RuleResults = {
    rules,
    riskBreakdown
  };

  // ── Determine Status & Reason ─────────────────────────────────────────────
  if (isAgentPaused) {
    return {
      status: 'BLOCKED',
      reason: 'Agent paused',
      riskScore: 100,
      ruleResults
    };
  }

  if (agentBudgetFailed) {
    return {
      status: 'BLOCKED',
      reason: `Exceeds agent daily budget of $${agent!.dailyBudget.toLocaleString()} ($${agent24hSpend.toFixed(2)} already spent)`,
      riskScore: 75,
      ruleResults
    };
  }

  if (isDenied) {
    return {
      status: 'BLOCKED',
      reason: `Merchant "${tx.merchant}" is on the denylist`,
      riskScore: 100,
      ruleResults
    };
  }

  if (allowlistFailed) {
    return {
      status: 'BLOCKED',
      reason: `Allowlist mode active — merchant "${tx.merchant}" is not on the approved list`,
      riskScore: 85,
      ruleResults
    };
  }

  if (txLimitFailed) {
    return {
      status: 'BLOCKED',
      reason: `Exceeds per-transaction limit of $${config.maxTxLimit.toLocaleString()} (attempted $${tx.amount.toLocaleString()})`,
      riskScore: 80,
      ruleResults
    };
  }

  if (freqCapFailed) {
    return {
      status: 'BLOCKED',
      reason: 'Frequency cap exceeded — too many requests in 1s window',
      riskScore: 90,
      ruleResults
    };
  }

  if (budgetFailed) {
    return {
      status: 'BLOCKED',
      reason: `Exceeds rolling 24h budget of $${config.dailyBudget.toLocaleString()} (${rolling24hSpend.toFixed(2)} already spent)`,
      riskScore: 60,
      ruleResults
    };
  }

  if (categoryCapFailed) {
    return {
      status: 'BLOCKED',
      reason: `Exceeds 24h cap for category "${category}" (Limit: $${categoryCap!.toLocaleString()}, Attempted: $${(currentCatSpend + tx.amount).toFixed(2)})`,
      riskScore: 70,
      ruleResults
    };
  }

  if (riskThresholdFailed) {
    return {
      status: 'FLAGGED',
      reason: `Risk score ${finalRiskScore}/100 exceeds threshold of ${threshold} — flagged for review`,
      riskScore: finalRiskScore,
      ruleResults
    };
  }

  // ── APPROVED ──────────────────────────────────────────────────────────────
  const settlementId = `SXP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  return {
    status: 'APPROVED',
    reason: `All policy checks passed — settled as ${settlementId}`,
    riskScore: finalRiskScore,
    settlementId,
    ruleResults
  };
}

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

  const agent = await prisma.agent.findUnique({
    where: { id: tx.agentId }
  });

  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let agent24hSpend = 0;
  if (agent && agent.dailyBudget > 0) {
    const agentAgg = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { agentId: tx.agentId, status: 'APPROVED', createdAt: { gt: oneDayAgo } }
    });
    agent24hSpend = agentAgg._sum.amount || 0;
  }

  const agg = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { status: 'APPROVED', createdAt: { gt: oneDayAgo } }
  });
  const rolling24hSpend = agg._sum.amount || 0;

  const oneSecondAgo = new Date(now.getTime() - 1000);
  const recent1sCount = await prisma.transaction.count({
    where: { agentId: tx.agentId, createdAt: { gt: oneSecondAgo } }
  });

  return evaluateRules(tx, {
    agent,
    config,
    agent24hSpend,
    rolling24hSpend,
    recent1sCount
  });
}
