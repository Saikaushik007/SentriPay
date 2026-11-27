import React from 'react';
import { cn } from '../../lib/utils';
import { RefreshCw } from 'lucide-react';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm p-5',
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
    'inline-flex items-center justify-center gap-1.5 font-medium rounded-[8px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
  const sizes: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
  };
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-[#4F46E5] text-white hover:bg-[#4338CA]',
    secondary: 'bg-white text-[#111827] border border-[#E5E7EB] hover:bg-[#F9FAFB]',
    ghost: 'bg-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]',
    destructive: 'bg-[#DC2626] text-white hover:bg-[#B91C1C]',
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED' || s === 'ACTIVE') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#ECFDF5] text-[#059669]">
        {s === 'APPROVED' ? 'Approved' : 'Active'}
      </span>
    );
  }
  if (s === 'BLOCKED' || s === 'PAUSED' || s === 'FAILED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#FEF2F2] text-[#DC2626]">
        {s === 'BLOCKED' ? 'Blocked' : s === 'PAUSED' ? 'Paused' : 'Failed'}
      </span>
    );
  }
  if (s === 'FLAGGED' || s === 'PENDING') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#FFFBEB] text-[#D97706]">
        {s === 'FLAGGED' ? 'Flagged' : 'Pending'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#F3F4F6] text-[#6B7280]">
      {status}
    </span>
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
        <h1 className="text-[24px] leading-[32px] font-semibold text-[#111827] tracking-tight">
          {title}
        </h1>
        <p className="text-[14px] leading-[20px] text-[#6B7280] mt-0.5">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[8px] bg-[#E5E7EB]/70', className)} />;
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
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      <p className="text-xs text-[#6B7280] mt-1 max-w-sm">{description}</p>
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
    <div className="flex items-center justify-between gap-4 p-4 rounded-[12px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]">
      <div className="text-sm font-medium">{message}</div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </Button>
    </div>
  );
}
