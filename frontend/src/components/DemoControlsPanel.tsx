import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Play, RefreshCw, Zap, Ban, DollarSign,
  PauseCircle, RotateCcw, ChevronDown, ChevronUp, Sliders
} from 'lucide-react';
import { apiUrl } from '../lib/api';
import { useToast } from '../context/ToastContext';

interface DemoControlsPanelProps {
  onDataChanged?: () => void;
}

export default function DemoControlsPanel({ onDataChanged }: DemoControlsPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const toast = useToast();

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch(apiUrl('/api/reset-demo'), { method: 'POST' });
      if (!res.ok) throw new Error('Demo reset request failed');
      const data = await res.json();
      toast.success('Demo Reset Complete', `Loaded ${data.total} baseline transactions across 3 active agents.`);
      onDataChanged?.();
    } catch (e: any) {
      toast.error('Reset Failed', e.message);
    } finally {
      setIsResetting(false);
    }
  };

  const runScenario = async (scenario: 'runaway' | 'denylist' | 'burst' | 'overlimit' | 'paused') => {
    setRunningScenario(scenario);

    try {
      if (scenario === 'overlimit') {
        // Exceeds per-tx limit of $1,000
        const res = await fetch(apiUrl('/api/payment-intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 1750.00,
            merchant: 'AWS Compute',
            agentId: 'agent-alpha-001'
          })
        });
        const data = await res.json();
        toast.warning('Over-Limit Intent Sent', `Result: ${data.status} — ${data.reason}`);
      } else if (scenario === 'denylist') {
        // Denylisted merchant
        const res = await fetch(apiUrl('/api/payment-intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 320.00,
            merchant: 'DarkWeb Compute',
            agentId: 'agent-beta-002'
          })
        });
        const data = await res.json();
        toast.error('Denylisted Merchant Intent', `Result: ${data.status} — ${data.reason}`);
      } else if (scenario === 'burst') {
        // Rapid burst: 4 concurrent calls in under 1 second
        toast.info('Dispatching Rapid Burst', 'Sending 4 rapid calls to trigger frequency cap...');
        const calls = await Promise.all([
          fetch(apiUrl('/api/payment-intent'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 15, merchant: 'OpenAI API', agentId: 'agent-beta-002' }) }),
          fetch(apiUrl('/api/payment-intent'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 18, merchant: 'OpenAI API', agentId: 'agent-beta-002' }) }),
          fetch(apiUrl('/api/payment-intent'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 22, merchant: 'OpenAI API', agentId: 'agent-beta-002' }) }),
          fetch(apiUrl('/api/payment-intent'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 25, merchant: 'OpenAI API', agentId: 'agent-beta-002' }) }),
        ]);
        const results = await Promise.all(calls.map(c => c.json()));
        const blocked = results.filter(r => r.status === 'BLOCKED').length;
        toast.warning('Burst Complete', `${blocked} of 4 calls throttled by Velocity Frequency Cap.`);
      } else if (scenario === 'paused') {
        // Ensure agent-alpha-001 is paused, then fire
        const agents = await fetch(apiUrl('/api/agents')).then(r => r.json()).catch(() => []);
        const alpha = Array.isArray(agents) ? agents.find((a: any) => (a.id || a.agentId) === 'agent-alpha-001') : null;
        if (alpha && alpha.status !== 'PAUSED') {
          await fetch(apiUrl('/api/agents/agent-alpha-001/pause'), { method: 'PATCH' });
        }
        const res = await fetch(apiUrl('/api/payment-intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 75.00,
            merchant: 'SendGrid Email',
            agentId: 'agent-alpha-001'
          })
        });
        const data = await res.json();
        toast.error('Paused Agent Intent', `Result: ${data.status} — ${data.reason}`);
      } else if (scenario === 'runaway') {
        // High amount to breach rolling budget
        const res = await fetch(apiUrl('/api/payment-intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 3500.00,
            merchant: 'Vercel Infrastructure',
            agentId: 'agent-gamma-003'
          })
        });
        const data = await res.json();
        toast.warning('Runaway Agent Intent', `Result: ${data.status} — ${data.reason}`);
      }

      onDataChanged?.();
    } catch (err: any) {
      toast.error('Scenario Execution Failed', err?.message || 'Error sending intent');
    } finally {
      setTimeout(() => setRunningScenario(null), 500);
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
      desc: 'Agent-alpha paused payment',
      icon: PauseCircle,
      color: '#7C3AED',
      bg: '#F5F3FF',
      border: '#DDD6FE'
    },
    {
      id: 'runaway' as const,
      title: 'Runaway Spend',
      desc: '$3,500 budget breach',
      icon: Sparkles,
      color: '#B91C1C',
      bg: '#FEF2F2',
      border: '#FECACA'
    }
  ];

  return (
    <div
      className="rounded-3xl border overflow-hidden transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        borderColor: '#E2E8F0',
        boxShadow: '0 8px 30px -10px rgba(0, 0, 0, 0.06)'
      }}
    >
      {/* Top Header / Collapse Bar */}
      <div className="p-5 flex items-center justify-between flex-wrap gap-4 border-b border-gray-100 bg-white/70">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)' }}
          >
            <Sliders size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Demo Controls & Scenarios
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Interactive Suite
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Fire live payment intents to demonstrate policy rules or restore baseline data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Reset Demo Button */}
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-95 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #18181B 0%, #27272A 100%)' }}
            title="Reset database to 110 clean baseline transactions and 3 active agents"
          >
            {isResetting ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <RotateCcw size={13} />
            )}
            <span>{isResetting ? 'Resetting Demo...' : 'Reset Demo'}</span>
          </button>

          {/* Toggle Expand/Collapse */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
            title={isOpen ? 'Collapse Panel' : 'Expand Panel'}
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expandable Scenario Cards */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="p-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {SCENARIOS.map(sc => {
                const Icon = sc.icon;
                const isThisRunning = runningScenario === sc.id;

                return (
                  <button
                    key={sc.id}
                    onClick={() => runScenario(sc.id)}
                    disabled={runningScenario !== null}
                    className="p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 group cursor-pointer"
                    style={{
                      background: sc.bg,
                      borderColor: sc.border,
                      boxShadow: `0 4px 14px -6px ${sc.color}25`
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-xs"
                          style={{ background: sc.color }}
                        >
                          {isThisRunning ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <Icon size={13} />
                          )}
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-900 transition-colors">
                          RUN
                        </span>
                      </div>
                      <div className="font-bold text-xs text-gray-900 leading-snug">
                        {sc.title}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 leading-tight line-clamp-1">
                        {sc.desc}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-[10px] font-bold" style={{ color: sc.color }}>
                      <span>Fire Intent</span>
                      <Play size={10} className="fill-current" />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
