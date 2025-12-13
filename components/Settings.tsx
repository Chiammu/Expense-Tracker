import React, { useState } from 'react';
import { AppState, AppSettings } from '../types';
import { shareBackup, exportToCSV, exportToPDF } from '../services/storage';

interface SettingsProps {
  state: AppState;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetData: () => void;
  importData: (file: File) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  installApp: () => void;
  canInstall: boolean;
  isIos: boolean;
  isStandalone: boolean;
}

const COLORS = ['#e91e63', '#f44336', '#ff6f00', '#ffc107', '#4caf50', '#2196f3', '#9c27b0', '#673ab7', '#3f51b5', '#00bcd4', '#009688', '#8bc34a'];

export const Settings: React.FC<SettingsProps> = ({ state, updateSettings, resetData, importData, showToast, installApp, canInstall, isIos, isStandalone }) => {
  const [newCat, setNewCat] = useState('');
  const [pinInput, setPinInput] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          updateSettings({ coverPhotoData: ev.target.result as string });
          showToast("Cover photo updated");
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      importData(e.target.files[0]);
    }
  };

  const handleShareBackup = async () => {
    const shared = await shareBackup(state);
    if (!shared) {
      showToast("Downloaded backup (Sharing not supported)", 'info');
    }
  };

  const addCategory = () => {
    if (newCat && !state.settings.customCategories.includes(newCat)) {
      updateSettings({ customCategories: [...state.settings.customCategories, newCat] });
      setNewCat('');
      showToast(`Category "${newCat}" added`);
    }
  };

  const removeCategory = (cat: string) => {
    if (window.confirm(`Delete category "${cat}"?`)) {
      updateSettings({ customCategories: state.settings.customCategories.filter(c => c !== cat) });
      showToast("Category removed");
    }
  };

  const setPin = () => {
    if (pinInput.length === 4) {
      updateSettings({ pin: pinInput });
      setPinInput('');
      showToast("PIN set successfully", 'success');
    } else {
      showToast("PIN must be 4 digits", 'error');
    }
  };

  return (
    <div className="pb-24 space-y-4 sm:space-y-6">
      
      {/* Install App Section - Show if not already installed (standalone) AND (either canInstall is true OR on iOS) */}
      {!isStandalone && (canInstall || isIos) && (
        <div className="bg-gradient-to-r from-primary to-purple-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="font-bold text-lg">Install App</h3>
              <p className="text-xs opacity-90">Get the best experience on your phone</p>
            </div>
            {canInstall && (
              <button 
                onClick={installApp} 
                className="bg-white text-primary px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors shadow-sm"
              >
                Install
              </button>
            )}
          </div>
          
          {/* iOS Specific Instructions */}
          {isIos && !canInstall && (
            <div className="bg-black/20 rounded-lg p-3 text-xs mt-2 border border-white/10">
              <p className="font-bold mb-1 flex items-center gap-1">
                <span>📱</span> Install on iPhone/iPad:
              </p>
              <ol className="list-decimal list-inside space-y-1 opacity-90 ml-1">
                <li>Tap the <span className="font-bold">Share</span> button in Safari menu</li>
                <li>Scroll down & select <span className="font-bold">Add to Home Screen</span></li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Security Section */}
      <div className="bg-surface/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6 transition-all hover:shadow-md">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="text-xl">🛡️</span> Security
        </h3>
        
        {state.settings.pin ? (
          <div className="flex justify-between items-center bg-green-50/50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-800/30">
            <div>
              <div className="text-green-700 dark:text-green-400 font-bold flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                App Secured
              </div>
              <div className="text-xs text-green-600/70 dark:text-green-400/60">PIN protection is active</div>
            </div>
            <button 
              onClick={() => { updateSettings({ pin: null }); showToast("PIN removed", 'info'); }} 
              className="px-4 py-2 bg-white dark:bg-gray-800 text-red-500 text-sm font-semibold rounded-lg shadow-sm hover:shadow border border-gray-100 dark:border-gray-700 transition-all active:scale-95"
            >
              Disable
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="password" 
              maxLength={4} 
              placeholder="Enter 4-digit PIN"
              className="flex-1 p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-background/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-center tracking-[0.5em] text-lg font-bold placeholder:font-normal placeholder:tracking-normal"
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <button 
              onClick={setPin} 
              disabled={pinInput.length !== 4}
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
            >
              Set PIN
            </button>
          </div>
        )}
      </div>

      {/* Categories Section */}
      <div className="bg-surface/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6 transition-all hover:shadow-md">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
          <span className="text-xl">🏷️</span> Categories
        </h3>
        
        <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
          {state.settings.customCategories.map(cat => (
            <span key={cat} className="group inline-flex items-center px-2.5 py-1 sm:px-3 sm:py-1.5 bg-gray-50 dark:bg-gray-800 rounded-full text-xs sm:text-sm font-medium border border-gray-100 dark:border-gray-700 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-default">
              {cat}
              <button 
                onClick={() => removeCategory(cat)} 
                className="ml-2 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        
        <div className="relative flex items-center group">
          <input 
            className="w-full p-3 sm:p-4 pr-14 border border-gray-200 dark:border-gray-700 rounded-xl bg-background/50 focus:bg-background focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all text-sm sm:text-base" 
            placeholder="Add new category..."
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
          />
          <button 
            onClick={addCategory} 
            disabled={!newCat}
            className="absolute right-2 p-1.5 sm:p-2 bg-secondary text-white rounded-lg shadow-md hover:bg-secondary/90 disabled:opacity-50 disabled:shadow-none transition-all active:scale-90"
          >
            <span className="text-lg sm:text-xl leading-none block pb-0.5">+</span>
          </button>
        </div>
      </div>

      {/* Personalization Section */}
      <div className="bg-surface/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6 transition-all hover:shadow-md">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 sm:mb-6 flex items-center gap-2">
          <span className="text-xl">🎨</span> Look & Feel
        </h3>
        
        {/* Theme Toggle */}
        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex mb-6">
          <button 
            onClick={() => updateSettings({ theme: 'light' })} 
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              state.settings.theme === 'light' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            ☀️ Light
          </button>
          <button 
            onClick={() => updateSettings({ theme: 'dark' })} 
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              state.settings.theme === 'dark' 
                ? 'bg-gray-700 text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            🌙 Dark
          </button>
        </div>

        {/* Color Picker */}
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 block">Accent Color</label>
          <div className="flex flex-wrap gap-3">
            {COLORS.map(c => (
               <button 
                 key={c} 
                 style={{ backgroundColor: c }}
                 onClick={() => updateSettings({ primaryColor: c })}
                 className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-transform flex items-center justify-center ${
                   state.settings.primaryColor === c 
                     ? 'scale-110 ring-2 ring-offset-2 ring-gray-300 dark:ring-gray-600 shadow-md' 
                     : 'hover:scale-110 hover:shadow-sm'
                 }`}
               >
                 {state.settings.primaryColor === c && <span className="text-white text-lg drop-shadow-md">✓</span>}
               </button>
            ))}
          </div>
        </div>

        {/* Names */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 block">Partner Names</label>
          <div className="grid grid-cols-2 gap-4">
             <input 
               className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors text-sm" 
               value={state.settings.person1Name}
               onChange={e => updateSettings({ person1Name: e.target.value })}
               placeholder="Person 1"
             />
             <input 
               className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors text-sm" 
               value={state.settings.person2Name}
               onChange={e => updateSettings({ person2Name: e.target.value })}
               placeholder="Person 2"
             />
          </div>
        </div>
      </div>

      {/* Cover Photo */}
      <div className="bg-surface/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6 transition-all hover:shadow-md">
         <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
            <span className="text-xl">🖼️</span> Cover Photo
         </h3>
         <div className="relative group overflow-hidden rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all">
           <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
           <div className="p-6 sm:p-8 text-center">
             <div className="text-3xl sm:text-4xl mb-2 group-hover:scale-110 transition-transform">📸</div>
             <div className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Tap to upload cover</div>
             <div className="text-[10px] sm:text-xs text-gray-400 mt-1">Supports JPG, PNG</div>
           </div>
         </div>
         {state.settings.coverPhotoData && (
            <div className="mt-3 flex justify-end">
              <button 
                onClick={() => { updateSettings({ coverPhotoData: null }); showToast("Photo removed"); }} 
                className="text-red-500 text-xs font-bold px-3 py-1 bg-red-50 dark:bg-red-900/10 rounded-lg hover:bg-red-100 transition-colors"
              >
                Remove Current Photo
              </button>
            </div>
         )}
      </div>

      {/* Data Management */}
      <div className="bg-surface/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-6 transition-all hover:shadow-md">
         <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
            <span className="text-xl">💾</span> Data & Syncing
         </h3>
         
         <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={handleShareBackup} className="p-4 bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary hover:text-white hover:shadow-md transition-all flex flex-col items-center gap-2 group col-span-2">
               <span className="text-2xl group-hover:scale-110 transition-transform">📤</span>
               <div className="text-center">
                 <span className="text-sm font-bold block">Share Backup</span>
                 <span className="text-[10px] opacity-75">Send file to partner</span>
               </div>
            </button>
            <button onClick={() => exportToCSV(state.expenses)} className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-white hover:shadow-md transition-all flex flex-col items-center gap-2 group">
              <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">CSV</span>
            </button>
            <button onClick={() => exportToPDF(state)} className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-white hover:shadow-md transition-all flex flex-col items-center gap-2 group">
              <span className="text-2xl group-hover:scale-110 transition-transform">📄</span>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">PDF</span>
            </button>
         </div>

         <div className="mb-4">
            <label className="block w-full p-3 bg-secondary/5 border border-secondary/20 rounded-xl text-center cursor-pointer hover:bg-secondary/10 transition-colors">
               <span className="text-sm font-bold text-secondary">📂 Import Partner's File</span>
               <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
         </div>

         <button onClick={resetData} className="w-full mt-4 p-3 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors flex items-center justify-center gap-2 opacity-70 hover:opacity-100">
            <span>🗑️</span> Reset App Data
         </button>
      </div>

    </div>
  );
};