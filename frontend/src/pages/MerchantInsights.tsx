import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, TrendingDown, Package, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';
import { apiUrl } from '../lib/api';

type MerchantInsight = {
  merchant: string; volume: number; spend: number; blocks: number; flags: number; total: number; riskScore: number;
};

type PolicyConfig = {
  id: string; denylist: string[];
};

export default function MerchantInsights() {
  const [data, setData] = useState<MerchantInsight[]>([]);
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingDenylist, setAddingDenylist] = useState<string | null>(null);
  const [denyMsg, setDenyMsg] = useState<{ merchant: string; msg: string } | null>(null);
  const [sortKey, setSortKey] = useState<'spend' | 'blocks' | 'riskScore' | 'total'>('spend');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [insights, pol] = await Promise.all([
        fetch(apiUrl('/api/merchants/insights')).then(r => r.json()),
        fetch(apiUrl('/api/policies')).then(r => r.json()),
      ]);
      setData(Array.isArray(insights) ? insights : []);
      setPolicy(pol);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addToDenylist = async (merchant: string) => {
    if (!policy) return;
    setAddingDenylist(merchant);
    try {
      const newDenylist = [...policy.denylist, merchant];
      const res = await fetch(apiUrl('/api/policies'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...policy, denylist: newDenylist })
      });
      if (!res.ok) throw new Error('Failed to update policy');
      setDenyMsg({ merchant, msg: `✓ "${merchant}" added to denylist` });
      await load();
    } catch (e: any) {
      setDenyMsg({ merchant, msg: `✗ ${e.message}` });
    } finally {
      setAddingDenylist(null);
      setTimeout(() => setDenyMsg(null), 3000);
    }
  };

  const sorted = [...data].sort((a, b) => b[sortKey] - a[sortKey]);
  const maxSpend = Math.max(...data.map(d => d.spend), 1);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 24, color: '#18181B', margin: 0 }}>Merchant Insights</h1>
        <p style={{ color: '#71717A', fontSize: 14, marginTop: 6 }}>Volume, blocks, and risk analysis per merchant — last 24h</p>
      </div>

      {error && (
        <div style={{ padding: 16, background: '#FFF1F2', borderRadius: 16, border: '1px solid #FECDD3', color: '#E11D48', fontSize: 14, marginBottom: 24 }}>
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: 8 }} />{error}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Merchants', value: data.length, color: '#4F46E5', icon: <Package size={16} /> },
          { label: 'Total Volume', value: `$${data.reduce((s, d) => s + d.spend, 0).toFixed(0)}`, color: '#10B981', icon: <CheckCircle2 size={16} /> },
          { label: 'Total Blocks', value: data.reduce((s, d) => s + d.blocks, 0), color: '#E11D48', icon: <ShieldAlert size={16} /> },
          { label: 'High Risk (>60)', value: data.filter(d => d.riskScore > 60).length, color: '#D97706', icon: <TrendingDown size={16} /> },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: `1px solid ${s.color}22`, borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: s.color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              {s.icon}{s.label}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 800, color: '#18181B' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sort controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: '#71717A', fontWeight: 600 }}>Sort by:</span>
        {(['spend', 'blocks', 'riskScore', 'total'] as const).map(k => (
          <button key={k} onClick={() => setSortKey(k)}
            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid #E4E4E7', cursor: 'pointer',
              background: sortKey === k ? '#4F46E5' : 'white', color: sortKey === k ? 'white' : '#52525B' }}>
            {k === 'spend' ? 'Spend' : k === 'blocks' ? 'Blocks' : k === 'riskScore' ? 'Risk' : 'Total'}
          </button>
        ))}
      </div>

      {/* Denylist message */}
      {denyMsg && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 12, background: denyMsg.msg.startsWith('✓') ? '#ECFDF5' : '#FFF1F2', color: denyMsg.msg.startsWith('✓') ? '#059669' : '#E11D48', fontSize: 13, fontWeight: 600 }}>
          {denyMsg.msg}
        </motion.div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 56, background: '#F4F4F5', borderRadius: 12 }} />)}
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #E4E4E7', borderRadius: 20, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['Merchant', 'Spend (24h)', 'Volume', 'Blocks', 'Flags', 'Risk Score', 'Trend', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#71717A', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#A1A1AA', fontSize: 13 }}>No merchant data for the last 24h — run the demo agent</td></tr>
              )}
              {sorted.map((m, i) => {
                const isDenied = policy?.denylist?.some(d => d.toLowerCase() === m.merchant.toLowerCase());
                const riskColor = m.riskScore > 60 ? '#E11D48' : m.riskScore > 30 ? '#D97706' : '#10B981';
                const spendPct = (m.spend / maxSpend) * 100;

                return (
                  <motion.tr key={m.merchant} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    style={{ borderBottom: '1px solid #F9FAFB', transition: 'background .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, color: '#18181B' }}>
                      {m.merchant}
                      {isDenied && <span style={{ marginLeft: 8, background: '#FFF1F2', color: '#E11D48', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>DENIED</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#18181B' }}>${m.spend.toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: '#52525B' }}>{m.volume}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: m.blocks > 0 ? '#E11D48' : '#A1A1AA', fontWeight: m.blocks > 0 ? 700 : 400 }}>{m.blocks}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: m.flags > 0 ? '#D97706' : '#A1A1AA' }}>{m.flags}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 48, height: 6, background: '#F4F4F5', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${m.riskScore}%`, height: '100%', background: riskColor, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: riskColor }}>{m.riskScore}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ width: 80, height: 6, background: '#EEF2FF', borderRadius: 3, overflow: 'hidden' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${spendPct}%` }} transition={{ duration: .6, delay: i * .03 }}
                          style={{ height: '100%', background: '#6366F1', borderRadius: 3 }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {!isDenied ? (
                        <button
                          onClick={() => addToDenylist(m.merchant)}
                          disabled={addingDenylist === m.merchant}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: addingDenylist === m.merchant ? .6 : 1, transition: 'all .15s' }}>
                          <Ban size={12} /> Denylist
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#A1A1AA' }}>Already denied</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
