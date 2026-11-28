import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CheckSquare,
  Bot,
  ShieldCheck,
  Store,
  BarChart3,
  Bell,
  Code2,
  Settings,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  FlaskConical,
  RotateCcw,
  Play,
} from 'lucide-react';
import { apiUrl, socket } from '../lib/api';
import { useTimeRange, type TimeRange } from '../context/TimeRangeContext';
import { Button } from './ui/primitives';
import { useToast } from '../context/ToastContext';

interface LayoutProps {
  children: ReactNode;
  onOpenPalette?: () => void;
}

const SCENARIOS = [
  {
    id: 'compliant',
    title: 'Compliant Payment',
    desc: 'Submits a $45 payment to OpenAI API from Alpha Infrastructure — passes all rules.',
    payload: { amount: 45, merchant: 'OpenAI API', agentId: 'agent-alpha-001' },
  },
  {
    id: 'tx-limit',
    title: 'Per-Tx Limit Breach',
    desc: 'Submits a $1,450 payment to AWS Compute — blocked by the $1,000 per-transaction cap.',
    payload: { amount: 1450, merchant: 'AWS Compute', agentId: 'agent-alpha-001' },
  },
  {
    id: 'denylist',
    title: 'Denylisted Merchant',
    desc: 'Submits a $120 payment to DarkWeb Compute — blocked immediately by merchant denylist.',
    payload: { amount: 120, merchant: 'DarkWeb Compute', agentId: 'agent-beta-002' },
  },
  {
    id: 'high-risk',
    title: 'High-Risk Flagged',
    desc: 'Submits a $680 payment to an unverified merchant — flagged for human approval.',
    payload: { amount: 680, merchant: 'Unknown Cloud Vendor', agentId: 'agent-gamma-003' },
  },
  {
    id: 'velocity',
    title: 'Velocity Burst',
    desc: 'Fires 4 rapid requests in <1s to trigger the 3 tx/sec velocity frequency cap.',
    payload: { amount: 25, merchant: 'Stripe Payments', agentId: 'agent-beta-002', burst: 4 },
  },
];

function SentriPayLogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sp-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <path d="M16 2.5L4.5 7.2V15.4C4.5 22.3 9.4 28.6 16 30C22.6 28.6 27.5 22.3 27.5 15.4V7.2L16 2.5Z" fill="url(#sp-logo-grad)" />
      <path d="M11.2 16.2L14.5 19.5L21.2 12.8" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/approvals': 'Approvals',
  '/agents': 'Agents',
  '/policies': 'Policies',
  '/merchants': 'Merchants',
  '/analytics': 'Analytics',
  '/alerts': 'Alerts',
  '/integrate': 'Integrate',
  '/settings': 'Settings',
};

export default function Layout({ children, onOpenPalette }: LayoutProps) {
  const location = useLocation();
  const toast = useToast();
  const { timeRange, setTimeRange } = useTimeRange();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [connStatus, setConnStatus] = useState<'Connected' | 'Reconnecting' | 'Offline'>('Connected');
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);

  const pageTitle =
    ROUTE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/agents/') ? 'Agent Detail' : 'SentriPay');

  const fetchPending = async () => {
    try {
      const res = await fetch(apiUrl('/api/review-queue'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPendingCount(data.length);
          setRecentAlerts(data.slice(0, 5));
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPending();
    const onConnect = () => setConnStatus('Connected');
    const onDisconnect = () => setConnStatus('Offline');
    const onReconnectAttempt = () => setConnStatus('Reconnecting');
    const onTx = () => fetchPending();

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('new_transaction', onTx);
    socket.on('transaction_updated', onTx);
    socket.on('demo_reset', onTx);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('new_transaction', onTx);
      socket.off('transaction_updated', onTx);
      socket.off('demo_reset', onTx);
    };
  }, []);

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      const res = await fetch(apiUrl('/api/reset-demo'), { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      toast.success('Demo data reset to fresh 24h/7d baseline');
      fetchPending();
    } catch {
      toast.error('Failed to reset demo data');
    } finally {
      setResetting(false);
    }
  };

  const handleRunScenario = async (s: (typeof SCENARIOS)[number]) => {
    setRunningScenario(s.id);
    try {
      const count = (s.payload as any).burst || 1;
      for (let i = 0; i < count; i++) {
        await fetch(apiUrl('/api/payment-intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: s.payload.amount,
            merchant: s.payload.merchant,
            agentId: s.payload.agentId,
          }),
        });
      }
      toast.success(`Scenario "${s.title}" executed`);
      fetchPending();
    } catch {
      toast.error(`Failed to run "${s.title}"`);
    } finally {
      setRunningScenario(null);
    }
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    { to: '/approvals', label: 'Approvals', icon: CheckSquare, badge: pendingCount },
    { to: '/agents', label: 'Agents', icon: Bot },
    { to: '/policies', label: 'Policies', icon: ShieldCheck },
    { to: '/merchants', label: 'Merchants', icon: Store },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/alerts', label: 'Alerts', icon: Bell },
    { to: '/integrate', label: 'Integrate', icon: Code2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path + '/'));

  const sidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-300 border-r border-slate-800">
      {/* Brand */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800/80">
        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 min-w-0"
          onClick={() => isMobile && setMobileOpen(false)}
        >
          <SentriPayLogoMark className="w-7 h-7 shrink-0" />
          {(!collapsed || isMobile) && (
            <span className="font-semibold text-[15px] text-white tracking-tight truncate">
              SentriPay
            </span>
          )}
        </Link>
        {isMobile ? (
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-[8px] text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-[8px] text-slate-400 hover:bg-slate-800 hover:text-white hidden lg:flex"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => isMobile && setMobileOpen(false)}
              title={collapsed && !isMobile ? item.label : undefined}
              className={`relative flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[14px] font-medium transition-colors duration-150 ${
                active
                  ? 'bg-[#4F46E5]/20 text-white'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-gradient-to-b from-[#4F46E5] to-[#7C3AED]" />
              )}
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#818CF8]' : ''}`} />
              {(!collapsed || isMobile) && <span className="flex-1 truncate">{item.label}</span>}
              {(!collapsed || isMobile) && typeof item.badge === 'number' && item.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium rounded-md bg-[#F59E0B]/20 text-[#FBBF24] font-mono-num">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F6F7FB] text-[#0F172A]">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:block shrink-0 transition-all duration-150 ${collapsed ? 'w-16' : 'w-[240px]'}`}>
        <div className="sticky top-0 h-screen">{sidebarContent(false)}</div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-[240px] max-w-[80vw] h-full z-10">{sidebarContent(true)}</div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Slim Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E5E7EB] px-4 lg:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-[8px] text-[#64748B] hover:bg-[#F3F4F6]"
            >
              <Menu className="w-4 h-4" />
            </button>

            <span className="hidden md:inline-block text-sm font-semibold text-[#0F172A] truncate">
              {pageTitle}
            </span>

            <button
              onClick={onOpenPalette}
              className="flex items-center gap-2 h-9 px-3 rounded-[8px] border border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] text-sm w-40 sm:w-56 transition-colors"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">Search…</span>
              <kbd className="hidden sm:inline-block text-xs px-1.5 py-0.5 bg-white border border-[#E5E7EB] rounded text-[#64748B] font-mono-num">
                Ctrl+K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Time range selector */}
            <div className="inline-flex items-center bg-[#F1F5F9] p-0.5 rounded-[8px] border border-[#E5E7EB]">
              {(['1h', '24h', '7d'] as TimeRange[]).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors ${
                    timeRange === r
                      ? 'bg-white text-[#4F46E5] shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Notifications bell */}
            <div className="relative">
              <button
                aria-label="Notifications"
                title="Notifications"
                onClick={() => setNotifOpen(o => !o)}
                className="relative h-9 w-9 rounded-[8px] border border-[#E5E7EB] bg-white flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
              >
                <Bell className="w-4 h-4" />
                {pendingCount > 0 && (
                  <span
                    data-testid="notif-bell-count"
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F43F5E] text-white text-[11px] font-medium font-mono-num flex items-center justify-center"
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-50 p-3">
                  <div className="text-xs font-semibold text-[#0F172A] pb-2 border-b border-[#E5E7EB]">
                    Pending Approvals ({pendingCount})
                  </div>
                  {recentAlerts.length === 0 ? (
                    <p className="text-xs text-[#64748B] py-4 text-center">No pending items</p>
                  ) : (
                    <div className="divide-y divide-[#E5E7EB] max-h-60 overflow-y-auto">
                      {recentAlerts.map(a => (
                        <Link
                          key={a.id}
                          to="/approvals"
                          onClick={() => setNotifOpen(false)}
                          className="block py-2 hover:bg-[#F8FAFC] rounded px-1"
                        >
                          <div className="text-xs font-medium text-[#0F172A]">{a.merchant}</div>
                          <div className="text-xs text-[#64748B] font-mono-num">${Number(a.amount).toFixed(2)}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Demo tools */}
            <Button variant="secondary" size="sm" onClick={() => setDemoOpen(true)}>
              <FlaskConical className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span className="hidden sm:inline">Demo tools</span>
            </Button>

            {/* Live gateway indicator with gently pulsing dot */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[#64748B] pl-1">
              <span className="relative flex h-2 w-2">
                {connStatus === 'Connected' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    connStatus === 'Connected'
                      ? 'bg-[#10B981]'
                      : connStatus === 'Reconnecting'
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#F43F5E]'
                  }`}
                />
              </span>
              <span>{connStatus}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>

      {/* Demo Tools Drawer */}
      {demoOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30" onClick={() => setDemoOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-xl border-l border-[#E5E7EB] z-10 flex flex-col">
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#0F172A]">Demo tools</h2>
                <p className="text-xs text-[#64748B]">Reset seeded data or trigger live payment scenarios</p>
              </div>
              <button
                aria-label="Close demo tools"
                onClick={() => setDemoOpen(false)}
                className="p-1.5 rounded-[8px] text-[#64748B] hover:bg-[#F3F4F6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="p-4 rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#0F172A]">Reset Demo</div>
                  <div className="text-xs text-[#64748B]">
                    Clears transactions and seeds 100 fresh records across 1h, 24h, and 7d.
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={handleResetDemo} disabled={resetting}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resetting ? 'Resetting…' : 'Reset'}
                </Button>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-medium text-[#64748B]">Payment Scenarios</div>
                {SCENARIOS.map(s => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-[12px] border border-[#E5E7EB] bg-white flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-[#0F172A]">{s.title}</div>
                      <div className="text-xs text-[#64748B] mt-0.5">{s.desc}</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={runningScenario === s.id}
                      onClick={() => handleRunScenario(s)}
                    >
                      <Play className="w-3 h-3" />
                      {runningScenario === s.id ? 'Running…' : 'Run'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
