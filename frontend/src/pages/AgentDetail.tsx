import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, ShieldAlert, Pause, Play, DollarSign, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiUrl } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

type AgentTx = {
  id: string; amount: number; merchant: string; status: string; reason: string; riskScore?: number; createdAt: string;
};
type AgentDetailData = {
  id: string; name: string; description: string; status: string; dailyBudget: number; apiKey: string;
  stats24h: { spend24h: number; approved: number; blocked: number; flagged: number; total: number; approvalRate: number };
  ruleHits: { reason: string; count: number }[];
  transactions: AgentTx[];
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{ background: status === 'ACTIVE' ? '#ECFDF5' : '#FFF1F2', color: status === 'ACTIVE' ? '#059669' : '#E11D48', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
      {status === 'ACTIVE' ? '● Active' : '◉ Paused'}
    </span>
  );
}

function TxStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    APPROVED: { bg: '#ECFDF5', color: '#059669' },
    BLOCKED: { bg: '#FFF1F2', color: '#E11D48' },
    FLAGGED: { bg: '#FFFBEB', color: '#D97706' },
  };
  const c = cfg[status] || { bg: '#F4F4F5', color: '#71717A' };
  return <span style={{ ...c, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{status}</span>;
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<AgentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetMsg, setBudgetMsg] = useState('');
  const [pausing, setPausing] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(apiUrl(`/api/agents/${id}`));
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
      setBudgetInput(String(d.dailyBudget));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const togglePause = async () => {
    if (!data) return;
    setPausing(true);
    try {
      await fetch(apiUrl(`/api/agents/${data.id}/pause`), { method: 'PATCH' });
      await load();
    } catch (e) { console.error(e); }
    finally { setPausing(false); }
  };

  const saveBudget = async () => {
    const budget = parseFloat(budgetInput);
    if (isNaN(budget) || budget < 0) { setBudgetMsg('Enter a valid amount'); return; }
    try {
      await fetch(apiUrl(`/api/agents/${data!.id}/budget`), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyBudget: budget })
      });
      setBudgetMsg('✓ Budget updated');
      await load();
    } catch { setBudgetMsg('Update failed'); }
    setTimeout(() => setBudgetMsg(''), 2500);
  };

  if (loading) return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ height: 200, background: 'white', borderRadius: 24, border: '1px solid #E4E4E7' }} />
    </div>
  );

  if (error || !data) return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
      <AlertTriangle size={40} style={{ color: '#E11D48', marginBottom: 12 }} />
      <p style={{ color: '#E11D48', fontWeight: 600 }}>{error || 'Agent not found'}</p>
      <button onClick={() => navigate('/agents')} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 12, background: '#4F46E5', color: 'white', border: 'none', cursor: 'pointer' }}>← Back to Agents</button>
    </div>
  );

  const spendPct = data.dailyBudget > 0 ? Math.min((data.stats24h.spend24h / data.dailyBudget) * 100, 100) : 0;
  const spendColor = spendPct > 85 ? '#E11D48' : spendPct > 65 ? '#D97706' : '#10B981';

  // Build hourly spend chart from transactions
  const hourMap: Record<number, number> = {};
  for (const tx of data.transactions) {
    if (tx.status === 'APPROVED') {
      const h = new Date(tx.createdAt).getHours();
      hourMap[h] = (hourMap[h] || 0) + tx.amount;
    }
  }
  const spendChart = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2,'0')}h`, spend: Math.round((hourMap[i] || 0) * 100) / 100 }));

  return (
    <div style={{ padding: '16px', maxWidth: 1200, margin: '0 auto', width: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      {/* Back */}
      <button onClick={() => navigate('/agents')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', fontSize: 14, fontWeight: 600 }}>
        <ArrowLeft size={16} /> Back to Agents
      </button>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'linear-gradient(135deg,#F5F3FF,#EFF6FF)', border: '1px solid #DDD6FE', borderRadius: 24, padding: 28, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#7C3AED', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={22} /></div>
            <div>
              <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 22, margin: 0 }}>{data.name}</h1>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#71717A', marginTop: 2 }}>{data.id}</div>
            </div>
            <StatusBadge status={data.status} />
          </div>
          <p style={{ color: '#52525B', fontSize: 14, margin: 0 }}>{data.description}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Budget editor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid #DDD6FE', borderRadius: 10, overflow: 'hidden', background: 'white' }}>
              <span style={{ padding: '0 8px', color: '#7C3AED', fontSize: 14, fontWeight: 700 }}>$</span>
              <input value={budgetInput} onChange={e => setBudgetInput(e.target.value)} type="number" min={0}
                style={{ border: 'none', width: 80, padding: '8px 4px', fontSize: 13, fontFamily: 'monospace', outline: 'none' }} />
              <button onClick={saveBudget} style={{ padding: '8px 12px', background: '#7C3AED', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Set Budget</button>
            </div>
            {budgetMsg && <span style={{ fontSize: 12, color: budgetMsg.startsWith('✓') ? '#059669' : '#E11D48', fontWeight: 600 }}>{budgetMsg}</span>}
          </div>
          <button onClick={togglePause} disabled={pausing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: data.status === 'ACTIVE' ? '#FFF1F2' : '#ECFDF5', color: data.status === 'ACTIVE' ? '#E11D48' : '#059669' }}>
            {data.status === 'ACTIVE' ? <><Pause size={15} /> Pause Agent</> : <><Play size={15} /> Resume Agent</>}
          </button>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: '24h Spend', value: `$${data.stats24h.spend24h.toFixed(2)}`, color: spendColor, icon: <DollarSign size={16} /> },
          { label: 'Approved', value: data.stats24h.approved, color: '#059669', icon: <CheckCircle2 size={16} /> },
          { label: 'Blocked', value: data.stats24h.blocked, color: '#E11D48', icon: <ShieldAlert size={16} /> },
          { label: 'Flagged', value: data.stats24h.flagged, color: '#D97706', icon: <AlertTriangle size={16} /> },
          { label: 'Approval Rate', value: `${data.stats24h.approvalRate}%`, color: '#4F46E5', icon: <Activity size={16} /> },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'white', border: `1px solid ${s.color}22`, borderRadius: 16, padding: '16px 18px', boxShadow: `0 4px 16px -6px ${s.color}22` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: s.color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              {s.icon}{s.label}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 800, color: '#18181B' }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Budget bar */}
      <div style={{ background: 'white', border: '1px solid #E4E4E7', borderRadius: 20, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          <span style={{ color: '#52525B' }}>Daily Budget Usage</span>
          <span style={{ fontFamily: 'monospace', color: spendColor }}>{spendPct.toFixed(1)}% of ${data.dailyBudget.toLocaleString()}</span>
        </div>
        <div style={{ height: 12, background: '#F4F4F5', borderRadius: 6, overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${spendPct}%` }} transition={{ duration: 1 }}
            style={{ height: '100%', background: `linear-gradient(90deg,${spendColor}99,${spendColor})`, borderRadius: 6 }} />
        </div>
      </div>

      {/* Grid: Spend chart + Rule hits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* 24h spend chart */}
        <div style={{ background: 'white', border: '1px solid #E4E4E7', borderRadius: 20, padding: 20 }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>24h Spend by Hour</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={spendChart} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F4F4F5" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#A1A1AA' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#A1A1AA' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, fontFamily: 'monospace' }} formatter={(v: any) => [`$${v}`, 'Spend']} />
              <Bar dataKey="spend" fill="#7C3AED" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Rule hits */}
        <div style={{ background: 'white', border: '1px solid #E4E4E7', borderRadius: 20, padding: 20 }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Top Block Reasons (24h)</h3>
          {data.ruleHits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#A1A1AA', fontSize: 13 }}>No blocks or flags — clean record ✓</div>
          ) : data.ruleHits.slice(0, 6).map((h, i) => {
            const max = data.ruleHits[0].count;
            return (
              <div key={h.reason} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#52525B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{h.reason.slice(0, 50)}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#E11D48' }}>{h.count}</span>
                </div>
                <div style={{ height: 8, background: '#FFF1F2', borderRadius: 4, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(h.count / max) * 100}%` }} transition={{ duration: .6, delay: i * .07 }}
                    style={{ height: '100%', background: 'linear-gradient(90deg,#F43F5E,#F472B6)', borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction history */}
      <div style={{ background: 'white', border: '1px solid #E4E4E7', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F4F4F5', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16 }}>
          Transaction History (last 100)
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['Time', 'Merchant', 'Amount', 'Status', 'Risk', 'Reason'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#71717A' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(0, 50).map(tx => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #F9FAFB', transition: 'background .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: '#71717A', whiteSpace: 'nowrap' }}>{new Date(tx.createdAt).toLocaleTimeString()}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#18181B', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.merchant}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#18181B' }}>${tx.amount.toFixed(2)}</td>
                  <td style={{ padding: '10px 14px' }}><TxStatusBadge status={tx.status} /></td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: (tx.riskScore ?? 0) > 70 ? '#E11D48' : '#71717A' }}>{tx.riskScore ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#71717A', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
