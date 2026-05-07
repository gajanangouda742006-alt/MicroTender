import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="px-2 py-4 border-t border-border-primary/50">
      <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-[0.2em] mb-3 px-2">System Theme</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleTheme();
        }}
        className="w-full relative h-11 rounded-2xl bg-surface-tertiary border border-border-primary flex items-center p-1.5 cursor-pointer group transition-all duration-300 hover:border-accent-primary/30 shadow-inner"
        aria-label="Toggle Theme"
      >
        {/* Sliding Indicator - Moved to top for natural layering */}
        <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-[12px] transition-all duration-500 shadow-glass-strong ${
          theme === 'dark' 
            ? 'left-1 bg-gradient-to-br from-secondary-600 to-accent-purple' 
            : 'left-[calc(50%+1px)] bg-white shadow-xl'
        }`} />

        <div className={`flex-1 flex items-center justify-center gap-2 z-20 transition-all duration-500 ${theme === 'dark' ? 'text-white font-black' : 'text-slate-500 font-bold'}`}>
          <Moon size={14} className={theme === 'dark' ? 'animate-float' : ''} />
          <span className="text-[11px] uppercase tracking-widest">Dark</span>
        </div>
        <div className={`flex-1 flex items-center justify-center gap-2 z-20 transition-all duration-500 ${theme === 'light' ? 'text-indigo-600 font-black' : 'text-slate-500 font-bold'}`}>
          <Sun size={14} className={theme === 'light' ? 'animate-float' : ''} />
          <span className="text-[11px] uppercase tracking-widest">Light</span>
        </div>
      </button>
    </div>
  );
}
