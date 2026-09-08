import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { AuthLayout } from '../components/layout/AuthLayout';
import { PasswordInput } from '../components/ui/PasswordInput';

export const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      addToast('Login successful!', 'success');
      // No manual navigation needed — AuthContext picks up the session
      // and GuestRoute redirects based on account status.
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Login failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Enter your credentials to access your branch">
      
      {/* PORTFOLIO DEMO BANNER */}
      <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl text-sm transition-colors duration-200 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-indigo-800 dark:text-indigo-300 mb-3">
          <Info size={18} />
          Portfolio Demo Access
        </div>
        
        <div className="space-y-3 text-indigo-700 dark:text-indigo-400 mb-4">
          <div className="bg-white/60 dark:bg-slate-900/50 p-3 rounded-lg border border-indigo-100/50 dark:border-indigo-800/50">
            <p className="font-semibold text-xs uppercase tracking-wider mb-1.5 opacity-80 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Manager (Abraka Branch)
            </p>
            <p className="font-mono text-sm"><strong>Email:</strong> admin@mail.com</p>
            <p className="font-mono text-sm"><strong>Password:</strong> 123,Bike</p>
          </div>
          
          <div className="bg-white/60 dark:bg-slate-900/50 p-3 rounded-lg border border-indigo-100/50 dark:border-indigo-800/50">
            <p className="font-semibold text-xs uppercase tracking-wider mb-1.5 opacity-80 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Salesperson (Abraka Branch)
            </p>
            <p className="font-mono text-sm"><strong>Email:</strong> jane@mail.com</p>
            <p className="font-mono text-sm"><strong>Password:</strong> 123,Bikers</p>
          </div>
        </div>

        <div className="pt-4 border-t border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-400 leading-relaxed">
          For more enquiries, message or call the developer on WhatsApp:
          <a 
            href="https://wa.me/2347086548140" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-flex mt-1.5 font-bold hover:underline items-center gap-1 text-indigo-800 dark:text-indigo-300 transition-colors"
          >
            +234 708 654 8140
          </a>
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
            className="text-sm font-medium text-red-600 hover:text-red-700 dark:hover:text-red-400 transition-all duration-200 px-2 py-1 -mr-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] cursor-pointer"
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