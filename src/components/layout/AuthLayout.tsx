import type { ReactNode } from 'react';
import { BrandLogo } from '../ui/BrandLogo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export const AuthLayout = ({ title, subtitle, children }: AuthLayoutProps) => (
  <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950">
    {/* Branding panel */}
    <div className="hidden md:flex flex-col w-1/2 bg-slate-900 p-12 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/20 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>

      <div className="relative z-10 flex-1 flex flex-col justify-center">
        <BrandLogo size="large" />
        <h1 className="mt-8 text-4xl font-light leading-tight">
          Enterprise <br />
          <span className="font-bold">
            Inventory & Inter-Branch <br /> Management System
          </span>
        </h1>
        <p className="mt-6 text-slate-400 max-w-md text-lg">
          Secure, auditable, and scaleable management for all your gadgets, sales, and
          financial tracking across multiple branches.
        </p>
      </div>
    </div>

    {/* Form panel */}
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="md:hidden mb-10 flex justify-center">
          <BrandLogo />
        </div>

        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{title}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">{subtitle}</p>

        {children}
      </div>
    </div>
  </div>
);