import { NavLink, Link } from 'react-router-dom';
import { Layers, LayoutDashboard, Shield, Bot, Code } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/policies',  label: 'Policies',  icon: Shield },
    { to: '/agents',    label: 'Agents',    icon: Bot },
    { to: '/integrate', label: 'Integrate', icon: Code },
  ];

  return (
    <div className="min-h-screen text-textMain flex flex-col font-sans" style={{ background: 'linear-gradient(135deg, #F5F3FF 0%, #F0F9FF 46%, #F0FDF4 100%)' }}>
      {/* ── Mesh hero background — bleeds only behind the header ── */}
      <div
        className="fixed top-0 left-0 right-0 h-[480px] pointer-events-none z-0 mesh-fade"
        style={{ background:
          'radial-gradient(ellipse 80% 60% at 5% -10%, rgba(129,140,248,0.20) 0%, transparent 60%),' +
          'radial-gradient(ellipse 55% 40% at 52% -8%, rgba(244,114,182,0.15) 0%, transparent 55%),' +
          'radial-gradient(ellipse 65% 50% at 98% -8%, rgba(56,189,248,0.18) 0%, transparent 55%)'
        }}
      />

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 h-[68px] flex items-center justify-between px-8
                         bg-background/75 backdrop-blur-xl border-b border-border/60">
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

        {/* Pill nav */}
        <nav className="flex items-center gap-1 bg-white/70 backdrop-blur-sm border border-border/60 p-1.5 rounded-full shadow-sm">
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

        {/* System Active pill */}
        <div className="flex items-center gap-2.5 bg-successLight text-success
                        px-4 py-2 rounded-full border border-success/20 text-xs font-bold font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          SYSTEM ACTIVE
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 relative z-10">
        {children}
      </main>
    </div>
  );
}
