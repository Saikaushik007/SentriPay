import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Store, ArrowRight, ShieldCheck, ShieldAlert, AlertTriangle, Activity } from 'lucide-react';
import { apiUrl, socket } from '../lib/api';

type MoneyFlowTx = {
  id: string;
  amount: number;
  merchant: string;
  agentId: string;
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  riskScore?: number | null;
  createdAt: string;
};

interface Props {
  onSelectTx?: (txId: string) => void;
}

export default function MoneyFlowMap({ onSelectTx }: Props) {
  const [flows, setFlows] = useState<MoneyFlowTx[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);

  const fetchFlows = async () => {
    try {
      const res = await fetch(apiUrl('/api/transactions/money-flow?limit=8'));
      if (res.ok) {
        const data = await res.json();
        setFlows(data.transactions || []);
        if (data.transactions?.length > 0 && !activeFlowId) {
          setActiveFlowId(data.transactions[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load money flow transactions', e);
    }
  };

  useEffect(() => {
    fetchFlows();

    const handleNewTx = (newTx: any) => {
      setFlows(prev => [newTx, ...prev.slice(0, 7)]);
      setActiveFlowId(newTx.id);
    };

    socket.on('new_transaction', handleNewTx);
    return () => {
      socket.off('new_transaction', handleNewTx);
    };
  }, []);

  const activeTx = flows.find(f => f.id === activeFlowId) || flows[0];

  const getStatusColor = (status?: string) => {
    if (status === 'APPROVED') return { stroke: '#10B981', bg: '#ECFDF5', text: '#059669', badgeBg: '#A7F3D0' };
    if (status === 'BLOCKED') return { stroke: '#E11D48', bg: '#FFF1F2', text: '#E11D48', badgeBg: '#FECDD3' };
    return { stroke: '#D97706', bg: '#FFFBEB', text: '#D97706', badgeBg: '#FDE68A' };
  };

  const statusColors = getStatusColor(activeTx?.status);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        borderRadius: 24,
        padding: 24,
        border: '1px solid #E2E8F0',
        boxShadow: '0 8px 32px -12px rgba(15, 23, 42, 0.08)',
        marginBottom: 24
      }}
    >
      {/* Title & Live Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: '#EEF2FF',
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px -2px rgba(79, 70, 229, 0.3)'
            }}
          >
            <Activity size={18} />
          </div>
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 17, margin: 0, color: '#0F172A' }}>
              Live Money-Flow Map
            </h3>
            <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>
              Real agent-to-merchant interceptor stream with state animation
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
            Real Postgres Stream
          </span>
        </div>
      </div>

      {/* Main Visual Topology Diagram */}
      <div
        style={{
          background: 'radial-gradient(ellipse at center, #F8FAFC 0%, #EEF2F6 100%)',
          borderRadius: 20,
          padding: '28px 24px',
          border: '1px solid #E2E8F0',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          {/* Agent Node */}
          <motion.div
            whileHover={{ scale: 1.04 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'white',
              borderRadius: 16,
              padding: '16px 20px',
              border: '1px solid #CBD5E1',
              boxShadow: '0 4px 16px -4px rgba(0,0,0,0.06)',
              minWidth: 140
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8
              }}
            >
              <Bot size={22} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>
              Source Agent
            </span>
            <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
              {activeTx ? activeTx.agentId : 'Scanning...'}
            </span>
          </motion.div>

          {/* Animated Connecting Vector: Agent -> Gateway */}
          <div style={{ flex: 1, position: 'relative', height: 28, margin: '0 12px', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%', height: 2, background: '#CBD5E1', position: 'relative' }}>
              <motion.div
                animate={{ x: ['0%', '100%'], opacity: [0, 1, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  top: -4,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#4F46E5',
                  boxShadow: '0 0 10px #4F46E5'
                }}
              />
            </div>
          </div>

          {/* Gateway Policy Interceptor Node */}
          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: statusColors.bg,
              borderRadius: 20,
              padding: '18px 24px',
              border: `2px solid ${statusColors.stroke}`,
              boxShadow: `0 8px 24px -6px ${statusColors.stroke}35`,
              minWidth: 180,
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: statusColors.badgeBg,
                color: statusColors.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8
              }}
            >
              {activeTx?.status === 'APPROVED' ? (
                <ShieldCheck size={26} />
              ) : activeTx?.status === 'BLOCKED' ? (
                <ShieldAlert size={26} />
              ) : (
                <AlertTriangle size={26} />
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: statusColors.text, letterSpacing: '0.07em' }}>
              SentriPay Gateway
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 900,
                color: statusColors.text,
                marginTop: 3,
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              {activeTx?.status || 'AWAITING'}
            </span>
            <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
              ${activeTx ? activeTx.amount.toFixed(2) : '0.00'}
            </span>
          </motion.div>

          {/* Animated Connecting Vector: Gateway -> Merchant */}
          <div style={{ flex: 1, position: 'relative', height: 28, margin: '0 12px', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%', height: 2, background: '#CBD5E1', position: 'relative' }}>
              {activeTx?.status === 'APPROVED' ? (
                <motion.div
                  animate={{ x: ['0%', '100%'], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute',
                    top: -4,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#10B981',
                    boxShadow: '0 0 10px #10B981'
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: -6,
                    transform: 'translateX(-50%)',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: statusColors.stroke,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 9,
                    fontWeight: 900
                  }}
                >
                  ✕
                </div>
              )}
            </div>
          </div>

          {/* Destination Merchant Node */}
          <motion.div
            whileHover={{ scale: 1.04 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'white',
              borderRadius: 16,
              padding: '16px 20px',
              border: '1px solid #CBD5E1',
              boxShadow: '0 4px 16px -4px rgba(0,0,0,0.06)',
              minWidth: 140
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#F1F5F9',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8
              }}
            >
              <Store size={22} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>
              Target Merchant
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginTop: 2, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeTx ? activeTx.merchant : 'Waiting...'}
            </span>
          </motion.div>
        </div>

        {/* Explainability Bar for the Active Flow */}
        {activeTx && (
          <div
            style={{
              marginTop: 20,
              background: 'white',
              borderRadius: 12,
              padding: '10px 16px',
              border: `1px solid ${statusColors.stroke}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: statusColors.text }}>Reason:</span>
              <span style={{ color: '#334155' }}>{activeTx.reason}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, fontFamily: 'monospace' }}>
              <span style={{ color: '#64748B' }}>Risk Score: <strong>{activeTx.riskScore ?? '—'}/100</strong></span>
              <button
                onClick={() => onSelectTx?.(activeTx.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4F46E5',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}
              >
                Inspect <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selector pills for recent Postgres transactions */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 8, letterSpacing: '0.05em' }}>
          Select Recent Transaction Stream
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {flows.map(tx => {
            const isSelected = tx.id === activeTx?.id;
            const c = getStatusColor(tx.status);
            return (
              <button
                key={tx.id}
                onClick={() => setActiveFlowId(tx.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  border: `1px solid ${isSelected ? c.stroke : '#E2E8F0'}`,
                  background: isSelected ? c.bg : 'white',
                  color: isSelected ? c.text : '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all .15s'
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.stroke }} />
                <span>${tx.amount.toFixed(0)}</span>
                <span style={{ opacity: 0.7 }}>→ {tx.merchant.slice(0, 10)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
