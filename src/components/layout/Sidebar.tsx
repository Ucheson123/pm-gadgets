import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ReceiptText, Users, Truck, Wallet,
  ScrollText, BadgePlus, LogOut, ChevronsLeft, ChevronsRight, X, Sun, Moon, Wrench
} from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  collapsed: boolean;          // desktop icon mode
  onToggleCollapse: () => void;
  mobileOpen: boolean;         // mobile drawer
  onCloseMobile: () => void;
}

export const Sidebar = ({
  collapsed, onToggleCollapse, mobileOpen, onCloseMobile,
}: SidebarProps) => {
  const { user, logout } = useAuth();
  
  // Theme toggle state
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return true; // Fallback to dark if undefined
  });

  // Apply theme to document and save preference
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/sales', icon: ReceiptText, label: 'Sales' },
    { to: '/repairs', icon: Wrench, label: 'Repairs' },
    ...(user?.role === 'manager'
      ? [
          { to: '/team', icon: Users, label: 'Team & Approvals' },
          { to: '/wallet', icon: Wallet, label: 'Wallet' },
          { to: '/orders', icon: Truck, label: 'Orders' },
          { to: '/audit', icon: ScrollText, label: 'Audit Logs' },
        ]
      : [{ to: '/pos', icon: BadgePlus, label: 'New Sale' }]),
  ];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
      collapsed ? 'lg:justify-center lg:px-0' : ''
    } ${isActive ? 'bg-red-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400'}`;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: drawer on mobile, static (and collapsible) on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto
          bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex flex-col border-r border-slate-200 dark:border-slate-800
          transition-all duration-200
          w-64 ${collapsed ? 'lg:w-20' : 'lg:w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        aria-label="Main navigation"
      >
        <div className={`p-6 border-b border-slate-200 dark:border-slate-800 flex items-center ${collapsed ? 'lg:justify-center lg:p-4' : 'justify-between'}`}>
          <div className={collapsed ? 'lg:hidden' : ''}>
            <BrandLogo />
          </div>
          {collapsed && (
            <span className="hidden lg:block font-black text-red-600 text-lg tracking-tight">
              PM
            </span>
          )}
          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 flex-1 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={navLinkClass}
              onClick={onCloseMobile}
              title={link.label}
            >
              <link.icon size={20} className="shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
          {user?.branch_name && (
            <p className={`px-4 pb-1 text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wider ${collapsed ? 'lg:hidden' : ''}`}>
              {user.branch_name} Branch
            </p>
          )}
          
          {/* Theme Toggle Button */}
          <button
            onClick={() => setIsDark(!isDark)}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            {isDark ? <Sun size={20} className="shrink-0" /> : <Moon size={20} className="shrink-0" />}
            <span className={collapsed ? 'lg:hidden' : ''}>
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>

          <button
            onClick={logout}
            title="Logout"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <LogOut size={20} className="shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Logout</span>
          </button>
          
          {/* Desktop-only collapse toggle */}
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden lg:flex w-full items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            {collapsed ? <ChevronsRight size={20} className="shrink-0" /> : <ChevronsLeft size={20} className="shrink-0" />}
            <span className={collapsed ? 'lg:hidden' : ''}>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
};