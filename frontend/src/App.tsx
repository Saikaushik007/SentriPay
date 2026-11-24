import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Policies from './pages/Policies';
import Agents from './pages/Agents';
import Integrate from './pages/Integrate';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <AnimatedRoutes />
      </Layout>
    </BrowserRouter>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return <AnimatePresence mode="wait" initial={false}>
    <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      <Routes location={location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/integrate" element={<Integrate />} />
      </Routes>
    </motion.div>
  </AnimatePresence>;
}
