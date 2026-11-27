import { createContext, useContext, useState, type ReactNode } from 'react';

export type TimeRange = '1h' | '24h' | '7d';

interface TimeRangeContextValue {
  timeRange: TimeRange;
  setTimeRange: (r: TimeRange) => void;
}

const TimeRangeContext = createContext<TimeRangeContextValue>({
  timeRange: '24h',
  setTimeRange: () => {},
});

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  return (
    <TimeRangeContext.Provider value={{ timeRange, setTimeRange }}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  return useContext(TimeRangeContext);
}
