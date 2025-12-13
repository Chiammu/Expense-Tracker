import React from 'react';
import { AppSettings } from '../types';

interface HeaderProps {
  settings: AppSettings;
  showInstall?: boolean;
  onInstall?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ settings, showInstall, onInstall }) => {
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
      
      {/* Install Button (Visible if app can be installed) */}
      {showInstall && (
        <button 
          onClick={onInstall}
          className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-md p-2 rounded-full text-white transition-all active:scale-95 z-20 shadow-sm border border-white/20"
          title="Install App"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
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