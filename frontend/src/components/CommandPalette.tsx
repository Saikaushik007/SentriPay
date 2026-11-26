import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronRight, LayoutDashboard, Shield, Users, Code2, Store, Zap, BellRing } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={16} />, desc: 'Live transaction feed & metrics' },
  { label: 'Policies', path: '/policies', icon: <Shield size={16} />, desc: 'Configure spend limits & rules' },
  { label: 'Agents', path: '/agents', icon: <Users size={16} />, desc: 'Manage autonomous AI agents' },
  { label: 'Merchant Insights', path: '/merchants', icon: <Store size={16} />, desc: 'Volume, blocks & risk per merchant' },
  { label: 'Alerts & Webhooks', path: '/alerts', icon: <BellRing size={16} />, desc: 'Signed webhooks & anomaly detection' },
  { label: 'Integrate', path: '/integrate', icon: <Code2 size={16} />, desc: 'API docs & SDK integration' },
];

const DEMO_ACTIONS = [
  { label: 'Reset Demo Data', key: 'reset', icon: <Zap size={16} />, desc: 'Re-seed 110 baseline records' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onDemoReset?: () => void;
};

export default function CommandPalette({ open, onClose, onDemoReset }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const allItems = [
    ...NAV_ITEMS.map(n => ({ ...n, type: 'nav' as const })),
    ...DEMO_ACTIONS.map(d => ({ ...d, type: 'action' as const, path: '' })),
  ];

  const filtered = query.trim()
    ? allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || i.desc.toLowerCase().includes(query.toLowerCase()))
    : allItems;

  const handleSelect = (item: typeof allItems[0]) => {
    if (item.type === 'nav') {
      navigate(item.path);
    } else if (item.key === 'reset') {
      onDemoReset?.();
    }
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && filtered[selected]) { handleSelect(filtered[selected]); }
      if (e.key === 'Escape') { onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected]);

  useEffect(() => { setSelected(0); }, [query]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', zIndex: 9000 }}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: 560, zIndex: 9001,
              background: 'white', borderRadius: 20, border: '1px solid #E4E4E7',
              boxShadow: '0 32px 80px -16px rgba(0,0,0,0.3)', overflow: 'hidden'
            }}>
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #F4F4F5' }}>
              <Search size={18} style={{ color: '#A1A1AA', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search pages, actions…"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#18181B', background: 'transparent' }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <kbd style={{ padding: '2px 6px', borderRadius: 6, border: '1px solid #E4E4E7', fontSize: 11, color: '#71717A', background: '#F9FAFB' }}>Esc</kbd>
              </div>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#A1A1AA', fontSize: 14 }}>No results for "{query}"</div>
              ) : (
                <>
                  {/* Nav section */}
                  {filtered.some(i => i.type === 'nav') && (
                    <div>
                      <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A1A1AA' }}>Navigation</div>
                      {filtered.filter(i => i.type === 'nav').map((item) => {
                        const isSelected = filtered.indexOf(item) === selected;
                        return (
                          <div key={item.label} onClick={() => handleSelect(item)}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', background: isSelected ? '#EEF2FF' : 'transparent', transition: 'background .1s' }}
                            onMouseEnter={() => setSelected(filtered.indexOf(item))}>
                            <span style={{ color: isSelected ? '#4F46E5' : '#71717A', display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? '#4F46E5' : '#18181B' }}>{item.label}</div>
                              <div style={{ fontSize: 12, color: '#71717A' }}>{item.desc}</div>
                            </div>
                            {isSelected && <ChevronRight size={14} style={{ color: '#4F46E5' }} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Actions section */}
                  {filtered.some(i => i.type === 'action') && (
                    <div>
                      <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A1A1AA' }}>Actions</div>
                      {filtered.filter(i => i.type === 'action').map((item) => {
                        const isSelected = filtered.indexOf(item) === selected;
                        return (
                          <div key={item.label} onClick={() => handleSelect(item)}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', background: isSelected ? '#FFF7ED' : 'transparent', transition: 'background .1s' }}
                            onMouseEnter={() => setSelected(filtered.indexOf(item))}>
                            <span style={{ color: isSelected ? '#D97706' : '#71717A', display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? '#D97706' : '#18181B' }}>{item.label}</div>
                              <div style={{ fontSize: 12, color: '#71717A' }}>{item.desc}</div>
                            </div>
                            {isSelected && <ChevronRight size={14} style={{ color: '#D97706' }} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer hint */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #F4F4F5', display: 'flex', gap: 16, fontSize: 11, color: '#A1A1AA' }}>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 4, border: '1px solid #E4E4E7', background: '#F9FAFB' }}>↑↓</kbd> navigate</span>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 4, border: '1px solid #E4E4E7', background: '#F9FAFB' }}>↵</kbd> select</span>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 4, border: '1px solid #E4E4E7', background: '#F9FAFB' }}>Esc</kbd> close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
