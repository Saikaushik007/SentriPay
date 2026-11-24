import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { useToast } from '../context/ToastContext';

interface Transaction {
  id: string;
  amount: number;
  merchant: string;
  agentId: string;
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  riskScore?: number;
  settlementId?: string;
  createdAt?: string;
  timestamp?: string;
}

interface ReviewQueueProps {
  transactions: Transaction[];
  onInspect: (tx: Transaction) => void;
  onActionComplete?: () => void;
}

export default function ReviewQueue({ transactions, onInspect, onActionComplete }: ReviewQueueProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const toast = useToast();

  const pendingTxs = transactions.filter(t => t.status === 'FLAGGED');

  const handleReview = async (id: string, action: 'APPROVE' | 'REJECT', e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingId(id);
    try {
      const res = await fetch(apiUrl(`/api/transactions/${id}/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reviewer: 'Security Lead',
          note: action === 'APPROVE' ? 'Approved after manual threat verification' : 'Blocked: anomaly signature confirmed'
        })
      });
      if (res.ok) {
        if (action === 'APPROVE') {
          toast.success('Transaction Approved', `Tx ${id.slice(0, 8)} manually approved & dispatched for settlement.`);
        } else {
          toast.warning('Transaction Rejected', `Tx ${id.slice(0, 8)} declined by security reviewer.`);
        }
        onActionComplete?.();
      } else {
        toast.error('Review Action Failed', `Server returned status ${res.status}`);
      }
    } catch (err: any) {
      toast.error('Review Action Error', err?.message || 'Network error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div 
      className="rounded-3xl overflow-hidden mb-8 border"
      style={{
        background: 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 100%)',
        borderColor: '#FDE68A',
        boxShadow: '0 10px 30px -15px rgba(245, 158, 11, 0.22)'
      }}
    >
      {/* Top Header */}
      <div 
        className="p-5 border-b flex items-center justify-between flex-wrap gap-3"
        style={{ borderColor: '#FEF3C7', background: '#FFFDF7' }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: '#FEF3C7', color: '#D97706' }}
          >
            <ShieldAlert size={19} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Review Queue (Flagged Transactions)
              </h3>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                {pendingTxs.length} Pending
              </span>
            </div>
            <p className="text-xs text-gray-500">
              High-risk intents held before x402 settlement awaiting human authorization.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
          Threshold: Risk Score ≥ 80
        </span>
      </div>

      {/* List */}
      <div className="p-4">
        {pendingTxs.length === 0 ? (
          <div className="py-8 text-center text-gray-400 flex flex-col items-center">
            <CheckCircle2 size={28} className="text-emerald-500/40 mb-2" />
            <p className="text-xs font-medium text-gray-600">Review queue is empty</p>
            <p className="text-[11px] text-gray-400 mt-0.5">All flagged autonomous payments have been evaluated.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
            <AnimatePresence>
              {pendingTxs.slice(0, 10).map(tx => {
                const isProcessing = processingId === tx.id;
                return (
                  <motion.div
                    key={tx.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    onClick={() => onInspect(tx)}
                    className="p-3.5 rounded-2xl bg-white border border-gray-200/90 hover:border-amber-300 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between gap-4 flex-wrap"
                  >
                    {/* Left Details */}
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        !
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 truncate">{tx.merchant}</span>
                          <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                            Risk {tx.riskScore ?? 85}/100
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span className="font-mono text-gray-400">{tx.agentId}</span>
                          <span>•</span>
                          <span className="truncate max-w-[240px] text-gray-600" title={tx.reason}>{tx.reason}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Amount & Actions */}
                    <div className="flex items-center gap-4 ml-auto">
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Requested</div>
                        <div className="text-base font-extrabold font-mono text-gray-900">
                          ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => handleReview(tx.id, 'APPROVE', e)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
                          title="Authorize payment and proceed to x402 settlement"
                        >
                          <CheckCircle2 size={13} />
                          Approve
                        </button>

                        <button
                          onClick={e => handleReview(tx.id, 'REJECT', e)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
                          title="Reject payment and enforce policy block"
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}