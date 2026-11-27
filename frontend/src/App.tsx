import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { TimeRangeProvider } from './context/TimeRangeContext';
import CommandPalette from './components/CommandPalette';
import ErrorBoundary from './components/ErrorBoundary';
import { apiUrl } from './lib/api';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Policies = lazy(() => import('./pages/Policies'));
const Agents = lazy(() => import('./pages/Agents'));
const Integrate = lazy(() => import('./pages/Integrate'));
const AgentDetail = lazy(() => import('./pages/AgentDetail'));
const MerchantInsights = lazy(() => import('./pages/MerchantInsights'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AlertSettings = lazy(() => import('./pages/AlertSettings'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageFallback() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 rounded-[8px] bg-[#E5E7EB]/70 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 rounded-[12px] bg-[#E5E7EB]/70 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TimeRangeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppInner />
          </BrowserRouter>
        </ToastProvider>
      </TimeRangeProvider>
    </ThemeProvider>
  );
}

function AppInner() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleDemoReset = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/reset-demo'), { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onDemoReset={handleDemoReset} />
      <Layout onOpenPalette={() => setPaletteOpen(true)}>
        <AnimatedRoutes />
      </Layout>
    </>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <Suspense fallback={<PageFallback />}>
          <Routes location={location}>
            <Route path="/" element={<ErrorBoundary label="Landing"><LandingPage /></ErrorBoundary>} />
            <Route path="/dashboard" element={<ErrorBoundary label="Dashboard"><Dashboard /></ErrorBoundary>} />
            <Route path="/transactions" element={<ErrorBoundary label="Transactions"><Transactions /></ErrorBoundary>} />
            <Route path="/approvals" element={<ErrorBoundary label="Approvals"><Approvals /></ErrorBoundary>} />
            <Route path="/policies" element={<ErrorBoundary label="Policies"><Policies /></ErrorBoundary>} />
            <Route path="/agents" element={<ErrorBoundary label="Agents"><Agents /></ErrorBoundary>} />
            <Route path="/agents/:id" element={<ErrorBoundary label="Agent detail"><AgentDetail /></ErrorBoundary>} />
            <Route path="/merchants" element={<ErrorBoundary label="Merchants"><MerchantInsights /></ErrorBoundary>} />
            <Route path="/analytics" element={<ErrorBoundary label="Analytics"><Analytics /></ErrorBoundary>} />
            <Route path="/alerts" element={<ErrorBoundary label="Alerts"><AlertSettings /></ErrorBoundary>} />
            <Route path="/integrate" element={<ErrorBoundary label="Integrate"><Integrate /></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary label="Settings"><Settings /></ErrorBoundary>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
