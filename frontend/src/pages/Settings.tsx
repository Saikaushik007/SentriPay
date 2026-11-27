import { useState, useEffect } from 'react';
import { PageHeader, Card, Button } from '../components/ui/primitives';
import { apiUrl } from '../lib/api';
import { maskApiKey } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, Copy, RotateCcw } from 'lucide-react';

export default function Settings() {
  const toast = useToast();
  const [agents, setAgents] = useState<any[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/agents'))
      .then(r => r.json())
      .then(d => setAgents(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch(apiUrl('/api/reset-demo'), { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Demo database reset');
    } catch {
      toast.error('Failed to reset demo');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader title="Settings" description="Workspace profile, API keys, appearance, and demo data" />

      <Card>
        <h2 className="text-base font-semibold text-[#111827]">Profile</h2>
        <p className="text-xs text-[#6B7280] mt-0.5 mb-4">Workspace administrator details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Workspace</label>
            <input
              readOnly
              value="SentriPay Production Gateway"
              className="w-full h-9 px-3 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Role</label>
            <input
              readOnly
              value="Security Operator"
              className="w-full h-9 px-3 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827]"
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[#111827]">Agent API Keys</h2>
        <p className="text-xs text-[#6B7280] mt-0.5 mb-4">Keys are masked by default</p>
        <div className="divide-y divide-[#E5E7EB]">
          {agents.map(ag => {
            const isShown = !!revealed[ag.id];
            return (
              <div key={ag.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-[#111827]">{ag.name}</div>
                  <div className="text-xs text-[#6B7280] font-mono-num">{ag.id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono-num px-2.5 py-1 rounded bg-[#F3F4F6] text-[#111827]">
                    {isShown ? ag.apiKey : maskApiKey(ag.apiKey)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={isShown ? 'Hide key' : 'Reveal key'}
                    onClick={() => setRevealed(r => ({ ...r, [ag.id]: !isShown }))}
                  >
                    {isShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(ag.apiKey || '');
                      toast.success('API key copied');
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[#111827]">Appearance</h2>
        <p className="text-xs text-[#6B7280] mt-0.5">Light theme is enforced across the workspace.</p>
      </Card>

      <Card className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Data & Demo</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Reset all transactions and seed fresh 1h / 24h / 7d activity.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="w-3.5 h-3.5" />
          {resetting ? 'Resetting…' : 'Reset Demo'}
        </Button>
      </Card>
    </div>
  );
}
