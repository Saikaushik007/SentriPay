import { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  Terminal,
  FileCode,
  XCircle,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import X402FlowVisualizer from '../components/X402FlowVisualizer';
import { PageHeader, Card } from '../components/ui/primitives';
import { apiUrl } from '../lib/api';

type SnippetTab = 'curl' | 'js' | 'python';

export default function Integrate() {
  const [activeTab, setActiveTab] = useState<SnippetTab>('curl');
  const [copied, setCopied] = useState(false);

  const endpoint = apiUrl('/api/payment-intent');

  const snippets: Record<SnippetTab, { label: string; icon: React.ReactNode; code: string }> = {
    curl: {
      label: 'cURL',
      icon: <Terminal size={14} />,
      code: `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <YOUR_AGENT_API_KEY>" \\
  -d '{
    "agentId": "agent-alpha-001",
    "merchant": "AWS Compute",
    "amount": 149.50
  }'`,
    },
    js: {
      label: 'JavaScript',
      icon: <FileCode size={14} />,
      code: `// SentriPay Autonomous Payment Intent
async function submitPaymentIntent({ agentId, merchant, amount, apiKey }) {
  const response = await fetch("${endpoint}", {
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
      return { success: true, settlementId: decision.settlementId };
    case "FLAGGED":
      return { success: false, pendingReview: true };
    case "BLOCKED":
      throw new Error(\`PaymentBlocked: \${decision.reason}\`);
  }
}`,
    },
    python: {
      label: 'Python',
      icon: <Code size={14} />,
      code: `import requests

def send_payment_intent(agent_id: str, merchant: str, amount: float, api_key: str):
    url = "${endpoint}"
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
        return data
    elif data["status"] == "FLAGGED":
        return data
    else:
        raise Exception(f"Blocked by SentriPay: {data['reason']}")`,
    },
  };

  const copyActive = () => {
    navigator.clipboard?.writeText(snippets[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      <PageHeader
        title="Integrate"
        description="Drop-in payment intent gateway between your autonomous agents and x402 settlement"
      />

      {/* 3-step guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { step: '01', title: 'Get your agent key', desc: 'Reveal and copy an agent API key from Settings.' },
          { step: '02', title: 'Send payment intents', desc: 'POST amount, merchant, and agentId to the gateway.' },
          { step: '03', title: 'Handle decisions', desc: 'Settle approved intents, queue flagged ones, or halt blocks.' },
        ].map(s => (
          <Card key={s.step} interactive className="p-4">
            <div className="text-xs font-mono-num font-semibold text-[#4F46E5] mb-1">STEP {s.step}</div>
            <div className="text-sm font-semibold text-[#0F172A]">{s.title}</div>
            <p className="text-xs text-[#64748B] mt-1">{s.desc}</p>
          </Card>
        ))}
      </div>

      {/* Live x402 Protocol Flow Visualizer */}
      <X402FlowVisualizer />

      {/* Decision Status Matrix Section */}
      <div className="space-y-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Gateway Decision Statuses</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Every payment intent returns one of three deterministic statuses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[#10B981]/30 bg-[#10B981]/[0.03] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#10B981]/10 text-[#059669]">
                  APPROVED
                </span>
                <CheckCircle2 size={18} className="text-[#10B981]" />
              </div>
              <h3 className="font-semibold text-sm text-[#0F172A] mb-1.5">Instant x402 Settlement</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Satisfied all configured spending limits, 24h rolling budget, merchant rules, and risk thresholds.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#10B981]/20 text-xs font-mono-num text-[#059669]">
              Includes <strong>settlementId</strong>
            </div>
          </Card>

          <Card className="border-[#F59E0B]/30 bg-[#F59E0B]/[0.03] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F59E0B]/10 text-[#D97706]">
                  FLAGGED
                </span>
                <AlertTriangle size={18} className="text-[#F59E0B]" />
              </div>
              <h3 className="font-semibold text-sm text-[#0F172A] mb-1.5">Held for Human Review</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Within financial limits but triggers elevated risk or novel merchant checks.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F59E0B]/20 text-xs font-mono-num text-[#D97706]">
              Routed to <strong>Approvals</strong> queue
            </div>
          </Card>

          <Card className="border-[#F43F5E]/30 bg-[#F43F5E]/[0.03] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F43F5E]/10 text-[#E11D48]">
                  BLOCKED
                </span>
                <XCircle size={18} className="text-[#F43F5E]" />
              </div>
              <h3 className="font-semibold text-sm text-[#0F172A] mb-1.5">Deterministic Policy Block</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Breached per-tx ceiling, daily budget, denylist, velocity cap, or paused agent state.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F43F5E]/20 text-xs font-mono-num text-[#E11D48]">
              Includes <strong>reason</strong> string
            </div>
          </Card>
        </div>
      </div>

      {/* Tabbed Code Samples */}
      <Card className="p-0 overflow-hidden bg-[#0F172A] border-[#1E293B] text-slate-100">
        <div className="px-4 py-3 bg-[#020617]/60 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {(Object.keys(snippets) as SnippetTab[]).map(key => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === key
                    ? 'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {snippets[key].icon}
                {snippets[key].label}
              </button>
            ))}
          </div>
          <button
            onClick={copyActive}
            className="text-xs font-mono-num px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check size={13} className="text-[#10B981]" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy snippet'}
          </button>
        </div>
        <pre className="p-5 font-mono-num text-xs overflow-x-auto text-slate-200 leading-relaxed">
          <code>{snippets[activeTab].code}</code>
        </pre>
      </Card>
    </div>
  );
}
