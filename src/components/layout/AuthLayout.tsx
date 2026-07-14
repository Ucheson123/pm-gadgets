import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Sun, Moon } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export const AuthLayout = ({ title, subtitle, children }: AuthLayoutProps) => {
  // Theme toggle state for the Auth Flow
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Branding panel */}
      <div className="hidden md:flex flex-col w-1/2 bg-white dark:bg-slate-900 p-12 text-slate-900 dark:text-white relative overflow-hidden transition-colors duration-200 border-r border-slate-200 dark:border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-50 dark:bg-red-600/20 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 transition-colors duration-200"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-50 dark:bg-orange-600/20 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3 transition-colors duration-200"></div>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <BrandLogo size="large" />
          <h1 className="mt-8 text-4xl font-light leading-tight transition-colors">
            Enterprise <br />
            <span className="font-bold">
              Inventory & Inter-Branch <br /> Management System
            </span>
          </h1>
          <p className="mt-6 text-slate-500 dark:text-slate-400 max-w-md text-lg transition-colors duration-200">
            Secure, auditable, and scaleable management for all your gadgets, sales, and
            financial tracking across multiple branches.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Theme Toggle Button positioned at the top right of the auth screen */}
        <button
          onClick={() => setIsDark(!isDark)}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="absolute top-6 right-6 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 transition-all duration-200"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Card Wrapper matching the reference photo */}
        <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-200 hover:border-red-100 hover:shadow-md dark:hover:border-red-500/20">
          <div className="md:hidden mb-10 flex justify-center">
            <BrandLogo />
          </div>

          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 transition-colors">{title}</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 transition-colors">{subtitle}</p>

          {children}
        </div>
      </div>
    </div>
  );
};