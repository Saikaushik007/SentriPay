import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Ban } from 'lucide-react';
import { apiUrl, socket } from '../lib/api';
import { useTimeRange } from '../context/TimeRangeContext';
import { useToast } from '../context/ToastContext';
import {
  Card,
  Button,
  PageHeader,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../components/ui/primitives';
import { formatCurrency } from '../lib/utils';

type MerchantRow = {
  merchant: string;
  total: number;
  blocked: number;
  approved: number;
  totalSpend: number;
};

export default function MerchantInsights() {
  const { timeRange } = useTimeRange();
  const toast = useToast();
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMerchants = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/transactions/merchants?range=${timeRange}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMerchants(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load merchants');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    setLoading(true);
    fetchMerchants();
    const onUpdate = () => fetchMerchants();
    socket.on('new_transaction', onUpdate);
    socket.on('demo_reset', onUpdate);
    return () => {
      socket.off('new_transaction', onUpdate);
      socket.off('demo_reset', onUpdate);
    };
  }, [fetchMerchants]);

  const addToDenylist = async (merchant: string) => {
    try {
      const polRes = await fetch(apiUrl('/api/policies'));
      const pol = await polRes.json();
      const currentList: string[] = Array.isArray(pol?.denylist) ? pol.denylist : [];
      if (currentList.includes(merchant)) {
        toast.success(`${merchant} is already on the denylist`);
        return;
      }
      const putRes = await fetch(apiUrl('/api/policies'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ denylist: [...currentList, merchant] }),
      });
      if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`);
      toast.success(`Added "${merchant}" to denylist`);
    } catch {
      toast.error('Failed to update denylist');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Merchants"
        description={`Merchant spend, volume, and block activity (${timeRange} window)`}
        actions={
          <Button variant="secondary" size="sm" onClick={fetchMerchants}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchMerchants} />}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-medium text-[#6B7280]">
                <th className="py-2.5 px-4">Merchant</th>
                <th className="py-2.5 px-4 text-right">Approved Spend</th>
                <th className="py-2.5 px-4 text-right">Volume</th>
                <th className="py-2.5 px-4 text-right">Approved</th>
                <th className="py-2.5 px-4 text-right">Blocked</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm">
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i}>
                    <td colSpan={6} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : merchants.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title={`No merchant data for the last ${timeRange}`}
                      description="Switch to 24h or 7d, or run a scenario from Demo tools."
                    />
                  </td>
                </tr>
              ) : (
                merchants.map(m => (
                  <tr key={m.merchant} className="hover:bg-[#F6F7FB] transition-colors">
                    <td className="py-3 px-4 font-medium text-[#0F172A]">{m.merchant}</td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-[#0F172A]">
                      {formatCurrency(m.totalSpend)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-[#64748B]">{m.total}</td>
                    <td className="py-3 px-4 text-right font-mono-num">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#10B981]/10 text-[#059669]">
                        {m.approved}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num">
                      {m.blocked > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F43F5E]/10 text-[#E11D48]">
                          {m.blocked}
                        </span>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="secondary" size="sm" onClick={() => addToDenylist(m.merchant)}>
                        <Ban className="w-3.5 h-3.5 text-[#F43F5E]" />
                        Add to denylist
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
