import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export type ToastMessage = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
};

type ToastContextType = {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  success: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const success = useCallback((title: string, description?: string) => showToast({ type: 'success', title, description }), [showToast]);
  const warning = useCallback((title: string, description?: string) => showToast({ type: 'warning', title, description }), [showToast]);
  const error = useCallback((title: string, description?: string) => showToast({ type: 'error', title, description }), [showToast]);
  const info = useCallback((title: string, description?: string) => showToast({ type: 'info', title, description }), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, warning, error, info }}>
      {children}
      {/* Toast container floating bottom-right */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => {
            const colors = {
              success: { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', icon: CheckCircle2 },
              warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', icon: AlertTriangle },
              error: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', icon: XCircle },
              info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', icon: Info },
            }[t.type];
            const Icon = colors.icon;

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className="pointer-events-auto rounded-2xl p-4 shadow-lg border flex items-start gap-3 backdrop-blur-md"
                style={{
                  background: colors.bg,
                  borderColor: colors.border,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
                }}
              >
                <Icon size={18} style={{ color: colors.text }} className="shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="font-bold" style={{ color: colors.text }}>{t.title}</div>
                  {t.description && <div className="text-gray-600 mt-0.5 leading-relaxed">{t.description}</div>}
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="p-1 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
