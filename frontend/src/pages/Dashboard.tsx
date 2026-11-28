import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  RefreshCw,
  ArrowRight,
  Search,
  Activity,
  ShieldX,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Bot,
  ShieldCheck,
  Landmark,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { apiUrl, socket } from '../lib/api';
import { useTimeRange } from '../context/TimeRangeContext';
import {
  Card,
  Button,
  PageHeader,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../components/ui/primitives';
import ErrorBoundary from '../components/ErrorBoundary';
import TransactionDrawer from '../components/TransactionDrawer';
import { formatCurrency, formatDateTime } from '../lib/utils';

type Transaction = {
  id: string;
  amount: number;
  merchant: string;
  agentId: string;
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  riskScore?: number;
  settlementId?: string;
  ruleResults?: any;
  createdAt?: string;
};

type ChartPoint = {
  time: string;
  approved: number;
  blocked: number;
  flagged: number;
  approvedAmount?: number;
  blockedAmount?: number;
  flaggedAmount?: number;
};
type BudgetInfo = { spent: number; limit: number };
type StatsData = {
  total: number;
  approved: number;
  blocked: number;
  flagged: number;
  approvalRate: number;
  totalSpend: number;
  range: string;
  deltas?: {
    totalPct: number;
    blockedPct: number;
    approvalRatePts: number;
    totalSpendPct: number;
  };
  sparklines?: {
    total: number[];
    blocked: number[];
    approved: number[];
    spend: number[];
  };
};

function CountUpNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const duration = 450;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const formatted =
    decimals > 0
      ? display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
      : Math.round(display).toLocaleString();

  return (
    <>
      {prefix}
      {formatted}
      {suffix}
    </>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 68;
  const H = 22;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`)
    .join(' ');
  return (
    <svg width={W} height={H} className="overflow-visible shrink-0" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BudgetRing({ pct }: { pct: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" className="shrink-0">
      <defs>
        <linearGradient id="sp-ring-grad" x1="0" y1="0" x2="104" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <circle cx="52" cy="52" r={r} fill="none" stroke="#F1F5F9" strokeWidth="9" />
      <circle
        cx="52"
        cy="52"
        r={r}
        fill="none"
        stroke="url(#sp-ring-grad)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 52 52)"
        style={{ transition: 'stroke-dashoffset 400ms ease' }}
      />
      <text
        x="52"
        y="56"
        textAnchor="middle"
        className="fill-[#0F172A] text-[15px] font-semibold font-mono-num"
      >
        {pct}%
      </text>
    </svg>
  );
}

function AgentInitials({ agentId }: { agentId: string }) {
  const short = agentId.replace('agent-', '').slice(0, 2).toUpperCase();
  const palette: Record<string, string> = {
    AL: 'bg-[#4F46E5]/10 text-[#4F46E5]',
    BE: 'bg-[#14B8A6]/10 text-[#0F766E]',
    GA: 'bg-[#7C3AED]/10 text-[#7C3AED]',
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`w-6 h-6 rounded-full text-[11px] font-semibold inline-flex items-center justify-center shrink-0 ${palette[short] || 'bg-slate-100 text-slate-700'
          }`}
      >
        {short}
      </span>
      <span className="text-xs text-[#64748B] font-mono-num">{agentId}</span>
    </span>
  );
}

function SentinelStatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#10B981]/10 text-[#059669]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
        <CheckCircle2 className="w-3 h-3" />
        Approved
      </span>
    );
  }
  if (status === 'BLOCKED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F43F5E]/10 text-[#E11D48]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />
        <ShieldX className="w-3 h-3" />
        Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F59E0B]/10 text-[#D97706]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
      <Clock className="w-3 h-3" />
      Flagged
    </span>
  );
}

export default function Dashboard() {
  const { timeRange } = useTimeRange();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [reviewQueueCount, setReviewQueueCount] = useState<number>(0);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartMode, setChartMode] = useState<'count' | 'amount'>('count');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const safeJson = async (url: string) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      };
      const [txRes, chartRes, budgetRes, statsRes, agentsRes, anomRes, reviewRes] = await Promise.allSettled([
        safeJson(apiUrl(`/api/transactions?range=${timeRange}`)),
        safeJson(apiUrl(`/api/transactions/chart?range=${timeRange}`)),
        safeJson(apiUrl(`/api/transactions/budget?range=${timeRange}`)),
        safeJson(apiUrl(`/api/transactions/stats?range=${timeRange}`)),
        safeJson(apiUrl(`/api/agents?range=${timeRange}`)),
        safeJson(apiUrl('/api/anomalies')),
        safeJson(apiUrl('/api/review-queue')),
      ]);
      if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) setTransactions(txRes.value);
      if (chartRes.status === 'fulfilled' && Array.isArray(chartRes.value)) setChartData(chartRes.value);
      if (budgetRes.status === 'fulfilled' && budgetRes.value?.limit != null) setBudget(budgetRes.value);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (agentsRes.status === 'fulfilled' && Array.isArray(agentsRes.value)) setAgents(agentsRes.value);
      if (anomRes.status === 'fulfilled' && Array.isArray(anomRes.value?.alerts)) setAnomalies(anomRes.value.alerts);
      if (reviewRes.status === 'fulfilled' && Array.isArray(reviewRes.value)) setReviewQueueCount(reviewRes.value.length);

      if (
        txRes.status === 'rejected' &&
        chartRes.status === 'rejected' &&
        budgetRes.status === 'rejected' &&
        statsRes.status === 'rejected'
      ) {
        setError('Unable to load dashboard data. Please check that the backend is running.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
    const onUpdate = () => fetchAll();
    socket.on('new_transaction', onUpdate);
    socket.on('transaction_updated', onUpdate);
    socket.on('demo_reset', onUpdate);
    return () => {
      socket.off('new_transaction', onUpdate);
      socket.off('transaction_updated', onUpdate);
      socket.off('demo_reset', onUpdate);
    };
  }, [fetchAll]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !t.merchant.toLowerCase().includes(q) &&
          !t.agentId.toLowerCase().includes(q) &&
          !(t.reason || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const safeBudgetSpent = budget && Number.isFinite(budget.spent) ? budget.spent : 0;
  const safeBudgetLimit = budget && Number.isFinite(budget.limit) && budget.limit > 0 ? budget.limit : 2000;
  const budgetPct = Math.min(100, Math.round((safeBudgetSpent / safeBudgetLimit) * 100));

  const sparkTotal = useMemo(() => chartData.slice(-10).map(c => c.approved + c.blocked + c.flagged), [chartData]);
  const sparkBlocked = useMemo(() => chartData.slice(-10).map(c => c.blocked), [chartData]);
  const sparkApproved = useMemo(() => chartData.slice(-10).map(c => c.approved), [chartData]);

  const nearLimitAgents = useMemo(
    () => agents.filter(a => a.dailyBudget > 0 && a.spentToday / a.dailyBudget >= 0.75),
    [agents]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`Sentinel payment enforcement overview (${timeRange} window)`}
        actions={
          <Button variant="secondary" size="sm" onClick={fetchAll}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchAll} />}

      {/* 4 KPI Cards */}
      <ErrorBoundary label="KPI summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <Card key={i}>
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-20" />
              </Card>
            ))
          ) : (
            <>
              <Card className="sp-card-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#64748B]">Processed ({timeRange})</span>
                  <span className="w-8 h-8 rounded-[8px] bg-[#4F46E5]/10 text-[#4F46E5] flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[28px] leading-[34px] font-semibold text-[#0F172A] font-mono-num">
                      <CountUpNumber value={stats?.total ?? transactions.length} />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        (stats?.deltas?.totalPct ?? 0) >= 0
                          ? 'bg-[#10B981]/10 text-[#059669]'
                          : 'bg-[#F43F5E]/10 text-[#E11D48]'
                      }`}
                    >
                      {(stats?.deltas?.totalPct ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {(stats?.deltas?.totalPct ?? 0) >= 0 ? '+' : ''}
                      {stats?.deltas?.totalPct ?? 0}% vs prev {timeRange}
                    </span>
                  </div>
                  <Sparkline data={stats?.sparklines?.total ?? sparkTotal} color="#4F46E5" />
                </div>
              </Card>

              <Card className="sp-card-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#64748B]">Blocked ({timeRange})</span>
                  <span className="w-8 h-8 rounded-[8px] bg-[#F43F5E]/10 text-[#F43F5E] flex items-center justify-center">
                    <ShieldX className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[28px] leading-[34px] font-semibold text-[#0F172A] font-mono-num">
                      <CountUpNumber value={stats?.blocked ?? 0} />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        (stats?.deltas?.blockedPct ?? 0) <= 0
                          ? 'bg-[#10B981]/10 text-[#059669]'
                          : 'bg-[#F43F5E]/10 text-[#E11D48]'
                      }`}
                    >
                      {(stats?.deltas?.blockedPct ?? 0) <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                      {(stats?.deltas?.blockedPct ?? 0) >= 0 ? '+' : ''}
                      {stats?.deltas?.blockedPct ?? 0}% vs prev {timeRange}
                    </span>
                  </div>
                  <Sparkline data={stats?.sparklines?.blocked ?? sparkBlocked} color="#F43F5E" />
                </div>
              </Card>

              <Card className="sp-card-hover">
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-medium text-[#64748B] cursor-help"
                    title="Approved decisions ÷ all decisions in the selected window"
                  >
                    Approval rate ({timeRange})
                  </span>
                  <span className="w-8 h-8 rounded-[8px] bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[28px] leading-[34px] font-semibold text-[#0F172A] font-mono-num">
                      <CountUpNumber value={stats?.approvalRate ?? 0} decimals={1} suffix="%" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        (stats?.deltas?.approvalRatePts ?? 0) >= 0
                          ? 'bg-[#10B981]/10 text-[#059669]'
                          : 'bg-[#F43F5E]/10 text-[#E11D48]'
                      }`}
                    >
                      {(stats?.deltas?.approvalRatePts ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {(stats?.deltas?.approvalRatePts ?? 0) >= 0 ? '+' : ''}
                      {stats?.deltas?.approvalRatePts ?? 0} pts vs prev {timeRange}
                    </span>
                  </div>
                  <Sparkline data={stats?.sparklines?.approved ?? sparkApproved} color="#10B981" />
                </div>
              </Card>

              <Card className="sp-card-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#64748B]">Spend ({timeRange})</span>
                  <span className="w-8 h-8 rounded-[8px] bg-[#14B8A6]/10 text-[#14B8A6] flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[28px] leading-[34px] font-semibold text-[#0F172A] font-mono-num">
                      <CountUpNumber value={stats?.totalSpend ?? 0} decimals={2} prefix="$" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        (stats?.deltas?.totalSpendPct ?? 0) >= 0
                          ? 'bg-[#10B981]/10 text-[#059669]'
                          : 'bg-[#F43F5E]/10 text-[#E11D48]'
                      }`}
                    >
                      {(stats?.deltas?.totalSpendPct ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {(stats?.deltas?.totalSpendPct ?? 0) >= 0 ? '+' : ''}
                      {stats?.deltas?.totalSpendPct ?? 0}% vs prev {timeRange}
                    </span>
                  </div>
                  <Sparkline data={stats?.sparklines?.spend ?? []} color="#14B8A6" />
                </div>
              </Card>
            </>
          )}
        </div>
      </ErrorBoundary>

      {/* Compact Sentinel Flow Strip */}
      <Card className="py-3.5 px-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Sentinel flow</div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-[8px] bg-[#4F46E5]/10 text-[#4F46E5] flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </span>
              <span className="text-[#64748B] text-xs">Agents</span>
              <span className="font-mono-num font-semibold text-[#0F172A]">{agents.length}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-[8px] bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span className="text-[#64748B] text-xs">Policy engine</span>
              <span className="font-mono-num font-semibold text-[#0F172A]">{stats?.total ?? 0}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-[8px] bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </span>
              <span className="text-[#64748B] text-xs">Settlement</span>
              <span className="font-mono-num font-semibold text-[#059669]">{stats?.approved ?? 0}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Volume Chart + Budget Ring + Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ErrorBoundary label="Volume chart">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div>
                <h2 className="text-[18px] leading-[24px] font-semibold text-[#0F172A]">
                  Transaction Volume ({timeRange})
                </h2>
                <p className="text-xs text-[#64748B]">Hourly buckets by decision status</p>
              </div>
              <div className="inline-flex items-center bg-[#F1F5F9] p-0.5 rounded-[8px] border border-[#E5E7EB]">
                <button
                  onClick={() => setChartMode('count')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors cursor-pointer ${
                    chartMode === 'count' ? 'bg-white text-[#4F46E5] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Count
                </button>
                <button
                  onClick={() => setChartMode('amount')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors cursor-pointer ${
                    chartMode === 'amount' ? 'bg-white text-[#4F46E5] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Amount
                </button>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-60 w-full" />
            ) : chartData.length === 0 ? (
              <EmptyState
                title="No volume in this window"
                description="Switch to 24h or 7d, or run a scenario from Demo tools."
              />
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      tickFormatter={v => (chartMode === 'amount' ? `$${v}` : `${v}`)}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid #E5E7EB',
                        fontSize: 12,
                      }}
                      formatter={(val: any, name: any) => [
                        chartMode === 'amount' ? formatCurrency(Number(val)) : `${val} tx`,
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar
                      dataKey={chartMode === 'amount' ? 'approvedAmount' : 'approved'}
                      name="Approved"
                      stackId="a"
                      fill="#10B981"
                    />
                    <Bar
                      dataKey={chartMode === 'amount' ? 'blockedAmount' : 'blocked'}
                      name="Blocked"
                      stackId="a"
                      fill="#F43F5E"
                    />
                    <Bar
                      dataKey={chartMode === 'amount' ? 'flaggedAmount' : 'flagged'}
                      name="Flagged"
                      stackId="a"
                      fill="#F59E0B"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </ErrorBoundary>

        <div className="space-y-4">
          {/* Budget Card with Gradient Progress Ring */}
          <ErrorBoundary label="Budget card">
            <Card>
              <h2 className="text-[18px] leading-[24px] font-semibold text-[#0F172A]">
                24h Rolling Budget
              </h2>
              <div className="mt-4 flex items-center gap-4">
                <BudgetRing pct={budgetPct} />
                <div className="min-w-0">
                  <div className="text-xs text-[#64748B]">Spent today</div>
                  <div className="text-lg font-semibold text-[#0F172A] font-mono-num">
                    {formatCurrency(safeBudgetSpent)}
                  </div>
                  <div className="text-xs text-[#64748B] mt-1 font-mono-num">
                    {formatCurrency(Math.max(0, safeBudgetLimit - safeBudgetSpent))} remaining of{' '}
                    {formatCurrency(safeBudgetLimit)}
                  </div>
                </div>
              </div>
            </Card>
          </ErrorBoundary>

          {/* Needs Attention Card */}
          <ErrorBoundary label="Needs attention">
            <Card>
              <h2 className="text-[18px] leading-[24px] font-semibold text-[#0F172A] mb-3">
                Needs attention
              </h2>
              <div className="space-y-2.5 text-xs">
                <Link
                  to="/approvals"
                  className="flex items-center justify-between p-2.5 rounded-[8px] bg-[#F59E0B]/10 text-[#B45309] hover:bg-[#F59E0B]/15 transition-colors"
                >
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Clock className="w-3.5 h-3.5" /> Flagged payments waiting
                  </span>
                  <span data-testid="dashboard-flagged-waiting" className="font-mono-num font-semibold">{reviewQueueCount}</span>
                </Link>

                <Link
                  to="/agents"
                  className="flex items-center justify-between p-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#E5E7EB] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Bot className="w-3.5 h-3.5 text-[#4F46E5]" /> Agents near daily limit
                  </span>
                  <span className="font-mono-num font-semibold">{nearLimitAgents.length}</span>
                </Link>

                {anomalies.length > 0 && (
                  <Link
                    to="/alerts"
                    className="flex items-center justify-between p-2.5 rounded-[8px] bg-[#F43F5E]/10 text-[#E11D48] hover:bg-[#F43F5E]/15 transition-colors"
                  >
                    <span className="inline-flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Spend anomaly detected
                    </span>
                    <span className="font-mono-num font-semibold">{anomalies.length}</span>
                  </Link>
                )}
              </div>
            </Card>
          </ErrorBoundary>
        </div>
      </div>

      {/* Live Feed Table */}
      <ErrorBoundary label="Live feed">
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[18px] leading-[24px] font-semibold text-[#0F172A]">Live Feed</h2>
              <p className="text-xs text-[#64748B]">{filtered.length} matching records</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter merchant or agent…"
                  className="h-8 pl-8 pr-3 text-xs rounded-[8px] border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>
              <div className="inline-flex rounded-[8px] border border-[#E5E7EB] p-0.5 bg-[#F8FAFC]">
                {['ALL', 'APPROVED', 'BLOCKED', 'FLAGGED'].map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      setStatusFilter(s);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors ${statusFilter === s
                        ? 'bg-[#4F46E5] text-white'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                  >
                    {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium text-[#64748B]">
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Merchant</th>
                  <th className="py-2.5 px-4">Agent</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Risk</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm">
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i}>
                      <td colSpan={7} className="py-3 px-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title="No transactions found"
                        description="Adjust your filters or switch the time range."
                      />
                    </td>
                  </tr>
                ) : (
                  paged.map(tx => {
                    const risk = Math.min(100, Math.max(0, tx.riskScore ?? 10));
                    const riskColor =
                      risk >= 75 ? 'bg-[#F43F5E]' : risk >= 45 ? 'bg-[#F59E0B]' : 'bg-[#10B981]';
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 text-xs text-[#64748B] font-mono-num whitespace-nowrap">
                          {formatDateTime(tx.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-2 font-medium text-[#0F172A]">
                            <span className="w-6 h-6 rounded-[6px] bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center justify-center shrink-0">
                              {tx.merchant.slice(0, 2).toUpperCase()}
                            </span>
                            {tx.merchant}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <AgentInitials agentId={tx.agentId} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num font-medium text-[#0F172A]">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <SentinelStatusBadge status={tx.status} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${riskColor}`} style={{ width: `${risk}%` }} />
                            </div>
                            <span className="text-xs font-mono-num text-[#64748B]">{tx.riskScore ?? '—'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedTx(tx);
                            }}
                          >
                            Inspect
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#64748B]">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </ErrorBoundary>

      <TransactionDrawer transaction={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
