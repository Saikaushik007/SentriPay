import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, ArrowRight, RefreshCw } from 'lucide-react';
import { apiUrl, socket } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useTimeRange } from '../context/TimeRangeContext';
import {
  Card,
  Button,
  StatusBadge,
  AgentInitials,
  PageHeader,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../components/ui/primitives';
import { formatCurrency } from '../lib/utils';

type AgentRow = {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'PAUSED';
  dailyBudget: number;
  spentToday: number;
  approvalRate: string;
  total: number;
  blocked: number;
  flagged: number;
};

export default function Agents() {
  const toast = useToast();
  const { timeRange } = useTimeRange();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);
  const [newBudget, setNewBudget] = useState('');

  const fetchAgents = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/agents?range=${timeRange}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAgents();
    const onUpdate = () => fetchAgents();
    socket.on('agent_updated', onUpdate);
    socket.on('new_transaction', onUpdate);
    socket.on('demo_reset', onUpdate);
    return () => {
      socket.off('agent_updated', onUpdate);
      socket.off('new_transaction', onUpdate);
      socket.off('demo_reset', onUpdate);
    };
  }, [fetchAgents]);

  const togglePause = async (ag: AgentRow) => {
    try {
      const res = await fetch(apiUrl(`/api/agents/${ag.id}/pause`), { method: 'PATCH' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`${ag.name} ${ag.status === 'PAUSED' ? 'resumed' : 'paused'}`);
      fetchAgents();
    } catch {
      toast.error('Failed to update agent status');
    }
  };

  const saveBudget = async () => {
    if (!editingAgent) return;
    const val = parseFloat(newBudget);
    if (Number.isNaN(val) || val <= 0) {
      toast.error('Enter a valid positive budget');
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/agents/${editingAgent.id}/budget`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyBudget: val }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Updated daily budget for ${editingAgent.name}`);
      setEditingAgent(null);
      fetchAgents();
    } catch {
      toast.error('Failed to update daily budget');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agents"
        description="Autonomous AI agents, daily spend limits, and enforcement status"
        actions={
          <Button variant="secondary" size="sm" onClick={fetchAgents}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchAgents} />}

      {/* Summary KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card interactive className="p-4">
          <div className="text-xs font-medium text-[#64748B]">Active Agents</div>
          <div className="text-2xl font-semibold font-mono-num text-[#0F172A] mt-1">
            {agents.filter(a => a.status === 'ACTIVE').length}
            <span className="text-sm font-normal text-[#64748B]"> / {agents.length}</span>
          </div>
        </Card>
        <Card interactive className="p-4">
          <div className="text-xs font-medium text-[#64748B]">Spend ({timeRange})</div>
          <div data-testid="agents-total-spend" className="text-2xl font-semibold font-mono-num text-[#0F172A] mt-1">
            {formatCurrency(agents.reduce((s, a) => s + (a.spentToday || 0), 0))}
          </div>
        </Card>
        <Card interactive className="p-4">
          <div className="text-xs font-medium text-[#64748B]">Combined Daily Budget</div>
          <div className="text-2xl font-semibold font-mono-num text-[#0F172A] mt-1">
            {formatCurrency(agents.reduce((s, a) => s + (a.dailyBudget || 0), 0))}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-medium text-[#6B7280]">
                <th className="py-2.5 px-4">Agent</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Daily Budget Usage</th>
                <th className="py-2.5 px-4 text-right">Spend ({timeRange})</th>
                <th className="py-2.5 px-4 text-right" title="Approved decisions ÷ all decisions in the selected window">
                  Approval Rate ({timeRange})
                </th>
                <th className="py-2.5 px-4 text-right">Blocks / Flags</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td colSpan={7} className="py-3 px-4">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No agents found" description="Reset demo data to bootstrap agents." />
                  </td>
                </tr>
              ) : (
                agents.map(ag => {
                  const pct = ag.dailyBudget > 0 ? Math.min(100, Math.round((ag.spentToday / ag.dailyBudget) * 100)) : 0;
                  return (
                    <tr key={ag.id} className="hover:bg-[#F6F7FB] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <AgentInitials agentId={ag.id} name={ag.name} />
                          <div>
                            <div className="font-medium text-[#0F172A]">{ag.name}</div>
                            <div className="text-xs text-[#64748B] font-mono-num">{ag.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={ag.status} />
                      </td>
                      <td className="py-3 px-4 min-w-[180px]">
                        <div className="flex items-center justify-between text-xs text-[#64748B] mb-1 font-mono-num">
                          <span>{pct}%</span>
                          <span>{formatCurrency(ag.dailyBudget)}</span>
                        </div>
                        <div className="h-2 bg-[#E5E7EB]/70 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background:
                                pct > 85
                                  ? '#F43F5E'
                                  : pct > 65
                                    ? '#F59E0B'
                                    : 'linear-gradient(90deg, #4F46E5, #7C3AED)',
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-medium text-[#111827]">
                        {formatCurrency(ag.spentToday)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-[#111827]">
                        {ag.approvalRate}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-xs text-[#6B7280]">
                        {ag.blocked} / {ag.flagged}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => togglePause(ag)}>
                            {ag.status === 'PAUSED' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                            {ag.status === 'PAUSED' ? 'Resume' : 'Pause'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingAgent(ag);
                              setNewBudget(String(ag.dailyBudget));
                            }}
                          >
                            Edit limit
                          </Button>
                          <Link
                            to={`/agents/${ag.id}`}
                            className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-[8px] text-[#4F46E5] hover:bg-[#EEF2FF]"
                          >
                            Detail
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setEditingAgent(null)} />
          <div className="relative bg-white rounded-[12px] border border-[#E5E7EB] shadow-xl max-w-sm w-full p-5 z-10 space-y-4">
            <h3 className="text-base font-semibold text-[#111827]">Edit daily budget</h3>
            <p className="text-xs text-[#6B7280]">{editingAgent.name}</p>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">Daily budget (USD)</label>
              <input
                type="number"
                value={newBudget}
                onChange={e => setNewBudget(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-[8px] border border-[#E5E7EB] font-mono-num"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingAgent(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={saveBudget}>
                Save limit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
