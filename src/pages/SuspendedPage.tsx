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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-200 dark:border-slate-800 transition-all duration-200 hover:border-red-100 hover:shadow-2xl dark:hover:border-red-500/20">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors duration-200">
          <ShieldOff className="w-10 h-10 text-red-600 dark:text-red-500 transition-colors duration-200" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 transition-colors duration-200">
          Account Suspended
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed transition-colors duration-200">
          Your access to this system has been suspended. If you believe this is a mistake,
          contact your Branch Manager.
        </p>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 active:scale-[0.98]"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
};