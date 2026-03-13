import React from 'react';
import { motion } from 'framer-motion';
import { spring } from '../utils/motion';
import { Section } from '../types';

interface BottomNavProps {
  activeSection: Section;
  setSection: (s: Section) => void;
}

const NAV_ICONS = {
  'add-expense': (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e91e63' : 'currentColor'} strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  'summaries': (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e91e63' : 'currentColor'} strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 4-5" />
    </svg>
  ),
  'investments': (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e91e63' : 'currentColor'} strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  'overview': (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e91e63' : 'currentColor'} strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  'settings': (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#e91e63' : 'currentColor'} strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

export const BottomNav: React.FC<BottomNavProps> = ({ activeSection, setSection }) => {
  const navItems: { id: Section; label: string }[] = [
    { id: 'add-expense', label: 'Add' },
    { id: 'summaries', label: 'Stats' },
    { id: 'investments', label: 'Wealth' },
    { id: 'overview', label: 'Plan' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center justify-between w-full max-w-md bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl rounded-full p-2 shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-gray-200/50 dark:border-white/[0.05]">
        {navItems.map(item => {
          const isActive = activeSection === item.id;
          return (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-full transition-all duration-300 ease-out flex-1 py-2`}
            >
              {isActive && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-full z-0"
                  transition={spring}
                />
              )}
              <div className={`relative z-10 transition-all duration-300 ease-out ${isActive ? 'scale-105 text-primary opacity-100' : 'scale-100 text-gray-500 dark:text-gray-400 opacity-60'}`}>
                {NAV_ICONS[item.id as keyof typeof NAV_ICONS]?.(isActive)}
              </div>
              <span className={`relative z-10 text-[9px] font-bold tracking-widest uppercase transition-all duration-300 ease-out leading-none mt-0.5 ${isActive ? 'text-primary opacity-100' : 'text-gray-500 dark:text-gray-400 opacity-60'}`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
