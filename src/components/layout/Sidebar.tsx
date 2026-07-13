import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ReceiptText, Users, Truck, Wallet,
  ScrollText, BadgePlus, LogOut, ChevronsLeft, ChevronsRight, X,
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

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/sales', icon: ReceiptText, label: 'Sales' },
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
    } ${isActive ? 'bg-red-600 text-white' : 'hover:bg-slate-800'}`;

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
          bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800
          transition-all duration-200
          w-64 ${collapsed ? 'lg:w-20' : 'lg:w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        aria-label="Main navigation"
      >
        <div className={`p-6 border-b border-slate-800 flex items-center ${collapsed ? 'lg:justify-center lg:p-4' : 'justify-between'}`}>
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
            className="lg:hidden p-1 text-slate-400 hover:text-white"
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

        <div className="p-4 border-t border-slate-800 space-y-1">
          {user?.branch_name && (
            <p className={`px-4 pb-1 text-xs text-slate-500 uppercase tracking-wider ${collapsed ? 'lg:hidden' : ''}`}>
              {user.branch_name} Branch
            </p>
          )}
          <button
            onClick={logout}
            title="Logout"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <LogOut size={20} className="shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Logout</span>
          </button>
          {/* Desktop-only collapse toggle */}
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden lg:flex w-full items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            {collapsed ? <ChevronsRight size={20} className="shrink-0" /> : <ChevronsLeft size={20} className="shrink-0" />}
            <span className={collapsed ? 'lg:hidden' : ''}>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
};