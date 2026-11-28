import React from 'react';
import { cn } from '../../lib/utils';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export function Card({
  className,
  interactive = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'bg-white border border-[#E5E7EB] rounded-[12px] p-5',
        interactive && 'sp-card-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md';

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium rounded-[10px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap cursor-pointer';
  const sizes: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
  };
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white hover:opacity-95 shadow-sm',
    secondary:
      'bg-white text-[#0F172A] border border-[#E5E7EB] hover:bg-[#F8FAFC]',
    ghost:
      'bg-transparent text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]',
    destructive:
      'bg-[#F43F5E] text-white hover:bg-[#E11D48] shadow-sm',
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED' || s === 'ACTIVE' || s === 'SUCCESS') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#10B981]/10 text-[#059669]">
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        {s === 'APPROVED' ? 'Approved' : s === 'ACTIVE' ? 'Active' : 'Delivered'}
      </span>
    );
  }
  if (s === 'BLOCKED' || s === 'PAUSED' || s === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F43F5E]/10 text-[#E11D48]">
        <XCircle className="w-3 h-3 shrink-0" />
        {s === 'BLOCKED' ? 'Blocked' : s === 'PAUSED' ? 'Paused' : 'Failed'}
      </span>
    );
  }
  if (s === 'FLAGGED' || s === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F59E0B]/10 text-[#D97706]">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        {s === 'FLAGGED' ? 'Flagged' : 'Pending'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#64748B]/10 text-[#64748B]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" />
      {status}
    </span>
  );
}

const AVATAR_PALETTE = [
  'bg-[#4F46E5]/10 text-[#4F46E5]',
  'bg-[#14B8A6]/10 text-[#0D9488]',
  'bg-[#7C3AED]/10 text-[#7C3AED]',
  'bg-[#0F172A]/10 text-[#0F172A]',
];

export function AgentInitials({ agentId, name }: { agentId: string; name?: string }) {
  const src = (name || agentId || 'AG').replace(/^agent-/i, '');
  const letters = src.slice(0, 2).toUpperCase();
  const hash = src.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const color = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-semibold font-mono-num shrink-0',
        color
      )}
    >
      {letters}
    </span>
  );
}

export function RiskBar({ score }: { score?: number | null }) {
  if (score === undefined || score === null) {
    return <span className="text-xs font-mono-num text-[#94A3B8]">—</span>;
  }
  const pct = Math.max(0, Math.min(100, score));
  const barColor =
    pct >= 75 ? '#F43F5E' : pct >= 40 ? '#F59E0B' : '#10B981';
  const textColor =
    pct >= 75 ? 'text-[#E11D48]' : pct >= 40 ? 'text-[#D97706]' : 'text-[#64748B]';
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-14 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className={cn('text-xs font-mono-num font-semibold w-6 text-right', textColor)}>
        {score}
      </span>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-[28px] leading-[36px] font-semibold text-[#0F172A] tracking-[-0.02em]">
          {title}
        </h1>
        <p className="text-[14px] leading-[20px] text-[#64748B] mt-0.5">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton-shimmer rounded-[8px]', className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mb-3"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="48" height="48" rx="14" fill="#F6F7FB" stroke="#E5E7EB" />
        <path
          d="M28 15L18 19.5V27.5C18 33.8 22.25 39.6 28 41.2C33.75 39.6 38 33.8 38 27.5V19.5L28 15Z"
          fill="#EEF2FF"
          stroke="#4F46E5"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M24 28L26.75 30.75L32.5 25"
          stroke="#4F46E5"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
      <p className="text-xs text-[#64748B] mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-[12px] bg-[#F43F5E]/10 border border-[#F43F5E]/25 text-[#E11D48]">
      <div className="text-sm font-medium">{message}</div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </Button>
    </div>
  );
}
