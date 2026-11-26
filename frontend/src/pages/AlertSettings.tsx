import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, ShieldAlert, Send, CheckCircle2, AlertTriangle, Key, ExternalLink, RefreshCw } from 'lucide-react';
import { apiUrl } from '../lib/api';

type WebhookConfig = {
  id: string;
  url: string;
  secret: string;
  enabled: boolean;
  events: string[];
  createdAt: string;
};

type WebhookLog = {
  id: string;
  webhookId: string;
  url: string;
  event: string;
  payload: any;
  signature: string;
  statusCode: number;
  response: string;
  success: boolean;
  createdAt: string;
};

type AnomalyAlert = {
  id: string;
  agentId?: string;
  severity: 'warning' | 'critical';
  type: string;
  message: string;
  baselineSpend: number;
  currentSpend: number;
  ratio: number;
  timestamp: string;
};

export default function AlertSettings() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const loadData = async () => {
    try {
      const [settingsRes, anomalyRes] = await Promise.all([
        fetch(apiUrl('/api/alerts/settings')),
        fetch(apiUrl('/api/anomalies'))
      ]);
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setWebhooks(s.webhooks || []);
        setLogs(s.deliveryLogs || []);
      }
      if (anomalyRes.ok) {
        const a = await anomalyRes.json();
        setAnomalies(a.alerts || []);
      }
    } catch (e) {
      console.error('Failed to load alert settings', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    try {
      const res = await fetch(apiUrl('/api/alerts/settings/webhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, secret: newSecret })
      });
      if (res.ok) {
        setStatusMsg('✓ Webhook endpoint saved');
        setNewUrl('');
        setNewSecret('');
        await loadData();
      }
    } catch (e) {
      setStatusMsg('✗ Failed to add webhook');
    }
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleTestPing = async (webhookId: string) => {
    setTestingId(webhookId);
    try {
      const res = await fetch(apiUrl('/api/alerts/settings/test-webhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId })
      });
      if (res.ok) {
        setStatusMsg('✓ Signed test ping delivered successfully');
        await loadData();
      }
    } catch (e) {
      setStatusMsg('✗ Test ping failed');
    } finally {
      setTestingId(null);
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 24, margin: 0, color: '#18181B' }}>
            Alerts & Webhook Gateway
          </h1>
          <p style={{ color: '#71717A', fontSize: 14, marginTop: 4 }}>
            Autonomous anomaly triggers, spend-doubling detectors, and HMAC-SHA256 signed webhooks
          </p>
        </div>
        <button
          onClick={loadData}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 12,
            background: 'white',
            border: '1px solid #E4E4E7',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            color: '#52525B'
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            background: statusMsg.startsWith('✓') ? '#ECFDF5' : '#FFF1F2',
            color: statusMsg.startsWith('✓') ? '#059669' : '#E11D48',
            border: `1px solid ${statusMsg.startsWith('✓') ? '#A7F3D0' : '#FECDD3'}`,
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 20
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* ── Active Anomalies Banner (Spend Doubled against Baseline) ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16, color: '#18181B', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={18} style={{ color: '#E11D48' }} /> Active Agent Anomalies (PostgreSQL Baseline Analysis)
        </h2>

        {anomalies.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '24px 20px', textAlign: 'center', color: '#10B981', fontSize: 13, fontWeight: 700 }}>
            <CheckCircle2 size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
            All autonomous agents are operating within normal baseline limits. No spend-doubling detected.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {anomalies.map(a => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'linear-gradient(135deg, #FFF1F2 0%, #FFFFFF 100%)',
                  border: '1px solid #FECDD3',
                  borderRadius: 16,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFE4E6', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#E11D48', letterSpacing: '0.05em' }}>
                        Spend Doubled Anomaly
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{new Date(a.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: '#18181B' }}>
                      {a.message}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, textAlign: 'right', flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase' }}>Baseline</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 800, color: '#475569' }}>${a.baselineSpend.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#E11D48', textTransform: 'uppercase' }}>Current 24h</div>
                    <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 800, color: '#E11D48' }}>${a.currentSpend.toFixed(2)}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── 2-Column Grid: Webhook Settings & Delivery Log ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: Webhook Destination Settings */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 20, padding: 24 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16, color: '#18181B', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={18} style={{ color: '#4F46E5' }} /> Webhook Dispatch Endpoints
          </h2>

          {/* Form */}
          <form onSubmit={handleAddWebhook} style={{ marginBottom: 24, padding: 16, background: '#F8FAFC', borderRadius: 14, border: '1px solid #E2E8F0' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>
                Target Endpoint URL
              </label>
              <input
                type="url"
                required
                placeholder="https://your-domain.com/webhooks/spend-guard"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'monospace', outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>
                Signing Secret (Optional, auto-generated if blank)
              </label>
              <input
                type="password"
                placeholder="whsec_..."
                value={newSecret}
                onChange={e => setNewSecret(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 12, fontFamily: 'monospace', outline: 'none' }}
              />
            </div>
            <button
              type="submit"
              style={{ width: '100%', padding: '9px 16px', borderRadius: 10, background: '#4F46E5', color: 'white', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              + Register Signed Webhook
            </button>
          </form>

          {/* Endpoints List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {webhooks.map(w => (
              <div key={w.id} style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#FAFAFA' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: w.enabled ? '#10B981' : '#94A3B8' }} />
                    <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>{w.url}</span>
                  </div>
                  <button
                    onClick={() => handleTestPing(w.id)}
                    disabled={testingId === w.id}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: '#EEF2FF',
                      border: '1px solid #C7D2FE',
                      color: '#4F46E5',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Send size={11} /> {testingId === w.id ? 'Sending...' : 'Test Ping'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#64748B' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Key size={12} /> HMAC-SHA256 Active
                  </span>
                  <span>Events: {w.events.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Webhook Delivery Log */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 20, padding: 24 }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 16, color: '#18181B', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExternalLink size={18} style={{ color: '#059669' }} /> Signed Delivery Log
          </h2>

          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8', fontSize: 13 }}>
              No deliveries logged yet. Send a test ping or trigger an anomaly to record signed webhook events.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
              {logs.map(log => (
                <div key={log.id} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#15803D', fontSize: 10, fontWeight: 800, fontFamily: 'monospace' }}>
                        {log.statusCode} OK
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{log.event}</span>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#94A3B8' }}>{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Signature: {log.signature.slice(0, 36)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
