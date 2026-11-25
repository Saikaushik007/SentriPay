import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, AlertCircle, Info } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { apiUrl } from '../lib/api';

type HeatmapData = {
  merchants: string[];
  matrix: Record<string, Record<number, { count: number; avgRisk: number; totalSpend: number; blocked: number }>>;
};

type AgentForecast = {
  agentId: string;
  name: string;
  currentSpend: number;
  dailyBudget: number;
  hourlyBurnRate: number;
  projectedEODSpend: number;
  projectedBreach: boolean;
  breachHour: string | null;
  burnPercentage: number;
  trajectory: { hour: string; actualOrProjected: number; budgetLine: number; isProjected: boolean }[];
};

export default function RiskHeatmapAndForecast() {
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [forecasts, setForecasts] = useState<AgentForecast[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<{ merchant: string; hour: number; data: any } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [hmRes, fcRes] = await Promise.all([
          fetch(apiUrl('/api/analytics/risk-heatmap')),
          fetch(apiUrl('/api/analytics/spend-forecast'))
        ]);
        if (hmRes.ok) {
          const hmData = await hmRes.json();
          setHeatmap(hmData);
        }
        if (fcRes.ok) {
          const fcData = await fcRes.json();
          setForecasts(fcData.forecasts || []);
          if (fcData.forecasts?.length > 0 && !selectedAgentId) {
            setSelectedAgentId(fcData.forecasts[0].agentId);
          }
        }
      } catch (err) {
        console.error('Failed to load heatmap and forecast data', err);
      }
    }
    loadData();
  }, []);

  const activeForecast = forecasts.find(f => f.agentId === selectedAgentId) || forecasts[0];

  // Helper to get heat color based on real risk score and volume
  const getCellColor = (avgRisk: number, count: number) => {
    if (count === 0) return { bg: '#F8FAFC', border: '#F1F5F9', text: '#94A3B8' };
    if (avgRisk >= 75) return { bg: '#FFE4E6', border: '#FDA4AF', text: '#BE123C' };
    if (avgRisk >= 45) return { bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' };
    return { bg: '#DCFCE7', border: '#BBF7D0', text: '#15803D' };
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        marginBottom: 28
      }}
    >
      {/* ── 1. Real Merchant-by-Hour Risk Heatmap ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFFDF8 100%)',
          borderRadius: 24,
          padding: 24,
          border: '1px solid #FED7AA',
          boxShadow: '0 8px 32px -12px rgba(245, 158, 11, 0.12)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Flame size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 16, margin: 0, color: '#18181B' }}>
                Merchant Risk Heatmap
              </h3>
              <p style={{ fontSize: 12, color: '#71717A', margin: '2px 0 0' }}>
                24-Hour temporal risk density matrix computed from PostgreSQL
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontFamily: 'monospace' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#DCFCE7' }} />Low</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#FEF3C7' }} />Med</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#FFE4E6' }} />High</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 460 }}>
            {/* Header row: hours */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(24, 1fr)', gap: 2, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Merchant</span>
              {hours.map(h => (
                <span
                  key={h}
                  style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    color: '#94A3B8',
                    textAlign: 'center',
                    fontWeight: h % 4 === 0 ? 800 : 400
                  }}
                >
                  {h % 4 === 0 ? `${h}h` : '·'}
                </span>
              ))}
            </div>

            {/* Merchant Rows */}
            {heatmap?.merchants.map(m => {
              const row = heatmap.matrix[m] || {};
              return (
                <div key={m} style={{ display: 'grid', gridTemplateColumns: '120px repeat(24, 1fr)', gap: 2, marginBottom: 3 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#334155',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '20px'
                    }}
                    title={m}
                  >
                    {m}
                  </span>
                  {hours.map(h => {
                    const cell = row[h] || { count: 0, avgRisk: 0, totalSpend: 0, blocked: 0 };
                    const style = getCellColor(cell.avgRisk, cell.count);
                    return (
                      <motion.div
                        key={h}
                        whileHover={{ scale: 1.25, zIndex: 10 }}
                        onClick={() => setActiveCell({ merchant: m, hour: h, data: cell })}
                        style={{
                          height: 20,
                          borderRadius: 3,
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: style.text
                        }}
                        title={`${m} @ ${h}:00 — ${cell.count} txs, Avg Risk: ${cell.avgRisk}`}
                      >
                        {cell.count > 0 ? (cell.blocked > 0 ? '✕' : cell.count) : ''}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Heatmap Cell Detail Info */}
        <div style={{ marginTop: 14, minHeight: 40, padding: '8px 12px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
          {activeCell ? (
            <>
              <div>
                <strong style={{ color: '#0F172A' }}>{activeCell.merchant}</strong> at <span style={{ fontFamily: 'monospace' }}>{activeCell.hour}:00</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontFamily: 'monospace' }}>
                <span>Txs: <strong>{activeCell.data.count}</strong></span>
                <span>Avg Risk: <strong>{activeCell.data.avgRisk}/100</strong></span>
                <span>Volume: <strong>${activeCell.data.totalSpend.toFixed(2)}</strong></span>
                <span style={{ color: activeCell.data.blocked > 0 ? '#E11D48' : '#059669' }}>
                  Blocked: <strong>{activeCell.data.blocked}</strong>
                </span>
              </div>
            </>
          ) : (
            <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Info size={13} /> Click any cell in the heatmap matrix to inspect hourly risk specifics
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Spend Forecast & Projected Budget Line per Agent ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)',
          borderRadius: 24,
          padding: 24,
          border: '1px solid #BBF7D0',
          boxShadow: '0 8px 32px -12px rgba(16, 185, 129, 0.12)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: '#DCFCE7',
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 16, margin: 0, color: '#18181B' }}>
                Spend Forecast & Trajectory
              </h3>
              <p style={{ fontSize: 12, color: '#71717A', margin: '2px 0 0' }}>
                Agent burn rate projection vs. enforced daily budget limit
              </p>
            </div>
          </div>

          {/* Agent Picker */}
          <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 2 }}>
            {forecasts.map(f => (
              <button
                key={f.agentId}
                onClick={() => setSelectedAgentId(f.agentId)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedAgentId === f.agentId ? 'white' : 'transparent',
                  color: selectedAgentId === f.agentId ? '#16A34A' : '#64748B',
                  boxShadow: selectedAgentId === f.agentId ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {f.agentId.replace('agent-', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Forecast Metrics Bar */}
        {activeForecast && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>Current Spend</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: '#0F172A', marginTop: 2 }}>
                ${activeForecast.currentSpend.toFixed(2)}
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: 12, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>Projected EOD</div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: activeForecast.projectedBreach ? '#E11D48' : '#059669',
                  marginTop: 2
                }}
              >
                ${activeForecast.projectedEODSpend.toFixed(2)}
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: 12, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>Daily Cap</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: '#475569', marginTop: 2 }}>
                ${activeForecast.dailyBudget.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Breach Alert Pill if Burn Rate Exceeds Cap */}
        {activeForecast?.projectedBreach && (
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: '#FFF1F2',
              border: '1px solid #FECDD3',
              color: '#BE123C',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 12
            }}
          >
            <AlertCircle size={14} /> Warning: Agent burn rate will breach budget cap by {activeForecast.breachHour || 'EOD'}!
          </div>
        )}

        {/* 24-Hour Projected Budget Line Chart */}
        {activeForecast && (
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeForecast.trajectory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#94A3B8' }} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#94A3B8' }} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, fontSize: 11, fontFamily: 'monospace' }}
                  formatter={(val: any, name: any) => [`$${Number(val).toFixed(2)}`, name === 'actualOrProjected' ? 'Spend Trajectory' : 'Enforced Cap']}
                />
                <Area type="monotone" dataKey="actualOrProjected" fill="#BBF7D0" stroke="#16A34A" strokeWidth={2} />
                <Line type="step" dataKey="budgetLine" stroke="#E11D48" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
