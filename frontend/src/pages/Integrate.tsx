import { useState } from 'react';
import { 
  Code, Copy, Check, Terminal, FileCode, 
  XCircle, AlertTriangle, CheckCircle2 
} from 'lucide-react';

export default function Integrate() {
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJs, setCopiedJs] = useState(false);
  const [copiedPython, setCopiedPython] = useState(false);

  const curlCode = `curl -X POST https://api.sentripay.dev/api/payment-intent \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_alpha_001_c8f92a" \\
  -d '{
    "agentId": "agent-alpha-001",
    "merchant": "AWS Compute",
    "amount": 149.50
  }'`;

  const jsCode = `// SentriPay Autonomous Payment Intent
async function submitPaymentIntent({ agentId, merchant, amount, apiKey = "sk_live_alpha_001_c8f92a" }) {
  const response = await fetch("https://api.sentripay.dev/api/payment-intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    },
    body: JSON.stringify({ agentId, merchant, amount })
  });

  const decision = await response.json();

  switch (decision.status) {
    case "APPROVED":
      console.log(\`✅ Payment settled via x402: \${decision.settlementId}\`);
      return { success: true, settlementId: decision.settlementId };

    case "FLAGGED":
      console.warn(\`⚠️ Held for operator review: \${decision.reason}\`);
      return { success: false, pendingReview: true };

    case "BLOCKED":
      console.error(\`❌ Policy enforcement blocked payment: \${decision.reason}\`);
      throw new Error(\`PaymentBlocked: \${decision.reason}\`);
  }
}`;

  const pythonCode = `import requests

def send_payment_intent(agent_id: str, merchant: str, amount: float, api_key: str = "sk_live_alpha_001_c8f92a"):
    url = "https://api.sentripay.dev/api/payment-intent"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key
    }
    payload = {
        "agentId": agent_id,
        "merchant": merchant,
        "amount": amount
    }

    res = requests.post(url, json=payload, headers=headers)
    data = res.json()

    if data["status"] == "APPROVED":
        print(f"Settled via x402: {data['settlementId']}")
        return data
    elif data["status"] == "FLAGGED":
        print(f"Held for manual review: {data['reason']}")
        return data
    else:
        raise Exception(f"Blocked by SentriPay: {data['reason']}")`;

  const copyToClipboard = (text: string, type: 'curl' | 'js' | 'python') => {
    navigator.clipboard.writeText(text);
    if (type === 'curl') {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else if (type === 'js') {
      setCopiedJs(true);
      setTimeout(() => setCopiedJs(false), 2000);
    } else {
      setCopiedPython(true);
      setTimeout(() => setCopiedPython(false), 2000);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full space-y-10">
      {/* Header Banner */}
      <div 
        className="rounded-3xl p-8 relative overflow-hidden text-white"
        style={{
          background: 'linear-gradient(135deg, #18181B 0%, #27272A 60%, #3F3F46 100%)',
          boxShadow: '0 12px 40px -10px rgba(24, 24, 27, 0.45)'
        }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-widest mb-3">
            <Code size={14} /> Developer API & SDK Integration
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Integrate SentriPay in 3 Minutes
          </h1>
          <p className="text-base text-gray-300 max-w-xl font-serif italic mb-4" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            A lightweight, deterministic proxy layer between autonomous agents and x402 settlement.
          </p>
          <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
            Replace direct payment requests with SentriPay's gateway endpoint. The engine runs 
            limits, velocity caps, allowlists, and risk scores in &lt;15ms before authorizing settlement.
          </p>
        </div>
      </div>

      {/* Decision Status Matrix Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Gateway Decision Statuses
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Every payment intent returns one of three deterministic statuses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* APPROVED */}
          <div 
            className="p-6 rounded-3xl border flex flex-col justify-between"
            style={{
              background: '#F0FDF4',
              borderColor: '#BBF7D0',
              boxShadow: '0 8px 24px -12px rgba(16, 185, 129, 0.2)'
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-sm">
                  APPROVED
                </span>
                <CheckCircle2 size={18} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-2">Instant x402 Settlement</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                The intent satisfied all configured spending limits, 24h rolling budget, merchant allowlist/denylist, and risk thresholds.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-200/80 text-[11px] font-mono text-emerald-800">
              Payload includes: <strong>settlementId</strong> (e.g. <code>SXP-402-9A4B</code>)
            </div>
          </div>

          {/* FLAGGED */}
          <div 
            className="p-6 rounded-3xl border flex flex-col justify-between"
            style={{
              background: '#FFFBEB',
              borderColor: '#FDE68A',
              boxShadow: '0 8px 24px -12px rgba(245, 158, 11, 0.2)'
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-amber-600 text-white shadow-sm">
                  FLAGGED
                </span>
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-2">Held for Human Review</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                The transaction is within financial limits but exhibits suspicious attributes (composite risk score &ge; 80 or novel merchant endpoint).
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-amber-200/80 text-[11px] font-mono text-amber-800">
              Routed to: <strong>Review Queue</strong> for operator authorization
            </div>
          </div>

          {/* BLOCKED */}
          <div 
            className="p-6 rounded-3xl border flex flex-col justify-between"
            style={{
              background: '#FFF1F2',
              borderColor: '#FECDD3',
              boxShadow: '0 8px 24px -12px rgba(244, 63, 94, 0.2)'
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-rose-600 text-white shadow-sm">
                  BLOCKED
                </span>
                <XCircle size={18} className="text-rose-600" />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-2">Deterministic Policy Block</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Breached a strict safety rule: single-transaction ceiling, daily budget exhausted, denylisted domain, frequency cap (&gt;3 tx/s), or paused agent.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-rose-200/80 text-[11px] font-mono text-rose-800">
              Payload includes: <strong>reason</strong> (Human-readable violation)
            </div>
          </div>
        </div>
      </div>

      {/* Code Samples Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Integration Code Snippets
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Copy and paste into your agent runtime or workflow orchestration engine.
          </p>
        </div>

        {/* cURL Snippet */}
        <div className="rounded-3xl bg-slate-900 text-slate-100 overflow-hidden shadow-xl border border-slate-800">
          <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={15} className="text-indigo-400" />
              <span className="text-xs font-mono font-bold text-slate-300">cURL Payment Intent</span>
            </div>
            <button
              onClick={() => copyToClipboard(curlCode, 'curl')}
              className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
            >
              {copiedCurl ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiedCurl ? 'Copied' : 'Copy cURL'}
            </button>
          </div>
          <pre className="p-6 font-mono text-xs overflow-x-auto text-emerald-300/90 leading-relaxed">
            <code>{curlCode}</code>
          </pre>
        </div>

        {/* JavaScript / TypeScript Snippet */}
        <div className="rounded-3xl bg-slate-900 text-slate-100 overflow-hidden shadow-xl border border-slate-800">
          <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode size={15} className="text-amber-400" />
              <span className="text-xs font-mono font-bold text-slate-300">JavaScript / TypeScript (Fetch)</span>
            </div>
            <button
              onClick={() => copyToClipboard(jsCode, 'js')}
              className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
            >
              {copiedJs ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiedJs ? 'Copied' : 'Copy JS'}
            </button>
          </div>
          <pre className="p-6 font-mono text-xs overflow-x-auto text-sky-200 leading-relaxed">
            <code>{jsCode}</code>
          </pre>
        </div>

        {/* Python Snippet */}
        <div className="rounded-3xl bg-slate-900 text-slate-100 overflow-hidden shadow-xl border border-slate-800">
          <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code size={15} className="text-sky-400" />
              <span className="text-xs font-mono font-bold text-slate-300">Python (Requests)</span>
            </div>
            <button
              onClick={() => copyToClipboard(pythonCode, 'python')}
              className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
            >
              {copiedPython ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiedPython ? 'Copied' : 'Copy Python'}
            </button>
          </div>
          <pre className="p-6 font-mono text-xs overflow-x-auto text-amber-200 leading-relaxed">
            <code>{pythonCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}