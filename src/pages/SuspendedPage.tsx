import { Navigate } from 'react-router-dom';
import { ShieldOff, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader } from '../components/ui/BrandLogo';

export const SuspendedPage = () => {
  const { user, isInitializing, logout } = useAuth();

  // Self-guarding: only suspended users belong here
  if (isInitializing) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === 'active') return <Navigate to="/dashboard" replace />;
  if (user.status === 'pending') return <Navigate to="/pending" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100 dark:border-slate-800">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-10 h-10 text-red-600 dark:text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          Account Suspended
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
          Your access to this system has been suspended. If you believe this is a mistake,
          contact your Branch Manager.
        </p>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-all"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
};