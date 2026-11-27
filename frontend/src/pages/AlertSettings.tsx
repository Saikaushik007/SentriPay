import { useEffect, useState, useCallback } from 'react';
import { Plus, Send, Trash2, RefreshCw } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { useToast } from '../context/ToastContext';
import {
  Card,
  Button,
  StatusBadge,
  PageHeader,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../components/ui/primitives';
import { formatDateTime } from '../lib/utils';

type Webhook = {
  id: string;
  url: string;
  enabled: boolean;
  events: string[];
  createdAt: string;
};

type DeliveryLog = {
  id: string;
  event: string;
  url: string;
  statusCode: number;
  success: boolean;
  createdAt: string;
};

export default function AlertSettings() {
  const toast = useToast();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchSettings = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/alerts/settings'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWebhooks(Array.isArray(data?.webhooks) ? data.webhooks : []);
      setLogs(Array.isArray(data?.deliveryLogs) ? data.deliveryLogs : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load alert settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const addWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim().startsWith('http')) {
      toast.error('Enter a valid HTTP(S) URL');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(apiUrl('/api/alerts/settings/webhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), secret: secret.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUrl('');
      setSecret('');
      toast.success('Webhook added');
      fetchSettings();
    } catch {
      toast.error('Failed to add webhook');
    } finally {
      setAdding(false);
    }
  };

  const sendTest = async (webhookId: string) => {
    try {
      const res = await fetch(apiUrl('/api/alerts/settings/test-webhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Test event delivered');
      fetchSettings();
    } catch {
      toast.error('Failed to send test event');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Alerts"
        description="Configure webhook endpoints for spend anomalies and blocked payments"
        actions={
          <Button variant="secondary" size="sm" onClick={fetchSettings}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchSettings} />}

      {/* Add Webhook Form */}
      <Card>
        <h2 className="text-base font-semibold text-[#111827]">Add webhook</h2>
        <p className="text-xs text-[#6B7280] mt-0.5 mb-4">
          Payloads are signed with HMAC-SHA256 in the X-SentriPay-Signature header.
        </p>
        <form onSubmit={addWebhook} className="flex flex-col sm:flex-row gap-2.5">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks/sentripay"
            className="flex-1 h-9 px-3 text-sm rounded-[8px] border border-[#E5E7EB]"
          />
          <input
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="Optional signing secret"
            className="sm:w-56 h-9 px-3 text-sm rounded-[8px] border border-[#E5E7EB]"
          />
          <Button type="submit" variant="primary" size="md" disabled={adding}>
            <Plus className="w-4 h-4" />
            {adding ? 'Adding…' : 'Add webhook'}
          </Button>
        </form>
      </Card>

      {/* Configured Webhooks */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-base font-semibold text-[#111827]">Webhook endpoints</h2>
        </div>
        {loading ? (
          <div className="p-5">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : webhooks.length === 0 ? (
          <EmptyState
            title="No webhooks yet"
            description="Add a webhook endpoint above to receive real-time anomaly and block notifications."
          />
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {webhooks.map(w => (
              <div key={w.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[#111827] font-mono-num break-all">{w.url}</div>
                  <div className="text-xs text-[#6B7280] mt-0.5">
                    Events: {w.events.join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => sendTest(w.id)}>
                    <Send className="w-3.5 h-3.5" />
                    Send test event
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove webhook"
                    onClick={() => setWebhooks(prev => prev.filter(x => x.id !== w.id))}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Delivery Log */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-base font-semibold text-[#111827]">Delivery log</h2>
          <p className="text-xs text-[#6B7280]">Recent signed webhook dispatches</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-medium text-[#6B7280]">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Event</th>
                <th className="py-2.5 px-4">Endpoint</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      title="No deliveries yet"
                      description="Send a test event to verify your webhook endpoint."
                    />
                  </td>
                </tr>
              ) : (
                logs.map(l => (
                  <tr key={l.id}>
                    <td className="py-2.5 px-4 text-xs text-[#6B7280] font-mono-num whitespace-nowrap">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-mono-num text-[#111827]">{l.event}</td>
                    <td className="py-2.5 px-4 text-xs text-[#6B7280] font-mono-num">{l.url}</td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={l.success ? 'APPROVED' : 'FAILED'} />
                      <span className="ml-2 text-xs font-mono-num text-[#6B7280]">{l.statusCode}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
