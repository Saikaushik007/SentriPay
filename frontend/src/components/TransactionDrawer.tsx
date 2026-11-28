import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, AlertTriangle, ShieldCheck, 
  Copy, Check, Bot, Store, Code
} from 'lucide-react';

export interface RuleEvaluation {
  rule: string;
  passed: boolean;
  limitValue: string;
  actualValue: string;
  message: string;
}

export interface RiskBreakdownItem {
  factor: string;
  points: number;
  description: string;
}

export interface RuleResults {
  rules: RuleEvaluation[];
  riskBreakdown: RiskBreakdownItem[];
}

export interface TransactionDetail {
  id: string;
  amount: number;
  merchant: string;
  agentId: string;
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  riskScore?: number | null;
  settlementId?: string | null;
  ruleResults?: RuleResults | null;
  createdAt?: string;
  timestamp?: string;
}

interface TransactionDrawerProps {
  transaction: TransactionDetail | null;
  onClose: () => void;
}

export default function TransactionDrawer({ transaction, onClose }: TransactionDrawerProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSettlement, setCopiedSettlement] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  if (!transaction) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(transaction.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopySettlement = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedSettlement(true);
    setTimeout(() => setCopiedSettlement(false), 2000);
  };

  const rules = transaction.ruleResults?.rules || [];
  const riskBreakdown = transaction.ruleResults?.riskBreakdown || [];
  const passedCount = rules.filter(r => r.passed).length;
  const totalRules = rules.length;

  const score = transaction.riskScore ?? 0;
  const riskColor = score >= 75 ? '#F43F5E' : score >= 40 ? '#F59E0B' : '#10B981';
  const riskBg = score >= 75 ? 'rgba(244,63,94,0.08)' : score >= 40 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)';
  const riskLabel = score >= 75 ? 'Elevated Risk' : score >= 40 ? 'Moderate Risk' : 'Low / Safe';

  const txDate = transaction.createdAt || transaction.timestamp || new Date().toISOString();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden"
          style={{ borderLeft: '1px solid #E2E8F0' }}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 bg-white/90 backdrop-blur flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: transaction.status === 'APPROVED' ? '#ECFDF5' : transaction.status === 'BLOCKED' ? '#FFF1F2' : '#FFFBEB',
                    color: transaction.status === 'APPROVED' ? '#059669' : transaction.status === 'BLOCKED' ? '#E11D48' : '#D97706',
                    border: `1px solid ${transaction.status === 'APPROVED' ? '#A7F3D0' : transaction.status === 'BLOCKED' ? '#FECDD3' : '#FDE68A'}`
                  }}>
                  {transaction.status}
                </span>
                <span className="text-xs font-mono text-gray-500">
                  {new Date(txDate).toLocaleString()}
                </span>
              </div>
              <h2 className="text-xl font-bold font-display mt-1 text-gray-900 flex items-center gap-2">
                Decision Explainer
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Main Overview Card */}
            <div 
              className="rounded-2xl p-5 border"
              style={{
                background: transaction.status === 'APPROVED'
                  ? 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)'
                  : transaction.status === 'BLOCKED'
                  ? 'linear-gradient(135deg, #FFF1F2 0%, #FFFFFF 100%)'
                  : 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 100%)',
                borderColor: transaction.status === 'APPROVED' ? '#BBF7D0' : transaction.status === 'BLOCKED' ? '#FECDD3' : '#FDE68A'
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transaction Amount</div>
                  <div className="text-3xl font-extrabold font-mono text-gray-900 mt-0.5">
                    ${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Composite Risk</div>
                  <div className="text-xl font-bold font-mono mt-0.5 flex items-center justify-end gap-1.5" style={{ color: riskColor }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: riskColor }} />
                    {score} / 100
                  </div>
                </div>
              </div>

              {/* Merchant & Agent Strip */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm">
                    <Store size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-400 font-medium">Merchant</div>
                    <div className="text-sm font-semibold text-gray-800 truncate">{transaction.merchant}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm">
                    <Bot size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-400 font-medium">AI Agent</div>
                    <div className="text-sm font-mono font-semibold text-gray-800 truncate">{transaction.agentId}</div>
                  </div>
                </div>
              </div>

              {/* Settlement ID if approved */}
              {transaction.status === 'APPROVED' && transaction.settlementId && (
                <div className="mt-4 p-3 bg-white/80 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">x402 Settlement ID</div>
                      <div className="text-xs font-mono font-semibold text-emerald-700 truncate">{transaction.settlementId}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopySettlement(transaction.settlementId!)}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex-shrink-0"
                    title="Copy Settlement ID"
                  >
                    {copiedSettlement ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}

              {/* Main Decision Reason */}
              <div className="mt-3 text-xs leading-relaxed font-medium p-3 rounded-xl bg-white/60 border border-gray-200/60" style={{ color: '#374151' }}>
                <span className="font-bold text-gray-900">Decision Reason: </span>
                {transaction.reason}
              </div>
            </div>

            {/* Risk Score Breakdown Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <AlertTriangle size={16} style={{ color: riskColor }} />
                  Risk Engine Assessment
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full font-mono"
                  style={{ background: riskBg, color: riskColor }}>
                  {riskLabel}
                </span>
              </div>

              {/* Risk bar meter */}
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mb-4">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, Math.max(8, score))}%`,
                    background: riskColor
                  }}
                />
              </div>

              {/* Risk Factors */}
              <div className="space-y-2">
                {riskBreakdown.length > 0 ? (
                  riskBreakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div>
                        <div className="font-semibold text-gray-800">{item.factor}</div>
                        <div className="text-gray-500 text-[11px] mt-0.5">{item.description}</div>
                      </div>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${item.points > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        +{item.points} pts
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 italic p-2">Standard autonomous transaction parameters assessed.</div>
                )}
              </div>
            </div>

            {/* Rule-by-Rule Evaluation Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-indigo-600" />
                    Policy Enforcement Checks
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Real-time gateway evaluation before settlement</p>
                </div>
                {totalRules > 0 && (
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {passedCount} / {totalRules} Passed
                  </span>
                )}
              </div>

              <div className="relative pl-6 space-y-3 border-l-2 border-[#E5E7EB] ml-2">
                {rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="relative p-3.5 rounded-[12px] border transition-all"
                    style={{
                      background: rule.passed ? '#FFFFFF' : 'rgba(244, 63, 94, 0.04)',
                      borderColor: rule.passed ? '#E5E7EB' : 'rgba(244, 63, 94, 0.25)',
                    }}
                  >
                    {/* Timeline node */}
                    <div
                      className="absolute -left-[33px] top-4 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center"
                      style={{ background: rule.passed ? '#10B981' : '#F43F5E' }}
                    >
                      {rule.passed ? (
                        <Check size={10} className="text-white" strokeWidth={3} />
                      ) : (
                        <X size={10} className="text-white" strokeWidth={3} />
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-[#0F172A]">{rule.rule}</div>
                        <div className="text-xs text-[#64748B] mt-0.5 leading-snug">{rule.message}</div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          rule.passed ? 'bg-[#10B981]/10 text-[#059669]' : 'bg-[#F43F5E]/10 text-[#E11D48]'
                        }`}
                      >
                        {rule.passed ? 'Pass' : 'Fail'}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#E5E7EB]/70 flex items-center justify-between text-xs font-mono-num">
                      <span className="text-[#64748B]">
                        Limit: <strong className="text-[#0F172A]">{rule.limitValue}</strong>
                      </span>
                      <span className={rule.passed ? 'text-[#059669] font-semibold' : 'text-[#E11D48] font-semibold'}>
                        Actual: {rule.actualValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Developer / Raw JSON Drawer Toggle */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="w-full p-4 flex items-center justify-between text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Code size={14} className="text-gray-500" />
                  Inspect Raw Transaction & Rule Payload
                </span>
                <span className="text-xs font-mono text-gray-400">
                  {showRawJson ? 'Hide' : 'Show'}
                </span>
              </button>

              {showRawJson && (
                <div className="p-4 border-t border-gray-200 bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto rounded-b-2xl">
                  <pre>{JSON.stringify(transaction, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-mono text-gray-400 truncate max-w-[200px]">ID: {transaction.id}</span>
              <button
                onClick={handleCopyId}
                className="p-1 hover:text-gray-800 transition-colors"
                title="Copy Transaction ID"
              >
                {copiedId ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              </button>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-gray-900 text-white hover:bg-black transition-colors"
            >
              Close Drawer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}