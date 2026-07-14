import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Store, User, Lock, Mail, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { AuthLayout } from '../components/layout/AuthLayout';

export const RegisterPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');
      if (error) {
        addToast('Could not load branches. Please refresh the page.', 'error');
      } else {
        setBranches(data ?? []);
      }
    };
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: formData.get('fullName') as string,
            branch_id: formData.get('branch') as string,
            role: formData.get('role') as string,
          },
        },
      });
      if (error) throw error;
      addToast('Registration successful! Pending approval.', 'success');
      // If email confirmation is OFF, a session is created and GuestRoute
      // redirects to /pending automatically. If it's ON, the user stays
      // here until they confirm via email.
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Registration failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Create Account" subtitle="Register your branch account">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 transition-colors duration-200" size={18} />
            <input
              type="text"
              name="fullName"
              required
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
              placeholder="John Doe"
            />
          </div>
        </div>

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
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
              placeholder="name@company.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 transition-colors duration-200" size={18} />
            <input
              type="password"
              name="password"
              required
              disabled={isLoading}
              minLength={6}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Select Branch
          </label>
          <div className="relative">
            <Store className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 transition-colors duration-200" size={18} />
            <select
              name="branch"
              required
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 appearance-none disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
            >
              <option value="">Select a branch...</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 transition-colors duration-200">
            Request Role
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 transition-colors duration-200" size={18} />
            <select
              name="role"
              required
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white transition-all duration-200 appearance-none disabled:opacity-50 hover:border-red-100 dark:hover:border-red-500/30"
            >
              <option value="">Select a role...</option>
              <option value="salesperson">Salesperson</option>
              <option value="manager">Branch Manager</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold shadow-lg shadow-red-600/30 transition-all active:scale-[0.98]"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register Account'}
        </button>
      </form>

      <div className="mt-8 text-center flex items-center justify-center text-sm transition-colors duration-200">
        <span className="text-slate-600 dark:text-slate-400 transition-colors duration-200">
          Already have an account?
        </span>
        <Link
          to="/login"
          className="ml-2 inline-block font-semibold text-red-600 hover:text-red-700 dark:hover:text-red-400 transition-all duration-200 px-3 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          Sign in here
        </Link>
      </div>
    </AuthLayout>
  );
};