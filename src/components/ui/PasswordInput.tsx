import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordInputProps {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  autoComplete?: string;
}

// ==========================================
// PASSWORD FIELD WITH SHOW/HIDE TOGGLE
// Uncontrolled (uses `name`), so it works with the FormData-based
// submit handlers on the auth pages.
//
// NOTE: the icon offsets and the input's horizontal padding are set as
// INLINE STYLES on purpose. Tailwind spacing utilities were being
// mis-applied in this project's setup, letting the text run under the
// icons. Inline styles guarantee the geometry; Tailwind still handles
// all colours, borders, and states.
// ==========================================
export const PasswordInput = ({
  name,
  label,
  placeholder = '••••••••',
  required = true,
  minLength = 6,
  disabled = false,
  autoComplete,
}: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
        {label}
      </label>

      <div className="relative w-full">
        {/* Lock icon — vertically centred, 14px in from the left edge */}
        <span
          className="pointer-events-none absolute flex items-center"
          style={{ left: '14px', top: 0, bottom: 0 }}
        >
          <Lock
            className="text-slate-400 dark:text-slate-500 transition-colors duration-200"
            size={18}
          />
        </span>

        <input
          type={visible ? 'text' : 'password'}
          name={name}
          required={required}
          minLength={minLength}
          disabled={disabled}
          autoComplete={autoComplete}
          style={{ paddingLeft: '44px', paddingRight: '44px' }}
          className="block w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
          placeholder={placeholder}
        />

        {/* Eye toggle — mirrors the lock, 14px in from the right edge */}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          style={{ right: '14px', top: 0, bottom: 0 }}
          className="absolute flex items-center text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
};