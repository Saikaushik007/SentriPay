const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api/payment-intent';
const INTERVAL_MS = 2000;

const merchants = ['AWS Services', 'OpenAI API', 'DarkWeb Compute Co.', 'Vercel Pro', 'GitHub Copilot'];
const agentId = 'agent_demo_77x';

function generateRandomPayment() {
  const isLarge = Math.random() > 0.8;
  const amount = isLarge ? (Math.random() * 5000 + 1000) : (Math.random() * 100 + 5);
  const merchant = merchants[Math.floor(Math.random() * merchants.length)];
  
  return { amount, merchant, agentId };
}

function sendPaymentIntent(payload) {
  const data = JSON.stringify(payload);
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  
  const req = http.request(BACKEND_URL, options, (res) => {
    let responseBody = '';
    res.on('data', chunk => responseBody += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(responseBody);
        console.log(`[${result.status}] Sent $${result.amount.toFixed(2)} to ${result.merchant} -> ${result.reason}`);
      } catch (e) {
        console.log(`Error parsing response: ${responseBody}`);
      }
    });
  });
  
  req.on('error', error => {
    console.error(`Error sending request: ${error.message}`);
  });
  
  req.write(data);
  req.end();
}

console.log('Starting Demo Agent... Press Ctrl+C to stop.');
console.log(`Sending intents to ${BACKEND_URL}`);

setInterval(() => {
  const payload = generateRandomPayment();
  sendPaymentIntent(payload);
}, INTERVAL_MS);
