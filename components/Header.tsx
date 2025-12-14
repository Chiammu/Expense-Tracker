import React from 'react';
import { AppSettings } from '../types';

interface HeaderProps {
  settings: AppSettings;
}

export const Header: React.FC<HeaderProps> = ({ settings }) => {
  return (
    <div 
      className="relative w-full py-5 sm:py-8 px-4 text-center text-white mb-4 sm:mb-6 rounded-b-xl shadow-md overflow-hidden transition-all duration-500"
      style={{
        background: settings.coverPhotoData 
          ? `url(${settings.coverPhotoData}) center/cover no-repeat`
          : `linear-gradient(135deg, var(--primary), var(--secondary))`,
      }}
    >
      {/* Overlay for better text readability if image exists */}
      <div className="absolute inset-0 bg-black/30 z-0"></div>
      
      {/* Sync Indicator - Subtle */}
      {settings.syncId && (
        <div className="absolute top-3 right-3 z-20 bg-black/40 backdrop-blur-md rounded-full px-2 py-1 flex items-center gap-1.5 border border-white/20 shadow-sm" title="Cloud Sync Active">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_5px_rgba(74,222,128,0.8)]"></div>
          <span className="text-[10px] font-bold text-white/90">Linked</span>
        </div>
      )}
      
      <div className="relative z-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 shadow-sm drop-shadow-md">
          {settings.headerTitle}
        </h1>
        <p className="text-xs sm:text-sm opacity-90 drop-shadow-md font-medium">
          {settings.headerSubtitle}
        </p>
      </div>
    </div>
  );
};