import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transform transition-all duration-300 translate-y-0 opacity-100"
          >
            {toast.type === 'success' && <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-500 shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={20} className="text-red-600 dark:text-red-500 shrink-0" />}
            {toast.type === 'info' && <Info size={20} className="text-slate-500 dark:text-slate-400 shrink-0" />}
            
            <span className="font-medium text-sm flex-1">{toast.message}</span>
            
            <button 
              onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))} 
              className="ml-2 p-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors duration-200 shrink-0"
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};