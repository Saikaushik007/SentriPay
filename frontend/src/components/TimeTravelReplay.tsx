import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, Play, Pause, RotateCcw } from 'lucide-react';

type Transaction = {
  id: string;
  amount: number;
  merchant: string;
  agentId: string;
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  riskScore?: number;
  settlementId?: string;
  createdAt?: string;
  timestamp?: string;
};

interface Props {
  transactions: Transaction[];
  onReplaySliceChange: (activeTransactions: Transaction[] | null) => void;
}

export default function TimeTravelReplay({ transactions, onReplaySliceChange }: Props) {
  const [isReplaying, setIsReplaying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(0);

  // Chronological order (oldest to newest)
  const chronological = [...transactions].reverse();

  useEffect(() => {
    if (isReplaying) {
      const currentSlice = chronological.slice(0, sliderIndex + 1).reverse();
      onReplaySliceChange(currentSlice);
    } else {
      onReplaySliceChange(null);
    }
  }, [isReplaying, sliderIndex, transactions.length]);

  // Auto-play interval
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && isReplaying) {
      interval = setInterval(() => {
        setSliderIndex(prev => {
          if (prev >= chronological.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 700);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, isReplaying, chronological.length]);

  const handleToggleReplay = () => {
    if (!isReplaying) {
      setIsReplaying(true);
      setSliderIndex(Math.floor(chronological.length / 2));
    } else {
      setIsReplaying(false);
      setIsPlaying(false);
    }
  };

  const currentReplayTx = chronological[sliderIndex] || chronological[0];

  return (
    <div
      style={{
        background: isReplaying ? 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%)' : 'white',
        borderRadius: 20,
        padding: '16px 20px',
        border: `1.5px solid ${isReplaying ? '#3B82F6' : '#E2E8F0'}`,
        boxShadow: isReplaying ? '0 8px 30px -10px rgba(59, 130, 246, 0.25)' : '0 4px 16px -4px rgba(0,0,0,0.05)',
        marginBottom: 24,
        transition: 'all .25s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: isReplaying ? '#DBEAFE' : '#F1F5F9',
              color: isReplaying ? '#2563EB' : '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <History size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 16, margin: 0, color: '#0F172A' }}>
                Time-Travel Replay
              </h3>
              {isReplaying && (
                <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 6, background: '#DBEAFE', color: '#1E40AF' }}>
                  REPLAY ACTIVE ({sliderIndex + 1}/{chronological.length})
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>
              Interactive ledger scrub slider to replay historical decisions and metrics
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isReplaying && (
            <>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 14px',
                  borderRadius: 10,
                  background: isPlaying ? '#EF4444' : '#2563EB',
                  color: 'white',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {isPlaying ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Auto-Play</>}
              </button>
              <button
                onClick={() => setSliderIndex(0)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  borderRadius: 10,
                  background: 'white',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
                title="Rewind to start"
              >
                <RotateCcw size={12} />
              </button>
            </>
          )}

          <button
            onClick={handleToggleReplay}
            style={{
              padding: '7px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              background: isReplaying ? '#FEE2E2' : '#EEF2FF',
              color: isReplaying ? '#B91C1C' : '#4F46E5',
              border: `1px solid ${isReplaying ? '#FECDD3' : '#C7D2FE'}`,
              cursor: 'pointer'
            }}
          >
            {isReplaying ? 'Exit Replay' : 'Enter Time-Travel Mode'}
          </button>
        </div>
      </div>

      {/* Scrub Slider */}
      {isReplaying && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>Oldest</span>
            <input
              type="range"
              min={0}
              max={chronological.length - 1}
              value={sliderIndex}
              onChange={e => setSliderIndex(parseInt(e.target.value, 10))}
              style={{ flex: 1, cursor: 'pointer', accentColor: '#2563EB' }}
            />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>Latest</span>
          </div>

          {currentReplayTx && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 14px',
                borderRadius: 10,
                background: 'white',
                border: '1px solid #DBEAFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                fontFamily: 'monospace'
              }}
            >
              <div>
                <strong>Replay Point:</strong> {new Date(currentReplayTx.createdAt || currentReplayTx.timestamp || '').toLocaleString()}
              </div>
              <div>
                <strong>Event:</strong> {currentReplayTx.agentId} → {currentReplayTx.merchant} (${currentReplayTx.amount.toFixed(2)}) —{' '}
                <span style={{ fontWeight: 800, color: currentReplayTx.status === 'APPROVED' ? '#059669' : '#E11D48' }}>
                  {currentReplayTx.status}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
