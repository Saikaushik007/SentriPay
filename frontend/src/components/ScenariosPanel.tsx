import { useState } from 'react';
import { Sparkles, Play, RefreshCw, Zap, ShieldAlert, Ban, DollarSign, PauseCircle } from 'lucide-react';

interface ScenariosPanelProps {
  onScenarioExecuted?: () => void;
}

export default function ScenariosPanel({ onScenarioExecuted }: ScenariosPanelProps) {
  const [running, setRunning] = useState<string | null>(null);

  const runScenario = async (scenario: 'runaway' | 'denylist' | 'burst' | 'overlimit' | 'paused') => {
    setRunning(scenario);

    try {
      if (scenario === 'overlimit') {
        // Exceeds per-tx limit of $1,000
        await fetch('/api/payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 1750.00,
            merchant: 'AWS Compute',
            agentId: 'agent-alpha-001'
          })
        });
      } else if (scenario === 'denylist') {
        // Denylisted merchant
        await fetch('/api/payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 320.00,
            merchant: 'DarkWeb Compute',
            agentId: 'agent-beta-002'
          })
        });
      } else if (scenario === 'burst') {
        // Rapid burst: 4 concurrent calls in under 1 second to trigger velocity cap
        await Promise.all([
          fetch('/api/payment-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 15, merchant: 'OpenAI API', agentId: 'agent-beta-002' }) }),
          fetch('/api/payment-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 18, merchant: 'OpenAI API', agentId: 'agent-beta-002' }) }),
          fetch('/api/payment-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 22, merchant: 'OpenAI API', agentId: 'agent-beta-002' }) }),
          fetch('/api/payment-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 25, merchant: 'OpenAI API', agentId: 'agent-beta-002' }) }),
        ]);
      } else if (scenario === 'paused') {
        // Ensure agent-alpha-001 is paused, then fire
        const agents = await fetch('/api/agents').then(r => r.json()).catch(() => []);
        const alpha = Array.isArray(agents) ? agents.find((a: any) => (a.id || a.agentId) === 'agent-alpha-001') : null;
        if (alpha && alpha.status !== 'PAUSED') {
          await fetch('/api/agents/agent-alpha-001/pause', { method: 'PATCH' });
        }
        await fetch('/api/payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 75.00,
            merchant: 'SendGrid Email',
            agentId: 'agent-alpha-001'
          })
        });
      } else if (scenario === 'runaway') {
        // High amount to breach rolling 24h budget or agent daily budget
        await fetch('/api/payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 3500.00,
            merchant: 'Vercel Infrastructure',
            agentId: 'agent-gamma-003'
          })
        });
      }

      onScenarioExecuted?.();
    } catch (err) {
      console.error('Scenario run error:', err);
    } finally {
      setTimeout(() => setRunning(null), 500);
    }
  };

  const SCENARIOS = [
    {
      id: 'overlimit' as const,
      title: 'Over-Limit',
      desc: 'Tx > $1,000 threshold',
      icon: DollarSign,
      color: '#E11D48',
      bg: '#FFF1F2',
      border: '#FECDD3'
    },
    {
      id: 'denylist' as const,
      title: 'Denylisted Merchant',
      desc: 'DarkWeb Compute call',
      icon: Ban,
      color: '#DC2626',
      bg: '#FEF2F2',
      border: '#FCA5A5'
    },
    {
      id: 'burst' as const,
      title: 'Rapid Burst',
      desc: '4 tx/s velocity breach',
      icon: Zap,
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A'
    },
    {
      id: 'paused' as const,
      title: 'Paused Agent',
      desc: 'Blocked: Agent paused',
      icon: PauseCircle,
      color: '#7C3AED',
      bg: '#F5F3FF',
      border: '#DDD6FE'
    },
    {
      id: 'runaway' as const,
      title: 'Runaway Agent',
      desc: 'Breaches 24h budget',
      icon: ShieldAlert,
      color: '#0891B2',
      bg: '#ECFEFF',
      border: '#A5F3FC'
    },
  ];

  return (
    <div 
      className="rounded-3xl p-6 border"
      style={{
        background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%)',
        borderColor: '#FED7AA',
        boxShadow: '0 10px 28px -16px rgba(234, 88, 12, 0.22)'
      }}
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-sm">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="font-bold text-base text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Live Threat & Scenario Simulator
            </h3>
            <p className="text-xs text-gray-500">
              Trigger realistic autonomous payment intents into the live policy engine.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
          Real WebSocket Dispatch
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SCENARIOS.map(s => {
          const Icon = s.icon;
          const isCurrent = running === s.id;
          return (
            <button
              key={s.id}
              onClick={() => runScenario(s.id)}
              disabled={!!running}
              className="p-3.5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 flex flex-col justify-between"
              style={{
                background: s.bg,
                borderColor: s.border
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: s.color }}>
                    <Icon size={14} />
                  </div>
                  {isCurrent && <RefreshCw size={13} className="animate-spin text-gray-600" />}
                </div>
                <div className="font-bold text-xs text-gray-900">{s.title}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{s.desc}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-gray-200/50 flex items-center gap-1 text-[11px] font-semibold" style={{ color: s.color }}>
                <Play size={10} fill={s.color} />
                <span>{isCurrent ? 'Firing…' : 'Fire'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}