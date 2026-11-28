import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ArrowRight, ArrowUpDown, RotateCcw } from 'lucide-react';
import { apiUrl, socket } from '../lib/api';
import { useTimeRange } from '../context/TimeRangeContext';
import {
  Card,
  Button,
  StatusBadge,
  AgentInitials,
  RiskBar,
  PageHeader,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../components/ui/primitives';
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

export default function Transactions() {
  const { timeRange } = useTimeRange();
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const statusFilter = searchParams.get('status') || 'ALL';
  const agentFilter = searchParams.get('agent') || 'ALL';
  const merchantFilter = searchParams.get('merchant') || '';
  const minAmount = searchParams.get('min') || '';
  const maxAmount = searchParams.get('max') || '';
  const [sortKey, setSortKey] = useState<'createdAt' | 'amount' | 'merchant' | 'status'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (!val || val === 'ALL') next.delete(key);
    else next.set(key, val);
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const fetchTxs = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/transactions?range=${timeRange}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    setLoading(true);
    fetchTxs();
    const onUpdate = () => fetchTxs();
    socket.on('new_transaction', onUpdate);
    socket.on('transaction_updated', onUpdate);
    socket.on('demo_reset', onUpdate);
    return () => {
      socket.off('new_transaction', onUpdate);
      socket.off('transaction_updated', onUpdate);
      socket.off('demo_reset', onUpdate);
    };
  }, [fetchTxs]);

  const agents = useMemo(() => Array.from(new Set(transactions.map(t => t.agentId))).sort(), [transactions]);

  const filtered = useMemo(() => {
    const min = minAmount ? parseFloat(minAmount) : null;
    const max = maxAmount ? parseFloat(maxAmount) : null;
    return transactions
      .filter(t => {
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        if (agentFilter !== 'ALL' && t.agentId !== agentFilter) return false;
        if (merchantFilter && !t.merchant.toLowerCase().includes(merchantFilter.toLowerCase())) return false;
        if (min !== null && !Number.isNaN(min) && t.amount < min) return false;
        if (max !== null && !Number.isNaN(max) && t.amount > max) return false;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'amount') cmp = a.amount - b.amount;
        else if (sortKey === 'merchant') cmp = a.merchant.localeCompare(b.merchant);
        else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
        else cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [transactions, statusFilter, agentFilter, merchantFilter, minAmount, maxAmount, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const exportCsv = () => {
    const rows = [
      ['ID', 'Time', 'Merchant', 'Agent', 'Amount', 'Status', 'Risk', 'Reason'],
      ...filtered.map(t => [
        t.id,
        t.createdAt || '',
        t.merchant,
        t.agentId,
        t.amount.toFixed(2),
        t.status,
        t.riskScore ?? '',
        t.reason,
      ]),
    ];
    const csv = rows.map(r => r.map(v => JSON.stringify(v ?? '')).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentripay-transactions-${timeRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        description={`Full payment ledger for the ${timeRange} window (${filtered.length} records)`}
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchTxs} />}

      <Card className="p-0 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-[#E5E7EB] flex flex-wrap items-center gap-2.5 bg-[#F9FAFB]">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={e => updateParam('status', e.target.value)}
            className="h-8 px-2.5 text-xs rounded-[8px] border border-[#E5E7EB] bg-white text-[#111827]"
          >
            <option value="ALL">All statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="BLOCKED">Blocked</option>
            <option value="FLAGGED">Flagged</option>
          </select>

          <select
            aria-label="Filter by agent"
            value={agentFilter}
            onChange={e => updateParam('agent', e.target.value)}
            className="h-8 px-2.5 text-xs rounded-[8px] border border-[#E5E7EB] bg-white text-[#111827]"
          >
            <option value="ALL">All agents</option>
            {agents.map(a => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <input
            value={merchantFilter}
            onChange={e => updateParam('merchant', e.target.value)}
            placeholder="Merchant…"
            className="h-8 px-2.5 text-xs rounded-[8px] border border-[#E5E7EB] bg-white text-[#111827] w-36"
          />

          <input
            type="number"
            value={minAmount}
            onChange={e => updateParam('min', e.target.value)}
            placeholder="Min $"
            className="h-8 px-2.5 text-xs rounded-[8px] border border-[#E5E7EB] bg-white text-[#111827] w-24 font-mono-num"
          />

          <input
            type="number"
            value={maxAmount}
            onChange={e => updateParam('max', e.target.value)}
            placeholder="Max $"
            className="h-8 px-2.5 text-xs rounded-[8px] border border-[#E5E7EB] bg-white text-[#111827] w-24 font-mono-num"
          />

          {(statusFilter !== 'ALL' || agentFilter !== 'ALL' || merchantFilter || minAmount || maxAmount) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchParams({}, { replace: true });
                setPage(1);
              }}
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-medium text-[#6B7280]">
                <th className="py-2.5 px-4">
                  <button onClick={() => toggleSort('createdAt')} className="inline-flex items-center gap-1 hover:text-[#111827]">
                    Time <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button onClick={() => toggleSort('merchant')} className="inline-flex items-center gap-1 hover:text-[#111827]">
                    Merchant <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-4">Agent</th>
                <th className="py-2.5 px-4 text-right">
                  <button onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 hover:text-[#111827]">
                    Amount <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-4">
                  <button onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-[#111827]">
                    Status <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-4">Risk</th>
                <th className="py-2.5 px-4 text-right">Details</th>
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
                      title="No matching transactions"
                      description="Try clearing your filters or selecting a wider time range."
                    />
                  </td>
                </tr>
              ) : (
                paged.map(tx => {
                  const rowTint =
                    tx.status === 'FLAGGED'
                      ? 'bg-[#F59E0B]/[0.04] hover:bg-[#F59E0B]/[0.08]'
                      : tx.status === 'BLOCKED'
                        ? 'bg-[#F43F5E]/[0.03] hover:bg-[#F43F5E]/[0.06]'
                        : 'hover:bg-[#F6F7FB]';
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className={`${rowTint} cursor-pointer transition-colors`}
                    >
                      <td className="py-3 px-4 text-xs text-[#64748B] font-mono-num whitespace-nowrap">
                        {formatDateTime(tx.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{tx.merchant}</td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-2">
                          <AgentInitials agentId={tx.agentId} />
                          <span className="text-xs text-[#64748B] font-mono-num">{tx.agentId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-semibold text-[#0F172A]">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="py-3 px-4">
                        <RiskBar score={tx.riskScore} />
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
          <div className="px-4 py-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#6B7280]">
            <span>
              Page {page} of {totalPages} ({filtered.length} total)
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <TransactionDrawer transaction={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
