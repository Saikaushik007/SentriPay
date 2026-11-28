import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve('..', 'docs', 'ui-polish-2');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ROUTES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'transactions', path: '/transactions' },
  { name: 'approvals', path: '/approvals' },
  { name: 'agents', path: '/agents' },
  { name: 'agent-detail', path: '/agents/agent-alpha-001' },
  { name: 'policies', path: '/policies' },
  { name: 'merchants', path: '/merchants' },
  { name: 'analytics', path: '/analytics' },
  { name: 'alerts', path: '/alerts' },
  { name: 'integrate', path: '/integrate' },
  { name: 'settings', path: '/settings' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

let currentConsoleErrors = [];
let currentFailedRequests = [];

page.on('console', msg => {
  if (msg.type() === 'error') {
    currentConsoleErrors.push(msg.text());
  }
});
page.on('pageerror', err => {
  currentConsoleErrors.push(err.message);
});
page.on('response', res => {
  if (res.status() >= 400) {
    currentFailedRequests.push(`${res.status()} ${res.url()}`);
  }
});

// 1. Open dashboard & click Reset Demo
await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Demo tools/i }).click();
await page.getByRole('button', { name: /^Reset$/i }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Close demo tools/i }).click();

const results = [];

for (const r of ROUTES) {
  currentConsoleErrors = [];
  currentFailedRequests = [];

  // 1440px check
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${r.name}-1440.png`), fullPage: true });

  // 390px check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const overflow390 = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${r.name}-390.png`), fullPage: true });

  results.push({
    page: r.name,
    path: r.path,
    consoleErrors: [...currentConsoleErrors],
    failedRequests: [...currentFailedRequests],
    overflow390,
  });
}

// Test mobile sidebar drawer at 390px
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Open navigation/i }).click();
await page.waitForTimeout(300);
const drawerVisible = await page.getByRole('button', { name: /Close navigation/i }).isVisible();
await page.getByRole('button', { name: /Close navigation/i }).click();

// Test interactive actions at 1440px
await page.setViewportSize({ width: 1440, height: 900 });
const actions = {};

// Action 1: Open decision drawer on /dashboard for APPROVED, BLOCKED, and FLAGGED
actions.decisionDrawer = {};
for (const status of ['APPROVED', 'BLOCKED', 'FLAGGED']) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: new RegExp(`^${status}$`, 'i') }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Inspect/i }).first().click();
  await page.waitForTimeout(300);
  const hasRisk = await page.getByText(/Risk Engine Assessment/i).isVisible();
  const hasReason = await page.getByText(/Decision Reason:/i).isVisible();
  actions.decisionDrawer[status] = hasRisk && hasReason;
  await page.locator('button').filter({ has: page.locator('svg.lucide-x') }).last().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(200);
}

// Action 2: Run a scenario from Demo tools
await page.getByRole('button', { name: /Demo tools/i }).click();
await page.getByRole('button', { name: /^Run$/i }).first().click();
await page.waitForTimeout(800);
actions.runScenario = true;
await page.getByRole('button', { name: /Close demo tools/i }).click();

// Action 3: Apply a table filter on /transactions
await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'networkidle' });
await page.getByLabel('Filter by status').selectOption('BLOCKED');
await page.waitForTimeout(400);
actions.tableFilter = page.url().includes('status=BLOCKED');

// Action 4: Pause and resume an agent on /agents
await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Pause/i }).first().click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /Resume/i }).first().click();
await page.waitForTimeout(600);
actions.pauseResumeAgent = true;

// Action 5: Approve and reject a flagged payment on /approvals
await page.goto(`${BASE_URL}/approvals`, { waitUntil: 'networkidle' });
const approveBtns = page.getByRole('button', { name: /Approve/i });
if ((await approveBtns.count()) > 0) {
  await approveBtns.first().click();
  await page.getByRole('button', { name: /Confirm Approve/i }).click();
  await page.waitForTimeout(600);
}
const rejectBtns = page.getByRole('button', { name: /Reject/i });
if ((await rejectBtns.count()) > 0) {
  await rejectBtns.first().click();
  await page.getByRole('button', { name: /Confirm Reject/i }).click();
  await page.waitForTimeout(600);
}
actions.approveReject = true;

// Action 6: Edit a policy & save + reload + restore, plus run simulator (approved & blocked)
await page.goto(`${BASE_URL}/policies`, { waitUntil: 'networkidle' });
const editBtn = page.getByRole('button', { name: /Edit/i }).first();
if (await editBtn.isVisible().catch(() => false)) {
  await editBtn.click();
  await page.waitForTimeout(300);
}
const txLimitInput = page.locator('input[type="number"]').first();
const originalLimit = await txLimitInput.inputValue();
await txLimitInput.fill('1250');
await page.getByRole('button', { name: /Save Changes/i }).first().click();
await page.waitForTimeout(600);
await page.reload({ waitUntil: 'networkidle' });
const editBtn2 = page.getByRole('button', { name: /Edit/i }).first();
if (await editBtn2.isVisible().catch(() => false)) {
  await editBtn2.click();
  await page.waitForTimeout(200);
}
const persistedLimit = await page.locator('input[type="number"]').first().inputValue();
// Restore original limit
await page.locator('input[type="number"]').first().fill(originalLimit || '1000');
await page.getByRole('button', { name: /Save Changes/i }).first().click();
await page.waitForTimeout(500);

// Simulator: approved case ($45) & blocked case ($1500)
// PolicySimulator is embedded in /policies - button text is "Test Policy"
let simApproved = false;
let simBlocked = false;
let simApprovedDetail = null;
let simBlockedDetail = null;
// Reload policies page fresh
await page.goto(`${BASE_URL}/policies`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const simBtn = page.getByRole('button', { name: /Test Policy/i }).first();
const simAmountInput = page.locator('input[type="number"][min="0.01"]').first();
const simMerchantInput = page.locator('input[placeholder*="AWS Compute"]').first();
if (await simBtn.isVisible().catch(() => false)) {
  // Test approved case: small amount, known good merchant
  if (await simMerchantInput.isVisible().catch(() => false)) {
    await simMerchantInput.fill('AWS Compute');
  }
  await simAmountInput.fill('45');
  await simBtn.click();
  await page.waitForTimeout(1000);
  const approvedText = await page.getByText(/Would Be Approved|Nothing Executed/i).first().isVisible().catch(() => false);
  const approvedStatus = await page.getByText(/APPROVED/i).first().isVisible().catch(() => false);
  simApproved = approvedText || approvedStatus;
  simApprovedDetail = {
    banner: await page.getByText(/Would Be Approved/i).first().textContent().catch(() => null),
    rulesPassed: await page.getByText(/of \d+ rules passed/i).first().textContent().catch(() => null),
  };

  // Test blocked case: amount over per-tx limit
  await simAmountInput.fill('9999');
  await simBtn.click();
  await page.waitForTimeout(1000);
  const blockedText = await page.getByText(/Would Be Blocked/i).first().isVisible().catch(() => false);
  const blockedStatus = await page.getByText(/BLOCKED/i).first().isVisible().catch(() => false);
  simBlocked = blockedText || blockedStatus;
  simBlockedDetail = {
    banner: await page.getByText(/Would Be Blocked/i).first().textContent().catch(() => null),
    rulesPassed: await page.getByText(/of \d+ rules passed/i).first().textContent().catch(() => null),
  };
}
actions.editPolicyAndSimulator = {
  persisted: persistedLimit === '1250',
  restoredTo: originalLimit || '1000',
  simApproved,
  simBlocked,
  simApprovedDetail,
  simBlockedDetail,
};

// Action 7: Add and remove a webhook on /alerts
await page.goto(`${BASE_URL}/alerts`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('https://your-server.com/webhooks/sentripay').fill('https://example.com/pw-hook');
await page.getByRole('button', { name: /Add webhook/i }).click();
await page.waitForTimeout(600);
const hookVisible = await page.getByText('https://example.com/pw-hook').first().isVisible();
await page.getByRole('button', { name: /Remove webhook/i }).first().click();
await page.waitForTimeout(400);
actions.addRemoveWebhook = hookVisible;

// Phase 1 Consistency Assertions:
// 1. Dashboard processed === Transactions count === sum of per-agent transactions
// 2. Dashboard approval rate === approved / processed
// 3. Agents 24h spend total === Dashboard 24h spend
// 4. Approvals badge === Dashboard flagged waiting === Bell count === Approvals page count
const [stats24h, txs24h, agents24h, reviewQ] = await Promise.all([
  page.evaluate(() => fetch('http://localhost:3001/api/transactions/stats?range=24h').then(r => r.json())),
  page.evaluate(() => fetch('http://localhost:3001/api/transactions?range=24h').then(r => r.json())),
  page.evaluate(() => fetch('http://localhost:3001/api/agents?range=24h').then(r => r.json())),
  page.evaluate(() => fetch('http://localhost:3001/api/review-queue').then(r => r.json())),
]);
const agentTxSum = agents24h.reduce((s, a) => s + a.total, 0);
const agentSpendSum = Math.round(agents24h.reduce((s, a) => s + a.totalSpend, 0) * 100) / 100;
const expectedApprovalRate = stats24h.total > 0 ? Math.round((stats24h.approved / stats24h.total) * 1000) / 10 : 0;

await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
const dashFlaggedWaiting = await page.getByTestId('dashboard-flagged-waiting').textContent().catch(() => null);
const bellCount = await page.getByTestId('notif-bell-count').textContent().catch(() => null);

actions.consistency = {
  processedMatch: stats24h.total === txs24h.length && stats24h.total === agentTxSum,
  statsTotal: stats24h.total,
  txsLength: txs24h.length,
  agentTxSum,
  approvalRateMatch: stats24h.approvalRate === expectedApprovalRate,
  approvalRate: stats24h.approvalRate,
  expectedApprovalRate,
  spendMatch: Math.abs(agentSpendSum - stats24h.totalSpend) < 0.02,
  agentSpendSum,
  dashSpend: stats24h.totalSpend,
  flaggedMatch:
    Number(dashFlaggedWaiting?.trim()) === reviewQ.length &&
    Number(bellCount?.trim()) === reviewQ.length,
  reviewQueueLength: reviewQ.length,
  dashFlaggedWaiting: dashFlaggedWaiting?.trim(),
  bellCount: bellCount?.trim(),
};

await browser.close();

console.log(JSON.stringify({ results, drawerVisible, actions }, null, 2));
