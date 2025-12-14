import React from 'react';
import { AppSettings } from '../types';

interface HeaderProps {
  settings: AppSettings;
}

export const Header: React.FC<HeaderProps> = ({ settings }) => {
  return (
    <div 
      className="relative w-full py-4 sm:py-6 px-4 text-center text-white mb-4 sm:mb-6 rounded-b-xl shadow-md overflow-hidden transition-all duration-500"
      style={{
        background: settings.coverPhotoData 
          ? `url(${settings.coverPhotoData}) center/cover no-repeat`
          : `linear-gradient(135deg, var(--primary), var(--secondary))`,
      }}
    >
      {/* Overlay for better text readability if image exists */}
      <div className="absolute inset-0 bg-black/30 z-0"></div>
      
      {/* Sync Indicator - Blinking Dot Only */}
      <div className="absolute top-3 right-3 z-20 flex items-center justify-center">
         {settings.syncId ? (
            // Connected: Green Blinking
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" title="Connected"></div>
         ) : (
            // Disconnected: Red Blinking
            <div className="w-3 h-3 rounded-full bg-red-500 animate-[pulse_1s_infinite] shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="Disconnected"></div>
         )}
      </div>
      
      <div className="relative z-10">
        <h1 className="text-xl sm:text-2xl font-bold mb-0 shadow-sm drop-shadow-md">
          {settings.headerTitle}
        </h1>
      </div>
    </div>
  );
};