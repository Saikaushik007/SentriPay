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
    <div className="flex flex-col h-full bg-white border-r border-[#E5E7EB]">
      {/* Brand */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#E5E7EB]">
        <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0" onClick={() => isMobile && setMobileOpen(false)}>
          <div className="w-8 h-8 rounded-[8px] bg-gradient-to-br from-[#4F46E5] to-[#6366F1] flex items-center justify-center text-white shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          {(!collapsed || isMobile) && (
            <span className="font-semibold text-[15px] text-[#111827] truncate">SentriPay</span>
          )}
        </Link>
        {isMobile ? (
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-[8px] text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-[8px] text-[#6B7280] hover:bg-[#F3F4F6] hidden lg:flex"
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
              className={`flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[14px] font-medium transition-colors duration-150 ${
                active
                  ? 'bg-[#EEF2FF] text-[#4F46E5]'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {(!collapsed || isMobile) && <span className="flex-1 truncate">{item.label}</span>}
              {(!collapsed || isMobile) && typeof item.badge === 'number' && item.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium rounded-md bg-[#FFFBEB] text-[#D97706] font-mono-num">
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
    <div className="min-h-screen flex bg-[#F6F7FB] text-[#111827]">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:block shrink-0 transition-all duration-150 ${collapsed ? 'w-16' : 'w-[240px]'}`}>
        <div className="sticky top-0 h-screen">{sidebarContent(false)}</div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative w-[240px] max-w-[80vw] h-full z-10">{sidebarContent(true)}</div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Slim Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E5E7EB] px-4 lg:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-[8px] text-[#6B7280] hover:bg-[#F3F4F6]"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenPalette}
              className="flex items-center gap-2 h-9 px-3 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] hover:text-[#111827] text-sm w-44 sm:w-64 transition-colors"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">Search…</span>
              <kbd className="hidden sm:inline-block text-xs px-1.5 py-0.5 bg-white border border-[#E5E7EB] rounded text-[#6B7280] font-mono-num">
                Ctrl+K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Time range selector */}
            <div className="inline-flex items-center bg-[#F3F4F6] p-0.5 rounded-[8px] border border-[#E5E7EB]">
              {(['1h', '24h', '7d'] as TimeRange[]).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors ${
                    timeRange === r
                      ? 'bg-white text-[#4F46E5] shadow-sm'
                      : 'text-[#6B7280] hover:text-[#111827]'
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
                className="relative h-9 w-9 rounded-[8px] border border-[#E5E7EB] bg-white flex items-center justify-center text-[#6B7280] hover:text-[#111827]"
              >
                <Bell className="w-4 h-4" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[11px] font-medium flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-50 p-3">
                  <div className="text-xs font-semibold text-[#111827] pb-2 border-b border-[#E5E7EB]">
                    Pending Approvals ({pendingCount})
                  </div>
                  {recentAlerts.length === 0 ? (
                    <p className="text-xs text-[#6B7280] py-4 text-center">No pending items</p>
                  ) : (
                    <div className="divide-y divide-[#E5E7EB] max-h-60 overflow-y-auto">
                      {recentAlerts.map(a => (
                        <Link
                          key={a.id}
                          to="/approvals"
                          onClick={() => setNotifOpen(false)}
                          className="block py-2 hover:bg-[#F9FAFB] rounded px-1"
                        >
                          <div className="text-xs font-medium text-[#111827]">{a.merchant}</div>
                          <div className="text-xs text-[#6B7280] font-mono-num">${Number(a.amount).toFixed(2)}</div>
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

            {/* Connection status dot */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[#6B7280] pl-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  connStatus === 'Connected'
                    ? 'bg-[#059669]'
                    : connStatus === 'Reconnecting'
                    ? 'bg-[#D97706]'
                    : 'bg-[#DC2626]'
                }`}
              />
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
                <h2 className="text-base font-semibold text-[#111827]">Demo tools</h2>
                <p className="text-xs text-[#6B7280]">Reset seeded data or trigger live payment scenarios</p>
              </div>
              <button
                aria-label="Close demo tools"
                onClick={() => setDemoOpen(false)}
                className="p-1.5 rounded-[8px] text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="p-4 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#111827]">Reset Demo</div>
                  <div className="text-xs text-[#6B7280]">
                    Clears transactions and seeds 100 fresh records across 1h, 24h, and 7d.
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={handleResetDemo} disabled={resetting}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  {resetting ? 'Resetting…' : 'Reset'}
                </Button>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-medium text-[#6B7280]">Payment Scenarios</div>
                {SCENARIOS.map(s => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-[12px] border border-[#E5E7EB] bg-white flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-[#111827]">{s.title}</div>
                      <div className="text-xs text-[#6B7280] mt-0.5">{s.desc}</div>
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
