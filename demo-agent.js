// SentriPay Autonomous Payment Agent Simulator
// Usage:
//   node demo-agent.js
//   node demo-agent.js https://your-render-backend.onrender.com
//   BACKEND_URL=https://your-render-backend.onrender.com node demo-agent.js

const rawUrl = process.env.BACKEND_URL || process.argv[2] || 'http://localhost:3001';
const BASE_URL = rawUrl.replace(/\/$/, '').replace(/\/api\/payment-intent$/, '');
const ENDPOINT = `${BASE_URL}/api/payment-intent`;
const INTERVAL_MS = 2500;

const merchants = [
  'AWS Compute', 'OpenAI API', 'Vercel Infrastructure', 'SendGrid Email',
  'Cloudflare CDN', 'Stripe Payments', 'GitHub Actions', 'Datadog Monitoring',
  'DarkWeb Compute', 'ShadyAI Services'
];

const agents = [
  { id: 'agent-alpha-001', apiKey: 'sk_live_alpha_001_c8f92a' },
  { id: 'agent-beta-002', apiKey: 'sk_live_beta_002_d3a17e' },
  { id: 'agent-gamma-003', apiKey: 'sk_live_gamma_003_e5b49f' }
];

function generateRandomPayment() {
  const isLarge = Math.random() > 0.82;
  const amount = isLarge
    ? parseFloat((Math.random() * 2500 + 1050).toFixed(2)) // Will trigger tx limit
    : parseFloat((Math.random() * 280 + 15).toFixed(2));
  const merchant = merchants[Math.floor(Math.random() * merchants.length)];
  const agent = agents[Math.floor(Math.random() * agents.length)];

  return { amount, merchant, agentId: agent.id, apiKey: agent.apiKey };
}

async function sendPaymentIntent(payload) {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': payload.apiKey
      },
      body: JSON.stringify({
        amount: payload.amount,
        merchant: payload.merchant,
        agentId: payload.agentId
      })
    });

    const result = await res.json();
    const symbol = result.status === 'APPROVED' ? '✅' : result.status === 'FLAGGED' ? '⚠️' : '❌';
    console.log(`${symbol} [${result.status}] ${payload.agentId} -> $${payload.amount.toFixed(2)} to ${payload.merchant} | ${result.reason}`);
  } catch (error) {
    console.error(`🚨 Error dispatching to ${ENDPOINT}: ${error.message}`);
  }
}

console.log('🤖 Starting SentriPay Autonomous Demo Agent...');
console.log(`🌐 Target Gateway: ${ENDPOINT}`);
console.log('⚡ Firing intents every 2.5s (Press Ctrl+C to terminate)\n');

// Fire initial intent immediately, then loop
sendPaymentIntent(generateRandomPayment());
setInterval(() => {
  sendPaymentIntent(generateRandomPayment());
}, INTERVAL_MS);

setInterval(() => {
  const payload = generateRandomPayment();
  sendPaymentIntent(payload);
}, INTERVAL_MS);
