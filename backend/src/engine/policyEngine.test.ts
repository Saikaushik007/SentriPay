import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRules, PolicyEngineContext, TransactionRequest } from './policyEngine';

const baseConfig = {
  maxTxLimit: 1000,
  dailyBudget: 2000,
  denylist: ['DarkWeb Compute', 'ShadyAI Services'],
  allowlistMode: false,
  allowlist: ['AWS Compute', 'Vercel Infrastructure'],
  maxRiskScore: 80
};

const baseAgent = {
  id: 'agent-alpha-001',
  name: 'Alpha Infrastructure',
  status: 'ACTIVE',
  dailyBudget: 1500
};

const baseContext: PolicyEngineContext = {
  agent: baseAgent,
  config: baseConfig,
  agent24hSpend: 0,
  rolling24hSpend: 0,
  recent1sCount: 0
};

describe('Policy Engine Rules Verification', () => {
  it('1. Approves compliant transaction under all thresholds', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'AWS Compute',
      amount: 150
    };
    const result = evaluateRules(tx, baseContext);
    assert.equal(result.status, 'APPROVED');
    assert.match(result.reason, /All policy checks passed/);
    assert.ok(result.settlementId?.startsWith('SXP-'));
    assert.equal(result.riskScore, 10);
  });

  it('2. Blocks paused agent (Rule 0)', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'AWS Compute',
      amount: 50
    };
    const ctx = {
      ...baseContext,
      agent: { ...baseAgent, status: 'PAUSED' }
    };
    const result = evaluateRules(tx, ctx);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.reason, 'Agent paused');
    assert.equal(result.riskScore, 100);
  });

  it('3. Blocks intent exceeding agent daily budget (Rule 0b)', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'AWS Compute',
      amount: 600
    };
    const ctx = {
      ...baseContext,
      agent24hSpend: 1000 // 1000 + 600 = 1600 > 1500
    };
    const result = evaluateRules(tx, ctx);
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.reason, /Exceeds agent daily budget/);
  });

  it('4. Blocks denylisted merchant (Rule 1)', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'DarkWeb Compute',
      amount: 100
    };
    const result = evaluateRules(tx, baseContext);
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.reason, /Merchant "DarkWeb Compute" is on the denylist/);
    assert.equal(result.riskScore, 100);
  });

  it('5. Blocks merchant when allowlist mode is active and merchant not listed (Rule 2)', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'SendGrid Email',
      amount: 100
    };
    const ctx = {
      ...baseContext,
      config: { ...baseConfig, allowlistMode: true, allowlist: ['AWS Compute', 'Vercel Infrastructure'] }
    };
    const result = evaluateRules(tx, ctx);
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.reason, /Allowlist mode active/);
  });

  it('6. Blocks single transaction exceeding maxTxLimit (Rule 3)', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'AWS Compute',
      amount: 1250 // > 1000
    };
    const result = evaluateRules(tx, baseContext);
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.reason, /Exceeds per-transaction limit of \$1,000/);
  });

  it('7. Blocks velocity frequency cap (>3 tx/sec) (Rule 4)', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'AWS Compute',
      amount: 25
    };
    const ctx = {
      ...baseContext,
      recent1sCount: 3 // 3 previous tx in 1s -> 4th triggers cap
    };
    const result = evaluateRules(tx, ctx);
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.reason, /Frequency cap exceeded/);
  });

  it('8. Blocks rolling 24h budget breach (Rule 5)', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'AWS Compute',
      amount: 400
    };
    const ctx = {
      ...baseContext,
      rolling24hSpend: 1800 // 1800 + 400 = 2200 > 2000
    };
    const result = evaluateRules(tx, ctx);
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.reason, /Exceeds rolling 24h budget of \$2,000/);
  });

  it('9. Flags transaction exceeding composite risk threshold (Rule 6)', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'NovelUntrustedMerchant.xyz', // unknown (+45)
      amount: 800 // > 500 (+25) -> base (10) + 45 + 25 = 80 >= 80 threshold
    };
    const result = evaluateRules(tx, baseContext);
    assert.equal(result.status, 'FLAGGED');
    assert.match(result.reason, /Risk score 80\/100 exceeds threshold/);
    assert.equal(result.riskScore, 80);
  });

  it('10. Blocks transaction exceeding category spend cap (Rule 5b)', () => {
    const tx: TransactionRequest = {
      agentId: 'agent-alpha-001',
      merchant: 'OpenAI API', // Category: AI & LLM Services
      amount: 300
    };
    const ctx: PolicyEngineContext = {
      ...baseContext,
      config: {
        ...baseConfig,
        categoryCaps: { 'AI & LLM Services': 500 }
      },
      category24hSpend: 350 // 350 + 300 = 650 > 500
    };
    const result = evaluateRules(tx, ctx);
    assert.equal(result.status, 'BLOCKED');
    assert.match(result.reason, /Exceeds 24h cap for category "AI & LLM Services"/);
    assert.equal(result.riskScore, 70);
  });
});
