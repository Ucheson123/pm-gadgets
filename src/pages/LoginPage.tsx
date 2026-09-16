import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, Info, ChevronDown, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { AuthLayout } from '../components/layout/AuthLayout';
import { PasswordInput } from '../components/ui/PasswordInput';

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoExpanded, setIsDemoExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
    addToast('Copied to clipboard!', 'success');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      addToast('Login successful!', 'success');
      // AuthContext picks up the session
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Login failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Enter your credentials to access your branch">
      {/* PROFESSIONAL PORTFOLIO DEMO ACCORDION */}
      <div className="mb-6 border border-indigo-100 dark:border-indigo-800/50 rounded-xl overflow-hidden transition-all duration-300 shadow-sm bg-indigo-50/50 dark:bg-indigo-900/10">
        <button
          type="button"
          onClick={() => setIsDemoExpanded(!isDemoExpanded)}
          className="w-full p-4 flex items-center justify-between text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition-colors focus:outline-none cursor-pointer"
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <Info size={18} />
            Reveal Demo Login Credentials
          </div>
          <ChevronDown
            size={18}
            className={`transform transition-transform duration-300 ${isDemoExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        <div
          className={`transition-all duration-300 ease-in-out ${
            isDemoExpanded ? 'max-h-125 opacity-100 visible' : 'max-h-0 opacity-0 invisible'
          }`}
        >
          <div className="p-4 pt-0 space-y-3">
            {/* Manager Credentials */}
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-indigo-100 dark:border-indigo-800/40 shadow-sm">
              <p className="font-semibold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Manager (Abraka)
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm group">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Email:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-900 dark:text-slate-200">admin@mail.com</span>
                    <button
                      onClick={() => handleCopy('admin@mail.com', 'mgr-email')}
                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                      title="Copy Email"
                    >
                      {copiedField === 'mgr-email' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm group">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Pass:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-900 dark:text-slate-200">123,Bike</span>
                    <button
                      onClick={() => handleCopy('123,Bike', 'mgr-pass')}
                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                      title="Copy Password"
                    >
                      {copiedField === 'mgr-pass' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Salesperson Credentials */}
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-indigo-100 dark:border-indigo-800/40 shadow-sm">
              <p className="font-semibold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Salesperson (Abraka)
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm group">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Email:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-900 dark:text-slate-200">jane@mail.com</span>
                    <button
                      onClick={() => handleCopy('jane@mail.com', 'sales-email')}
                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                      title="Copy Email"
                    >
                      {copiedField === 'sales-email' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm group">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Pass:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-900 dark:text-slate-200">123,Bikers</span>
                    <button
                      onClick={() => handleCopy('123,Bikers', 'sales-pass')}
                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                      title="Copy Password"
                    >
                      {copiedField === 'sales-pass' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 mt-1 text-xs text-center text-indigo-600/80 dark:text-indigo-400/80 border-t border-indigo-100 dark:border-indigo-800/50">
              Need help? WhatsApp Developer:{' '}
              <a
                href="https://wa.me/2347086548140"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline ml-1 text-indigo-700 dark:text-indigo-300 cursor-pointer"
              >
                +234 708 654 8140
              </a>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 transition-colors duration-200" size={18} />
            <input
              type="email"
              name="email"
              required
              disabled={isLoading}
              autoComplete="email"
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
              placeholder="name@company.com"
            />
          </div>
        </div>

        <PasswordInput
          name="password"
          label="Password"
          disabled={isLoading}
          autoComplete="current-password"
        />

        <div className="flex justify-end mt-1">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-red-600 hover:text-red-700 dark:hover:text-red-400 transition-all duration-200 px-2 py-1 -mr-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
        </button>
      </form>

      <div className="mt-8 text-center flex items-center justify-center text-sm transition-colors duration-200">
        <span className="text-slate-600 dark:text-slate-400 transition-colors duration-200">
          Don't have an account?
        </span>
        <Link
          to="/register"
          className="ml-2 inline-block font-semibold text-red-600 hover:text-red-700 dark:hover:text-red-400 transition-all duration-200 px-3 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
        >
          Register here.
        </Link>
      </div>
    </AuthLayout>
  );
};