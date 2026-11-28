import { useState, useEffect } from 'react';
import { PageHeader, Card, Skeleton } from '../components/ui/primitives';
import ErrorBoundary from '../components/ErrorBoundary';
import MoneyFlowMap from '../components/MoneyFlowMap';
import RiskHeatmapAndForecast from '../components/RiskHeatmapAndForecast';
import TimeTravelReplay from '../components/TimeTravelReplay';
import { apiUrl } from '../lib/api';
import { useTimeRange } from '../context/TimeRangeContext';

type TabId = 'flow' | 'heatmap' | 'rules' | 'replay';

export default function Analytics() {
  const { timeRange } = useTimeRange();
  const [tab, setTab] = useState<TabId>('flow');
  const [ruleHits, setRuleHits] = useState<{ rule: string; count: number }[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(apiUrl(`/api/transactions/rule-hits?range=${timeRange}`)).then(r => r.json()).catch(() => ({ hits: [] })),
      fetch(apiUrl(`/api/transactions?range=${timeRange}`)).then(r => r.json()).catch(() => []),
    ])
      .then(([hitsData, txsData]) => {
        setRuleHits(hitsData?.hits || []);
        setTransactions(Array.isArray(txsData) ? txsData : []);
      })
      .finally(() => setLoading(false));
  }, [timeRange]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'flow', label: 'Money-flow map' },
    { id: 'heatmap', label: 'Risk heatmap & forecast' },
    { id: 'rules', label: 'Top rules triggered' },
    { id: 'replay', label: 'Time-travel replay' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description={`Deep-dive telemetry, risk heatmaps, and spend forecasts (${timeRange} window)`}
      />

      <div className="inline-flex flex-wrap gap-1 bg-white border border-[#E5E7EB] p-1 rounded-[12px]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-[9px] transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F6F7FB]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'flow' && (
        <ErrorBoundary label="Money-flow map">
          <MoneyFlowMap />
        </ErrorBoundary>
      )}

      {tab === 'heatmap' && (
        <ErrorBoundary label="Risk heatmap & forecast">
          <RiskHeatmapAndForecast />
        </ErrorBoundary>
      )}

      {tab === 'rules' && (
        <ErrorBoundary label="Top rules triggered">
          <Card>
            <h2 className="text-base font-semibold text-[#111827] mb-4">
              Top Rules Triggered ({timeRange})
            </h2>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : ruleHits.length === 0 ? (
              <p className="text-sm text-[#6B7280] py-8 text-center">No policy blocks or flags in this range.</p>
            ) : (
              <div className="space-y-3">
                {ruleHits.map(h => {
                  const max = Math.max(...ruleHits.map(x => x.count), 1);
                  return (
                    <div key={h.rule} className="flex items-center gap-3">
                      <div className="w-36 text-xs font-medium text-[#6B7280] truncate">{h.rule}</div>
                      <div className="flex-1 h-2.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4F46E5] rounded-full"
                          style={{ width: `${(h.count / max) * 100}%` }}
                        />
                      </div>
                      <div className="w-10 text-right text-xs font-mono-num font-semibold text-[#111827]">
                        {h.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </ErrorBoundary>
      )}

      {tab === 'replay' && (
        <ErrorBoundary label="Time-travel replay">
          <TimeTravelReplay transactions={transactions} onReplaySliceChange={() => {}} />
        </ErrorBoundary>
      )}
    </div>
  );
}
