import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Save, Plus, X, Clock, CheckCircle2, ToggleLeft, ToggleRight, Sliders, ShieldCheck, ShieldX, Lock, Shield } from 'lucide-react';
import PolicySimulator from '../components/PolicySimulator';

type PolicyConfig = {
  id: string;
  maxTxLimit: number;
  dailyBudget: number;
  denylist: string[];
  allowlistMode: boolean;
  allowlist: string[];
  maxRiskScore: number;
  updatedAt: string;
};
type HistoryEntry = { id: string; action: string; detail: string; createdAt: string };

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-2xl ${className}`} />;
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-6 right-6 z-50 flex items-center gap-3 text-white px-5 py-3.5 rounded-2xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg,#10B981,#34D399)', boxShadow: '0 4px 24px -4px rgba(16,185,129,0.4)' }}
        >
          <CheckCircle2 size={18} /> {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Policies() {
  const [policies, setPolicies] = useState<PolicyConfig | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PolicyConfig | null>(null);
  const [newDenyMerchant, setNewDenyMerchant] = useState('');
  const [newAllowMerchant, setNewAllowMerchant] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(false);

  const showToast = () => { setToast(true); setTimeout(() => setToast(false), 3000); };

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/policies').then(r => r.json()),
      fetch('/api/policies/history').then(r => r.json())
    ]).then(([pol, hist]) => {
      setPolicies(pol); setDraft(pol); setHistory(hist);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxTxLimit: draft.maxTxLimit,
          dailyBudget: draft.dailyBudget,
          denylist: draft.denylist,
          allowlistMode: draft.allowlistMode,
          allowlist: draft.allowlist,
          maxRiskScore: draft.maxRiskScore,
        })
      });
      const updated = await res.json();
      setPolicies(updated); setDraft(updated);
      setIsEditing(false); showToast();
      fetch('/api/policies/history').then(r => r.json()).then(setHistory);
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  const d = isEditing ? draft : policies;
  const allowMode = isEditing ? draft?.allowlistMode : policies?.allowlistMode;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto w-full">
      <Toast message="Policy saved to database ✓" visible={toast} />

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div
        className="rounded-3xl p-8 mb-8 relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 60%, #6D28D9 100%)', boxShadow: '0 8px 40px -8px rgba(79,70,229,0.45)' }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="absolute bottom-0 right-32 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(244,114,182,0.15) 0%,transparent 70%)', transform: 'translateY(30%)' }} />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-white/60 text-xs font-mono uppercase tracking-widest mb-3">
              <Shield size={13} /> Enforcement Engine v2
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Policy Control Center</h1>
            <p className="text-sm mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', color: 'rgba(255,255,255,0.82)' }}>Calibrated guardrails for the agents you trust.</p>
            <p className="text-white/70 text-sm max-w-lg leading-relaxed mb-6">
              Configure the rule-set governing all autonomous agent transactions — spending limits, merchant access control, and risk enforcement.
            </p>
            {/* Stat pills */}
            {loading ? (
              <div className="flex gap-4">
                {[1,2,3].map(i => (
                  <div key={i} className="h-16 w-36 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Per-Tx Limit', value: `$${policies?.maxTxLimit?.toLocaleString()}` },
                  { label: 'Daily Budget', value: `$${policies?.dailyBudget?.toLocaleString()}` },
                  { label: 'Risk Threshold', value: `≥ ${policies?.maxRiskScore ?? 80}` },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl px-5 py-3"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                    <div className="font-mono font-bold text-xl">{s.value}</div>
                    <div className="text-white/60 text-[11px] font-semibold uppercase tracking-wider mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit / Save */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {isEditing ? (
              <>
                <button onClick={() => { setIsEditing(false); setDraft(policies); }}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)' }}>
                  Discard
                </button>
                <button onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all"
                  style={{ background: 'white', color: '#4F46E5', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.20)' }}>
                  {isSaving ? <span className="inline-block w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /> : <Save size={15} />}
                  Save Changes
                </button>
              </>
            ) : (
              <button onClick={() => { setDraft(policies); setIsEditing(true); }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.20)' }}>
                <Settings2 size={15} /> Edit Policies
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

        {/* Left: Core Logic Rules */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EEF2FF', color: '#4F46E5', boxShadow: '0 2px 10px -2px rgba(79,70,229,0.3)' }}>
              <Sliders size={16} />
            </div>
            <h2 className="font-bold text-xl" style={{ fontFamily: 'Outfit, sans-serif' }}>Core Logic Rules</h2>
          </div>
          <div className="space-y-4">
            {loading ? (
              [1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)
            ) : (
              <>
                <RuleCard
                  title="Per-Transaction Limit"
                  desc="Transactions above this amount are instantly blocked."
                  value={d?.maxTxLimit ?? 1000} min={100} max={10000} step={100}
                  prefix="$" accentColor="#4F46E5" editing={isEditing}
                  gradient="linear-gradient(90deg, #4F46E5, #7C3AED)"
                  wash="rgba(79,70,229,0.03)" shadowColor="rgba(79,70,229,0.15)"
                  onChange={v => draft && setDraft({ ...draft, maxTxLimit: v })}
                />
                <RuleCard
                  title="Daily Budget (24h Rolling)"
                  desc="Blocks spend exceeding this in any 24h window."
                  value={d?.dailyBudget ?? 2000} min={100} max={10000} step={100}
                  prefix="$" suffix="/day" accentColor="#7C3AED" editing={isEditing}
                  gradient="linear-gradient(90deg, #7C3AED, #DB2777)"
                  wash="rgba(124,58,237,0.03)" shadowColor="rgba(124,58,237,0.15)"
                  onChange={v => draft && setDraft({ ...draft, dailyBudget: v })}
                />
                <RuleCard
                  title="Max Risk Score Threshold"
                  desc="Flags transactions at or above this risk score."
                  value={d?.maxRiskScore ?? 80} min={30} max={100} step={5}
                  accentColor="#F59E0B" editing={isEditing} isRisk
                  gradient="linear-gradient(90deg, #F59E0B, #EA580C)"
                  wash="rgba(245,158,11,0.03)" shadowColor="rgba(245,158,11,0.15)"
                  onChange={v => draft && setDraft({ ...draft, maxRiskScore: v })}
                />
                {/* Static */}
                <div className="rounded-2xl p-5 flex items-center justify-between relative overflow-hidden"
                  style={{
                    background: 'rgba(16,185,129,0.03)',
                    border: '1px solid #E4E4E7',
                    boxShadow: '0 4px 16px -4px rgba(16,185,129,0.15)',
                    borderLeft: '4px solid #10B981'
                  }}>
                  <div className="ml-2">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-sm text-gray-900">Frequency Cap</div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{ background: '#D1FAE5', color: '#059669' }}>System Rule</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Velocity limit per agent (hardcoded)</div>
                  </div>
                  <div className="font-mono font-bold text-sm px-4 py-2 rounded-xl"
                    style={{ background: '#D1FAE5', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                    3 tx / sec
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Merchant Access Control */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FFF7ED', color: '#EA580C', boxShadow: '0 2px 10px -2px rgba(234,88,12,0.3)' }}>
              <Lock size={16} />
            </div>
            <h2 className="font-bold text-xl" style={{ fontFamily: 'Outfit, sans-serif' }}>Merchant Access Control</h2>
          </div>
          <div className="space-y-4">

            {/* Allowlist Card */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(16,185,129,0.03)', border: '1px solid #E4E4E7', boxShadow: '0 4px 16px -4px rgba(16,185,129,0.15)', borderLeft: '4px solid #10B981' }}>
              <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E4E4E7' }}>
                <div className="flex items-center gap-3 ml-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#D1FAE5', color: '#10B981' }}>
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Strict Allowlist Mode</div>
                    <div className="text-xs text-gray-400 mt-0.5">Only these merchants are permitted</div>
                  </div>
                </div>
                <button
                  onClick={() => isEditing && draft && setDraft({ ...draft, allowlistMode: !draft.allowlistMode })}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: allowMode ? 'linear-gradient(135deg,#10B981,#34D399)' : '#F4F4F5',
                    color: allowMode ? 'white' : '#71717A',
                    boxShadow: allowMode ? '0 4px 14px -2px rgba(16,185,129,0.35)' : 'none',
                    cursor: isEditing ? 'pointer' : 'default',
                  }}
                >
                  {allowMode ? <><ToggleRight size={14} /> ON</> : <><ToggleLeft size={14} /> OFF</>}
                </button>
              </div>
              <div className="p-5 min-h-[140px]">
                {allowMode ? (
                  <>
                    {isEditing && (
                      <form onSubmit={e => {
                        e.preventDefault();
                        if (newAllowMerchant.trim() && draft && !draft.allowlist.includes(newAllowMerchant.trim())) {
                          setDraft({ ...draft, allowlist: [...draft.allowlist, newAllowMerchant.trim()] });
                          setNewAllowMerchant('');
                        }
                      }} className="flex gap-2 mb-4">
                        <input type="text" placeholder="Add merchant to allowlist..." value={newAllowMerchant}
                          onChange={e => setNewAllowMerchant(e.target.value)}
                          className="flex-1 bg-white border rounded-xl text-sm px-4 py-2 outline-none font-mono transition-all"
                          style={{ borderColor: '#E4E4E7' }}
                          onFocus={e => (e.target.style.borderColor = '#10B981')}
                          onBlur={e => (e.target.style.borderColor = '#E4E4E7')} />
                        <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                          style={{ background: 'linear-gradient(135deg,#10B981,#34D399)', boxShadow: '0 4px 14px -2px rgba(16,185,129,0.4)' }}>
                          <Plus size={15} /> Add
                        </button>
                      </form>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(isEditing ? draft?.allowlist : policies?.allowlist)?.length === 0 ? (
                        <p className="text-sm text-gray-400 italic w-full text-center py-4">No merchants allowed — all will be blocked!</p>
                      ) : (isEditing ? draft?.allowlist : policies?.allowlist)?.map(m => (
                        <span key={m} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-white"
                          style={{ background: 'linear-gradient(135deg,#10B981,#34D399)', boxShadow: '0 2px 8px -2px rgba(16,185,129,0.35)' }}>
                          {m}
                          {isEditing && (
                            <button onClick={() => draft && setDraft({ ...draft, allowlist: draft.allowlist.filter(x => x !== m) })}
                              className="hover:opacity-70 transition-opacity"><X size={11} /></button>
                          )}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400 italic py-4">
                    Allowlist disabled — Denylist mode is active.
                  </div>
                )}
              </div>
            </div>

            {/* Denylist Card */}
            <div className="rounded-2xl overflow-hidden transition-opacity"
              style={{
                background: 'rgba(244,63,94,0.03)',
                border: '1px solid #E4E4E7', boxShadow: '0 4px 16px -4px rgba(244,63,94,0.15)',
                borderLeft: '4px solid #F43F5E',
                opacity: allowMode ? 0.5 : 1,
              }}>
              <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E4E4E7' }}>
                <div className="flex items-center gap-3 ml-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FFE4E6', color: '#F43F5E' }}>
                    <ShieldX size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Global Denylist</div>
                    <div className="text-xs text-gray-400 mt-0.5">Always block these merchants</div>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(244,114,182,0.15))', color: '#E11D48', border: '1px solid rgba(244,63,94,0.2)' }}>
                  {(isEditing ? draft?.denylist.length : policies?.denylist.length)} blocked
                </span>
              </div>
              <div className="p-5 min-h-[140px]">
                {isEditing && !allowMode && (
                  <form onSubmit={e => {
                    e.preventDefault();
                    if (newDenyMerchant.trim() && draft && !draft.denylist.includes(newDenyMerchant.trim())) {
                      setDraft({ ...draft, denylist: [...draft.denylist, newDenyMerchant.trim()] });
                      setNewDenyMerchant('');
                    }
                  }} className="flex gap-2 mb-4">
                    <input type="text" placeholder="Add blocked merchant..." value={newDenyMerchant}
                      onChange={e => setNewDenyMerchant(e.target.value)}
                      className="flex-1 bg-white border rounded-xl text-sm px-4 py-2 outline-none font-mono transition-all"
                      style={{ borderColor: '#E4E4E7' }}
                      onFocus={e => (e.target.style.borderColor = '#F43F5E')}
                      onBlur={e => (e.target.style.borderColor = '#E4E4E7')} />
                    <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                      style={{ background: '#18181B' }}>
                      <Plus size={15} /> Add
                    </button>
                  </form>
                )}
                <div className="flex flex-wrap gap-2">
                  {(isEditing ? draft?.denylist : policies?.denylist)?.length === 0 ? (
                    <p className="text-sm text-gray-400 italic w-full text-center py-4">No merchants on the denylist.</p>
                  ) : (isEditing ? draft?.denylist : policies?.denylist)?.map(m => (
                    <span key={m} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold text-white shadow-lg"
                      style={{ background: 'linear-gradient(135deg,#F43F5E,#F472B6)', boxShadow: '0 4px 12px -2px rgba(244,63,94,0.4)' }}>
                      {m}
                      {isEditing && !allowMode && (
                        <button onClick={() => draft && setDraft({ ...draft, denylist: draft.denylist.filter(x => x !== m) })}
                          className="hover:opacity-70 transition-opacity"><X size={11} /></button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Policy Simulator Panel ───────────────────────────── */}
      <PolicySimulator />

      {/* ── Audit Trail Timeline ─────────────────────────────── */}
       <div className="rounded-3xl overflow-hidden mb-12"
         style={{ background: 'linear-gradient(135deg,#F5F3FF,#FFFFFF)', border: '1px solid #DDD6FE', boxShadow: '0 12px 30px -18px rgba(124,58,237,.32)' }}>
        <div className="p-6 border-b flex items-center gap-3" style={{ borderColor: '#E4E4E7', background: '#FAFAFA' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F4F4F5', color: '#71717A' }}>
            <Clock size={20} />
          </div>
          <div>
            <h2 className="font-bold text-xl" style={{ fontFamily: 'Outfit, sans-serif' }}>Audit Trail</h2>
            <p className="text-sm text-gray-400 mt-0.5">Immutable log of every policy modification</p>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="space-y-5">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 max-w-3xl" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-gray-400">
              <Clock size={32} className="opacity-20 mb-3" />
              <p className="text-sm font-medium">No changes recorded yet</p>
            </div>
          ) : (
            <div className="relative pl-7 space-y-8" style={{ borderLeft: '2px solid #E4E4E7' }}>
              {history.map((h, i) => (
                <motion.div key={h.id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-[35px] top-2 w-4 h-4 rounded-full border-[3px] border-white"
                    style={{
                      background: h.action === 'DEMO_RESET' ? '#F59E0B' : '#4F46E5',
                      boxShadow: h.action === 'DEMO_RESET' ? '0 0 0 3px rgba(245,158,11,0.2)' : '0 0 0 3px rgba(79,70,229,0.2)'
                    }} />

                  <div className="bg-white rounded-2xl p-5 max-w-4xl transition-all"
                    style={{ border: '1px solid #E4E4E7', boxShadow: '0 1px 8px -2px rgba(0,0,0,0.06)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg"
                          style={{
                            background: h.action === 'DEMO_RESET' ? '#FEF3C7' : '#EEF2FF',
                            color: h.action === 'DEMO_RESET' ? '#D97706' : '#4F46E5',
                          }}>
                          {h.action}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">SYSTEM</span>
                      </div>
                      <span className="text-xs font-mono text-gray-400">
                        {new Date(h.createdAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#18181B' }}>{h.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RuleCard ────────────────────────────────────────────────────────────────
function RuleCard({ title, desc, value, min, max, step, prefix = '', suffix = '', accentColor, editing, isRisk, onChange, gradient, wash, shadowColor }: {
  title: string; desc: string; value: number; min: number; max: number; step: number;
  prefix?: string; suffix?: string; accentColor: string; editing: boolean; isRisk?: boolean;
  gradient: string; wash: string; shadowColor: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const valColor = isRisk
    ? value < 60 ? '#10B981' : value < 80 ? '#F59E0B' : '#F43F5E'
    : accentColor;

  return (
    <div className="rounded-2xl p-5 relative overflow-hidden transition-all duration-300"
      style={{
        background: wash,
        border: '1px solid #E4E4E7',
        boxShadow: `0 4px 16px -4px ${shadowColor}`,
        borderLeft: `4px solid ${accentColor}`
      }}>
      <div className="flex items-start justify-between ml-2 mb-4">
        <div className="flex-1 mr-4">
          <div className="font-bold text-sm text-gray-900">{title}</div>
          <div className="text-xs text-gray-500 mt-1 leading-snug">{desc}</div>
        </div>
        <div className="font-mono font-bold text-xl px-4 py-2 rounded-xl flex-shrink-0 shadow-sm"
          style={{ background: wash, color: valColor, border: `1px solid ${shadowColor}` }}>
          {prefix}{value.toLocaleString()}{suffix}
        </div>
      </div>

      {editing ? (
        <div className="ml-2 p-4 rounded-xl space-y-3" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="relative h-2 rounded-full overflow-hidden w-full" style={{ background: '#E4E4E7' }}>
            <div className="absolute top-0 left-0 h-full rounded-full" style={{ width: `${pct}%`, background: gradient }} />
            <input type="range" min={min} max={max} step={step} value={value}
              onChange={e => onChange(parseInt(e.target.value))}
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <div className="flex justify-between text-[11px] font-mono font-semibold text-gray-400">
            <span>{prefix}{min.toLocaleString()}</span>
            <span>{prefix}{max.toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <div className="ml-2">
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#E4E4E7' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)` }} />
          </div>
        </div>
      )}
    </div>
  );
}
