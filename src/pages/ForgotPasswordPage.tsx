import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, MailCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { AuthLayout } from '../components/layout/AuthLayout';

export const ForgotPasswordPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const email = new FormData(e.currentTarget).get('email') as string;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSentTo(email);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not send reset email.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="We'll email you a secure link to set a new password"
    >
      {sentTo ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-slate-700 dark:text-slate-300 font-medium mb-2">
            Check your inbox
          </p>
          <p className="text-sm text-slate-500 mb-6">
            If an account exists for <strong>{sentTo}</strong>, a password reset link is
            on its way. The link expires after a short time, so use it soon.
          </p>
          <Link to="/login" className="font-semibold text-red-600 hover:text-red-700 text-sm">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input
                  type="email"
                  name="email"
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50"
                  placeholder="name@company.com"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
            </button>
          </form>
          <div className="mt-8 text-center">
            <Link to="/login" className="font-semibold text-red-600 hover:text-red-700 text-sm">
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
};