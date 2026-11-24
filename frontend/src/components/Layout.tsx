import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Layers, LayoutDashboard, Shield, Bot, Code, Menu, X } from 'lucide-react';
import { useSocketStatus } from '../lib/api';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const socketStatus = useSocketStatus();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/policies',  label: 'Policies',  icon: Shield },
    { to: '/agents',    label: 'Agents',    icon: Bot },
    { to: '/integrate', label: 'Integrate', icon: Code },
  ];

  return (
    <div className="min-h-screen text-textMain flex flex-col font-sans" style={{ background: 'linear-gradient(135deg, #F5F3FF 0%, #F0F9FF 46%, #F0FDF4 100%)' }}>
      {/* ── Mesh hero background ── */}
      <div
        className="fixed top-0 left-0 right-0 h-[480px] pointer-events-none z-0 mesh-fade"
        style={{ background:
          'radial-gradient(ellipse 80% 60% at 5% -10%, rgba(129,140,248,0.20) 0%, transparent 60%),' +
          'radial-gradient(ellipse 55% 40% at 52% -8%, rgba(244,114,182,0.15) 0%, transparent 55%),' +
          'radial-gradient(ellipse 65% 50% at 98% -8%, rgba(56,189,248,0.18) 0%, transparent 55%)'
        }}
      />

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 h-[68px] flex items-center justify-between px-4 sm:px-8
                         bg-white/80 backdrop-blur-xl border-b border-border/60">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
            <Layers size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-[1.15rem] tracking-tight">
            Sentri
            <span className="bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent">
              Pay
            </span>
          </span>
        </Link>

        {/* Desktop Pill Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-white/70 backdrop-blur-sm border border-border/60 p-1.5 rounded-full shadow-sm">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold
                 transition-all duration-200 select-none ${
                  isActive
                    ? 'bg-gradient-primary text-white shadow-glow-primary'
                    : 'text-textMuted hover:text-textMain hover:bg-gray-100/80'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right side: Real Socket Status Pill & Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold font-mono transition-colors"
            style={{
              background: socketStatus === 'Connected' ? '#ECFDF5' : socketStatus === 'Reconnecting' ? '#FFFBEB' : '#FEF2F2',
              borderColor: socketStatus === 'Connected' ? '#A7F3D0' : socketStatus === 'Reconnecting' ? '#FDE68A' : '#FECACA',
              color: socketStatus === 'Connected' ? '#059669' : socketStatus === 'Reconnecting' ? '#D97706' : '#DC2626'
            }}
          >
            <span className="relative flex h-2 w-2">
              {socketStatus !== 'Offline' && (
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: socketStatus === 'Connected' ? '#10B981' : '#F59E0B' }}
                />
              )}
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{
                  background: socketStatus === 'Connected' ? '#10B981' : socketStatus === 'Reconnecting' ? '#F59E0B' : '#EF4444'
                }}
              />
            </span>
            <span className="hidden sm:inline">
              {socketStatus === 'Connected' ? 'GATEWAY CONNECTED' : socketStatus === 'Reconnecting' ? 'RECONNECTING...' : 'OFFLINE'}
            </span>
            <span className="sm:hidden">
              {socketStatus === 'Connected' ? 'LIVE' : socketStatus === 'Reconnecting' ? 'RETRY' : 'OFF'}
            </span>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-gray-200 bg-white/80 text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-6 py-4 flex flex-col gap-2 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>
      )}

      {/* ── Page content ── */}
      <main className="flex-1 relative z-10 w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
