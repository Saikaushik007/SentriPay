import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  Bot,
  Landmark,
  Sliders,
  Store,
  Zap,
  AlertTriangle,
  CheckSquare,
  FileText,
} from 'lucide-react';
import { apiUrl } from '../lib/api';
import { formatCurrency } from '../lib/utils';

export default function LandingPage() {
  const [stats, setStats] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/api/transactions/stats?range=24h')).then(r => r.json()).catch(() => null),
      fetch(apiUrl('/api/transactions/budget')).then(r => r.json()).catch(() => null),
    ]).then(([s, b]) => {
      if (s) setStats(s);
      if (b) setBudget(b);
    });
  }, []);

  const features = [
    { icon: Sliders, title: 'Spend Limits', desc: 'Enforce per-transaction caps and rolling 24h budgets.', color: 'bg-[#4F46E5]/10 text-[#4F46E5]' },
    { icon: Store, title: 'Merchant Controls', desc: 'Block denylisted vendors or enforce strict allowlists.', color: 'bg-[#14B8A6]/10 text-[#0F766E]' },
    { icon: Zap, title: 'Velocity Caps', desc: 'Stop runaway agent loops exceeding 3 tx/sec.', color: 'bg-[#F59E0B]/10 text-[#D97706]' },
    { icon: AlertTriangle, title: 'Risk Scoring', desc: 'Composite risk evaluation with plain-English reasons.', color: 'bg-[#F43F5E]/10 text-[#E11D48]' },
    { icon: CheckSquare, title: 'Human Approvals', desc: 'Dual-signature review queue for high-value flagged payments.', color: 'bg-[#7C3AED]/10 text-[#7C3AED]' },
    { icon: FileText, title: 'Audit Trail', desc: 'Immutable policy history and exportable compliance logs.', color: 'bg-[#10B981]/10 text-[#059669]' },
  ];

  const rules = [
    { rule: 'Agent Status', check: 'ACTIVE vs PAUSED', action: 'Block if paused' },
    { rule: 'Per-Transaction Limit', check: 'Amount <= $1,000', action: 'Block over cap' },
    { rule: 'Rolling 24h Budget', check: '24h spend <= $2,000', action: 'Block over budget' },
    { rule: 'Velocity Cap', check: '<= 3 tx/sec per agent', action: 'Block burst' },
    { rule: 'Risk Threshold', check: 'Score < 80 / 100', action: 'Flag for approval' },
  ];

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-[#0F172A]">
      {/* Public Top Nav */}
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="SentriPay" className="w-7 h-7" />
            <span className="font-semibold text-[15px] text-[#0F172A]">SentriPay</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/integrate" className="text-sm font-medium text-[#64748B] hover:text-[#0F172A]">
              Docs
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-sm font-medium text-white bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-95"
            >
              Open dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-16">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-5">
            <h1 className="text-3xl sm:text-4xl font-semibold text-[#0F172A] tracking-tight leading-tight">
              Deterministic spend guardrails for autonomous AI agents.
            </h1>
            <p className="text-base text-[#64748B] leading-relaxed">
              Intercept every agent payment intent before settlement. Enforce limits, merchant
              policies, velocity caps, and human approvals in one unified gateway.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-[8px] text-sm font-medium text-white bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-95"
              >
                Open dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/integrate"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-[8px] text-sm font-medium text-[#0F172A] bg-white border border-[#E5E7EB] hover:bg-[#F8FAFC]"
              >
                View docs
              </Link>
            </div>
          </div>

          {/* Live Preview Card from real numbers */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <span className="text-sm font-semibold text-[#0F172A]">Live Gateway Snapshot (24h)</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-[#059669] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E5E7EB]">
                <div className="text-xs text-[#64748B]">Processed (24h)</div>
                <div className="text-2xl font-semibold text-[#0F172A] font-mono-num mt-1">
                  {stats?.total ?? '—'}
                </div>
              </div>
              <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E5E7EB]">
                <div className="text-xs text-[#64748B]">Approval Rate</div>
                <div className="text-2xl font-semibold text-[#10B981] font-mono-num mt-1">
                  {stats?.approvalRate != null ? `${stats.approvalRate.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E5E7EB]">
                <div className="text-xs text-[#64748B]">Blocked</div>
                <div className="text-2xl font-semibold text-[#F43F5E] font-mono-num mt-1">
                  {stats?.blocked ?? '—'}
                </div>
              </div>
              <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E5E7EB]">
                <div className="text-xs text-[#64748B]">24h Budget Used</div>
                <div className="text-2xl font-semibold text-[#0F172A] font-mono-num mt-1">
                  {budget ? formatCurrency(budget.spent) : '—'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="space-y-4">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Bot, step: '1. Agent', desc: 'Your AI agent submits a payment intent to SentriPay instead of settling directly.' },
              { icon: ShieldCheck, step: '2. Policy', desc: 'The engine evaluates limits, denylists, velocity caps, and composite risk.' },
              { icon: Landmark, step: '3. Settlement', desc: 'Compliant payments settle with a verifiable ID; risky ones are blocked or flagged.' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="bg-white border border-[#E5E7EB] rounded-[12px] p-5 shadow-sm">
                  <div className="w-9 h-9 rounded-[8px] bg-[#4F46E5]/10 text-[#4F46E5] flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-sm font-semibold text-[#0F172A]">{s.step}</div>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Features Grid */}
        <section className="space-y-4">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Built-in guardrails</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white border border-[#E5E7EB] rounded-[12px] p-5 shadow-sm">
                  <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center mb-3 ${f.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-sm font-semibold text-[#0F172A]">{f.title}</div>
                  <p className="text-xs text-[#64748B] mt-1">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Short Rules Table */}
        <section className="bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-[18px] font-semibold text-[#0F172A]">Default policy rules</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium text-[#64748B]">
                  <th className="py-2.5 px-4">Rule</th>
                  <th className="py-2.5 px-4">Condition</th>
                  <th className="py-2.5 px-4">Enforcement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {rules.map(r => (
                  <tr key={r.rule}>
                    <td className="py-2.5 px-4 font-medium text-[#0F172A]">{r.rule}</td>
                    <td className="py-2.5 px-4 font-mono-num text-xs text-[#64748B]">{r.check}</td>
                    <td className="py-2.5 px-4 text-xs text-[#64748B]">{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-[#0F172A] text-white rounded-[12px] p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Ready to inspect live agent traffic?</h2>
            <p className="text-sm text-slate-300 mt-1">
              Open the Sentinel dashboard or integrate the gateway into your agent runtime.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-[8px] text-sm font-medium text-white bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] shrink-0"
          >
            Open dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
