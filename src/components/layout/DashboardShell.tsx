import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { NotificationsBell } from './NotificationsBell';
import { useAuth } from '../../context/AuthContext';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Branch operations overview' },
  '/inventory': { title: 'Inventory', subtitle: 'Manage stock for your branch' },
  '/team': { title: 'Team Management', subtitle: 'Approve and manage your branch staff' },
  '/wallet': { title: 'Branch Wallet', subtitle: 'Deposits, transactions, and statements' },
  '/orders': { title: 'Inter-Branch Orders', subtitle: 'Order stock from and supply stock to other branches' },
  '/sales': { title: 'Sales History', subtitle: 'All sales recorded at your branch' },
  '/pos': { title: 'New Sale', subtitle: 'Record a customer sale and print the receipt' },
  '/audit': { title: 'Audit Trail', subtitle: 'Every change, traceable to a user' },
};

export const DashboardShell = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Keyboard accessible: Escape closes the mobile drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ProtectedRoute guarantees an active user, but guard for type safety
  if (!user) return null;

  const meta = PAGE_META[pathname] ?? {
    title: 'Dashboard',
    subtitle: 'Branch operations overview',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <header className="flex justify-between items-center gap-3 mb-6 lg:mb-8">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 shrink-0"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                {meta.title}
              </h1>
              <p className="text-sm text-slate-500 truncate hidden sm:block">
                {meta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <NotificationsBell />
            <div className="text-right hidden sm:block">
              <p className="font-medium text-slate-900 dark:text-white">{user.full_name}</p>
              <p className="text-sm text-slate-500">
                <span className="text-emerald-600 font-medium capitalize">{user.role}</span>
                {user.branch_name && <> · {user.branch_name} Branch</>}
              </p>
            </div>
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold uppercase shrink-0">
              {(user.full_name || '?').charAt(0)}
            </div>
          </div>
        </header>

        {/* Routed view renders here */}
        <Outlet />
      </div>
    </div>
  );
};