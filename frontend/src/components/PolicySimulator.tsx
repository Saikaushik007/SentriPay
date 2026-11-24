import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Play, CheckCircle2, XCircle, AlertTriangle, 
  ShieldCheck, Bot, Store, DollarSign, RefreshCw 
} from 'lucide-react';

interface RuleEvaluation {
  rule: string;
  passed: boolean;
  limitValue: string;
  actualValue: string;
  message: string;
}

interface RiskBreakdownItem {
  factor: string;
  points: number;
  description: string;
}

interface SimulationResult {
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  riskScore: number;
  settlementId?: string;
  ruleResults: {
    rules: RuleEvaluation[];
    riskBreakdown: RiskBreakdownItem[];
  };
}

export default function PolicySimulator() {
  const [agentId, setAgentId] = useState('agent-alpha-001');
  const [merchant, setMerchant] = useState('AWS Compute');
  const [amount, setAmount] = useState('150.00');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableAgents, setAvailableAgents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableAgents(data.map((a: any) => ({ id: a.id || a.agentId, name: a.name })));
        } else {
          setAvailableAgents([
            { id: 'agent-alpha-001', name: 'Alpha Infrastructure' },
            { id: 'agent-beta-002', name: 'Beta Compute Optimizer' },
            { id: 'agent-gamma-003', name: 'Gamma Data Pipeline' }
          ]);
        }
      })
      .catch(() => {
        setAvailableAgents([
          { id: 'agent-alpha-001', name: 'Alpha Infrastructure' },
          { id: 'agent-beta-002', name: 'Beta Compute Optimizer' },
          { id: 'agent-gamma-003', name: 'Gamma Data Pipeline' }
        ]);
      });
  }, []);

  const runSimulation = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please provide a valid payment amount greater than $0');
      return;
    }
    if (!merchant.trim()) {
      setError('Please specify a merchant');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          merchant: merchant.trim(),
          amount: numAmount
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Simulation failed with HTTP ${res.status}`);
      }

      const data: SimulationResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during simulation');
    } finally {
      setLoading(false);
    }
  };

  const PRESETS = [
    { label: 'Normal AWS Infra', agent: 'agent-alpha-001', merchant: 'AWS Compute', amount: '85.00' },
    { label: 'Denylisted ShadyAI', agent: 'agent-beta-002', merchant: 'ShadyAI Services', amount: '120.00' },
    { label: 'Over Tx Limit ($2,500)', agent: 'agent-alpha-001', merchant: 'Vercel Infrastructure', amount: '2500.00' },
    { label: 'High Risk Unknown Vendor', agent: 'agent-gamma-003', merchant: 'CryptoGpuRental.xyz', amount: '850.00' },
  ];

  return (
    <div 
      className="rounded-3xl overflow-hidden mb-12"
      style={{
        background: 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 100%)',
        border: '1px solid #FDE68A',
        boxShadow: '0 12px 32px -18px rgba(245, 158, 11, 0.25)'
      }}
    >
      {/* Header Strip */}
      <div 
        className="p-6 border-b flex items-center justify-between flex-wrap gap-4"
        style={{ borderColor: '#FEF3C7', background: '#FFFDF7' }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: '#FEF3C7', color: '#D97706' }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Policy Simulator (Dry Run)
              </h2>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Non-settling
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Execute real-time policy rules without saving transactions or debiting x402 liquidity.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400">Presets:</span>
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setAgentId(p.agent);
                setMerchant(p.merchant);
                setAmount(p.amount);
              }}
              className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 text-amber-900 font-medium transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-5 rounded-2xl border border-amber-100 shadow-sm">
          {/* Agent Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Bot size={14} className="text-amber-600" />
              Agent
            </label>
            <select
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono border border-gray-200 bg-gray-50 outline-none focus:border-amber-500 focus:bg-white transition-colors"
            >
              {availableAgents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.id} ({a.name})
                </option>
              ))}
            </select>
          </div>

          {/* Merchant Input */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Store size={14} className="text-amber-600" />
              Merchant
            </label>
            <input
              type="text"
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              placeholder="e.g. AWS Compute"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-gray-200 bg-gray-50 outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <DollarSign size={14} className="text-amber-600" />
              Amount ($ USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="150.00"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono border border-gray-200 bg-gray-50 outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Simulate Button */}
          <div className="flex items-end">
            <button
              onClick={runSimulation}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)'
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Testing Policy...
                </>
              ) : (
                <>
                  <Play size={16} fill="white" />
                  Test Policy
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <XCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Simulation Output */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Decision Outcome Banner */}
              <div
                className="p-5 rounded-2xl border"
                style={{
                  background: result.status === 'APPROVED' ? '#F0FDF4' : result.status === 'BLOCKED' ? '#FFF1F2' : '#FFFBEB',
                  borderColor: result.status === 'APPROVED' ? '#86EFAC' : result.status === 'BLOCKED' ? '#FECDD3' : '#FDE68A'
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wider uppercase shadow-sm flex items-center gap-1.5"
                      style={{
                        background: result.status === 'APPROVED' ? '#059669' : result.status === 'BLOCKED' ? '#E11D48' : '#D97706',
                        color: '#FFFFFF'
                      }}
                    >
                      <span className="opacity-75 text-[10px]">SIMULATED</span>
                      <span>{result.status}</span>
                    </span>
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        {result.status === 'APPROVED' ? 'Simulation: Would Be Approved (Nothing Executed)' : result.status === 'BLOCKED' ? 'Simulation: Would Be Blocked' : 'Simulation: Would Be Flagged'}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{result.reason}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-gray-400 text-[10px] uppercase">Composite Risk</div>
                      <div className="font-bold text-base" style={{
                        color: result.riskScore >= 75 ? '#E11D48' : result.riskScore >= 40 ? '#D97706' : '#059669'
                      }}>
                        {result.riskScore} / 100
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-amber-700 text-[10px] uppercase font-bold">Execution Status</div>
                      <div className="font-semibold text-gray-500 text-xs">Simulated (Dry Run)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evaluated Rules Grid */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-indigo-600" />
                    Rule-by-Rule Evaluation
                  </h3>
                  <span className="text-xs font-mono font-semibold text-gray-500">
                    {result.ruleResults.rules.filter(r => r.passed).length} of {result.ruleResults.rules.length} rules passed
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.ruleResults.rules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border flex flex-col justify-between"
                      style={{
                        background: rule.passed ? '#FAFAFA' : '#FFF1F2',
                        borderColor: rule.passed ? '#E5E7EB' : '#FECDD3'
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {rule.passed ? (
                              <CheckCircle2 size={15} className="text-emerald-600" />
                            ) : (
                              <XCircle size={15} className="text-rose-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-900">{rule.rule}</div>
                            <div className="text-[11px] text-gray-600 mt-0.5">{rule.message}</div>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                          rule.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {rule.passed ? 'Pass' : 'Fail'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-gray-400">Limit: {rule.limitValue}</span>
                        <span className={rule.passed ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-bold'}>
                          Actual: {rule.actualValue}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Breakdown if present */}
              {result.ruleResults.riskBreakdown && result.ruleResults.riskBreakdown.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-200">
                  <div className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Risk Score Factor Contribution
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {result.ruleResults.riskBreakdown.map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-gray-800">{item.factor}</div>
                          <div className="text-[10px] text-gray-400">{item.description}</div>
                        </div>
                        <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                          item.points > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          +{item.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}