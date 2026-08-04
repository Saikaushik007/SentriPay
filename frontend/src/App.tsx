import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Activity, DollarSign, Clock, Hash } from 'lucide-react';

const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');

type Transaction = {
  id: string;
  amount: number;
  merchant: string;
  agentId: string;
  status: 'APPROVED' | 'BLOCKED' | 'FLAGGED';
  reason: string;
  timestamp: string;
};

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('new_transaction', (tx: Transaction) => {
      setTransactions((prev) => [tx, ...prev].slice(0, 50)); // Keep last 50
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_transaction');
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-textMain flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <h1 className="font-semibold text-lg tracking-tight">Agent Spend Policy Guard</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
            )}
          </span>
          <span className="text-textMuted">{isConnected ? 'System Active' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Live Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              Live Transaction Feed
            </h2>
            <span className="text-xs text-textMuted font-mono">Listening for x402 events...</span>
          </div>
          
          <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-border text-xs font-semibold text-textMuted uppercase tracking-wider bg-black/20">
              <div className="col-span-2">Time</div>
              <div className="col-span-3">Merchant</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Reason</div>
            </div>
            
            <div className="flex flex-col max-h-[600px] overflow-y-auto overflow-x-hidden p-2">
              <AnimatePresence initial={false}>
                {transactions.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-48 text-textMuted gap-2"
                  >
                    <Clock size={24} className="opacity-50" />
                    <p className="text-sm">Waiting for agent transactions...</p>
                  </motion.div>
                ) : (
                  transactions.map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="grid grid-cols-12 gap-4 p-3 items-center rounded-lg hover:bg-border/30 transition-colors mb-1"
                    >
                      <div className="col-span-2 text-xs text-textMuted font-mono">
                        {new Date(tx.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                      </div>
                      <div className="col-span-3 text-sm font-medium truncate">
                        {tx.merchant}
                      </div>
                      <div className="col-span-2 text-sm font-mono flex items-center gap-1">
                        <DollarSign size={12} className="text-textMuted" />
                        {tx.amount.toFixed(2)}
                      </div>
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${
                          tx.status === 'APPROVED' ? 'bg-success/10 text-success border-success/20' : 
                          tx.status === 'BLOCKED' ? 'bg-danger/10 text-danger border-danger/20' : 
                          'bg-warning/10 text-warning border-warning/20'
                        }`}>
                          {tx.status === 'APPROVED' && <ShieldCheck size={12} />}
                          {tx.status === 'BLOCKED' && <ShieldAlert size={12} />}
                          {tx.status}
                        </span>
                      </div>
                      <div className="col-span-3 text-xs text-textMuted truncate">
                        {tx.reason}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Col: Dummy Analytics / Config Sidebar */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-medium text-textMuted mb-4">Policy Engine Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/30 p-4 rounded-lg border border-border">
                <div className="text-xs text-textMuted mb-1 flex items-center gap-1">
                  <Hash size={12} /> Total Processed
                </div>
                <div className="text-2xl font-semibold font-mono">{transactions.length}</div>
              </div>
              <div className="bg-black/30 p-4 rounded-lg border border-border">
                <div className="text-xs text-textMuted mb-1 flex items-center gap-1">
                  <ShieldAlert size={12} /> Blocked
                </div>
                <div className="text-2xl font-semibold font-mono text-danger">
                  {transactions.filter(t => t.status === 'BLOCKED').length}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex-1">
            <h3 className="text-sm font-medium text-textMuted mb-4">Active Policies</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-border">
                <div>
                  <div className="text-sm font-medium">Per-Tx Limit</div>
                  <div className="text-xs text-textMuted">Max spend per x402 intent</div>
                </div>
                <div className="text-sm font-mono bg-border px-2 py-1 rounded">$1,000</div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-border">
                <div>
                  <div className="text-sm font-medium">Daily Budget</div>
                  <div className="text-xs text-textMuted">Rolling 24h window</div>
                </div>
                <div className="text-sm font-mono bg-border px-2 py-1 rounded">$500/day</div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-border">
                <div>
                  <div className="text-sm font-medium">Strict Allowlist</div>
                  <div className="text-xs text-textMuted">Only pre-approved IDs</div>
                </div>
                <div className="w-8 h-4 bg-primary rounded-full relative">
                  <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
