import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers, LayoutDashboard, Shield, Bot, Code, Menu, X, RefreshCw, Store, BellRing } from 'lucide-react';
import { useSocketStatus } from '../lib/api';
import { useAppTheme } from '../context/ThemeContext';
import { colors, shadows, radii, spacing } from '../theme';

export default function Layout({ children, onOpenPalette }: { children: React.ReactNode; onOpenPalette?: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const socketStatus = useSocketStatus();
  const { currentTheme } = useAppTheme();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/policies',  label: 'Policies',  icon: Shield },
    { to: '/agents',    label: 'Agents',    icon: Bot },
    { to: '/merchants', label: 'Merchants', icon: Store },
    { to: '/alerts',    label: 'Alerts',    icon: BellRing },
    { to: '/integrate', label: 'Integrate', icon: Code },
  ];

  return (
    <div
      className="min-h-screen text-textMain flex flex-col font-sans relative overflow-x-hidden"
      style={{
        background: currentTheme.pageGradient,
      }}
    >
      {/* ── Slowly Drifting Blurred Color Blobs (Lavender, Sky, Mint, Peach) ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Blob 1: Lavender (top-left) */}
        <div
          className="drift-blob-1 absolute rounded-full"
          style={{
            top: '-80px',
            left: '-80px',
            width: '460px',
            height: '460px',
            background: 'radial-gradient(circle, rgba(196,181,253,0.38) 0%, rgba(237,233,254,0.15) 70%, transparent 100%)',
            filter: 'blur(70px)',
          }}
        />

        {/* Blob 2: Sky Blue (top-right) */}
        <div
          className="drift-blob-2 absolute rounded-full"
          style={{
            top: '12%',
            right: '-100px',
            width: '440px',
            height: '440px',
            background: 'radial-gradient(circle, rgba(125,211,252,0.34) 0%, rgba(224,242,254,0.12) 70%, transparent 100%)',
            filter: 'blur(75px)',
          }}
        />

        {/* Blob 3: Mint Green (middle-left) */}
        <div
          className="drift-blob-3 absolute rounded-full"
          style={{
            top: '52%',
            left: '3%',
            width: '420px',
            height: '420px',
            background: 'radial-gradient(circle, rgba(134,239,172,0.30) 0%, rgba(220,252,231,0.12) 70%, transparent 100%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Blob 4: Soft Peach (bottom-right) */}
        <div
          className="drift-blob-4 absolute rounded-full"
          style={{
            bottom: '-60px',
            right: '8%',
            width: '480px',
            height: '480px',
            background: 'radial-gradient(circle, rgba(254,215,170,0.36) 0%, rgba(255,237,213,0.14) 70%, transparent 100%)',
            filter: 'blur(85px)',
          }}
        />
      </div>

      {/* ── Sticky Header ── */}
      <header
        className="sticky top-0 z-50 h-[68px] flex items-center justify-between px-4 sm:px-8 border-b transition-all backdrop-blur-xl"
        style={{
          background: 'rgba(255, 255, 255, 0.82)',
          borderColor: 'rgba(226, 232, 240, 0.7)',
          boxShadow: shadows.sm,
        }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
            style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              boxShadow: shadows.glowPrimary,
              borderRadius: radii.md,
            }}
          >
            <Layers size={16} strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-[1.15rem] tracking-tight">
            Sentri
            <span style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Pay
            </span>
          </span>
        </Link>

        {/* Desktop Pill Nav with Sliding Indicator */}
        <nav
          className="hidden md:flex items-center gap-1 border p-1.5 rounded-full relative"
          style={{
            background: 'rgba(255, 255, 255, 0.72)',
            borderColor: 'rgba(226, 232, 240, 0.7)',
            boxShadow: shadows.sm,
            borderRadius: radii.full,
          }}
        >
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="relative flex items-center gap-2 text-sm font-semibold select-none transition-colors duration-200"
              style={({ isActive }) => ({
                color: isActive ? '#FFFFFF' : colors.textMuted,
                borderRadius: radii.full,
                padding: `${spacing[2]} ${spacing[5]}`,
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                        boxShadow: shadows.glowPrimary,
                        borderRadius: radii.full,
                        zIndex: 0,
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={15} />
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right side: Real Socket Status Pill, ⌘K, Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          {/* ⌘K Command Palette hint */}
          {onOpenPalette && (
            <button
              onClick={onOpenPalette}
              aria-label="Open command palette"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all"
              style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#71717A', cursor: 'pointer' }}
              onMouseOver={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.color = '#4F46E5'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#F4F4F5'; e.currentTarget.style.color = '#71717A'; }}
            >
              <span style={{ fontSize: 11 }}>⌘K</span>
            </button>
          )}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold font-mono transition-colors"
            style={{
              background: socketStatus === 'Connected' ? colors.approved.light : socketStatus === 'Reconnecting' ? colors.flagged.light : colors.blocked.light,
              borderColor: socketStatus === 'Connected' ? colors.approved.border : socketStatus === 'Reconnecting' ? colors.flagged.border : colors.blocked.border,
              color: socketStatus === 'Connected' ? colors.approved.text : socketStatus === 'Reconnecting' ? colors.flagged.text : colors.blocked.text,
              borderRadius: radii.full,
            }}
          >
            <span className="relative flex h-2 w-2">
              {socketStatus !== 'Offline' && (
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: socketStatus === 'Connected' ? colors.approved.base : colors.flagged.base }}
                />
              )}
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{
                  background: socketStatus === 'Connected' ? colors.approved.base : socketStatus === 'Reconnecting' ? colors.flagged.base : colors.blocked.base
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
            style={{ borderRadius: radii.md }}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-6 py-4 flex flex-col gap-2 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200"
          style={{ boxShadow: shadows.md }}
        >
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
              style={{ borderRadius: radii.md }}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>
      )}

      {/* Render cold-start indicator */}
      {(socketStatus === 'Offline' || socketStatus === 'Reconnecting') && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-800 font-medium z-10 relative">
          <RefreshCw size={13} className="animate-spin text-amber-600 shrink-0" />
          <span>Waking up server (Render free tier cold-start ~30s)... The gateway will automatically connect once active.</span>
        </div>
      )}

      {/* ── Page content ── */}
      <main className="flex-1 relative z-10 w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
