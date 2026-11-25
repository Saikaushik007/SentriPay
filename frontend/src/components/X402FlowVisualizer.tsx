import { useState } from 'react';
import {
  Play, RefreshCw, CheckCircle2,
  Lock, Key, Sparkles
} from 'lucide-react';
import { apiUrl } from '../lib/api';

export default function X402FlowVisualizer() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [step1Data, setStep1Data] = useState<any>(null);
  const [step2Data, setStep2Data] = useState<any>(null);
  const [step3Data, setStep3Data] = useState<any>(null);

  const runFlow = async () => {
    setIsRunning(true);
    setCurrentStep(1);
    setStep1Data(null);
    setStep2Data(null);
    setStep3Data(null);

    try {
      // ── Step 1: Request protected endpoint without proof ──────────────────
      const res1 = await fetch(apiUrl('/api/x402/resource'));
      const data1 = await res1.json();
      setStep1Data({
        status: res1.status,
        statusText: res1.statusText || 'Payment Required',
        body: data1
      });

      await new Promise(r => setTimeout(r, 1200));
      setCurrentStep(2);

      // ── Step 2: Agent intercepts 402, routes intent through SentriPay ─────
      const res2 = await fetch(apiUrl('/api/payment-intent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-beta-002',
          merchant: data1.paymentRequirements?.merchant || 'OpenAI API',
          amount: data1.paymentRequirements?.amount || 45.00
        })
      });
      const data2 = await res2.json();
      setStep2Data({
        status: res2.status,
        body: data2
      });

      await new Promise(r => setTimeout(r, 1400));
      setCurrentStep(3);

      // ── Step 3: Agent retries resource with X-Payment-Proof header ────────
      const proof = data2.settlementId || 'SXP-SIMULATED-PROOF-01';
      const res3 = await fetch(apiUrl('/api/x402/resource'), {
        headers: {
          'X-Payment-Proof': proof
        }
      });
      const data3 = await res3.json();
      setStep3Data({
        status: res3.status,
        proof,
        body: data3
      });

      setCurrentStep(4); // Completed
    } catch (err: any) {
      console.error('x402 flow failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div
      className="rounded-3xl border overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)',
        borderColor: '#312E81',
        boxShadow: '0 16px 40px -15px rgba(30, 27, 75, 0.4)'
      }}
    >
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-indigo-900/60 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono uppercase tracking-widest mb-1.5">
            <Sparkles size={14} /> Protocol Simulation
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Live x402 Autonomous Payment Flow
          </h2>
          <p className="text-xs text-indigo-200/80 mt-1 max-w-xl">
            Simulate an autonomous agent encountering an HTTP 402 challenge, getting cleared by SentriPay's policy engine, and unlocking the resource with cryptographic proof.
          </p>
        </div>

        <button
          onClick={runFlow}
          disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
        >
          {isRunning ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Play size={14} className="fill-current" />
          )}
          <span>{isRunning ? 'Executing Flow...' : 'Run x402 Protocol Flow'}</span>
        </button>
      </div>

      {/* Interactive 3-Step Pipeline */}
      <div className="p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* STEP 1: HTTP 402 Challenge */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              currentStep >= 1 ? 'border-amber-500/50 bg-slate-900/90' : 'border-slate-800 bg-slate-900/40 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Step 1: Resource Challenge
              </span>
              <Lock size={16} className="text-amber-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">HTTP 402 Payment Required</h4>
            <p className="text-[11px] text-slate-400 mb-3">
              Agent requests protected API endpoint without payment credentials.
            </p>
            {step1Data ? (
              <div className="p-3 rounded-xl bg-slate-950 font-mono text-[10px] text-amber-300 border border-amber-500/20 overflow-x-auto space-y-1">
                <div>HTTP/1.1 402 Payment Required</div>
                <div className="text-slate-400">Amount: $45.00 (USD)</div>
                <div className="text-slate-400">Merchant: OpenAI API</div>
              </div>
            ) : (
              <div className="h-16 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center text-[11px] text-slate-500 font-mono">
                {currentStep === 0 ? 'Awaiting execution' : 'Dispatching GET...'}
              </div>
            )}
          </div>

          {/* STEP 2: SentriPay Gateway Clearance */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              currentStep >= 2 ? 'border-indigo-500/50 bg-slate-900/90' : 'border-slate-800 bg-slate-900/40 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Step 2: Policy Interception
              </span>
              <Key size={16} className="text-indigo-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">SentriPay Evaluation</h4>
            <p className="text-[11px] text-slate-400 mb-3">
              Engine runs limits, budget, allowlists, and risk scores (&lt;15ms).
            </p>
            {step2Data ? (
              <div className="p-3 rounded-xl bg-slate-950 font-mono text-[10px] text-emerald-400 border border-emerald-500/20 overflow-x-auto space-y-1">
                <div className="font-bold">STATUS: {step2Data.body.status}</div>
                <div className="text-slate-400 truncate">Proof: {step2Data.body.settlementId || 'SXP-SIMULATED-PROOF'}</div>
                <div className="text-indigo-300">Settlement: Simulated (x402)</div>
              </div>
            ) : (
              <div className="h-16 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center text-[11px] text-slate-500 font-mono">
                {currentStep < 2 ? 'Waiting for Step 1' : 'Evaluating policy...'}
              </div>
            )}
          </div>

          {/* STEP 3: Protected Resource Unlocked */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              currentStep >= 3 ? 'border-emerald-500/50 bg-slate-900/90' : 'border-slate-800 bg-slate-900/40 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Step 3: Resource Unlocked
              </span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">HTTP 200 OK + Resource</h4>
            <p className="text-[11px] text-slate-400 mb-3">
              Agent retries with X-Payment-Proof and receives authorized payload.
            </p>
            {step3Data ? (
              <div className="p-3 rounded-xl bg-slate-950 font-mono text-[10px] text-emerald-300 border border-emerald-500/20 overflow-x-auto space-y-1">
                <div>HTTP/1.1 200 OK</div>
                <div className="text-slate-300">Access: GRANTED</div>
                <div className="text-emerald-400 truncate">Quota: 500,000 tokens</div>
              </div>
            ) : (
              <div className="h-16 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center text-[11px] text-slate-500 font-mono">
                {currentStep < 3 ? 'Waiting for Step 2' : 'Verifying proof...'}
              </div>
            )}
          </div>
        </div>

        {/* Footer info pill */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-4 border-t border-slate-800 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Protocol: <strong>x402-v1</strong></span>
          </div>
          <span className="text-indigo-400">
            *Settlement labeled simulated until testnet contract is deployed.
          </span>
        </div>
      </div>
    </div>
  );
}
