import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import CommandPalette from './components/CommandPalette';
import ErrorBoundary from './components/ErrorBoundary';
import { apiUrl } from './lib/api';

// Lazy-loaded routes
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Policies = lazy(() => import('./pages/Policies'));
const Agents = lazy(() => import('./pages/Agents'));
const Integrate = lazy(() => import('./pages/Integrate'));
const AgentDetail = lazy(() => import('./pages/AgentDetail'));
const MerchantInsights = lazy(() => import('./pages/MerchantInsights'));
const AlertSettings = lazy(() => import('./pages/AlertSettings'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageFallback() {
  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ height: 176, borderRadius: 24, background: 'rgba(229,231,235,0.7)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: 256, borderRadius: 24, background: 'rgba(229,231,235,0.7)' }} />)}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

function AppInner() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl+K / Cmd+K global handler
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
    try { await fetch(apiUrl('/api/reset-demo'), { method: 'POST' }); } catch (e) { console.error(e); }
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <Suspense fallback={<PageFallback />}>
          <Routes location={location}>
            <Route path="/" element={<ErrorBoundary label="Landing"><LandingPage /></ErrorBoundary>} />
            <Route path="/dashboard" element={<ErrorBoundary label="Dashboard"><Dashboard /></ErrorBoundary>} />
            <Route path="/policies" element={<ErrorBoundary label="Policies"><Policies /></ErrorBoundary>} />
            <Route path="/agents" element={<ErrorBoundary label="Agents"><Agents /></ErrorBoundary>} />
            <Route path="/agents/:id" element={<ErrorBoundary label="Agent detail"><AgentDetail /></ErrorBoundary>} />
            <Route path="/merchants" element={<ErrorBoundary label="Merchants"><MerchantInsights /></ErrorBoundary>} />
            <Route path="/alerts" element={<ErrorBoundary label="Alerts"><AlertSettings /></ErrorBoundary>} />
            <Route path="/integrate" element={<ErrorBoundary label="Integrate"><Integrate /></ErrorBoundary>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
