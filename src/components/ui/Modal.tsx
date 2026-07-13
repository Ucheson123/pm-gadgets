import type { ReactNode } from 'react';
import { X } from 'lucide-react';

// ==========================================
// MODAL SYSTEM
// Scrollable overlay: tall content scrolls instead of being clipped
// at the top by flex centering.
// ==========================================
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children, actions }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* min-h-full keeps short modals centered; tall ones start at the top and scroll */}
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-4 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-5 text-slate-600 dark:text-slate-300">
            {children}
          </div>
          {actions && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};