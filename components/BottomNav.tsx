import React from 'react';
import { Section } from '../types';

interface BottomNavProps {
  activeSection: Section;
  setSection: (s: Section) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeSection, setSection }) => {
  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: 'add-expense', label: 'Add', icon: '➕' },
    { id: 'summaries', label: 'Stats', icon: '📊' },
    { id: 'partner-chat', label: 'Chat', icon: '💬' },
    { id: 'overview', label: 'Plan', icon: '👫' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Gradient fade at top of nav */}
      <div className="h-6 bg-gradient-to-b from-transparent to-black/5 dark:to-black/20 pointer-events-none"></div>
      
      <div className="bg-surface/90 dark:bg-[#121212]/90 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-800/50 flex justify-around pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)] transition-all duration-300">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className="group relative flex flex-1 flex-col items-center justify-center py-3 focus:outline-none"
            >
              {/* Animated Background Pill */}
              {isActive && (
                <div className="absolute top-2 w-10 h-8 bg-primary/10 dark:bg-primary/20 rounded-2xl animate-scale-in" />
              )}
              
              <span className={`text-lg mb-0.5 relative z-10 transition-transform duration-200 group-active:scale-90 ${
                isActive ? 'scale-110 -translate-y-0.5' : 'grayscale opacity-70'
              }`}>
                {item.icon}
              </span>
              
              <span className={`text-[9px] font-bold tracking-wide transition-all duration-200 ${
                isActive ? 'text-primary translate-y-0 opacity-100' : 'text-text-light translate-y-1 opacity-70'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};