
import React from 'react';
import { AppSettings } from '../types';

interface HeaderProps {
  settings: AppSettings;
  onTogglePrivacy?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ settings, onTogglePrivacy }) => {
  return (
    <div className="sticky top-0 z-50 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-xl border-b border-gray-100/50 dark:border-white/[0.04]">
      <div className="flex items-center justify-between px-5 h-16">

        {/* Left: App Identity */}
        <div>
          <h1 className="text-[17px] font-black text-text tracking-tight leading-none">{settings.headerTitle}</h1>
          <p className="text-[11px] font-semibold text-text-light mt-0.5 tracking-wide">Couple Finance</p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePrivacy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${settings.privacyMode
                ? 'bg-primary text-white shadow-[0_0_12px_rgba(233,30,99,0.4)]'
                : 'bg-gray-100 dark:bg-white/[0.06] text-text-light'
              }`}
          >
            {settings.privacyMode ? '🔒 Private' : '👁 Visible'}
          </button>
          <div
            className={`w-2 h-2 rounded-full ${settings.syncId
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]'
              } animate-pulse`}
            title={settings.syncId ? 'Synced' : 'Offline'}
          />
        </div>

      </div>
    </div>
  );
};
