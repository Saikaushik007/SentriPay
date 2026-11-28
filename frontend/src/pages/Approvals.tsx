import { useEffect, useState, useCallback } from 'react';
import { Check, X, RefreshCw } from 'lucide-react';
import { apiUrl, socket } from '../lib/api';
import { useToast } from '../context/ToastContext';
import {
  Card,
  Button,
  AgentInitials,
  RiskBar,
  PageHeader,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../components/ui/primitives';
import TransactionDrawer from '../components/TransactionDrawer';
import { formatCurrency, formatDateTime, formatRelativeTime } from '../lib/utils';

type ReviewTx = {
  id: string;
  amount: number;
  merchant: string;
  agentId: string;
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  riskScore?: number;
  ruleResults?: any;
  createdAt?: string;
};

export default function Approvals() {
  const toast = useToast();
  const [items, setItems] = useState<ReviewTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTx, setSelectedTx] = useState<ReviewTx | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ txs: ReviewTx[]; action: 'APPROVE' | 'REJECT' } | null>(null);
  const [reviewer, setReviewer] = useState('Compliance Officer');
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/review-queue'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setSelectedIds(new Set());
    } catch (e: any) {
      setError(e?.message || 'Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const onUpdate = () => fetchQueue();
    socket.on('new_transaction', onUpdate);
    socket.on('transaction_updated', onUpdate);
    socket.on('demo_reset', onUpdate);
    return () => {
      socket.off('new_transaction', onUpdate);
      socket.off('transaction_updated', onUpdate);
      socket.off('demo_reset', onUpdate);
    };
  }, [fetchQueue]);

  const toggleAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!confirmAction || confirmAction.txs.length === 0) return;
    setSubmitting(true);
    try {
      let multiSigCount = 0;
      for (const tx of confirmAction.txs) {
        const res = await fetch(apiUrl(`/api/transactions/${tx.id}/review`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: confirmAction.action, reviewer }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.multisig) multiSigCount++;
      }
      if (confirmAction.txs.length === 1 && multiSigCount === 1) {
        toast.success('First signature recorded (1/2)');
      } else {
        toast.success(
          confirmAction.action === 'APPROVE'
            ? `${confirmAction.txs.length} payment(s) processed`
            : `${confirmAction.txs.length} payment(s) rejected`
        );
      }
      setConfirmAction(null);
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTxs = items.filter(i => selectedIds.has(i.id));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Approvals"
        description="Flagged payments awaiting human review (payments >= $300 require 2 signatures)"
        actions={
          <div className="flex items-center gap-2">
            {selectedTxs.length > 0 && (
              <>
                <button
                  onClick={() => setConfirmAction({ txs: selectedTxs, action: 'APPROVE' })}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-xs font-medium bg-[#10B981] hover:bg-[#059669] text-white transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve ({selectedTxs.length})
                </button>
                <button
                  onClick={() => setConfirmAction({ txs: selectedTxs, action: 'REJECT' })}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-xs font-medium border border-[#F43F5E]/40 text-[#E11D48] hover:bg-[#F43F5E]/10 bg-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject ({selectedTxs.length})
                </button>
              </>
            )}
            <Button variant="secondary" size="sm" onClick={fetchQueue}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchQueue} />}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-medium text-[#6B7280]">
                <th className="py-2.5 px-4 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleAll}
                    className="rounded border-[#E5E7EB] accent-[#4F46E5] cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-4">Age</th>
                <th className="py-2.5 px-4">Merchant</th>
                <th className="py-2.5 px-4">Agent</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4">Risk</th>
                <th className="py-2.5 px-4">Signatures</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td colSpan={8} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="No pending approvals"
                      description="All flagged transactions have been reviewed."
                    />
                  </td>
                </tr>
              ) : (
                items.map(tx => (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="bg-[#F59E0B]/[0.05] hover:bg-[#F59E0B]/[0.09] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${tx.merchant}`}
                        checked={selectedIds.has(tx.id)}
                        onChange={() => toggleOne(tx.id)}
                        className="rounded border-[#E5E7EB] accent-[#4F46E5] cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 text-xs text-[#64748B] font-mono-num whitespace-nowrap" title={formatDateTime(tx.createdAt)}>
                      {formatRelativeTime(tx.createdAt)}
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
                      <RiskBar score={tx.riskScore} />
                    </td>
                    <td className="py-3 px-4 text-xs font-mono-num text-[#64748B]">
                      {tx.amount >= 300 ? '0 of 2' : '0 of 1'}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setConfirmAction({ txs: [tx], action: 'APPROVE' })}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] text-xs font-medium bg-[#10B981] hover:bg-[#059669] text-white transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => setConfirmAction({ txs: [tx], action: 'REJECT' })}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] text-xs font-medium border border-[#F43F5E]/40 text-[#E11D48] hover:bg-[#F43F5E]/10 bg-white transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white rounded-[12px] border border-[#E5E7EB] shadow-xl max-w-md w-full p-5 z-10 space-y-4">
            <h3 className="text-base font-semibold text-[#0F172A]">
              {confirmAction.action === 'APPROVE'
                ? `Approve ${confirmAction.txs.length > 1 ? `${confirmAction.txs.length} payments` : 'payment'}?`
                : `Reject ${confirmAction.txs.length > 1 ? `${confirmAction.txs.length} payments` : 'payment'}?`}
            </h3>
            {confirmAction.txs.length === 1 ? (
              <p className="text-sm text-[#64748B]">
                {confirmAction.txs[0].merchant} ·{' '}
                <span className="font-mono-num font-medium text-[#0F172A]">
                  {formatCurrency(confirmAction.txs[0].amount)}
                </span>{' '}
                ({confirmAction.txs[0].agentId})
              </p>
            ) : (
              <p className="text-sm text-[#64748B]">
                Total:{' '}
                <span className="font-mono-num font-medium text-[#0F172A]">
                  {formatCurrency(confirmAction.txs.reduce((s, t) => s + t.amount, 0))}
                </span>{' '}
                across {confirmAction.txs.length} flagged transactions.
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Reviewer name</label>
              <input
                value={reviewer}
                onChange={e => setReviewer(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-[8px] border border-[#E5E7EB]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                variant={confirmAction.action === 'APPROVE' ? 'primary' : 'destructive'}
                size="sm"
                disabled={submitting}
                onClick={handleConfirm}
              >
                {submitting ? 'Submitting…' : confirmAction.action === 'APPROVE' ? 'Confirm Approve' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <TransactionDrawer transaction={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
