/**
 * SentriPay — Database Reset & Seed Script
 *
 * Budget design:
 *   dailyBudget = $2,000
 *   Target 24h spend = $900–$1,300  →  ~45–65% donut
 *
 * Strategy for APPROVED transactions:
 *   - 20 "recent" txs: timestamps 5–18h ago  (inside 24h window), amounts $20–$95
 *     Expected spend in window: 20 × avg $57.50 = ~$1,150
 *   - 40 "older" txs:  timestamps 26–72h ago (outside 24h window), amounts $30–$850
 *     These appear in the feed/chart history but don't count toward the 24h budget.
 *
 * All BLOCKED and FLAGGED timestamps are scattered across ±72h (they don't affect budget).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MERCHANTS_CLEAN = [
  'Vercel Infrastructure', 'AWS Compute', 'Stripe Payments', 'SendGrid Email',
  'Cloudflare CDN', 'OpenAI API', 'Twilio SMS', 'GitHub Actions',
  'Datadog Monitoring', 'PagerDuty Alerts', 'Sentry Errors', 'Notion Workspace'
];
const MERCHANTS_DENIED = ['DarkWeb Compute', 'ShadyAI Services'];
const AGENT_IDS = ['agent-alpha-001', 'agent-beta-002', 'agent-gamma-003'];

const rand = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const minsAgo = (mins: number): Date => new Date(Date.now() - mins * 60 * 1000);

// Deterministic 24h window boundary
const WINDOW_BOUNDARY_MINS = 24 * 60; // exactly 1440 minutes ago

async function main() {
  console.log('🗑️  Clearing existing transactions and policy history...');
  await prisma.transaction.deleteMany({});
  await prisma.policyHistory.deleteMany({});

  // ── Policy Config ──────────────────────────────────────────────────────────
  const DAILY_BUDGET = 2000;
  const policyData = {
    maxTxLimit: 1000,
    dailyBudget: DAILY_BUDGET,
    denylist: ['DarkWeb Compute', 'ShadyAI Services'],
  };
  const existing = await prisma.policyConfig.findFirst();
  if (existing) {
    await prisma.policyConfig.update({ where: { id: existing.id }, data: policyData });
  } else {
    await prisma.policyConfig.create({ data: policyData });
  }
  await prisma.policyHistory.create({
    data: {
      action: 'POLICY_UPDATED',
      detail: `Seed reset: Per-Tx Limit $1,000, Daily Budget $${DAILY_BUDGET.toLocaleString()}, Denylist: DarkWeb Compute, ShadyAI Services`
    }
  });
  console.log(`   ✅ PolicyConfig set: maxTxLimit=$1,000 | dailyBudget=$${DAILY_BUDGET.toLocaleString()} | denylist=2 merchants`);

  // ── Seed transactions ──────────────────────────────────────────────────────
  const seeds: {
    amount: number; merchant: string; agentId: string;
    status: string; reason: string; riskScore: number; createdAt: Date;
  }[] = [];

  // GROUP A — 20 APPROVED inside 24h window (5 min → 18h ago, amounts $20–$95)
  // Target: 20 × avg ~$57.50 = ~$1,150 in-window spend (57.5% of $2,000)
  for (let i = 0; i < 20; i++) {
    seeds.push({
      amount: rand(20, 95),
      merchant: pick(MERCHANTS_CLEAN),
      agentId: pick(AGENT_IDS),
      status: 'APPROVED',
      reason: 'All policy checks passed',
      riskScore: rand(5, 40),
      createdAt: minsAgo(rand(5, 18 * 60)), // 5 min → 18h ago (inside window)
    });
  }

  // GROUP B — 40 APPROVED outside 24h window (26h → 72h ago, varied amounts)
  // These enrich the feed/chart history but don't inflate the budget donut
  for (let i = 0; i < 40; i++) {
    seeds.push({
      amount: rand(30, 850),
      merchant: pick(MERCHANTS_CLEAN),
      agentId: pick(AGENT_IDS),
      status: 'APPROVED',
      reason: 'All policy checks passed',
      riskScore: rand(5, 45),
      createdAt: minsAgo(rand(WINDOW_BOUNDARY_MINS + 120, 72 * 60)), // 26h → 72h ago (outside window)
    });
  }

  // 20 BLOCKED — per-tx limit exceeded (scattered across ±60h)
  for (let i = 0; i < 20; i++) {
    const amount = rand(1010, 4800);
    seeds.push({
      amount,
      merchant: pick(MERCHANTS_CLEAN),
      agentId: pick(AGENT_IDS),
      status: 'BLOCKED',
      reason: `Exceeds per-transaction limit of $1,000 (attempted $${amount.toLocaleString()})`,
      riskScore: rand(30, 65),
      createdAt: minsAgo(rand(5, 60 * 60)),
    });
  }

  // 10 BLOCKED — denylist
  for (let i = 0; i < 10; i++) {
    const merchant = pick(MERCHANTS_DENIED);
    seeds.push({
      amount: rand(50, 800),
      merchant,
      agentId: pick(AGENT_IDS),
      status: 'BLOCKED',
      reason: `Merchant "${merchant}" is on the denylist`,
      riskScore: rand(70, 95),
      createdAt: minsAgo(rand(5, 60 * 60)),
    });
  }

  // 5 BLOCKED — frequency cap
  for (let i = 0; i < 5; i++) {
    seeds.push({
      amount: rand(20, 400),
      merchant: pick(MERCHANTS_CLEAN),
      agentId: pick(AGENT_IDS),
      status: 'BLOCKED',
      reason: 'Frequency cap exceeded — too many requests in 1s window',
      riskScore: rand(40, 75),
      createdAt: minsAgo(rand(5, 60 * 60)),
    });
  }

  // 15 FLAGGED — elevated risk score
  for (let i = 0; i < 15; i++) {
    const riskScore = rand(75, 92);
    seeds.push({
      amount: rand(400, 950),
      merchant: pick(MERCHANTS_CLEAN),
      agentId: pick(AGENT_IDS),
      status: 'FLAGGED',
      reason: `Risk score ${riskScore} exceeds threshold — flagged for review`,
      riskScore,
      createdAt: minsAgo(rand(5, 60 * 60)),
    });
  }

  // Sort ascending by createdAt for chart ordering
  seeds.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  await prisma.transaction.createMany({ data: seeds as any });

  // ── Report ─────────────────────────────────────────────────────────────────
  const total    = seeds.length;
  const approved = seeds.filter(t => t.status === 'APPROVED').length;
  const blocked  = seeds.filter(t => t.status === 'BLOCKED').length;
  const flagged  = seeds.filter(t => t.status === 'FLAGGED').length;

  const windowCutoff = new Date(Date.now() - WINDOW_BOUNDARY_MINS * 60 * 1000);
  const inWindowSpend = seeds
    .filter(t => t.status === 'APPROVED' && t.createdAt >= windowCutoff)
    .reduce((s, t) => s + t.amount, 0);

  const allApprovedSpend = seeds
    .filter(t => t.status === 'APPROVED')
    .reduce((s, t) => s + t.amount, 0);

  console.log(`\n✅ Seeded ${total} transactions across ${AGENT_IDS.length} agents`);
  console.log(`   APPROVED : ${approved}  (${((approved/total)*100).toFixed(0)}%)`);
  console.log(`   BLOCKED  : ${blocked}  (${((blocked/total)*100).toFixed(0)}%)`);
  console.log(`   FLAGGED  : ${flagged}  (${((flagged/total)*100).toFixed(0)}%)`);
  console.log(`   Approval Rate: ${((approved/total)*100).toFixed(1)}%`);
  console.log(`\n📊 Budget Donut Projection:`);
  console.log(`   In-window spend (24h) : $${inWindowSpend.toFixed(2)}`);
  console.log(`   Daily budget limit    : $${DAILY_BUDGET.toLocaleString()}`);
  console.log(`   Donut %               : ${((inWindowSpend / DAILY_BUDGET) * 100).toFixed(1)}%`);
  console.log(`   All-time approved     : $${allApprovedSpend.toFixed(2)}`);
  console.log(`\n🏁 Done.`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
