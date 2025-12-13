import React from 'react';
import { AppSettings } from '../types';

interface HeaderProps {
  settings: AppSettings;
}

export const Header: React.FC<HeaderProps> = ({ settings }) => {
  return (
    <div 
      className="relative w-full py-5 sm:py-8 px-4 text-center text-white mb-4 sm:mb-6 rounded-b-xl shadow-md overflow-hidden"
      style={{
        background: settings.coverPhotoData 
          ? `url(${settings.coverPhotoData}) center/cover no-repeat`
          : `linear-gradient(135deg, var(--primary), var(--secondary))`,
      }}
    >
      {/* Overlay for better text readability if image exists */}
      <div className="absolute inset-0 bg-black/30 z-0"></div>
      
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