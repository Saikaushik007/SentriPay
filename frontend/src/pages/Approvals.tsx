import { useEffect, useState, useCallback } from 'react';
import { Check, X, RefreshCw } from 'lucide-react';
import { apiUrl, socket } from '../lib/api';
import { useToast } from '../context/ToastContext';
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
import { formatCurrency, formatDateTime } from '../lib/utils';

type ReviewTx = {
  id: string;
  amount: number;
  merchant: string;
  agentId: string;
  status: string;
  reason: string;
  riskScore?: number;
  createdAt?: string;
};

export default function Approvals() {
  const toast = useToast();
  const [items, setItems] = useState<ReviewTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ tx: ReviewTx; action: 'APPROVE' | 'REJECT' } | null>(null);
  const [reviewer, setReviewer] = useState('Compliance Officer');
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/review-queue'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
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

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/transactions/${confirmAction.tx.id}/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmAction.action, reviewer }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.multisig) {
        toast.success(data.message || 'First signature recorded (1/2)');
      } else {
        toast.success(
          confirmAction.action === 'APPROVE' ? 'Payment approved and settled' : 'Payment rejected'
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Approvals"
        description="Flagged payments awaiting human review (payments >= $300 require 2 signatures)"
        actions={
          <Button variant="secondary" size="sm" onClick={fetchQueue}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchQueue} />}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-medium text-[#6B7280]">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Merchant</th>
                <th className="py-2.5 px-4">Agent</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4">Risk</th>
                <th className="py-2.5 px-4">Required Signatures</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td colSpan={7} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No pending approvals"
                      description="All flagged transactions have been reviewed."
                    />
                  </td>
                </tr>
              ) : (
                items.map(tx => (
                  <tr key={tx.id} className="bg-[#F59E0B]/[0.05] hover:bg-[#F59E0B]/[0.09] transition-colors">
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
                      <div className="flex items-center gap-2">
                        <StatusBadge status={tx.status} />
                        <RiskBar score={tx.riskScore} />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono-num text-[#64748B]">
                      {tx.amount >= 300 ? '2 approvers' : '1 approver'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setConfirmAction({ tx, action: 'APPROVE' })}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmAction({ tx, action: 'REJECT' })}
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </Button>
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
            <h3 className="text-base font-semibold text-[#111827]">
              {confirmAction.action === 'APPROVE' ? 'Approve payment?' : 'Reject payment?'}
            </h3>
            <p className="text-sm text-[#6B7280]">
              {confirmAction.tx.merchant} ·{' '}
              <span className="font-mono-num font-medium text-[#111827]">
                {formatCurrency(confirmAction.tx.amount)}
              </span>{' '}
              ({confirmAction.tx.agentId})
            </p>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Reviewer name</label>
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
    </div>
  );
}
