import { Apple, Loader2 } from 'lucide-react';

export const BrandLogo = ({ size = 'normal' }: { size?: 'normal' | 'large' }) => (
  <div className="flex items-center gap-1 select-none">
    <span className={`font-black tracking-tight ${size === 'large' ? 'text-4xl' : 'text-2xl'} text-red-600`}>
      P
    </span>
    <div className="relative flex items-center justify-center">
      <Apple 
        className={`${size === 'large' ? 'w-8 h-8' : 'w-6 h-6'} text-slate-900 dark:text-white mb-1 transition-colors duration-200`} 
        fill="currentColor" 
      />
    </div>
    <span className={`font-black tracking-tight ${size === 'large' ? 'text-4xl' : 'text-2xl'} text-red-600`}>
      M
    </span>
    <span className={`font-bold ml-1 text-slate-800 dark:text-slate-200 tracking-widest uppercase transition-colors duration-200 ${size === 'large' ? 'text-xl mt-1' : 'text-sm mt-0.5'}`}>
      Gadgets
    </span>
  </div>
);

export const FullScreenLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
    <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-4" />
    <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse transition-colors duration-200">
      Connecting to secure environment...
    </p>
  </div>
);