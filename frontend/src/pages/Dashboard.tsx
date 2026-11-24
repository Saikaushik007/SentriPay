import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Activity, DollarSign, Clock, Cpu, Banknote, Search, X, RotateCcw, CheckCircle2, Download, TrendingUp, FileCheck2, CalendarRange, AlertTriangle } from 'lucide-react';
import TransactionDrawer from '../components/TransactionDrawer';
import DemoControlsPanel from '../components/DemoControlsPanel';
import ReviewQueue from '../components/ReviewQueue';
import { apiUrl, socket } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }}
          className="fixed top-6 right-6 z-50 flex items-center gap-3 text-white px-5 py-3.5 rounded-2xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg,#10B981,#34D399)', boxShadow: '0 4px 24px -4px rgba(16,185,129,0.4)' }}>
          <CheckCircle2 size={18} /> {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type Transaction = {
  id: string; amount: number; merchant: string; agentId: string;
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED'; reason: string;
  riskScore?: number; settlementId?: string;
  ruleResults?: any;
  createdAt?: string; timestamp?: string;
};
type ChartPoint = { time: string; approved: number; blocked: number; flagged: number };
type MerchantStat = { merchant: string; total: number; blocked: number; approved: number; totalSpend: number };
type BudgetInfo = { spent: number; limit: number };
type InsightInfo = { thisWeekSpend: number; lastWeekSpend: number; spendChangePct: number | null; busiestHour: number | null; busiestHourTransactions: number; sampleSize: number };
type Anomaly = { id: string; severity: 'warning' | 'critical'; message: string };

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [merchants, setMerchants] = useState<MerchantStat[]>([]);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [insights, setInsights] = useState<InsightInfo | null>(null);

  // Live tracking — IDs that arrived via websocket (not pre-seeded)
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterMerchant, setFilterMerchant] = useState('');
  const [filterMin, setFilterMin] = useState('');
  const [filterMax, setFilterMax] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAll = async () => {
    setFetchError(null);
    try {
      await Promise.all([
        fetch(apiUrl('/api/transactions')).then(r => r.json()).then(setTransactions),
        fetch(apiUrl('/api/transactions/chart')).then(r => r.json()).then(setChartData),
        fetch(apiUrl('/api/transactions/merchants')).then(r => r.json()).then(setMerchants),
        fetch(apiUrl('/api/transactions/budget')).then(r => r.json()).then(setBudget),
        fetch(apiUrl('/api/insights')).then(r => r.json()).then(setInsights)
      ]);
    } catch (err: any) {
      console.error(err);
      setFetchError(err?.message || 'Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };
  const refreshAnomalies = () => fetch(apiUrl('/api/anomalies')).then(r => r.json()).then(data => setAnomalies(data.alerts || [])).catch(console.error);

  useEffect(() => {
    fetchAll();
    refreshAnomalies();
    const onNewTx = (tx: Transaction) => {
      setTransactions(prev => [tx, ...prev].slice(0, 150));
      setLiveIds(prev => new Set([...prev, tx.id]));
      fetch(apiUrl('/api/transactions/chart')).then(r => r.json()).then(setChartData).catch(console.error);
      fetch(apiUrl('/api/transactions/merchants')).then(r => r.json()).then(setMerchants).catch(console.error);
      fetch(apiUrl('/api/transactions/budget')).then(r => r.json()).then(setBudget).catch(console.error);
      fetch(apiUrl('/api/insights')).then(r => r.json()).then(setInsights).catch(console.error);
      refreshAnomalies();
    };
    const onDemoReset = () => { fetchAll(); setLiveIds(new Set()); setToast(true); setTimeout(() => setToast(false), 3000); };
    const onTxUpdated = (updated: Transaction) => {
      setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
      fetch(apiUrl('/api/transactions/chart')).then(r => r.json()).then(setChartData).catch(console.error);
      fetch(apiUrl('/api/transactions/merchants')).then(r => r.json()).then(setMerchants).catch(console.error);
      fetch(apiUrl('/api/transactions/budget')).then(r => r.json()).then(setBudget).catch(console.error);
    };
    socket.on('new_transaction', onNewTx);
    socket.on('demo_reset', onDemoReset);
    socket.on('transaction_updated', onTxUpdated);
    const anomalyInterval = window.setInterval(refreshAnomalies, 45000);
    return () => {
      socket.off('new_transaction', onNewTx);
      socket.off('demo_reset', onDemoReset);
      socket.off('transaction_updated', onTxUpdated);
      window.clearInterval(anomalyInterval);
    };
  }, []);

  const totalTxs = transactions.length;
  const blockedTxs = transactions.filter(t => t.status === 'BLOCKED').length;
  const approvedTxs = transactions.filter(t => t.status === 'APPROVED').length;
  const approvalRate = totalTxs > 0 ? ((approvedTxs / totalTxs) * 100).toFixed(1) : '0.0';
  const dailySpend = budget?.spent || 0;

  const filteredTxs = useMemo(() => {
    return transactions.filter(tx => {
      if (filterStatus !== 'ALL' && tx.status !== filterStatus) return false;
      if (filterMerchant && !tx.merchant.toLowerCase().includes(filterMerchant.toLowerCase())) return false;
      if (filterMin && tx.amount < parseFloat(filterMin)) return false;
      if (filterMax && tx.amount > parseFloat(filterMax)) return false;
      return true;
    });
  }, [transactions, filterStatus, filterMerchant, filterMin, filterMax]);

  const budgetPct = budget ? Math.min((budget.spent / budget.limit) * 100, 100) : 0;

  const exportTransactions = async () => {
    try {
      const rows: Transaction[] = await fetch(apiUrl('/api/transactions/export')).then(r => r.json());
      const header = ['id', 'createdAt', 'agentId', 'merchant', 'amount', 'status', 'riskScore', 'settlementId', 'reason'];
      const csv = [header, ...rows.map(row => header.map(key => JSON.stringify((row as any)[key] ?? '')))].map(row => row.join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `sentripay-transactions-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto w-full">
      <ActivityTicker transactions={transactions} />
      <AnomalyBanner alerts={anomalies.filter(alert => !dismissedAnomalies.has(alert.id))} onDismiss={id => setDismissedAnomalies(previous => new Set([...previous, id]))} />
      <Toast msg="✓ Demo data reset — 110 baseline records loaded" visible={toast} />

      {/* Page Top Bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Overview</h1>
          <p className="text-sm mt-1" style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', color: '#7C3AED' }}>Every autonomous payment, kept intentionally in bounds.</p>
          <p className="text-sm mt-0.5 text-gray-500">Real-time policy enforcement metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportTransactions}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all hover:bg-violet-50 cursor-pointer"
            style={{ background: 'white', border: '1px solid #D8D4FE', color: '#4F46E5', boxShadow: '0 4px 14px -5px rgba(79,70,229,0.35)' }}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Error state with Retry */}
      {fetchError && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle size={18} /> {fetchError}
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
          >
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Stat Row */}
      {isLoading && transactions.length === 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-white/70 border border-gray-200/60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          <StatCard value={totalTxs} label="Total Processed" color="#4F46E5" />
          <StatCard value={blockedTxs} label="Blocked" color="#F43F5E" />
          <StatCard value={`${approvalRate}%`} label="Approval Rate" color="#10B981" />
          <StatCard value={`$${dailySpend.toLocaleString(undefined,{maximumFractionDigits:0})}`} label="24h Spend" color="#7C3AED" mono />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left: Charts + Feed */}
        <div className="xl:col-span-2 flex flex-col gap-8">

          {/* Architecture Visual */}
          <div className="rounded-2xl p-8 relative overflow-hidden flex flex-col gap-6 text-white"
            style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)', boxShadow: '0 8px 40px -8px rgba(79,70,229,0.45)' }}>
            <DepthOrb />
            <div>
              <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>x402 Protocol</div>
              <h2 className="font-bold text-2xl" style={{ fontFamily: 'Outfit, sans-serif' }}>Sentinel Architecture</h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>Real-time interception and policy enforcement gateway</p>
            </div>
            <div className="flex items-center justify-center gap-0 w-full max-w-md mx-auto relative z-10">
              <ArchNode icon={<Cpu size={20} />} label="AI Agent" dark />
              <AnimatedConnector />
              <ArchNode icon={<ShieldCheck size={22} />} label="Policy Engine" highlight />
              <AnimatedConnector />
              <ArchNode icon={<Banknote size={20} />} label="Settlement" dark />
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <div className="grid grid-cols-1 gap-5">
            <InsightPanel insights={insights} />
            {/* Unified Demo Controls & Scenarios Panel */}
            <DemoControlsPanel onDataChanged={fetchAll} />
          </div>

          {/* Traffic Volume Chart */}
          <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(135deg,#F0F9FF,#FFFFFF)', border: '1px solid #BAE6FD', boxShadow: '0 8px 24px -14px rgba(14,165,233,0.28)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F0F9FF', color: '#0EA5E9', boxShadow: '0 2px 10px -2px rgba(14,165,233,0.3)' }}>
                  <Activity size={16} />
                </div>
                <h3 className="font-bold text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>Transaction Volume</h3>
              </div>
              <span className="text-xs font-mono" style={{ color: '#71717A' }}>Last {chartData.length} transactions</span>
            </div>
            {chartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                    <linearGradient id="colorFlagged" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FCD34D" />
                      <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                    <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FB7185" />
                      <stop offset="100%" stopColor="#F43F5E" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#71717A' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#71717A' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E4E4E7', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, boxShadow: '0 4px 20px -2px rgba(0,0,0,0.06)' }}
                    formatter={(val: any) => [`$${Number(val).toFixed(2)}`, undefined]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Inter, sans-serif', paddingTop: '10px' }} />
                  <Bar dataKey="approved" stackId="a" fill="url(#colorApproved)" name="Approved" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="flagged" stackId="a" fill="url(#colorFlagged)" name="Flagged" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="blocked" stackId="a" fill="url(#colorBlocked)" name="Blocked" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Review Queue for FLAGGED Transactions */}
          <ReviewQueue transactions={transactions} onInspect={setSelectedTx} onActionComplete={fetchAll} />

          {/* Live Feed with Filters */}
          <div className="bg-surface border-0 rounded-3xl shadow-card hover:shadow-card-hover transition-shadow duration-300 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-border bg-white flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-display font-semibold text-lg flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primaryLight flex items-center justify-center text-primary">
                  <Activity size={18} />
                </div>
                Live Feed
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Filter */}
                <div className="flex items-center gap-1 rounded-lg p-1 text-xs" style={{ background: '#F9FAFB', border: '1px solid #E4E4E7' }}>
                  {['ALL', 'APPROVED', 'BLOCKED', 'FLAGGED'].map(s => (
                    <button key={s}
                      onClick={() => setFilterStatus(s)}
                      style={filterStatus === s
                        ? { background: '#4F46E5', color: 'white', boxShadow: '0 4px 14px -2px rgba(79,70,229,0.35)' }
                        : { color: '#71717A' }}
                      className="px-3 py-1.5 rounded-md font-bold transition-all duration-200 hover:bg-gray-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {/* Merchant Search */}
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#71717A' }} />
                  <input value={filterMerchant} onChange={e => setFilterMerchant(e.target.value)}
                    placeholder="Merchant..." className="pl-7 pr-2 py-1.5 text-xs bg-white rounded-lg outline-none w-28 font-mono"
                    style={{ border: '1px solid #E4E4E7' }} />
                </div>
                {/* Amount Range */}
                <input value={filterMin} onChange={e => setFilterMin(e.target.value)} placeholder="Min $"
                  className="w-16 px-2 py-1.5 text-xs bg-white rounded-lg outline-none font-mono"
                  style={{ border: '1px solid #E4E4E7' }} />
                <input value={filterMax} onChange={e => setFilterMax(e.target.value)} placeholder="Max $"
                  className="w-16 px-2 py-1.5 text-xs bg-white rounded-lg outline-none font-mono"
                  style={{ border: '1px solid #E4E4E7' }} />
                {(filterMerchant || filterMin || filterMax || filterStatus !== 'ALL') && (
                  <button onClick={() => { setFilterStatus('ALL'); setFilterMerchant(''); setFilterMin(''); setFilterMax(''); }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ border: '1px solid #E4E4E7', color: '#F43F5E' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-wider bg-white" style={{ borderBottom: '1px solid #E4E4E7', color: '#71717A' }}>
              <div className="col-span-1"></div>
              <div className="col-span-2">Time</div>
              <div className="col-span-3">Merchant</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 flex items-center justify-between">
                <span>Settlement / Reason</span>
                <span className="text-[10px] text-indigo-500 font-normal lowercase tracking-normal">(click to inspect)</span>
              </div>
            </div>

            <div className="flex flex-col max-h-[480px] overflow-y-auto p-3">
              <AnimatePresence initial={false}>
                {filteredTxs.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: '#71717A' }}>
                    <Clock size={24} className="opacity-30" />
                    <p className="text-sm font-medium">No transactions match your filters</p>
                    <p className="text-xs">Try adjusting your search criteria</p>
                  </motion.div>
                ) : filteredTxs.map(tx => {
                  const isLive = liveIds.has(tx.id);
                  return (
                    <motion.div key={tx.id}
                      initial={{ opacity: 0, scale: isLive ? 1.03 : 1, y: -8, backgroundColor: isLive ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0)' }}
                      animate={{ opacity: 1, scale: 1, y: 0, backgroundColor: 'rgba(255,255,255,0)' }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      onClick={() => setSelectedTx(tx)}
                      title="Click to view decision explainer & policy rules"
                      className="grid grid-cols-12 gap-2 px-3 py-3 items-center rounded-xl hover:bg-violet-50/70 hover:shadow-sm cursor-pointer transition-all"
                      style={{
                        borderBottom: '1px solid #F4F4F5',
                        borderLeft: isLive ? '3px solid #10B981' : '3px solid transparent',
                        background: isLive ? 'rgba(16,185,129,0.03)' : undefined
                      }}>
                      {/* Live pulse dot vs Baseline badge */}
                      <div className="col-span-1 flex items-center justify-center">
                        {isLive ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs" title="Live WebSocket Transaction">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600" />
                            </span>
                            LIVE
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200" title="Seeded Baseline Transaction">
                            Base
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-xs font-mono" style={{ color: '#71717A' }}>
                        {new Date(tx.createdAt || tx.timestamp || Date.now()).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="col-span-3 text-sm font-medium truncate" style={{ color: '#18181B' }}>{tx.merchant}</div>
                      <div className="col-span-2 text-sm font-mono font-bold flex items-center gap-1" style={{ color: '#18181B' }}>
                        <DollarSign size={13} style={{ color: '#71717A' }} />
                        {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="col-span-2"><StatusPill status={tx.status} /></div>
                      <div className="col-span-2">
                        {tx.status === 'APPROVED' && (tx as any).settlementId ? (
                          <span className="text-[10px] font-mono px-2 py-1 rounded-lg"
                            style={{ color: '#10B981', background: 'rgba(16,185,129,0.10)' }}>
                            {(tx as any).settlementId}
                          </span>
                        ) : tx.status === 'FLAGGED' && tx.riskScore ? (
                          <div className="flex items-center gap-2">
                            <MiniRiskGauge score={tx.riskScore} />
                            <span className="text-xs truncate" style={{ color: '#71717A' }} title={tx.reason}>{tx.reason}</span>
                          </div>
                        ) : (
                          <span className="text-xs truncate block" style={{ color: '#71717A' }} title={tx.reason}>{tx.reason}</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right: Sidebar widgets */}
        <div className="flex flex-col gap-6">
          {/* Budget Donut */}
          <div className="rounded-3xl p-6" style={{ background: 'linear-gradient(135deg,#FFF7ED,#FFFBEB)', border: '1px solid #FED7AA', boxShadow: '0 8px 40px -12px rgba(234,88,12,0.20)' }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EEF2FF', color: '#4F46E5', boxShadow: '0 2px 10px -2px rgba(79,70,229,0.3)' }}>
                <Banknote size={16} />
              </div>
              <h3 className="font-bold text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>24h Budget</h3>
            </div>
            <p className="text-xs mb-5 ml-11" style={{ color: '#71717A' }}>Rolling spend vs. daily cap</p>
            {budget ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative">
                    {/* Pure SVG donut — no recharts crash */}
                    <BudgetDonut pct={budgetPct} />
                  </div>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="font-bold" style={{ color: '#4F46E5' }}>${budget.spent.toFixed(2)} spent</span>
                  <span style={{ color: '#71717A' }}>${(Math.max(budget.limit - budget.spent, 0)).toFixed(2)} left</span>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: '#E4E4E7' }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${budgetPct}%`, background: 'linear-gradient(90deg, #4F46E5, #7C3AED)' }} />
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm" style={{ color: '#71717A' }}>Loading...</div>
            )}
          </div>

          {/* Enforcement Layers Table */}
          <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#F5F3FF,#FFFFFF)', border: '1px solid #DDD6FE', boxShadow: '0 8px 40px -12px rgba(124,58,237,0.18)' }}>
            <div className="p-5 flex items-center gap-3" style={{ borderBottom: '1px solid #E4E4E7', background: '#FAFAFA' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EEF2FF', color: '#4F46E5', boxShadow: '0 2px 10px -2px rgba(79,70,229,0.3)' }}>
                <ShieldCheck size={16} />
              </div>
              <h3 className="font-bold text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>Enforcement Layers</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase" style={{ color: '#71717A', background: '#F9FAFB', borderBottom: '1px solid #E4E4E7' }}>
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Rule</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Value</th>
                  <th className="px-4 py-2.5 text-center font-semibold">On</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Per-Tx Limit', value: `$${(budget?.limit || 1000).toLocaleString()}`, highlight: true },
                  { name: 'Daily Budget', value: `$${(budget?.limit || 2000).toLocaleString()}/day`, highlight: false },
                  { name: 'Rate Limit', value: '3 tx / sec', highlight: false },
                  { name: 'Risk Threshold', value: 'Score ≥ 80', highlight: false },
                  { name: 'Allowlist Mode', value: 'Configurable', highlight: false },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F4F4F5', background: row.highlight ? 'rgba(79,70,229,0.04)' : i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                    <td className="px-4 py-3 font-semibold text-sm" style={{ color: row.highlight ? '#4F46E5' : '#18181B' }}>{row.name}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#71717A' }}>{row.value}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="relative inline-flex">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full opacity-50" style={{ background: '#10B981' }} />
                        <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#10B981' }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-Merchant Blocked Breakdown */}
          <div className="rounded-3xl p-6" style={{ background: 'linear-gradient(135deg,#FFF1F2,#FFFFFF)', border: '1px solid #FECDD3', boxShadow: '0 8px 24px -14px rgba(244,63,94,0.22)' }}>
            <h3 className="font-bold text-lg mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Top Blocked Merchants</h3>
            <p className="text-xs mb-4" style={{ color: '#71717A' }}>By block count</p>
            {merchants.filter(m => m.blocked > 0).length === 0 ? (
              <div className="text-sm italic text-center py-6" style={{ color: '#71717A' }}>No blocked transactions yet</div>
            ) : (
              <div className="space-y-3">
                {merchants.filter(m => m.blocked > 0).slice(0, 6).map((m) => (
                  <div key={m.merchant}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold truncate max-w-[140px]" style={{ color: '#18181B' }}>{m.merchant}</span>
                      <span className="font-mono font-bold" style={{ color: '#F43F5E' }}>{m.blocked} blocks</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E4E4E7' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(m.blocked / (merchants[0]?.blocked || 1)) * 100}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #F43F5E, #F472B6)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ComplianceReport />
      <TransactionDrawer transaction={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// ── BudgetDonut (pure SVG, no recharts) ─────────────────────────────────────
function BudgetDonut({ pct }: { pct: number }) {
  const R = 58, stroke = 22, size = 180;
  const circ = 2 * Math.PI * R;
  const fill = (pct / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="#E4E4E7" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none"
          stroke="url(#budgetGrad)" strokeWidth={stroke}
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <defs>
          <linearGradient id="budgetGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold text-2xl" style={{ color: '#4F46E5' }}>{pct.toFixed(0)}%</span>
        <span className="text-xs font-semibold" style={{ color: '#71717A' }}>used</span>
      </div>
    </div>
  );
}

function AnimatedNumber({ value, formatter }: { value: number, formatter?: (v: number) => string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000;
    const startValue = display;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      const current = Math.floor(startValue + progress * (value - startValue));
      setDisplay(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };
    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{formatter ? formatter(display) : display}</span>;
}

function StatCard({ value, label, color, mono }: { value: string | number; label: string; color: string; mono?: boolean }) {
  const isNumber = typeof value === 'number';
  return (
    <div className="p-6 rounded-2xl cursor-default transition-all duration-200 relative overflow-hidden"
      style={{ background: color === '#10B981' ? 'linear-gradient(135deg,#ECFDF5,#FFFFFF)' : color === '#F43F5E' ? 'linear-gradient(135deg,#FFF1F2,#FFFFFF)' : color === '#7C3AED' ? 'linear-gradient(135deg,#FFF7ED,#FFFFFF)' : 'linear-gradient(135deg,#EEF2FF,#FFFFFF)', border: `1px solid ${color}30`, boxShadow: `0 8px 22px -16px ${color}88` }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: color, opacity: 0.85 }} />
      <div className={`text-4xl lg:text-5xl font-bold mb-2 tabular-nums ${mono ? 'font-mono tracking-tight' : ''}`}
        style={{ fontFamily: mono ? 'JetBrains Mono, monospace' : 'Outfit, sans-serif', color }}>
        {isNumber
          ? <AnimatedNumber value={value as number} formatter={v => v.toLocaleString()} />
          : value}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#71717A' }}>{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styleMap: Record<string, React.CSSProperties> = {
    APPROVED: { background: 'linear-gradient(135deg,#10B981,#34D399)', boxShadow: '0 4px 14px -2px rgba(16,185,129,0.35)', color: 'white' },
    BLOCKED:  { background: 'linear-gradient(135deg,#F43F5E,#F472B6)', boxShadow: '0 4px 14px -2px rgba(244,63,94,0.35)', color: 'white' },
    FLAGGED:  { background: 'linear-gradient(135deg,#F59E0B,#FCD34D)', boxShadow: '0 4px 14px -2px rgba(245,158,11,0.30)', color: 'white' },
  };
  
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase"
      style={styleMap[status] || { background: '#E4E4E7', color: '#71717A' }}>
      {status === 'APPROVED' && <CheckCircle2 size={12} strokeWidth={3} />}
      {status === 'BLOCKED' && <X size={12} strokeWidth={3} />}
      {status === 'FLAGGED' && <ShieldAlert size={12} strokeWidth={3} />}
      {status}
    </span>
  );
}

function MiniRiskGauge({ score }: { score: number }) {
  const color = score < 60 ? '#10B981' : score < 80 ? '#F59E0B' : '#F43F5E';
  const radius = 8;
  const stroke = 3;
  const circ = 2 * Math.PI * radius;
  const half = circ / 2;
  const offset = half - (score / 100) * half;

  return (
    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md border border-border/50">
      <svg width="20" height="10" viewBox="0 0 20 10" className="overflow-visible">
        <path d={`M${stroke / 2} 10 A${radius} ${radius} 0 0 1 ${20 - stroke / 2} 10`}
          fill="none" stroke="#E4E4E7" strokeWidth={stroke} strokeLinecap="round" />
        <path d={`M${stroke / 2} 10 A${radius} ${radius} 0 0 1 ${20 - stroke / 2} 10`}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={half} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span className="text-[10px] font-mono font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function ArchNode({ icon, label, highlight, dark }: { icon: React.ReactNode; label: string; highlight?: boolean; dark?: boolean }) {
  const boxStyle: React.CSSProperties = highlight
    ? { background: 'white', color: '#4F46E5', border: '2px solid white', boxShadow: '0 0 0 4px rgba(255,255,255,0.25), 0 4px 24px -4px rgba(79,70,229,0.4)', width: 64, height: 64 }
    : dark
    ? { background: 'rgba(255,255,255,0.10)', color: 'white', border: '2px solid rgba(255,255,255,0.20)', backdropFilter: 'blur(8px)', width: 56, height: 56 }
    : { background: 'white', color: '#71717A', border: '2px solid #E4E4E7', width: 56, height: 56 };
  return (
    <div className="flex flex-col items-center gap-2 z-10">
      <div className="rounded-2xl flex items-center justify-center transition-transform hover:scale-105" style={boxStyle}>
        {icon}
      </div>
      <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: dark || highlight ? 'white' : '#4F46E5' }}>{label}</span>
    </div>
  );
}

function AnimatedConnector() {
  return (
    <div className="flex-1 h-1 relative mx-2 rounded-full overflow-hidden"
      style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.3), rgba(56,189,248,0.5))' }}>
      <motion.div
        className="absolute top-1/2 w-3 h-3 rounded-full -translate-y-1/2"
        style={{ background: 'white', boxShadow: '0 0 8px rgba(255,255,255,0.8)' }}
        animate={{ left: ['0%', '100%'], scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-52 flex flex-col items-center justify-center text-textMuted gap-2">
      <Activity size={28} className="opacity-20" />
      <p className="text-sm font-medium">No transaction data yet</p>
      <p className="text-xs">Run the demo agent to start seeing data here</p>
    </div>
  );
}

function ActivityTicker({ transactions }: { transactions: Transaction[] }) {
  const items = transactions.slice(0, 5);
  if (!items.length) return null;
  return <div className="mb-5 overflow-hidden rounded-2xl px-4 py-2.5" style={{ background: 'linear-gradient(90deg,#EEF2FF,#FDF2F8,#ECFEFF)', border: '1px solid #DDD6FE' }}>
    <motion.div className="flex gap-8 whitespace-nowrap text-xs font-mono" animate={{ x: [0, -24, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>
      <span style={{ color: '#4F46E5', fontWeight: 800 }}>LIVE ACTIVITY</span>
      {items.map(tx => <span key={tx.id} style={{ color: tx.status === 'APPROVED' ? '#059669' : tx.status === 'BLOCKED' ? '#E11D48' : '#D97706' }}>{tx.status} · ${tx.amount.toFixed(2)} · {tx.merchant}</span>)}
    </motion.div>
  </div>;
}

function AnomalyBanner({ alerts, onDismiss }: { alerts: Anomaly[]; onDismiss: (id: string) => void }) {
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [alerts.length]);
  useEffect(() => {
    if (alerts.length < 2) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % alerts.length), 5000);
    return () => window.clearInterval(timer);
  }, [alerts.length]);
  const alert = alerts[index];
  return <AnimatePresence mode="wait">{alert && <motion.div key={alert.id} initial={{ opacity: 0, height: 0, y: -12 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -12 }} transition={{ duration: .3 }} className="mb-5 overflow-hidden rounded-2xl"><div className="flex items-center gap-3 px-5 py-3.5 text-white" style={{ background: alert.severity === 'critical' ? 'linear-gradient(100deg,#F59E0B,#F43F5E)' : 'linear-gradient(100deg,#F59E0B,#FB7185)', boxShadow: '0 12px 28px -18px rgba(244,63,94,.7)' }}><AlertTriangle size={20} /><p className="flex-1 text-sm font-semibold">{alert.message}</p>{alerts.length > 1 && <span className="text-xs font-mono opacity-80">{index + 1}/{alerts.length}</span>}<button aria-label="Dismiss anomaly alert" onClick={() => onDismiss(alert.id)} className="p-1 rounded-lg hover:bg-white/15"><X size={18} /></button></div></motion.div>}</AnimatePresence>;
}

type ComplianceReportData = {
  range: { start: string; end: string };
  summary: { total: number; approved: number; blocked: number; flagged: number };
  blockReasons: { reason: string; count: number }[];
  policyChanges: { id: string; action: string; detail: string; createdAt: string }[];
};

function ComplianceReport() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [start, setStart] = useState(weekAgo);
  const [end, setEnd] = useState(today);
  const [report, setReport] = useState<ComplianceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(apiUrl(`/api/compliance-report?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`));
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      setReport(await res.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to generate report.'); }
    finally { setLoading(false); }
  };

  const download = () => {
    if (!report) return;
    const rows = [
      ['Metric', 'Value'],
      ['Range', `${start} to ${end}`],
      ['Total processed', report.summary.total], ['Approved', report.summary.approved], ['Blocked', report.summary.blocked], ['Flagged', report.summary.flagged],
      [], ['Block reason', 'Count'], ...report.blockReasons.map(x => [x.reason, x.count]), [], ['Policy change', 'Occurred at'], ...report.policyChanges.map(x => [x.detail, x.createdAt])
    ];
    const csv = rows.map(row => row.map(value => JSON.stringify(value ?? '')).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `sentripay-compliance-${start}-to-${end}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const maxReason = Math.max(...(report?.blockReasons.map(x => x.count) || [1]), 1);
  return <section className="mt-8 rounded-3xl p-6 md:p-8" style={{ background: 'linear-gradient(135deg,#FFF1F2 0%,#FFF7ED 52%,#FFFFFF 100%)', border: '1px solid #FECDD3', boxShadow: '0 20px 50px -28px rgba(244,63,94,0.42)' }}>
    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-7">
      <div><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FFE4E6', color: '#E11D48', boxShadow: '0 6px 16px -8px rgba(225,29,72,.6)' }}><FileCheck2 size={20} /></div><h2 className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif', color: '#18181B' }}>Compliance Report</h2></div><p className="mt-2" style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', color: '#BE123C' }}>A traceable story of every decision, drawn from the ledger.</p></div>
      <div className="flex flex-wrap items-center gap-2 rounded-full p-1.5" style={{ background: 'rgba(255,255,255,.78)', border: '1px solid #FECDD3' }}><CalendarRange size={15} style={{ color: '#E11D48', marginLeft: 8 }} /><input aria-label="Report start date" type="date" value={start} max={end} onChange={e => setStart(e.target.value)} className="rounded-full px-3 py-2 text-xs font-mono outline-none" style={{ background: 'transparent', color: '#18181B' }} /><span style={{ color: '#A1A1AA' }}>→</span><input aria-label="Report end date" type="date" value={end} min={start} max={today} onChange={e => setEnd(e.target.value)} className="rounded-full px-3 py-2 text-xs font-mono outline-none" style={{ background: 'transparent', color: '#18181B' }} /><button onClick={generate} disabled={loading} className="px-5 py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-60" style={{ background: '#18181B', boxShadow: '0 6px 16px -8px rgba(24,24,27,.55)' }}>{loading ? 'Generating…' : 'Generate Report'}</button>{report && <button onClick={download} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold" style={{ background: '#FFFFFF', border: '1px solid #FDA4AF', color: '#BE123C' }}><Download size={15} /> Download CSV</button>}</div>
    </div>
    {error && <p className="text-sm" style={{ color: '#E11D48' }}>{error}</p>}
    {report && <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[['Processed', report.summary.total, '#9F1239'], ['Approved', report.summary.approved, '#059669'], ['Blocked', report.summary.blocked, '#E11D48'], ['Flagged', report.summary.flagged, '#D97706']].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,.8)', border: `1px solid ${color}30`, boxShadow: `0 10px 20px -18px ${color}99` }}><div className="font-mono text-3xl font-bold" style={{ color: String(color) }}><AnimatedNumber value={Number(value)} /></div><div className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#71717A' }}>{label}</div></div>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,.78)', border: '1px solid #FECDD3' }}><h3 className="font-bold mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>Block-reason breakdown</h3>{report.blockReasons.length ? <div className="space-y-4">{report.blockReasons.map(item => <div key={item.reason} title={`${item.reason}: ${item.count}`}><div className="flex justify-between gap-4 text-xs mb-1.5"><span className="truncate" style={{ color: '#52525B' }}>{item.reason}</span><span className="font-mono font-bold" style={{ color: '#E11D48' }}>{item.count}</span></div><div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#FFE4E6' }}><motion.div initial={{ width: 0 }} animate={{ width: `${(item.count / maxReason) * 100}%` }} transition={{ duration: .75, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#F43F5E,#F472B6)' }} /></div></div>)}</div> : <p className="text-sm" style={{ color: '#71717A' }}>No blocked payments in this range.</p>}</div><div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,.78)', border: '1px solid #FED7AA' }}><h3 className="font-bold mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>Policy changes in range</h3>{report.policyChanges.length ? <div className="space-y-4">{report.policyChanges.map((item, index) => <div className="flex gap-3" key={item.id}><div className="flex flex-col items-center"><span className="w-3 h-3 rounded-full" style={{ background: item.action === 'DEMO_RESET' ? '#F59E0B' : '#7C3AED' }} />{index < report.policyChanges.length - 1 && <span className="w-px flex-1 mt-1" style={{ background: '#FED7AA' }} />}</div><div className="pb-2"><p className="text-sm" style={{ color: '#27272A' }}>{item.detail}</p><p className="text-xs font-mono mt-1" style={{ color: '#A1A1AA' }}>{new Date(item.createdAt).toLocaleString()}</p></div></div>)}</div> : <p className="text-sm" style={{ color: '#71717A' }}>No policy changes recorded in this range.</p>}</div></div>
    </motion.div>}
  </section>;
}

function DepthOrb() {
  return <motion.div className="absolute right-7 bottom-3 pointer-events-none" animate={{ rotateY: [0, 360], rotateX: [8, -8, 8], y: [0, -8, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} style={{ width: 112, height: 112, borderRadius: '32px', background: 'linear-gradient(135deg,rgba(255,255,255,.34),rgba(56,189,248,.12))', border: '1px solid rgba(255,255,255,.35)', boxShadow: 'inset 12px 12px 20px rgba(255,255,255,.16), 16px 18px 35px rgba(20,10,90,.28)', transformStyle: 'preserve-3d' }}>
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} className="absolute inset-5 rounded-full" style={{ border: '2px dashed rgba(255,255,255,.72)' }} />
    <ShieldCheck size={37} className="absolute left-[37px] top-[37px]" />
  </motion.div>;
}

function InsightPanel({ insights }: { insights: InsightInfo | null }) {
  const change = insights?.spendChangePct;
  const hour = insights?.busiestHour === null || insights?.busiestHour === undefined ? '—' : `${String(insights.busiestHour).padStart(2, '0')}:00`;
  return <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg,#ECFDF5,#EFF6FF)', border: '1px solid #A7F3D0', boxShadow: '0 10px 24px -18px rgba(5,150,105,.6)' }}>
    <div className="flex items-center gap-2 mb-4" style={{ color: '#047857' }}><TrendingUp size={17} /><span className="font-bold">Live spend intelligence</span></div>
    <div className="grid grid-cols-2 gap-3"><div><div className="text-xs" style={{ color: '#64748B' }}>7d vs previous</div><div className="font-mono font-bold text-xl" style={{ color: change !== null && change !== undefined && change > 0 ? '#D97706' : '#059669' }}>{change === null || change === undefined ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}</div></div><div><div className="text-xs" style={{ color: '#64748B' }}>Busiest hour</div><div className="font-mono font-bold text-xl" style={{ color: '#2563EB' }}>{hour}</div></div></div>
  </div>;
}
