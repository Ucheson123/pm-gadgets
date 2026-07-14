import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { AuthLayout } from '../components/layout/AuthLayout';
import { FullScreenLoader } from '../components/ui/BrandLogo';

// The recovery link signs the user in with a temporary session, then lands
// them here. This page checks that session directly (NOT via AuthContext,
// because pending/suspended users must also be able to reset passwords).
export const ResetPasswordPage = () => {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirm = formData.get('confirm') as string;

    if (password !== confirm) {
      addToast('Passwords do not match.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      addToast('Password updated. Welcome back!', 'success');
      // Route guards take over: active → dashboard, pending → pending, etc.
      navigate('/dashboard', { replace: true });
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not update password.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) return <FullScreenLoader />;

  if (!hasSession) {
    return (
      <AuthLayout title="Link Expired" subtitle="This reset link is invalid or has expired">
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors duration-200">
            <ShieldAlert className="w-8 h-8 text-orange-600 dark:text-orange-500 transition-colors duration-200" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 transition-colors duration-200">
            Reset links only work once and expire quickly. Request a fresh one and use it
            right away.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block font-semibold text-red-600 hover:text-red-700 dark:hover:text-red-400 text-sm transition-all duration-200 px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set New Password" subtitle="Choose a new password for your account">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 transition-colors duration-200" size={18} />
            <input
              type="password"
              name="password"
              required
              minLength={6}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 transition-colors duration-200" size={18} />
            <input
              type="password"
              name="confirm"
              required
              minLength={6}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
              placeholder="••••••••"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all active:scale-[0.98]"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
        </button>
      </form>
    </AuthLayout>
  );
};