import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, ShieldCheck, DollarSign, Shield, ShieldX, Zap, Pause, Play, Edit3, Check, X, Key, Copy, Eye, EyeOff, RotateCcw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../lib/api';
import { useToast } from '../context/ToastContext';

type AgentStat = {
  id?: string;
  agentId: string;
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'PAUSED';
  dailyBudget?: number;
  apiKey?: string;
  spentToday?: number;
  total: number;
  approved: number;
  blocked: number;
  flagged: number;
  totalSpend: number;
  approvalRate: string;
  lastSeen: string;
};

function Skeleton({ className = '' }) {
  return <div className={`skeleton-shimmer rounded-3xl ${className}`} />;
}

// Pure SVG half-donut risk gauge — no recharts, no crash
function RiskGauge({ score }: { score: number }) {
  const capped = Math.min(100, Math.max(0, score));
  const color = capped < 40 ? '#10B981' : capped < 70 ? '#F59E0B' : '#F43F5E';
  const label = capped < 40 ? 'Low' : capped < 70 ? 'Med' : 'High';
  const R = 28, stroke = 6, w = 70, h = 40;
  const circumference = Math.PI * R;
  const offset = circumference - (capped / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
        {/* Track */}
        <path
          d={`M ${w / 2 - R} ${h} A ${R} ${R} 0 0 1 ${w / 2 + R} ${h}`}
          fill="none" stroke="#E4E4E7" strokeWidth={stroke} strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M ${w / 2 - R} ${h} A ${R} ${R} 0 0 1 ${w / 2 + R} ${h}`}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.4s ease' }}
        />
        <text x={w / 2} y={h - 4} textAnchor="middle" fontSize="13" fontWeight="700"
          fontFamily="JetBrains Mono, monospace" fill={color}>
          {capped}
        </text>
      </svg>
      <span className="text-[9px] font-mono font-bold uppercase tracking-wider" style={{ color }}>
        {label} RISK
      </span>
    </div>
  );
}

// Pure SVG mini donut for approval rate
function ApprovalDonut({ rate, color }: { rate: number; color: string }) {
  const R = 20, stroke = 5;
  const circ = 2 * Math.PI * R;
  const fill = (rate / 100) * circ;
  return (
    <svg width={54} height={54} viewBox="0 0 54 54">
      <defs>
        <linearGradient id={`donutGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color + '88'} />
        </linearGradient>
      </defs>
      <circle cx={27} cy={27} r={R} fill="none" stroke="#E4E4E7" strokeWidth={stroke} />
      <circle cx={27} cy={27} r={R} fill="none" stroke={`url(#donutGrad-${color.replace('#', '')})`} strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x={27} y={31} textAnchor="middle" fontSize="10" fontWeight="700"
        fontFamily="JetBrains Mono, monospace" fill={color}>
        {Math.round(rate)}%
      </text>
    </svg>
  );
}

const AGENT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#38BDF8'];

export default function Agents() {
  const [agents, setAgents] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editBudgetValue, setEditBudgetValue] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const toast = useToast();

  const handleCopyApiKey = (agentId: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(agentId);
    toast.info('API Key Copied', `${agentId} key copied to clipboard.`);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const fetchAgents = () => {
    setLoading(true);
    setError(null);
    fetch(apiUrl('/api/agents'))
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => { setAgents(data); setError(null); })
      .catch(e => { console.error(e); setError(e.message); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleTogglePause = async (agentId: string) => {
    try {
      setActionLoadingId(agentId);
      const res = await fetch(apiUrl(`/api/agents/${agentId}/pause`), { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to toggle pause');
      const updated = await res.json();
      setAgents(prev => prev.map(a => a.agentId === agentId ? { ...a, status: updated.status } : a));
      if (updated.status === 'PAUSED') {
        toast.warning('Agent Paused', `${agentId} has been paused. Any incoming payments will be blocked.`);
      } else {
        toast.success('Agent Resumed', `${agentId} is now active and authorized to spend within policy.`);
      }
    } catch (e: any) {
      toast.error('Pause Toggle Failed', e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveBudget = async (agentId: string) => {
    try {
      const budget = parseFloat(editBudgetValue);
      if (isNaN(budget) || budget < 0) return toast.error('Invalid Budget', 'Enter a positive budget amount');
      setActionLoadingId(agentId);
      const res = await fetch(apiUrl(`/api/agents/${agentId}/budget`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyBudget: budget })
      });
      if (!res.ok) throw new Error('Failed to update daily budget');
      const updated = await res.json();
      setAgents(prev => prev.map(a => a.agentId === agentId ? { ...a, dailyBudget: updated.dailyBudget } : a));
      setEditingAgentId(null);
      toast.success('Budget Updated', `${agentId} daily budget set to $${budget.toLocaleString()}.`);
    } catch (e: any) {
      toast.error('Budget Update Failed', e.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const networkApproval = agents.length > 0
    ? (agents.reduce((s, a) => s + parseFloat(a.approvalRate), 0) / agents.length).toFixed(1)
    : '—';
  const totalSpend = agents.reduce((s, a) => s + a.totalSpend, 0);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto w-full">

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div
        className="rounded-3xl p-8 mb-8 relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 60%, #6D28D9 100%)' }}
      >
        {/* Glow blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="absolute bottom-0 right-40 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)', transform: 'translateY(30%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/60 text-xs font-mono uppercase tracking-widest mb-3">
            <Bot size={13} /> Autonomous Agent Network
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Agent Registry</h1>
          <p className="text-sm mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', color: 'rgba(255,255,255,0.82)' }}>A living portrait of every agent under protection.</p>
          <p className="text-white/70 text-sm max-w-lg mb-7 leading-relaxed">
            Global view of all autonomous agents routed through SentriPay. Monitor real-time spending behavior, approval rates, and policy enforcement.
          </p>

          {/* Summary stats */}
          {!loading && agents.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {[
                { icon: <Bot size={20} />, value: agents.length, label: 'Active Agents' },
                { icon: <ShieldCheck size={20} />, value: `${networkApproval}%`, label: 'Network Approval' },
                { icon: <DollarSign size={20} />, value: `$${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, label: 'Total Cleared' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-white">{s.value}</div>
                    <div className="text-white/60 text-[11px] font-semibold uppercase tracking-wide">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {loading && (
            <div className="flex gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[68px] w-48 rounded-2xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Agent Cards Grid ─────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-20 text-red-500 gap-3">
          <ShieldX size={40} />
          <p className="font-semibold">Failed to load agents: {error}</p>
          <p className="text-sm text-gray-400">Ensure the backend is online and database is reachable.</p>
          <button
            onClick={fetchAgents}
            className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <RotateCcw size={13} /> Retry Connection
          </button>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center py-24 gap-5" style={{ background: 'linear-gradient(135deg,#F0F9FF,#F0FDF4)', borderRadius: '1.5rem', border: '1px solid #BAE6FD', boxShadow: '0 16px 36px -24px rgba(14,165,233,.45)' }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
            <Bot size={40} className="text-indigo-400" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>No agents detected yet</h2>
            <p className="text-sm text-gray-400 max-w-xs">Run the demo agent to populate this registry automatically.</p>
            <div className="mt-5 inline-block font-mono text-sm px-5 py-2.5 rounded-xl font-bold"
              style={{ background: '#F4F4F5', color: '#18181B' }}>
              node demo-agent.js
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {agents.map((agent, i) => {
            const color = AGENT_COLORS[i % AGENT_COLORS.length];
            const rate = parseFloat(agent.approvalRate);
            const estRisk = Math.min(95, Math.round(
              ((agent.blocked + agent.flagged * 0.7) / Math.max(agent.total, 1)) * 100 + 10
            ));
            const approvedPct = agent.total ? (agent.approved / agent.total) * 100 : 0;
            const flaggedPct  = agent.total ? (agent.flagged  / agent.total) * 100 : 0;
            const blockedPct  = agent.total ? (agent.blocked  / agent.total) * 100 : 0;

            return (
              <motion.div key={agent.agentId}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                style={{
                  background: `${color}08`, // soft background wash
                  borderRadius: '1.5rem',
                  border: `1px solid ${color}20`,
                  boxShadow: `0 8px 32px -8px ${color}30`,
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                whileHover={{ y: -4, boxShadow: `0 12px 40px -8px ${color}50` }}
              >
                {/* Colored top bar */}
                <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}99)` }} />

                <div className="p-6">
                  {/* Agent header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}>
                        <Bot size={18} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono font-bold text-lg" style={{ color: '#18181B' }}>{agent.agentId}</div>
                        <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" 
                          style={{
                            background: agent.status === 'PAUSED' ? '#FEE2E2' : '#D1FAE5',
                            color: agent.status === 'PAUSED' ? '#DC2626' : '#059669',
                            border: `1px solid ${agent.status === 'PAUSED' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`
                          }}>
                          {agent.status === 'PAUSED' ? 'Paused' : 'Active'}
                        </div>
                      </div>
                    </div>
                    <RiskGauge score={estRisk} />
                  </div>

                  {/* API Key Box (Masked with copy & reveal toggle) */}
                  <div className="flex items-center justify-between gap-2 mb-4 px-3 py-2 rounded-xl bg-white/80 border border-gray-200/80 shadow-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Key size={13} className="text-gray-400 shrink-0" />
                      <span className="text-[11px] font-mono text-gray-500 font-semibold">API Key:</span>
                      <span className="text-xs font-mono font-bold text-gray-800 truncate">
                        {agent.apiKey ? (
                          revealedKeyId === agent.agentId ? agent.apiKey : `${agent.apiKey.slice(0, 10)}••••••••${agent.apiKey.slice(-4)}`
                        ) : 'sk_live_••••••••••••'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {agent.apiKey && (
                        <button
                          onClick={() => setRevealedKeyId(revealedKeyId === agent.agentId ? null : agent.agentId)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                          title={revealedKeyId === agent.agentId ? 'Hide API Key' : 'Reveal API Key'}
                        >
                          {revealedKeyId === agent.agentId ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      <button
                        onClick={() => handleCopyApiKey(agent.agentId, agent.apiKey || `sk_live_${agent.agentId.replace(/-/g, '_')}`)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                        title="Copy API Key"
                      >
                        {copiedKeyId === agent.agentId ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Controls: Pause/Resume Toggle & Daily Budget */}
                  <div className="flex items-center justify-between gap-2 mb-4 p-2.5 rounded-xl bg-white/70 border border-gray-200/60 shadow-xs">
                    {/* Pause / Resume Button */}
                    <button
                      onClick={() => handleTogglePause(agent.agentId)}
                      disabled={actionLoadingId === agent.agentId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: agent.status === 'PAUSED' ? '#10B981' : '#FEE2E2',
                        color: agent.status === 'PAUSED' ? '#FFFFFF' : '#DC2626',
                        border: `1px solid ${agent.status === 'PAUSED' ? '#059669' : '#FCA5A5'}`,
                        cursor: actionLoadingId === agent.agentId ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {agent.status === 'PAUSED' ? <Play size={12} /> : <Pause size={12} />}
                      <span>{agent.status === 'PAUSED' ? 'Resume Agent' : 'Pause Agent'}</span>
                    </button>

                    {/* Daily Budget (Editable) */}
                    <div className="flex items-center gap-2 text-xs">
                      {editingAgentId !== agent.agentId ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 font-medium">Daily Limit:</span>
                          <span className="font-mono font-bold text-gray-900">${(agent.dailyBudget || 500).toLocaleString()}</span>
                          <button
                            onClick={() => {
                              setEditingAgentId(agent.agentId);
                              setEditBudgetValue(String(agent.dailyBudget || 500));
                            }}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500"
                            title="Edit Daily Budget"
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-gray-500">$</span>
                          <input
                            type="number"
                            value={editBudgetValue}
                            onChange={e => setEditBudgetValue(e.target.value)}
                            className="w-16 px-1.5 py-0.5 border border-indigo-400 rounded text-xs font-mono font-bold outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveBudget(agent.agentId)}
                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                            title="Save"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setEditingAgentId(null)}
                            className="p-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {/* Spend */}
                    <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg,#FFFFFF,#F0FDF4)', border: `1px solid ${color}25`, boxShadow: `0 8px 18px -12px ${color}55` }}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#71717A' }}>Cleared Spend</div>
                      <div className="flex items-center gap-1 font-mono font-bold text-lg" style={{ color: '#18181B' }}>
                        <span style={{ color: '#71717A', fontSize: 14 }}>$</span>
                        {agent.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>

                    {/* Approval donut */}
                    <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#FFFFFF,#EEF2FF)', border: `1px solid ${color}25`, boxShadow: `0 8px 18px -12px ${color}55` }}>
                      <ApprovalDonut rate={rate} color={color} />
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#71717A' }}>Approval</div>
                        <div className="font-mono font-bold text-base" style={{ color }}>{agent.approvalRate}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Stacked outcome bar */}
                  <div>
                    <div className="flex justify-between text-[11px] font-medium mb-1.5" style={{ color: '#71717A' }}>
                      <span>{agent.total} transactions</span>
                      <span>Enforcement breakdown</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex gap-px" style={{ background: '#E4E4E7' }}>
                      {approvedPct > 0 && (
                        <div className="h-full rounded-full" style={{ width: `${approvedPct}%`, background: 'linear-gradient(90deg, #10B981, #34D399)' }} />
                      )}
                      {flaggedPct > 0 && (
                        <div className="h-full" style={{ width: `${flaggedPct}%`, background: '#F59E0B' }} />
                      )}
                      {blockedPct > 0 && (
                        <div className="h-full rounded-full" style={{ width: `${blockedPct}%`, background: 'linear-gradient(90deg, #F43F5E, #F472B6)' }} />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2.5 text-[11px] font-mono font-bold">
                      <span className="flex items-center gap-1.5" style={{ color: '#10B981' }}>
                        <Shield size={11} /> {agent.approved} Approved
                      </span>
                      <span className="flex items-center gap-1.5" style={{ color: '#F59E0B' }}>
                        <Zap size={11} /> {agent.flagged} Flagged
                      </span>
                      <span className="flex items-center gap-1.5" style={{ color: '#F43F5E' }}>
                        <ShieldX size={11} /> {agent.blocked} Blocked
                      </span>
                    </div>
                  </div>
                  {/* View Detail link */}
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(228,228,231,0.6)' }}>
                    <Link
                      to={`/agents/${agent.agentId}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: color, textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: `${color}10`, border: `1px solid ${color}22`, transition: 'all .15s' }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = `${color}20`; }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = `${color}10`; }}
                    >
                      <ArrowRight size={12} /> View Full Detail
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
