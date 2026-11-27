import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, Activity, DollarSign, Cpu, Banknote,
  Search, X, RotateCcw, CheckCircle2, Download, TrendingUp, FileCheck2,
  CalendarRange, AlertTriangle, FileText, Bell, BellRing, Users,
  BarChart2, ChevronUp, ChevronDown, ArrowRight, Zap
} from 'lucide-react';
import TransactionDrawer from '../components/TransactionDrawer';
import DemoControlsPanel from '../components/DemoControlsPanel';
import ReviewQueue from '../components/ReviewQueue';
import MoneyFlowMap from '../components/MoneyFlowMap';
import RiskHeatmapAndForecast from '../components/RiskHeatmapAndForecast';
import ThemeAndLayoutBar from '../components/ThemeAndLayoutBar';
import TimeTravelReplay from '../components/TimeTravelReplay';
import ConfettiCelebration from '../components/ConfettiCelebration';
import ErrorBoundary from '../components/ErrorBoundary';
import { apiUrl, socket } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────
type Transaction = {
  id: string; amount: number; merchant: string; agentId: string;
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED'; reason: string;
  riskScore?: number; settlementId?: string; ruleResults?: any;
  createdAt?: string; timestamp?: string;
};
type ChartPoint = { time: string; approved: number; blocked: number; flagged: number };
type MerchantStat = { merchant: string; total: number; blocked: number; approved: number; totalSpend: number };
type BudgetInfo = { spent: number; limit: number };
type InsightInfo = { thisWeekSpend: number; lastWeekSpend: number; spendChangePct: number | null; busiestHour: number | null; busiestHourTransactions: number; sampleSize: number };
type Anomaly = { id: string; severity: 'warning' | 'critical'; message: string };
type StatsData = { total: number; approved: number; blocked: number; flagged: number; approvalRate: number; totalSpend: number; range: string };
type RuleHit = { rule: string; count: number };
type AgentInfo = { id: string; name: string; status: string; spentToday: number; dailyBudget: number; approvalRate: string; total: number; approved: number; blocked: number; flagged: number };

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }}
          style={{ position: 'fixed', top: 24, right: 24, zIndex: 50, display: 'flex', alignItems: 'center', gap: 12, color: 'white', padding: '12px 20px', borderRadius: 16, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg,#10B981,#34D399)', boxShadow: '0 4px 24px -4px rgba(16,185,129,0.4)' }}>
          <CheckCircle2 size={18} /> {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Notification Bell ─────────────────────────────────────────────────────────
function NotificationBell({ transactions }: { transactions: Transaction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const recent = transactions.filter(t => t.status === 'BLOCKED' || t.status === 'FLAGGED').slice(0, 6);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        aria-label="Notifications"
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, background: recent.length > 0 ? '#FFF1F2' : '#F4F4F5', border: `1px solid ${recent.length > 0 ? '#FECDD3' : '#E4E4E7'}`, color: recent.length > 0 ? '#E11D48' : '#71717A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .2s' }}>
        {recent.length > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {recent.length > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, background: '#E11D48', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{recent.length}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .96 }}
            style={{ position: 'absolute', right: 0, top: 48, width: 320, background: 'white', border: '1px solid #E4E4E7', borderRadius: 16, boxShadow: '0 20px 60px -16px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F4F4F5', fontWeight: 700, fontSize: 13 }}>Recent Blocks & Flags</div>
            {recent.length === 0 ? (
              <div style={{ padding: 20, fontSize: 13, color: '#71717A', textAlign: 'center' }}>No recent blocks or flags</div>
            ) : recent.map(tx => (
              <div key={tx.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F9FAFB', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ marginTop: 2, width: 8, height: 8, borderRadius: 4, background: tx.status === 'BLOCKED' ? '#E11D48' : '#D97706', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#18181B' }}>{tx.merchant} · <span style={{ fontFamily: 'monospace' }}>${tx.amount.toFixed(2)}</span></div>
                  <div style={{ fontSize: 11, color: '#71717A', marginTop: 2 }}>{tx.reason?.slice(0, 60)}{(tx.reason?.length ?? 0) > 60 ? '…' : ''}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  const area = `M 0,${H} L ${pts.split(' ').map(p => p).join(' L ')} L ${W},${H} Z`;
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Animated Number ───────────────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const start = ref.current;
    const target = value;
    const duration = 800;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
      else ref.current = target;
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{display}</>;
}

// ── Stat Card with Sparkline ──────────────────────────────────────────────────
function StatCard({ value, label, color, icon, sparkData, mono }: {
  value: number | string; label: string; color: string; icon?: React.ReactNode;
  sparkData?: number[]; mono?: boolean;
}) {
  const colorAlpha = color + '18';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}
      whileHover={{ y: -3, boxShadow: `0 20px 40px -8px ${color}30` }}
      style={{ background: 'white', border: `1px solid ${color}22`, borderRadius: 20, padding: '20px 20px 16px', boxShadow: `0 6px 24px -8px ${color}22`, transition: 'all .2s', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, borderRadius: '0 20px 0 80px', background: colorAlpha, opacity: .6 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
          <div style={{ fontFamily: mono ? 'JetBrains Mono, monospace' : 'Outfit, sans-serif', fontSize: 28, fontWeight: 800, color: '#18181B', lineHeight: 1 }}>
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          </div>
        </div>
        {icon && <div style={{ width: 36, height: 36, borderRadius: 10, background: colorAlpha, color, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>{icon}</div>}
      </div>
      {sparkData && sparkData.length >= 2 && (
        <div style={{ marginTop: 10, opacity: .8 }}>
          <Sparkline data={sparkData} color={color} />
        </div>
      )}
    </motion.div>
  );
}

// ── Spend Gauge ───────────────────────────────────────────────────────────────
function SpendGauge({ spent, limit }: { spent: number; limit: number }) {
  const safeSpent = typeof spent === 'number' && isFinite(spent) ? spent : 0;
  const safeLimit = typeof limit === 'number' && isFinite(limit) && limit > 0 ? limit : 500;
  const pct = Math.min((safeSpent / safeLimit) * 100, 100);
  const color = pct > 85 ? '#E11D48' : pct > 65 ? '#D97706' : '#10B981';
  const r = 48, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ * 0.75;
  const gap = circ - dash;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={120} height={96} viewBox="0 0 120 96">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F4F4F5" strokeWidth={10}
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round" />
        <motion.circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${gap + circ * 0.25}`}
          strokeDashoffset={circ * 0.125}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${gap + circ * 0.25}` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" style={{ fill: color, fontSize: 15, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>{pct.toFixed(0)}%</text>
        <text x={cx} y={cy + 12} textAnchor="middle" style={{ fill: '#71717A', fontSize: 9, fontFamily: 'Inter, sans-serif' }}>of budget</text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#18181B' }}>
          ${safeSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span style={{ color: '#A1A1AA', fontWeight: 400 }}>/ ${safeLimit.toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 10, color: '#71717A', marginTop: 2 }}>24h spend vs budget</div>
      </div>
    </div>
  );
}

// ── Agent Leaderboard ─────────────────────────────────────────────────────────
function AgentLeaderboard({ agents }: { agents: AgentInfo[] }) {
  const sorted = [...agents].sort((a, b) => b.spentToday - a.spentToday);
  const maxSpend = sorted[0]?.spentToday || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((ag, i) => {
        const pct = maxSpend > 0 ? (ag.spentToday / maxSpend) * 100 : 0;
        const statusColor = ag.status === 'ACTIVE' ? '#10B981' : '#F43F5E';
        return (
          <div key={ag.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 20, fontSize: 11, fontWeight: 700, color: i === 0 ? '#D97706' : '#A1A1AA', textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#18181B' }}>{ag.name.replace('Alpha ', 'α ').replace('Beta ', 'β ').replace('Gamma ', 'γ ')}</span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#52525B', fontWeight: 700 }}>${ag.spentToday.toFixed(0)}</span>
              </div>
              <div style={{ height: 6, background: '#F4F4F5', borderRadius: 4, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: .8, delay: i * .1 }}
                  style={{ height: '100%', background: `linear-gradient(90deg, ${statusColor}99, ${statusColor})`, borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 10, color: '#71717A' }}>{ag.approvalRate}% approval</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: statusColor }}>{ag.status}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Rule Hits Chart ───────────────────────────────────────────────────────────
function RuleHitsChart({ hits }: { hits: RuleHit[] }) {
  if (!hits.length) return <div style={{ textAlign: 'center', padding: '24px 0', color: '#A1A1AA', fontSize: 13 }}>No blocks or flags in this range</div>;
  const maxCount = Math.max(...hits.map(h => h.count), 1);
  const COLORS = ['#E11D48', '#F43F5E', '#FB7185', '#F87171', '#FCA5A5', '#FECACA', '#FED7D7', '#FFF1F2'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {hits.slice(0, 6).map((h, i) => (
        <div key={h.rule} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 100, fontSize: 10, fontWeight: 600, color: '#52525B', textAlign: 'right', flexShrink: 0, lineHeight: '1.3' }}>{h.rule}</div>
          <div style={{ flex: 1, height: 18, background: '#FFF1F2', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${(h.count / maxCount) * 100}%` }}
              transition={{ duration: .7, delay: i * .08 }}
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: COLORS[i] || '#E11D48', borderRadius: 6 }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#E11D48', width: 24, textAlign: 'right', flexShrink: 0 }}>{h.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Time Range Pills ──────────────────────────────────────────────────────────
function RangePills({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: '#F4F4F5', borderRadius: 10, padding: 3 }}>
      {['1h', '24h', '7d'].map(r => (
        <button key={r} onClick={() => onChange(r)}
          style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s',
            background: value === r ? 'white' : 'transparent',
            color: value === r ? '#4F46E5' : '#71717A',
            boxShadow: value === r ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
          }}>
          {r}
        </button>
      ))}
    </div>
  );
}

// ── Global Search ─────────────────────────────────────────────────────────────
function GlobalSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Search size={14} style={{ position: 'absolute', left: 10, color: '#A1A1AA' }} />
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder="Search transactions…"
        style={{ paddingLeft: 30, paddingRight: value ? 30 : 12, paddingTop: 7, paddingBottom: 7, borderRadius: 10, border: '1px solid #E4E4E7', background: 'white', fontSize: 13, color: '#18181B', outline: 'none', width: 200, transition: 'width .2s' }}
        onFocus={e => { e.currentTarget.style.width = '260px'; e.currentTarget.style.borderColor = '#A5B4FC'; }}
        onBlur={e => { e.currentTarget.style.width = '200px'; e.currentTarget.style.borderColor = '#E4E4E7'; }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#A1A1AA', display: 'flex', alignItems: 'center' }}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ── Sortable Column Header ────────────────────────────────────────────────────
function SortHeader({ label, sortKey, currentKey, dir, onSort }: {
  label: string; sortKey: string; currentKey: string; dir: 'asc' | 'desc'; onSort: (k: string) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <th onClick={() => onSort(sortKey)} style={{ cursor: 'pointer', userSelect: 'none', padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: active ? '#4F46E5' : '#71717A', background: '#FAFAFA', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {active ? (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} style={{ opacity: .3 }} />}
      </span>
    </th>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    APPROVED: { bg: '#ECFDF5', color: '#059669', label: '✓ Approved' },
    BLOCKED: { bg: '#FFF1F2', color: '#E11D48', label: '✕ Blocked' },
    FLAGGED: { bg: '#FFFBEB', color: '#D97706', label: '⚑ Flagged' },
  };
  const c = cfg[status] || { bg: '#F4F4F5', color: '#71717A', label: status };
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{c.label}</span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ArchNode({ icon, label, highlight, dark }: { icon: React.ReactNode; label: string; highlight?: boolean; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}>
      <motion.div whileHover={{ scale: 1.08 }} style={{ width: 52, height: 52, borderRadius: 14, border: highlight ? '2px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.3)', background: highlight ? 'rgba(255,255,255,0.22)' : dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: highlight ? '0 0 32px rgba(255,255,255,0.25)' : 'none' }}>
        {icon}
      </motion.div>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </div>
  );
}

function AnimatedConnector() {
  return (
    <div style={{ flex: 1, height: 2, position: 'relative', overflow: 'hidden', background: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
      <motion.div animate={{ x: ['−100%', '200%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)', borderRadius: 2 }} />
    </div>
  );
}

function DepthOrb() {
  return (
    <motion.div animate={{ rotateY: [0, 360], rotateX: [8, -8, 8], y: [0, -8, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      style={{ position: 'absolute', right: 28, bottom: 12, width: 112, height: 112, borderRadius: 32, background: 'linear-gradient(135deg,rgba(255,255,255,.34),rgba(56,189,248,.12))', border: '1px solid rgba(255,255,255,.35)', boxShadow: 'inset 12px 12px 20px rgba(255,255,255,.16), 16px 18px 35px rgba(20,10,90,.28)', transformStyle: 'preserve-3d', pointerEvents: 'none' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: 20, borderRadius: '50%', border: '2px dashed rgba(255,255,255,.72)' }} />
      <ShieldCheck size={37} style={{ position: 'absolute', left: 37, top: 37 }} />
    </motion.div>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 208, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#A1A1AA', gap: 8 }}>
      <Activity size={28} style={{ opacity: .2 }} />
      <p style={{ fontSize: 13, fontWeight: 600 }}>No transaction data yet</p>
      <p style={{ fontSize: 12 }}>Run the demo agent to start seeing data here</p>
    </div>
  );
}

function ActivityTicker({ transactions }: { transactions: Transaction[] }) {
  const items = transactions.slice(0, 5);
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 20, overflow: 'hidden', borderRadius: 16, padding: '10px 16px', background: 'linear-gradient(90deg,#EEF2FF,#FDF2F8,#ECFEFF)', border: '1px solid #DDD6FE' }}>
      <motion.div style={{ display: 'flex', gap: 32, whiteSpace: 'nowrap', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
        animate={{ x: [0, -24, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>
        <span style={{ color: '#4F46E5', fontWeight: 800 }}>LIVE ACTIVITY</span>
        {items.map(tx => (
          <span key={tx.id} style={{ color: tx.status === 'APPROVED' ? '#059669' : tx.status === 'BLOCKED' ? '#E11D48' : '#D97706' }}>
            {tx.status} · ${tx.amount.toFixed(2)} · {tx.merchant}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function AnomalyBanner({ alerts, onDismiss }: { alerts: Anomaly[]; onDismiss: (id: string) => void }) {
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [alerts.length]);
  useEffect(() => {
    if (alerts.length < 2) return;
    const timer = window.setInterval(() => setIndex(c => (c + 1) % alerts.length), 5000);
    return () => window.clearInterval(timer);
  }, [alerts.length]);
  const alert = alerts[index];
  return (
    <AnimatePresence mode="wait">
      {alert && (
        <motion.div key={alert.id} initial={{ opacity: 0, height: 0, y: -12 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -12 }} transition={{ duration: .3 }} style={{ marginBottom: 20, overflow: 'hidden', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', color: 'white', background: alert.severity === 'critical' ? 'linear-gradient(100deg,#F59E0B,#F43F5E)' : 'linear-gradient(100deg,#F59E0B,#FB7185)', boxShadow: '0 12px 28px -18px rgba(244,63,94,.7)' }}>
            <AlertTriangle size={20} />
            <p style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{alert.message}</p>
            {alerts.length > 1 && <span style={{ fontSize: 12, fontFamily: 'monospace', opacity: .8 }}>{index + 1}/{alerts.length}</span>}
            <button aria-label="Dismiss anomaly alert" onClick={() => onDismiss(alert.id)} style={{ padding: 4, borderRadius: 8, background: 'rgba(255,255,255,.15)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type ComplianceReportData = {
  range: { start: string; end: string };
  summary: { total: number; approved: number; blocked: number; flagged: number };
  blockReasons: { reason: string; count: number }[];
  policyChanges: { id: string; action: string; detail: string; createdAt: string }[];
};

function ComplianceReport() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [start, setStart] = useState(weekAgo);
  const [end, setEnd] = useState(today);
  const [report, setReport] = useState<ComplianceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(apiUrl(`/api/compliance-report?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`));
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      setReport(await res.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to generate report.'); }
    finally { setLoading(false); }
  };

  const download = () => {
    if (!report) return;
    const rows = [
      ['Metric', 'Value'], ['Range', `${start} to ${end}`],
      ['Total processed', report.summary.total], ['Approved', report.summary.approved],
      ['Blocked', report.summary.blocked], ['Flagged', report.summary.flagged],
      [], ['Block reason', 'Count'], ...report.blockReasons.map(x => [x.reason, x.count]),
      [], ['Policy change', 'Occurred at'], ...report.policyChanges.map(x => [x.detail, x.createdAt])
    ];
    const csv = rows.map(row => row.map(v => JSON.stringify(v ?? '')).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `sentripay-compliance-${start}-to-${end}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (!report) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Popup blocked. Please allow popups to export PDF report.');
    const html = `<!DOCTYPE html><html><head><title>SentriPay Compliance (${start} to ${end})</title><style>body{font-family:system-ui,sans-serif;padding:40px;color:#18181B}.title{font-size:24px;font-weight:800;color:#1E1B4B}.meta{font-size:12px;font-family:monospace;color:#475569;margin-top:8px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}.card{padding:16px;border-radius:10px;border:1px solid #E2E8F0;background:#F8FAFC}.cv{font-size:22px;font-weight:800;font-family:monospace}.cl{font-size:11px;text-transform:uppercase;color:#64748B;margin-top:4px}table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px}th{text-align:left;padding:10px;background:#F1F5F9;border-bottom:2px solid #CBD5E1}td{padding:10px;border-bottom:1px solid #E2E8F0}.footer{font-size:11px;color:#94A3B8;text-align:center;border-top:1px solid #E2E8F0;padding-top:16px;margin-top:32px}</style></head><body>
      <div class="title">SentriPay Compliance Report</div><div class="meta">Period: ${start} to ${end} | Generated: ${new Date().toISOString()}</div>
      <div class="grid"><div class="card"><div class="cv" style="color:#4F46E5">${report.summary.total}</div><div class="cl">Total</div></div><div class="card"><div class="cv" style="color:#059669">${report.summary.approved}</div><div class="cl">Approved</div></div><div class="card"><div class="cv" style="color:#E11D48">${report.summary.blocked}</div><div class="cl">Blocked</div></div><div class="card"><div class="cv" style="color:#D97706">${report.summary.flagged}</div><div class="cl">Flagged</div></div></div>
      <h3>Block Reasons</h3><table><thead><tr><th>Reason</th><th>Count</th></tr></thead><tbody>${report.blockReasons.map(r => `<tr><td>${r.reason}</td><td><b>${r.count}</b></td></tr>`).join('') || '<tr><td colspan="2">None</td></tr>'}</tbody></table>
      <h3>Policy Changes</h3><table><thead><tr><th>Detail</th><th>Timestamp</th></tr></thead><tbody>${report.policyChanges.map(c => `<tr><td>${c.detail}</td><td>${new Date(c.createdAt).toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="2">None</td></tr>'}</tbody></table>
      <div class="footer">SentriPay Gateway Enforcement Engine</div><script>window.onload=function(){window.print()}</script></body></html>`;
    printWindow.document.write(html); printWindow.document.close();
  };

  const maxReason = Math.max(...(report?.blockReasons.map(x => x.count) || [1]), 1);

  return (
    <section style={{ marginTop: 32, borderRadius: 24, padding: '32px', background: 'linear-gradient(135deg,#FFF1F2,#FFF7ED,#FFFFFF)', border: '1px solid #FECDD3', boxShadow: '0 20px 50px -28px rgba(244,63,94,0.3)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFE4E6', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -8px rgba(225,29,72,.6)' }}><FileCheck2 size={20} /></div>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#18181B' }}>Compliance Report</h2>
          </div>
          <p style={{ marginTop: 8, fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', color: '#BE123C', fontSize: 14 }}>A traceable story of every decision, drawn from the ledger.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.78)', border: '1px solid #FECDD3', borderRadius: 24, padding: '8px 12px' }}>
          <CalendarRange size={15} style={{ color: '#E11D48' }} />
          <input aria-label="Report start date" type="date" value={start} max={end} onChange={e => setStart(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: 12, fontFamily: 'monospace', color: '#18181B', outline: 'none' }} />
          <span style={{ color: '#A1A1AA' }}>→</span>
          <input aria-label="Report end date" type="date" value={end} min={start} max={today} onChange={e => setEnd(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: 12, fontFamily: 'monospace', color: '#18181B', outline: 'none' }} />
          <button onClick={generate} disabled={loading} style={{ padding: '8px 20px', borderRadius: 24, fontSize: 13, fontWeight: 700, color: 'white', background: '#18181B', border: 'none', cursor: 'pointer', opacity: loading ? .6 : 1 }}>{loading ? 'Generating…' : 'Generate'}</button>
          {report && <>
            <button onClick={download} style={{ padding: '8px 16px', borderRadius: 24, fontSize: 12, fontWeight: 600, background: 'white', border: '1px solid #FDA4AF', color: '#BE123C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Download size={13} />CSV</button>
            <button onClick={downloadPdf} style={{ padding: '8px 16px', borderRadius: 24, fontSize: 12, fontWeight: 600, background: 'white', border: '1px solid #C7D2FE', color: '#4F46E5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={13} />PDF</button>
          </>}
        </div>
      </div>
      {error && <p style={{ color: '#E11D48', fontSize: 13, marginBottom: 16 }}>{error}</p>}
      {report && (
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 16 }}>
            {[['Processed', report.summary.total, '#9F1239'], ['Approved', report.summary.approved, '#059669'], ['Blocked', report.summary.blocked, '#E11D48'], ['Flagged', report.summary.flagged, '#D97706']].map(([label, value, color]) => (
              <div key={String(label)} style={{ borderRadius: 16, padding: 20, background: 'rgba(255,255,255,.8)', border: `1px solid ${color}30` }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 800, color: String(color) }}><AnimatedNumber value={Number(value)} /></div>
                <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717A' }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            <div style={{ borderRadius: 16, padding: 20, background: 'rgba(255,255,255,.78)', border: '1px solid #FECDD3' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, marginBottom: 20 }}>Block-reason breakdown</h3>
              {report.blockReasons.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {report.blockReasons.map(item => (
                    <div key={item.reason}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                        <span style={{ color: '#52525B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{item.reason}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#E11D48' }}>{item.count}</span>
                      </div>
                      <div style={{ height: 10, background: '#FFE4E6', borderRadius: 6, overflow: 'hidden' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(item.count / maxReason) * 100}%` }} transition={{ duration: .75 }}
                          style={{ height: '100%', background: 'linear-gradient(90deg,#F43F5E,#F472B6)', borderRadius: 6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ fontSize: 13, color: '#71717A' }}>No blocked payments in this range.</p>}
            </div>
            <div style={{ borderRadius: 16, padding: 20, background: 'rgba(255,255,255,.78)', border: '1px solid #FED7AA' }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, marginBottom: 20 }}>Policy changes in range</h3>
              {report.policyChanges.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {report.policyChanges.map((item, i) => (
                    <div key={item.id} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ width: 12, height: 12, borderRadius: 6, background: item.action === 'DEMO_RESET' ? '#F59E0B' : '#7C3AED', flexShrink: 0 }} />
                        {i < report.policyChanges.length - 1 && <span style={{ width: 1, flex: 1, background: '#FED7AA', marginTop: 4 }} />}
                      </div>
                      <div style={{ paddingBottom: 8 }}>
                        <p style={{ fontSize: 13, color: '#27272A' }}>{item.detail}</p>
                        <p style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 4, color: '#A1A1AA' }}>{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ fontSize: 13, color: '#71717A' }}>No policy changes recorded.</p>}
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [, setMerchants] = useState<MerchantStat[]>([]); const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [insights, setInsights] = useState<InsightInfo | null>(null);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Stage 6: Personal Dashboard Layout state (persisted to localStorage)
  const DEFAULT_LAYOUT = ['flowMap', 'heatmap', 'volumeChart'];
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sentripay_widget_order');
      return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
    } catch {
      return DEFAULT_LAYOUT;
    }
  });

  const handleReorder = (newOrder: string[]) => {
    setWidgetOrder(newOrder);
    localStorage.setItem('sentripay_widget_order', JSON.stringify(newOrder));
  };

  const handleResetLayout = () => {
    setWidgetOrder(DEFAULT_LAYOUT);
    localStorage.removeItem('sentripay_widget_order');
  };

  // Stage 7: Time-Travel Replay State
  const [replayTransactions, setReplayTransactions] = useState<Transaction[] | null>(null);
  const activeTransactions = replayTransactions || transactions;

  // Phase I state
  const [timeRange, setTimeRange] = useState('24h');
  const [globalSearch, setGlobalSearch] = useState('');
  const [rangeStats, setRangeStats] = useState<StatsData | null>(null);
  const [ruleHits, setRuleHits] = useState<RuleHit[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  // Transaction table state
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterAgent, setFilterAgent] = useState('ALL');
  const [filterMerchant, setFilterMerchant] = useState('');
  const [filterMin, setFilterMin] = useState('');
  const [filterMax, setFilterMax] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchAll = useCallback(async () => {
    setFetchError(null);
    try {
      // Use allSettled so one failing route doesn't blank the whole dashboard
      const safeJson = async (url: string) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      };
      const [txRes, chartRes, merchantRes, budgetRes, insightsRes, agentsRes] = await Promise.allSettled([
        safeJson(apiUrl(`/api/transactions?range=${timeRange}`)),
        safeJson(apiUrl(`/api/transactions/chart?range=${timeRange}`)),
        safeJson(apiUrl(`/api/transactions/merchants?range=${timeRange}`)),
        safeJson(apiUrl('/api/transactions/budget')),
        safeJson(apiUrl('/api/insights')),
        safeJson(apiUrl('/api/agents')),
      ]);
      if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) setTransactions(txRes.value);
      if (chartRes.status === 'fulfilled' && Array.isArray(chartRes.value)) setChartData(chartRes.value);
      if (merchantRes.status === 'fulfilled' && Array.isArray(merchantRes.value)) setMerchants(merchantRes.value);
      if (budgetRes.status === 'fulfilled' && budgetRes.value?.limit != null) setBudget(budgetRes.value);
      if (insightsRes.status === 'fulfilled') setInsights(insightsRes.value);
      if (agentsRes.status === 'fulfilled' && Array.isArray(agentsRes.value)) setAgents(agentsRes.value);

      // Surface partial errors (non-critical)
      const failed = [txRes, chartRes, merchantRes, budgetRes, insightsRes, agentsRes]
        .filter(r => r.status === 'rejected')
        .map(r => (r as PromiseRejectedResult).reason?.message);
      if (failed.length === 6) setFetchError('All dashboard routes failed — check backend');
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to fetch dashboard data');
    } finally { setIsLoading(false); }
  }, []);

  const fetchRangeData = useCallback(async (range: string) => {
    try {
      const [stats, hits] = await Promise.all([
        fetch(apiUrl(`/api/transactions/stats?range=${range}`)).then(r => r.json()),
        fetch(apiUrl(`/api/transactions/rule-hits?range=${range}`)).then(r => r.json()),
      ]);
      setRangeStats(stats);
      setRuleHits(hits.hits || []);
    } catch (e) { console.error(e); }
  }, []);

  const refreshAnomalies = useCallback(() =>
    fetch(apiUrl('/api/anomalies')).then(r => r.json()).then(d => setAnomalies(d.alerts || [])).catch(console.error), []);

  useEffect(() => {
    fetchAll();
    fetchRangeData(timeRange);
    refreshAnomalies();
    const onNewTx = (tx: Transaction) => {
      setTransactions(prev => [tx, ...prev].slice(0, 150));
      setLiveIds(prev => new Set([...prev, tx.id]));
      if (tx.status === 'APPROVED') {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2000);
      }
      fetch(apiUrl('/api/transactions/chart')).then(r => r.json()).then(setChartData).catch(console.error);
      fetch(apiUrl('/api/transactions/budget')).then(r => r.json()).then(setBudget).catch(console.error);
      refreshAnomalies();
    };
    const onDemoReset = () => {
      fetchAll();
      fetchRangeData(timeRange);
      setLiveIds(new Set());
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    };
    const onTxUpdated = (updated: Transaction) => {
      setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
      fetch(apiUrl('/api/transactions/budget')).then(r => r.json()).then(setBudget).catch(console.error);
    };
    socket.on('new_transaction', onNewTx);
    socket.on('demo_reset', onDemoReset);
    socket.on('transaction_updated', onTxUpdated);
    const anomalyInterval = window.setInterval(refreshAnomalies, 45000);
    return () => {
      socket.off('new_transaction', onNewTx);
      socket.off('demo_reset', onDemoReset);
      socket.off('transaction_updated', onTxUpdated);
      window.clearInterval(anomalyInterval);
    };
  }, []);

  useEffect(() => { fetchRangeData(timeRange); }, [timeRange]);

  const handleSort = useCallback((key: string) => {
    setSortDir(d => key === sortKey ? (d === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortKey(key);
    setPage(1);
  }, [sortKey]);

  const filteredTxs = useMemo(() => {
    let arr = [...transactions];
    if (globalSearch) {
      const q = globalSearch.toLowerCase();
      arr = arr.filter(tx => tx.merchant.toLowerCase().includes(q) || tx.agentId.toLowerCase().includes(q) || tx.status.toLowerCase().includes(q) || tx.reason?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'ALL') arr = arr.filter(tx => tx.status === filterStatus);
    if (filterAgent !== 'ALL') arr = arr.filter(tx => tx.agentId === filterAgent);
    if (filterMerchant) arr = arr.filter(tx => tx.merchant.toLowerCase().includes(filterMerchant.toLowerCase()));
    if (filterMin) arr = arr.filter(tx => tx.amount >= parseFloat(filterMin));
    if (filterMax) arr = arr.filter(tx => tx.amount <= parseFloat(filterMax));
    arr.sort((a, b) => {
      let va: any = a[sortKey as keyof Transaction];
      let vb: any = b[sortKey as keyof Transaction];
      if (sortKey === 'createdAt' || sortKey === 'timestamp') {
        va = new Date(va || 0).getTime();
        vb = new Date(vb || 0).getTime();
      }
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [transactions, globalSearch, filterStatus, filterAgent, filterMerchant, filterMin, filterMax, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / PAGE_SIZE));
  const pagedTxs = filteredTxs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportTransactions = async () => {
    try {
      const rows: Transaction[] = await fetch(apiUrl('/api/transactions/export')).then(r => r.json());
      const header = ['id', 'createdAt', 'agentId', 'merchant', 'amount', 'status', 'riskScore', 'settlementId', 'reason'];
      const csv = [header, ...rows.map(row => header.map(key => JSON.stringify((row as any)[key] ?? '')))].map(row => row.join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `sentripay-transactions-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('Export failed:', e); }
  };

  // Derive sparkline-like data from chart
  const sparkApproved = chartData.slice(-7).map(d => d.approved);
  const sparkBlocked = chartData.slice(-7).map(d => d.blocked); // approx

  const totalTxs = rangeStats?.total ?? transactions.length;
  const blockedTxs = rangeStats?.blocked ?? transactions.filter(t => t.status === 'BLOCKED').length;
  const approvalRate = rangeStats?.approvalRate ?? (totalTxs > 0 ? parseFloat(((transactions.filter(t => t.status === 'APPROVED').length / totalTxs) * 100).toFixed(1)) : 0);
  const dailySpend = rangeStats?.totalSpend ?? (budget?.spent || 0);

  const uniqueAgentIds = [...new Set(transactions.map(t => t.agentId))];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1440, margin: '0 auto', width: '100%' }}>
      <ConfettiCelebration trigger={confetti} />
      {/* Activity Ticker */}
      <ActivityTicker transactions={transactions} />
      <AnomalyBanner alerts={anomalies.filter(a => !dismissedAnomalies.has(a.id))} onDismiss={id => setDismissedAnomalies(prev => new Set([...prev, id]))} />
      <Toast msg="✓ Demo data reset — 110 baseline records loaded" visible={toast} />

      {/* Sticky Top Bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', borderRadius: 20, padding: '12px 20px', marginBottom: 24, border: '1px solid rgba(229,231,235,0.7)', boxShadow: '0 4px 24px -8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 22, color: '#18181B', margin: 0 }}>Overview</h1>
          <p style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', color: '#7C3AED', fontSize: 13, margin: 0 }}>Every autonomous payment, kept intentionally in bounds.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <GlobalSearch value={globalSearch} onChange={v => { setGlobalSearch(v); setPage(1); }} />
          <RangePills value={timeRange} onChange={setTimeRange} />
          <NotificationBell transactions={transactions} />
          <button onClick={exportTransactions}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 24, fontSize: 13, fontWeight: 600, background: 'white', border: '1px solid #D8D4FE', color: '#4F46E5', boxShadow: '0 4px 14px -5px rgba(79,70,229,0.25)', cursor: 'pointer', transition: 'all .2s' }}
            onMouseOver={e => { e.currentTarget.style.background = '#F5F3FF'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'white'; }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={{ marginBottom: 24, padding: 16, borderRadius: 16, background: '#FFF1F2', border: '1px solid #FECDD3', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}><AlertTriangle size={18} />{fetchError}</div>
          <button onClick={fetchAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: '#E11D48', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <RotateCcw size={12} />Retry
          </button>
        </div>
      )}

      {/* ── BENTO GRID: Stat Row ── */}
      {isLoading && transactions.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 20, marginBottom: 32 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 120, borderRadius: 20, background: 'white', border: '1px solid #F4F4F5' }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 20, marginBottom: 32 }}>
          <StatCard value={totalTxs} label="Processed" color="#4F46E5" icon={<Activity size={18} />} sparkData={sparkApproved} />
          <StatCard value={blockedTxs} label="Blocked" color="#E11D48" icon={<ShieldAlert size={18} />} sparkData={sparkBlocked} />
          <StatCard value={`${approvalRate}%`} label="Approval Rate" color="#10B981" icon={<CheckCircle2 size={18} />} />
          <StatCard value={`$${dailySpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} label={`${timeRange} Spend`} color="#7C3AED" icon={<DollarSign size={18} />} mono />
        </div>
      )}

      {/* Stage 6: Theme Picker & Personal Dashboard Reorder Bar */}
      <ThemeAndLayoutBar
        widgetOrder={widgetOrder}
        onReorder={handleReorder}
        onResetLayout={handleResetLayout}
      />

      {/* Stage 7: Time-Travel Replay Slider */}
      <TimeTravelReplay
        transactions={transactions}
        onReplaySliceChange={setReplayTransactions}
      />

      {/* ── BENTO GRID: Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, marginBottom: 32 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Hero: Sentinel Architecture */}
          <div style={{ borderRadius: 24, padding: 32, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)', boxShadow: '0 8px 40px -8px rgba(79,70,229,0.45)', color: 'white' }}>
            <DepthOrb />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4, color: 'rgba(255,255,255,0.6)' }}>x402 Protocol</div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 24, margin: '0 0 6px' }}>Sentinel Architecture</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Real-time interception and policy enforcement gateway</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: 400, marginTop: 24, position: 'relative', zIndex: 1 }}>
              <ArchNode icon={<Cpu size={20} />} label="AI Agent" dark />
              <AnimatedConnector />
              <ArchNode icon={<ShieldCheck size={22} />} label="Policy Engine" highlight />
              <AnimatedConnector />
              <ArchNode icon={<Banknote size={20} />} label="Settlement" dark />
            </div>
          </div>

          {/* Ordered Dynamic Dashboard Widgets */}
          {widgetOrder.map(wid => {
            if (wid === 'flowMap') {
              return (
                <div key="flowMap">
                  <ErrorBoundary label="Money flow map">
                    <MoneyFlowMap onSelectTx={(id) => {
                      const found = transactions.find(t => t.id === id);
                      if (found) setSelectedTx(found);
                    }} />
                  </ErrorBoundary>
                </div>
              );
            }
            if (wid === 'heatmap') {
              return (
                <div key="heatmap">
                  <ErrorBoundary label="Risk heatmap">
                    <RiskHeatmapAndForecast />
                  </ErrorBoundary>
                </div>
              );
            }
            if (wid === 'volumeChart') {
              return (
                <div key="volumeChart" style={{ borderRadius: 20, padding: 24, background: 'linear-gradient(135deg,#F0F9FF,#FFFFFF)', border: '1px solid #BAE6FD', boxShadow: '0 8px 24px -14px rgba(14,165,233,0.28)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F0F9FF', color: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px -2px rgba(14,165,233,0.3)' }}><Activity size={16} /></div>
                      <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16, margin: 0 }}>Transaction Volume</h3>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#71717A' }}>Last {chartData.length} transactions</span>
                  </div>
                  {chartData.length === 0 ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34D399" /><stop offset="100%" stopColor="#10B981" /></linearGradient>
                          <linearGradient id="cF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FCD34D" /><stop offset="100%" stopColor="#F59E0B" /></linearGradient>
                          <linearGradient id="cB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FB7185" /><stop offset="100%" stopColor="#F43F5E" /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#71717A' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#71717A' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E4E4E7', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} formatter={(val: any) => [`$${Number(val).toFixed(2)}`, undefined]} />
                        <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Inter, sans-serif', paddingTop: 10 }} />
                        <Bar dataKey="approved" stackId="a" fill="url(#cA)" name="Approved" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="flagged" stackId="a" fill="url(#cF)" name="Flagged" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="blocked" stackId="a" fill="url(#cB)" name="Blocked" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              );
            }
            return null;
          })}

          {/* Demo Controls */}
          <DemoControlsPanel onDataChanged={() => { fetchAll(); fetchRangeData(timeRange); }} />
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Spend Gauge */}
          <div style={{ borderRadius: 20, padding: 24, background: 'linear-gradient(135deg,#FFF7ED,#FFFFFF)', border: '1px solid #FED7AA', boxShadow: '0 8px 24px -14px rgba(234,88,12,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF7ED', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={14} /></div>
              <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>Budget Usage</span>
            </div>
            <ErrorBoundary label="Budget gauge">
              {budget ? <SpendGauge spent={budget.spent} limit={budget.limit} /> : (
                <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A1A1AA', fontSize: 13 }}>Loading…</div>
              )}
            </ErrorBoundary>
          </div>

          {/* Agent Leaderboard */}
          <div style={{ borderRadius: 20, padding: 20, background: 'linear-gradient(135deg,#F5F3FF,#FFFFFF)', border: '1px solid #DDD6FE', boxShadow: '0 8px 24px -14px rgba(124,58,237,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} /></div>
              <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>Agent Leaderboard</span>
            </div>
            {agents.length > 0 ? (
              <AgentLeaderboard agents={agents} />
            ) : (
              <div style={{ textAlign: 'center', color: '#A1A1AA', fontSize: 13, padding: '16px 0' }}>No agents loaded</div>
            )}
          </div>

          {/* Top Rules Triggered */}
          <div style={{ borderRadius: 20, padding: 20, background: 'linear-gradient(135deg,#FFF1F2,#FFFFFF)', border: '1px solid #FECDD3', boxShadow: '0 8px 24px -14px rgba(225,29,72,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF1F2', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart2 size={14} /></div>
                <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'Outfit, sans-serif' }}>Top Rules Triggered</span>
              </div>
              <span style={{ fontSize: 10, color: '#A1A1AA', fontFamily: 'monospace' }}>{timeRange}</span>
            </div>
            <RuleHitsChart hits={ruleHits} />
          </div>

          {/* Live Intelligence */}
          {insights && (
            <div style={{ borderRadius: 20, padding: 20, background: 'linear-gradient(135deg,#ECFDF5,#EFF6FF)', border: '1px solid #A7F3D0', boxShadow: '0 10px 24px -18px rgba(5,150,105,.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#047857', marginBottom: 16 }}>
                <TrendingUp size={16} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Live Intelligence</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>7d vs prev week</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 20, color: insights.spendChangePct !== null && insights.spendChangePct > 0 ? '#D97706' : '#059669' }}>
                    {insights.spendChangePct === null ? '—' : `${insights.spendChangePct >= 0 ? '+' : ''}${insights.spendChangePct.toFixed(1)}%`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>Busiest hour</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 20, color: '#2563EB' }}>
                    {insights.busiestHour === null ? '—' : `${String(insights.busiestHour).padStart(2, '0')}:00`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Queue */}
      <ReviewQueue transactions={activeTransactions} onInspect={setSelectedTx} onActionComplete={fetchAll} />

      {/* ── Live Feed: Sortable, Paginated, Filtered ── */}
      <div style={{ background: 'white', borderRadius: 24, border: '1px solid #E4E4E7', boxShadow: '0 8px 32px -12px rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: 24 }}>
        {/* Feed header + filters */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={16} /></div>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16 }}>Live Feed</span>
            <span style={{ background: '#F4F4F5', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#71717A' }}>{filteredTxs.length} records</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Status filter */}
            <div style={{ display: 'flex', gap: 2, background: '#F9FAFB', border: '1px solid #E4E4E7', borderRadius: 10, padding: 3 }}>
              {['ALL', 'APPROVED', 'BLOCKED', 'FLAGGED'].map(s => (
                <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                  style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all .15s',
                    background: filterStatus === s ? '#4F46E5' : 'transparent',
                    color: filterStatus === s ? 'white' : '#71717A'
                  }}>
                  {s}
                </button>
              ))}
            </div>
            {/* Agent filter */}
            <select value={filterAgent} onChange={e => { setFilterAgent(e.target.value); setPage(1); }}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E4E4E7', fontSize: 12, color: '#52525B', background: 'white', cursor: 'pointer' }}>
              <option value="ALL">All Agents</option>
              {uniqueAgentIds.map(id => <option key={id} value={id}>{id.replace('agent-', '').replace(/-\d+$/, '').replace('-', ' ').toUpperCase()}</option>)}
            </select>
            {/* Merchant search */}
            <input value={filterMerchant} onChange={e => { setFilterMerchant(e.target.value); setPage(1); }}
              placeholder="Merchant…" style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E4E4E7', fontSize: 12, width: 100, color: '#18181B', outline: 'none' }} />
            {/* Amount range */}
            <input value={filterMin} onChange={e => { setFilterMin(e.target.value); setPage(1); }}
              placeholder="Min $" style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid #E4E4E7', fontSize: 12, width: 64, color: '#18181B', outline: 'none' }} />
            <input value={filterMax} onChange={e => { setFilterMax(e.target.value); setPage(1); }}
              placeholder="Max $" style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid #E4E4E7', fontSize: 12, width: 64, color: '#18181B', outline: 'none' }} />
            {/* Reset filters */}
            {(filterStatus !== 'ALL' || filterAgent !== 'ALL' || filterMerchant || filterMin || filterMax || globalSearch) && (
              <button onClick={() => { setFilterStatus('ALL'); setFilterAgent('ALL'); setFilterMerchant(''); setFilterMin(''); setFilterMax(''); setGlobalSearch(''); setPage(1); }}
                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E4E4E7', background: 'white', fontSize: 12, color: '#71717A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} />Reset
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SortHeader label="Time" sortKey="createdAt" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Merchant" sortKey="merchant" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Agent" sortKey="agentId" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Amount" sortKey="amount" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#71717A', background: '#FAFAFA' }}>Risk</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#71717A', background: '#FAFAFA' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {pagedTxs.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#A1A1AA', fontSize: 13 }}>No transactions match your filters</td></tr>
              )}
              <AnimatePresence initial={false}>
                {pagedTxs.map((tx, i) => {
                  const isLive = liveIds.has(tx.id);
                  const rowBg = tx.status === 'BLOCKED' ? 'rgba(254,241,242,0.4)' : tx.status === 'FLAGGED' ? 'rgba(255,251,235,0.4)' : 'transparent';
                  const accentColor = tx.status === 'BLOCKED' ? '#E11D48' : tx.status === 'FLAGGED' ? '#D97706' : '#10B981';
                  return (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0, x: isLive ? 12 : 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      transition={{ duration: .25, delay: i * 0.01 }}
                      onClick={() => setSelectedTx(tx)}
                      style={{ background: rowBg, borderBottom: '1px solid #F9FAFB', cursor: 'pointer', transition: 'background .15s', position: 'relative' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${accentColor}10`; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = rowBg; }}>
                      {/* Left accent bar */}
                      <td style={{ padding: '10px 12px', paddingLeft: 16, fontSize: 12, fontFamily: 'monospace', color: '#71717A', whiteSpace: 'nowrap', borderLeft: isLive ? `3px solid ${accentColor}` : '3px solid transparent' }}>
                        {new Date(tx.createdAt || tx.timestamp || Date.now()).toLocaleTimeString()}
                        {isLive && <span style={{ marginLeft: 6, background: '#10B981', color: 'white', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, verticalAlign: 'middle' }}>LIVE</span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#18181B', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.merchant}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: '#71717A' }}>{tx.agentId?.split('-').slice(1, 3).join('-')}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#18181B' }}>${tx.amount.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px' }}><StatusBadge status={tx.status} /></td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 48, height: 6, background: '#F4F4F5', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(tx.riskScore ?? 10, 100)}%`, background: (tx.riskScore ?? 10) > 70 ? '#E11D48' : (tx.riskScore ?? 10) > 40 ? '#D97706' : '#10B981', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#71717A' }}>{tx.riskScore ?? '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={e => { e.stopPropagation(); setSelectedTx(tx); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, background: '#F4F4F5', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#52525B' }}>
                          Inspect <ArrowRight size={11} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#71717A' }}>Page {page} of {totalPages} · {filteredTxs.length} results</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E4E4E7', background: 'white', fontSize: 12, fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? .4 : 1 }}>
                ← Prev
              </button>
              {/* Stable unique page buttons — deduplicated */}
              {(() => {
                const windowSize = Math.min(5, totalPages);
                let start = Math.max(1, page - Math.floor(windowSize / 2));
                const end = Math.min(totalPages, start + windowSize - 1);
                start = Math.max(1, end - windowSize + 1);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => (
                  <button key={`page-${p}`} onClick={() => setPage(p)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E4E4E7', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: page === p ? '#4F46E5' : 'white', color: page === p ? 'white' : '#52525B' }}>
                    {p}
                  </button>
                ));
              })()}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E4E4E7', background: 'white', fontSize: 12, fontWeight: 600, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? .4 : 1 }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compliance Report */}
      <ComplianceReport />

      {/* Transaction Detail Drawer */}
      <TransactionDrawer transaction={selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
