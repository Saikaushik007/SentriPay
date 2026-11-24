import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, Bot, Zap, ArrowRight, 
  Lock, TrendingUp, Activity, ArrowUpRight 
} from 'lucide-react';
import { apiUrl } from '../lib/api';

interface LiveStats {
  totalCount: number;
  approvedCount: number;
  blockedCount: number;
  totalVolume: number;
  approvalRate: string;
  activeAgents: number;
}

export default function LandingPage() {
  const [stats, setStats] = useState<LiveStats>({
    totalCount: 0,
    approvedCount: 0,
    blockedCount: 0,
    totalVolume: 0,
    approvalRate: '0.0',
    activeAgents: 3
  });

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/api/transactions')).then(r => r.json()).catch(() => []),
      fetch(apiUrl('/api/agents')).then(r => r.json()).catch(() => [])
    ]).then(([txs, agents]) => {
      if (Array.isArray(txs) && txs.length > 0) {
        const approved = txs.filter((t: any) => t.status === 'APPROVED');
        const blocked = txs.filter((t: any) => t.status === 'BLOCKED');
        const volume = approved.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        const rate = txs.length > 0 ? ((approved.length / txs.length) * 100).toFixed(1) : '0.0';

        setStats({
          totalCount: txs.length,
          approvedCount: approved.length,
          blockedCount: blocked.length,
          totalVolume: volume,
          approvalRate: rate,
          activeAgents: Array.isArray(agents) ? agents.length : 3
        });
      }
    });
  }, []);

  return (
    <div 
      className="min-h-[calc(100vh-68px)] flex flex-col relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #F5F3FF 0%, #F0F9FF 50%, #F0FDF4 100%)'
      }}
    >
      {/* Background Soft Mesh Glows */}
      <div 
        className="absolute top-10 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none blur-3xl opacity-30"
        style={{ background: 'radial-gradient(circle, #818CF8 0%, transparent 70%)' }}
      />
      <div 
        className="absolute top-40 right-10 w-[450px] h-[450px] rounded-full pointer-events-none blur-3xl opacity-25"
        style={{ background: 'radial-gradient(circle, #F472B6 0%, transparent 70%)' }}
      />
      <div 
        className="absolute -bottom-10 left-10 w-[600px] h-[600px] rounded-full pointer-events-none blur-3xl opacity-25"
        style={{ background: 'radial-gradient(circle, #38BDF8 0%, transparent 70%)' }}
      />

      <div className="max-w-[1300px] mx-auto px-6 py-16 flex-1 flex flex-col justify-between relative z-10 w-full">
        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              x402 Protocol Autonomous Policy Layer
            </div>

            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.12]"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Intelligent Spend Guard for Autonomous AI Payments
            </h1>

            <p 
              className="text-xl sm:text-2xl text-rose-800 leading-relaxed font-serif"
              style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic' }}
            >
              The deterministic control layer between autonomous agents and instant x402 settlement.
            </p>

            <p className="text-base text-gray-600 max-w-xl leading-relaxed">
              Autonomous AI agents can now pay for cloud compute, APIs, and micro-services natively. 
              SentriPay validates every payment intent in sub-second milliseconds against dynamic limits, 
              denylists, velocity caps, and composite risk scoring before money moves.
            </p>

            {/* Launch CTA */}
            <div className="pt-2 flex items-center gap-4 flex-wrap">
              <Link
                to="/dashboard"
                className="px-8 py-3.5 rounded-full bg-slate-900 hover:bg-black text-white font-bold text-sm shadow-xl inline-flex items-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  boxShadow: '0 10px 25px -8px rgba(15, 23, 42, 0.5)'
                }}
              >
                Launch Dashboard
                <ArrowRight size={16} />
              </Link>

              <Link
                to="/policies"
                className="px-6 py-3.5 rounded-full bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm border border-gray-200 shadow-sm inline-flex items-center gap-2 transition-colors"
              >
                Configure Policies
              </Link>
            </div>
          </div>

          {/* Floating Live-Stats Card (Real Postgres Data) */}
          <div className="lg:col-span-5">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl p-7 bg-white/85 backdrop-blur-xl border border-white/80 shadow-2xl relative"
              style={{
                boxShadow: '0 20px 40px -15px rgba(99, 102, 241, 0.15)'
              }}
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Live Gateway Telemetry</span>
                </div>
                <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                  Postgres Live
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                  <div className="text-[11px] font-medium text-indigo-600 uppercase tracking-wide">Approved Volume</div>
                  <div className="text-2xl font-black font-mono text-indigo-950 mt-1">
                    ${stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-indigo-500 mt-0.5 font-medium">Settled via x402</div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                  <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wide">Approval Rate</div>
                  <div className="text-2xl font-black font-mono text-emerald-950 mt-1">
                    {stats.approvalRate}%
                  </div>
                  <div className="text-[11px] text-emerald-500 mt-0.5 font-medium">{stats.approvedCount} approved intents</div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
                  <div className="text-[11px] font-medium text-rose-600 uppercase tracking-wide">Blocked Violations</div>
                  <div className="text-2xl font-black font-mono text-rose-950 mt-1">
                    {stats.blockedCount}
                  </div>
                  <div className="text-[11px] text-rose-500 mt-0.5 font-medium">Zero capital loss</div>
                </div>

                <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100">
                  <div className="text-[11px] font-medium text-sky-600 uppercase tracking-wide">Enforced Agents</div>
                  <div className="text-2xl font-black font-mono text-sky-950 mt-1">
                    {stats.activeAgents}
                  </div>
                  <div className="text-[11px] text-sky-500 mt-0.5 font-medium">Active fleet workers</div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Activity size={13} className="text-emerald-500" />
                  Real database metrics
                </span>
                <Link to="/dashboard" className="text-indigo-600 font-semibold hover:underline flex items-center gap-1">
                  View feed <ArrowUpRight size={12} />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Agent → Policy Engine → Settlement Strip */}
        <div 
          className="rounded-3xl p-7 mb-14 border border-indigo-100 shadow-md"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(245,243,255,0.7) 100%)'
          }}
        >
          <div className="text-center mb-6">
            <span className="text-xs uppercase font-mono tracking-widest text-indigo-600 font-bold">
              Sub-second Transaction Lifecycle
            </span>
            <h2 className="text-xl font-bold text-gray-900 mt-0.5" style={{ fontFamily: 'Outfit, sans-serif' }}>
              How SentriPay Intercepts & Protects Autonomous Payments
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            {/* Step 1: Agent */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-sm text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center mb-2 font-bold shadow-sm">
                <Bot size={20} />
              </div>
              <div className="text-xs font-mono font-bold text-violet-700 uppercase">1. Autonomous Agent</div>
              <div className="text-sm font-bold text-gray-900 mt-1">Payment Intent</div>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                AI Agent generates autonomous payment request for merchant API or resource.
              </p>
            </div>

            {/* Arrow 1 */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="h-0.5 w-full bg-gradient-to-r from-violet-300 to-indigo-400 relative">
                <div className="absolute right-0 -top-1 border-solid border-l-indigo-400 border-l-8 border-y-transparent border-y-4 border-r-0" />
              </div>
              <span className="text-[10px] font-mono text-gray-400 mt-1">x402 Intent</span>
            </div>

            {/* Step 2: Policy Engine */}
            <div className="p-4 rounded-2xl bg-indigo-600 text-white shadow-lg text-center relative overflow-hidden">
              <div className="w-10 h-10 mx-auto rounded-xl bg-white/20 text-white flex items-center justify-center mb-2 font-bold backdrop-blur">
                <ShieldCheck size={20} />
              </div>
              <div className="text-xs font-mono font-bold text-indigo-200 uppercase">2. Policy Guard</div>
              <div className="text-sm font-bold text-white mt-1">Multi-Rule Validation</div>
              <p className="text-[11px] text-indigo-100 mt-1 leading-snug">
                Limits, 24h budget, denylist, agent pause, velocity & risk score (0-100).
              </p>
            </div>

            {/* Arrow 2 */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="h-0.5 w-full bg-gradient-to-r from-indigo-400 to-emerald-400 relative">
                <div className="absolute right-0 -top-1 border-solid border-l-emerald-400 border-l-8 border-y-transparent border-y-4 border-r-0" />
              </div>
              <span className="text-[10px] font-mono text-gray-400 mt-1">Pre-flight OK</span>
            </div>

            {/* Step 3: Settlement */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-sm text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 font-bold shadow-sm">
                <Zap size={20} />
              </div>
              <div className="text-xs font-mono font-bold text-emerald-700 uppercase">3. x402 Protocol</div>
              <div className="text-sm font-bold text-gray-900 mt-1">Instant Settlement</div>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Generates unique settlement ID, debits liquidity, and emits ledger audit receipt.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Feature Cards in Mint, Peach, Sky, Rose Tints */}
        <div>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Four Defense Layers Built for Autonomous Commerce
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Mint Tint: Budgets */}
            <div 
              className="p-6 rounded-3xl border transition-transform hover:-translate-y-1 duration-200"
              style={{
                background: '#ECFDF5',
                borderColor: '#A7F3D0',
                boxShadow: '0 8px 24px -12px rgba(16, 185, 129, 0.2)'
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-4 shadow-sm">
                <TrendingUp size={20} />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Per-Tx & Daily Budgets
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Configure hard ceilings on single-payment size, rolling 24-hour spend limits, and isolated per-agent budgets.
              </p>
            </div>

            {/* Peach Tint: Merchant Control */}
            <div 
              className="p-6 rounded-3xl border transition-transform hover:-translate-y-1 duration-200"
              style={{
                background: '#FFF7ED',
                borderColor: '#FED7AA',
                boxShadow: '0 8px 24px -12px rgba(234, 88, 12, 0.2)'
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-4 shadow-sm">
                <Lock size={20} />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Merchant Access Control
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Denylist malicious and unvetted payment endpoints instantly, or switch to strict allowlist-only mode for mission-critical fleets.
              </p>
            </div>

            {/* Sky Tint: Frequency Cap */}
            <div 
              className="p-6 rounded-3xl border transition-transform hover:-translate-y-1 duration-200"
              style={{
                background: '#F0F9FF',
                borderColor: '#BAE6FD',
                boxShadow: '0 8px 24px -12px rgba(14, 165, 233, 0.2)'
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center mb-4 shadow-sm">
                <Zap size={20} />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Velocity Frequency Cap
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Prevents runaway agent loops, double-spend bursts, and recursive calls by rate-limiting agents to configurable tx-per-second thresholds.
              </p>
            </div>

            {/* Rose Tint: Risk Scoring */}
            <div 
              className="p-6 rounded-3xl border transition-transform hover:-translate-y-1 duration-200"
              style={{
                background: '#FFF1F2',
                borderColor: '#FECDD3',
                boxShadow: '0 8px 24px -12px rgba(244, 63, 94, 0.2)'
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center mb-4 shadow-sm">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-bold text-base text-gray-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Composite Risk Scoring
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Calculates real-time 0–100 risk score combining merchant reputation and transfer size, routing questionable transactions to a Review Queue.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}