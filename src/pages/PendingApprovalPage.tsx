import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader } from '../components/ui/BrandLogo';

export const PendingApprovalPage = () => {
  const { user, isInitializing, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  // Self-guarding: only pending users belong here
  if (isInitializing) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === 'active') return <Navigate to="/dashboard" replace />;
  if (user.status === 'suspended') return <Navigate to="/suspended" replace />;

  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshProfile();
    // If status changed to active, the guard above redirects on re-render.
    setChecking(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-200 dark:border-slate-800 transition-all duration-200 hover:border-red-100 hover:shadow-2xl dark:hover:border-red-500/20">
        <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors duration-200">
          <Lock className="w-10 h-10 text-orange-600 dark:text-orange-500 transition-colors duration-200" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 transition-colors duration-200">
          Account Pending
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed transition-colors duration-200">
          Your account registration was successful, but it requires approval from your
          Branch Manager before you can access the system.
        </p>
        <div className="space-y-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-medium shadow-lg shadow-red-600/30 transition-all active:scale-[0.98]"
          >
            <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking...' : 'Check Approval Status'}
          </button>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 active:scale-[0.98]"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};