import { useEffect, useState } from 'react';
import { Settings2, Save, Plus, X, Clock, Sliders, Lock, Layers } from 'lucide-react';
import PolicySimulator from '../components/PolicySimulator';
import { apiUrl } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Card, Button, PageHeader, Skeleton, ErrorState } from '../components/ui/primitives';

type PolicyConfig = {
  id: string;
  maxTxLimit: number;
  dailyBudget: number;
  denylist: string[];
  allowlistMode: boolean;
  allowlist: string[];
  maxRiskScore: number;
  categoryCaps?: Record<string, number>;
  updatedAt: string;
};
type HistoryEntry = { id: string; action: string; detail: string; createdAt: string };

export default function Policies() {
  const [policies, setPolicies] = useState<PolicyConfig | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PolicyConfig | null>(null);
  const [newDenyMerchant, setNewDenyMerchant] = useState('');
  const [newAllowMerchant, setNewAllowMerchant] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const loadAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(apiUrl('/api/policies')).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch(apiUrl('/api/policies/history')).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([pol, hist]) => {
        setPolicies(pol);
        setDraft(pol);
        setHistory(Array.isArray(hist) ? hist : []);
      })
      .catch(err => {
        setError(err?.message || 'Failed to load policies');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const res = await fetch(apiUrl('/api/policies'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxTxLimit: draft.maxTxLimit,
          dailyBudget: draft.dailyBudget,
          denylist: draft.denylist,
          allowlistMode: draft.allowlistMode,
          allowlist: draft.allowlist,
          maxRiskScore: draft.maxRiskScore,
          categoryCaps: draft.categoryCaps ?? {},
        }),
      });
      if (!res.ok) throw new Error(`Failed to save policy (HTTP ${res.status})`);
      const updated = await res.json();
      setPolicies(updated);
      setDraft(updated);
      setIsEditing(false);
      toast.success('Policy Saved', 'Guardrails persisted and synced.');
      fetch(apiUrl('/api/policies/history'))
        .then(r => r.json())
        .then(h => setHistory(Array.isArray(h) ? h : []))
        .catch(() => {});
    } catch (e: any) {
      toast.error('Save Failed', e?.message || 'Could not update policy');
    } finally {
      setIsSaving(false);
    }
  };

  const d = isEditing ? draft : policies;
  const allowMode = isEditing ? draft?.allowlistMode : policies?.allowlistMode;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Policies"
        description="Spending limits, merchant access control, category caps, and risk thresholds"
        actions={
          isEditing ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setDraft(policies);
                }}
              >
                Discard
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setDraft(policies);
                setIsEditing(true);
              }}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Edit Policies
            </Button>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={loadAll} />}

      {isEditing && (
        <div className="sticky bottom-4 z-30 bg-[#0F172A] text-white px-5 py-3 rounded-[12px] shadow-lg flex items-center justify-between gap-4 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            Editing active policy rules — unsaved changes
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsEditing(false);
                setDraft(policies);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] cursor-pointer"
            >
              <Save size={13} /> Save Changes
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Logic Rules */}
        <Card className="space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E5E7EB]">
            <Sliders className="w-4 h-4 text-[#4F46E5]" />
            <h2 className="text-[16px] font-semibold text-[#0F172A]">Core Logic Rules</h2>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <RuleRow
                title="Per-Transaction Limit"
                desc="Transactions above this amount are instantly blocked."
                value={d?.maxTxLimit ?? 1000}
                min={100}
                max={10000}
                step={50}
                prefix="$"
                editing={isEditing}
                onChange={v => draft && setDraft({ ...draft, maxTxLimit: v })}
              />
              <RuleRow
                title="Daily Budget (24h Rolling)"
                desc="Blocks spend exceeding this in any 24h window."
                value={d?.dailyBudget ?? 2000}
                min={100}
                max={10000}
                step={100}
                prefix="$"
                editing={isEditing}
                onChange={v => draft && setDraft({ ...draft, dailyBudget: v })}
              />
              <RuleRow
                title="Max Risk Score Threshold"
                desc="Flags transactions at or above this risk score."
                value={d?.maxRiskScore ?? 80}
                min={30}
                max={100}
                step={5}
                editing={isEditing}
                onChange={v => draft && setDraft({ ...draft, maxRiskScore: v })}
              />

              {/* Category Caps */}
              <div className="pt-4 border-t border-[#E5E7EB]">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-[#64748B]" />
                  <div className="text-sm font-semibold text-[#0F172A]">Merchant Category Caps (24h)</div>
                </div>
                <div className="space-y-2">
                  {[
                    'Cloud Infrastructure',
                    'AI & LLM Services',
                    'Communications',
                    'DevOps & Tooling',
                  ].map(cat => {
                    const currentVal = (isEditing ? draft?.categoryCaps : policies?.categoryCaps)?.[cat];
                    const hasCap = currentVal !== undefined && currentVal > 0;
                    return (
                      <div
                        key={cat}
                        className="flex items-center justify-between py-2 px-3 rounded-[8px] border border-[#E5E7EB] bg-white text-xs"
                      >
                        <span className="font-medium text-[#0F172A]">{cat}</span>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#64748B] font-mono-num">$</span>
                            <input
                              type="number"
                              min={0}
                              step={50}
                              placeholder="No Cap"
                              value={currentVal ?? ''}
                              onChange={e => {
                                if (!draft) return;
                                const num = parseFloat(e.target.value);
                                const updatedCaps = { ...(draft.categoryCaps || {}) };
                                if (isNaN(num) || num <= 0) delete updatedCaps[cat];
                                else updatedCaps[cat] = num;
                                setDraft({ ...draft, categoryCaps: updatedCaps });
                              }}
                              className="w-24 h-7 px-2 border border-[#E5E7EB] rounded-[6px] text-xs font-mono-num text-right text-[#0F172A]"
                            />
                          </div>
                        ) : (
                          <span className="font-mono-num text-xs text-[#64748B]">
                            {hasCap ? `$${currentVal.toLocaleString()}/24h` : 'No Cap'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Merchant Access Control */}
        <Card className="space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E5E7EB]">
            <Lock className="w-4 h-4 text-[#4F46E5]" />
            <h2 className="text-[16px] font-semibold text-[#0F172A]">Merchant Access Control</h2>
          </div>

          {/* Allowlist */}
          <div className="space-y-3 pb-4 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">Strict Allowlist Mode</div>
                <div className="text-xs text-[#64748B]">Only listed merchants are permitted</div>
              </div>
              <button
                type="button"
                onClick={() => isEditing && draft && setDraft({ ...draft, allowlistMode: !draft.allowlistMode })}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  allowMode
                    ? 'bg-[#10B981]/10 text-[#059669] border-[#10B981]/30'
                    : 'bg-[#F8FAFC] text-[#64748B] border-[#E5E7EB]'
                } ${isEditing ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {allowMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {allowMode ? (
              <div className="space-y-2.5">
                {isEditing && (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      if (newAllowMerchant.trim() && draft && !draft.allowlist.includes(newAllowMerchant.trim())) {
                        setDraft({ ...draft, allowlist: [...draft.allowlist, newAllowMerchant.trim()] });
                        setNewAllowMerchant('');
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Add merchant to allowlist..."
                      value={newAllowMerchant}
                      onChange={e => setNewAllowMerchant(e.target.value)}
                      className="flex-1 h-8 px-3 rounded-[8px] border border-[#E5E7EB] text-xs font-mono-num"
                    />
                    <Button type="submit" variant="secondary" size="sm">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </Button>
                  </form>
                )}
                <div className="flex flex-wrap gap-2">
                  {(isEditing ? draft?.allowlist : policies?.allowlist)?.length === 0 ? (
                    <span className="text-xs text-[#64748B]">No merchants allowed — all will be blocked.</span>
                  ) : (
                    (isEditing ? draft?.allowlist : policies?.allowlist)?.map(m => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-mono-num bg-[#F8FAFC] border border-[#E5E7EB] text-[#0F172A]"
                      >
                        {m}
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => draft && setDraft({ ...draft, allowlist: draft.allowlist.filter(x => x !== m) })}
                            className="text-[#64748B] hover:text-[#0F172A]"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#64748B]">Allowlist disabled — Global Denylist mode is active.</p>
            )}
          </div>

          {/* Denylist */}
          <div className={`space-y-3 ${allowMode ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">Global Denylist</div>
                <div className="text-xs text-[#64748B]">Always block these merchants</div>
              </div>
              <span className="text-xs font-mono-num text-[#64748B]">
                {(isEditing ? draft?.denylist.length : policies?.denylist.length) ?? 0} blocked
              </span>
            </div>

            {isEditing && !allowMode && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (newDenyMerchant.trim() && draft && !draft.denylist.includes(newDenyMerchant.trim())) {
                    setDraft({ ...draft, denylist: [...draft.denylist, newDenyMerchant.trim()] });
                    setNewDenyMerchant('');
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Add blocked merchant..."
                  value={newDenyMerchant}
                  onChange={e => setNewDenyMerchant(e.target.value)}
                  className="flex-1 h-8 px-3 rounded-[8px] border border-[#E5E7EB] text-xs font-mono-num"
                />
                <Button type="submit" variant="secondary" size="sm">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </form>
            )}

            <div className="flex flex-wrap gap-2">
              {(isEditing ? draft?.denylist : policies?.denylist)?.length === 0 ? (
                <span className="text-xs text-[#64748B]">No merchants on the denylist.</span>
              ) : (
                (isEditing ? draft?.denylist : policies?.denylist)?.map(m => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-mono-num bg-[#F8FAFC] border border-[#E5E7EB] text-[#0F172A]"
                  >
                    {m}
                    {isEditing && !allowMode && (
                      <button
                        type="button"
                        aria-label={`Remove ${m}`}
                        onClick={() => draft && setDraft({ ...draft, denylist: draft.denylist.filter(x => x !== m) })}
                        className="text-[#64748B] hover:text-[#F43F5E]"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Policy Simulator */}
      <PolicySimulator />

      {/* Audit Trail */}
      <Card>
        <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-[#E5E7EB]">
          <Clock className="w-4 h-4 text-[#64748B]" />
          <div>
            <h2 className="text-[16px] font-semibold text-[#0F172A]">Audit Trail</h2>
            <p className="text-xs text-[#64748B]">Immutable log of policy modifications</p>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : history.length === 0 ? (
          <p className="text-xs text-[#64748B] py-6 text-center">No changes recorded yet.</p>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {history.map(h => (
              <div key={h.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#0F172A] font-mono-num font-semibold shrink-0">
                    {h.action}
                  </span>
                  <span className="text-[#0F172A] truncate">{h.detail}</span>
                </div>
                <span className="font-mono-num text-[#64748B] shrink-0">
                  {new Date(h.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RuleRow({
  title,
  desc,
  value,
  min,
  max,
  step,
  prefix = '',
  editing,
  onChange,
}: {
  title: string;
  desc: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  editing: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-[#0F172A]">{title}</div>
          <div className="text-xs text-[#64748B]">{desc}</div>
        </div>
        {editing ? (
          <div className="flex items-center gap-1 shrink-0">
            {prefix && <span className="text-xs font-mono-num text-[#64748B]">{prefix}</span>}
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={e => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) onChange(n);
              }}
              className="w-24 h-8 px-2.5 border border-[#E5E7EB] rounded-[8px] text-sm font-mono-num font-semibold text-right text-[#0F172A]"
            />
          </div>
        ) : (
          <div className="text-sm font-mono-num font-semibold text-[#0F172A] shrink-0">
            {prefix}
            {value.toLocaleString()}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={!editing}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          className="w-full accent-[#4F46E5] cursor-pointer disabled:opacity-60 disabled:cursor-default"
        />
        <div className="flex justify-between text-[11px] font-mono-num text-[#64748B]">
          <span>
            {prefix}
            {min.toLocaleString()}
          </span>
          <span>
            {prefix}
            {max.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
