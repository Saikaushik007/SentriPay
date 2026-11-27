import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { RefreshCw, ArrowRight, Search } from 'lucide-react';
import { apiUrl, socket } from '../lib/api';
import { useTimeRange } from '../context/TimeRangeContext';
import {
  Card,
  Button,
  StatusBadge,
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

type ChartPoint = { time: string; approved: number; blocked: number; flagged: number };
type BudgetInfo = { spent: number; limit: number };
type StatsData = {
  total: number;
  approved: number;
  blocked: number;
  flagged: number;
  approvalRate: number;
  totalSpend: number;
  range: string;
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 72;
  const H = 24;
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

export default function Dashboard() {
  const { timeRange } = useTimeRange();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const safeJson = async (url: string) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      };
      const [txRes, chartRes, budgetRes, statsRes] = await Promise.allSettled([
        safeJson(apiUrl(`/api/transactions?range=${timeRange}`)),
        safeJson(apiUrl(`/api/transactions/chart?range=${timeRange}`)),
        safeJson(apiUrl('/api/transactions/budget')),
        safeJson(apiUrl(`/api/transactions/stats?range=${timeRange}`)),
      ]);
      if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) setTransactions(txRes.value);
      if (chartRes.status === 'fulfilled' && Array.isArray(chartRes.value)) setChartData(chartRes.value);
      if (budgetRes.status === 'fulfilled' && budgetRes.value?.limit != null) setBudget(budgetRes.value);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description={`Real-time payment policy enforcement (${timeRange} window)`}
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
              <Card>
                <div className="text-xs font-medium text-[#6B7280]">Processed ({timeRange})</div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[28px] leading-[36px] font-semibold text-[#111827] font-mono-num">
                      {stats?.total ?? transactions.length}
                    </div>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      {stats?.flagged ?? 0} flagged for review
                    </div>
                  </div>
                  <Sparkline data={sparkTotal} color="#4F46E5" />
                </div>
              </Card>

              <Card>
                <div className="text-xs font-medium text-[#6B7280]">Blocked ({timeRange})</div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[28px] leading-[36px] font-semibold text-[#DC2626] font-mono-num">
                      {stats?.blocked ?? 0}
                    </div>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      Policy violations stopped
                    </div>
                  </div>
                  <Sparkline data={sparkBlocked} color="#DC2626" />
                </div>
              </Card>

              <Card>
                <div className="text-xs font-medium text-[#6B7280]">Approval rate</div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[28px] leading-[36px] font-semibold text-[#059669] font-mono-num">
                      {(stats?.approvalRate ?? 0).toFixed(1)}%
                    </div>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      {stats?.approved ?? 0} approved payments
                    </div>
                  </div>
                  <Sparkline data={sparkApproved} color="#059669" />
                </div>
              </Card>

              <Card>
                <div className="text-xs font-medium text-[#6B7280]">Spend ({timeRange})</div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[28px] leading-[36px] font-semibold text-[#111827] font-mono-num">
                      {formatCurrency(stats?.totalSpend ?? 0)}
                    </div>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      Approved settlement volume
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </ErrorBoundary>

      {/* Volume Chart + Budget Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ErrorBoundary label="Volume chart">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] leading-[24px] font-semibold text-[#111827]">
                  Transaction Volume
                </h2>
                <p className="text-xs text-[#6B7280]">Approved, flagged, and blocked amounts</p>
              </div>
              <span className="text-xs text-[#6B7280] font-mono-num">{chartData.length} points</span>
            </div>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : chartData.length === 0 ? (
              <EmptyState
                title="No volume in this window"
                description="Try switching to 24h or 7d, or run a scenario from Demo tools."
              />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #E5E7EB',
                        fontSize: 12,
                      }}
                      formatter={(val: any) => [formatCurrency(Number(val)), undefined]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="approved" stackId="a" fill="#059669" name="Approved" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="flagged" stackId="a" fill="#D97706" name="Flagged" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="blocked" stackId="a" fill="#DC2626" name="Blocked" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </ErrorBoundary>

        <ErrorBoundary label="Budget card">
          <Card className="flex flex-col justify-between">
            <div>
              <h2 className="text-[16px] leading-[24px] font-semibold text-[#111827]">
                24h Rolling Budget
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Approved spend against global daily limit
              </p>

              <div className="mt-6">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[28px] leading-[36px] font-semibold text-[#111827] font-mono-num">
                    {formatCurrency(safeBudgetSpent)}
                  </span>
                  <span className="text-xs text-[#6B7280] font-mono-num">
                    of {formatCurrency(safeBudgetLimit)}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      budgetPct > 85
                        ? 'bg-[#DC2626]'
                        : budgetPct > 65
                        ? 'bg-[#D97706]'
                        : 'bg-[#059669]'
                    }`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-[#6B7280]">
                  <span>{budgetPct}% utilized</span>
                  <span className="font-mono-num">
                    {formatCurrency(Math.max(0, safeBudgetLimit - safeBudgetSpent))} remaining
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-[#E5E7EB] text-xs text-[#6B7280]">
              Rolling 24-hour window updates automatically as new payments settle.
            </div>
          </Card>
        </ErrorBoundary>
      </div>

      {/* Live Feed Table */}
      <ErrorBoundary label="Live feed">
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[16px] leading-[24px] font-semibold text-[#111827]">Live Feed</h2>
              <p className="text-xs text-[#6B7280]">{filtered.length} matching records</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter merchant or agent…"
                  className="h-8 pl-8 pr-3 text-xs rounded-[8px] border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>
              <div className="inline-flex rounded-[8px] border border-[#E5E7EB] p-0.5 bg-[#F9FAFB]">
                {['ALL', 'APPROVED', 'BLOCKED', 'FLAGGED'].map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      setStatusFilter(s);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors ${
                      statusFilter === s
                        ? 'bg-[#4F46E5] text-white'
                        : 'text-[#6B7280] hover:text-[#111827]'
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
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-medium text-[#6B7280]">
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
                  paged.map(tx => (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-xs text-[#6B7280] font-mono-num whitespace-nowrap">
                        {formatDateTime(tx.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#111827]">{tx.merchant}</td>
                      <td className="py-3 px-4 text-xs text-[#6B7280] font-mono-num">{tx.agentId}</td>
                      <td className="py-3 px-4 text-right font-mono-num font-medium text-[#111827]">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="py-3 px-4 text-xs font-mono-num text-[#6B7280]">
                        {tx.riskScore ?? '—'}
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#6B7280]">
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
