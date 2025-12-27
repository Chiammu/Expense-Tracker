
import React, { useState, useEffect, useRef } from 'react';
import { AppState, AppSettings } from '../types';
import { shareBackup, exportToCSV, exportMonthlyReportPDF, logAuditEvent, importDataFromJSON, exportData } from '../services/storage';
import { authService } from '../services/auth';
import { generateMonthlyDigest } from '../services/geminiService';
import { ScannerModal } from './ScannerModal';
// @ts-ignore
import QRCode from 'qrcode';

interface SettingsProps {
  state: AppState;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  onImportState: (newState: AppState) => void;
  resetData: () => void;
  deleteAccount: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const haptic = (pattern: number | number[] = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const Settings: React.FC<SettingsProps> = ({ state, updateSettings, onImportState, deleteAccount, showToast }) => {
  const [pinInput, setPinInput] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const idToShare = state.settings.syncId || 'NOT_PAIRED';
    QRCode.toDataURL(idToShare)
      .then((url: string) => setQrUrl(url))
      .catch((err: any) => console.error("QR Gen Error:", err));

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [state.settings.syncId]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleSyncScan = (data: string) => {
    if (data && data.length > 10) {
      updateSettings({ syncId: data });
      setShowScanner(false);
      logAuditEvent('COUPLE_SYNC_PAIRED', { method: 'QR' });
      showToast("Sync Active!", "success");
      haptic([10, 5, 10]);
    }
  };

  const generateSyncId = () => {
    const newId = crypto.randomUUID();
    updateSettings({ syncId: newId });
    logAuditEvent('COUPLE_SYNC_ID_GENERATED');
    showToast("New Sync ID Generated");
  };

  const handleDownloadMonthlyPDF = async () => {
    setGeneratingReport(true);
    showToast("Generating Monthly PDF Report...", "info");
    try {
      const digest = await generateMonthlyDigest(state);
      exportMonthlyReportPDF(state, digest);
      haptic(20);
      showToast("PDF Advisor Report downloaded!", "success");
    } catch (error) {
      showToast("PDF generation failed.", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const newState = await importDataFromJSON(file);
      onImportState(newState);
      haptic([10, 5, 10]);
      showToast("Data imported successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to import JSON", "error");
    } finally {
      if (e.target) e.target.value = ''; // Reset for next selection
    }
  };

  const handleSignOut = async () => {
    if (confirm("Sign out?")) {
      try {
        await authService.signOut();
        haptic(5);
        showToast("Signed out successfully", "info");
      } catch (err: any) {
        showToast(err.message, "error");
      }
    }
  };

  const SectionHeader = ({ icon, title }: { icon: string, title: string }) => (
    <div className="flex items-center gap-2 mb-4">
       <span className="text-xl">{icon}</span>
       <h3 className="text-lg font-bold text-text">{title}</h3>
    </div>
  );

  return (
    <div className="pb-24 max-w-xl mx-auto space-y-8 animate-fade-in">
      
      {showScanner && <ScannerModal onScan={handleSyncScan} onClose={() => setShowScanner(false)} />}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportJSON} 
        accept=".json" 
        className="hidden" 
      />

      {deferredPrompt && (
        <section className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-3xl p-6 border border-primary/20 animate-slide-up">
           <div className="flex items-center gap-4">
              <div className="text-3xl">📱</div>
              <div className="flex-1">
                 <h3 className="text-sm font-bold">Install as App</h3>
                 <p className="text-[10px] text-text-light">Get faster access and a fullscreen experience.</p>
              </div>
              <button onClick={handleInstallClick} className="bg-primary text-white text-[10px] font-bold px-4 py-2 rounded-full shadow-lg">Install</button>
           </div>
        </section>
      )}

      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="👤" title="Identity & Profile" />
         <div className="grid grid-cols-2 gap-4">
            <input type="text" className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-sm font-bold" value={state.settings.person1Name} onChange={e => updateSettings({ person1Name: e.target.value })} placeholder="Person 1" />
            <input type="text" className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-sm font-bold" value={state.settings.person2Name} onChange={e => updateSettings({ person2Name: e.target.value })} placeholder="Person 2" />
         </div>
      </section>

      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="👫" title="Data Sync" />
         <div className="space-y-6">
            <div className="flex flex-col items-center text-center px-4">
               {qrUrl ? (
                 <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100 mb-4">
                    <img src={qrUrl} alt="Sync QR" className="w-32 h-32" />
                 </div>
               ) : (
                 <div className="w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-text-light mb-4">No ID</div>
               )}
               <p className="text-[10px] font-black uppercase text-text-light tracking-widest mb-1">Your Device ID</p>
               <code className="text-[10px] bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded text-primary font-mono max-w-full break-all mb-4">{state.settings.syncId || 'None'}</code>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4">
               <button onClick={() => setShowScanner(true)} className="py-3 bg-primary text-white font-bold rounded-xl text-xs flex flex-col items-center gap-1 shadow-lg shadow-primary/20 active:scale-95 transition-all">
                 <span>📷</span> Scan Partner
               </button>
               <button onClick={generateSyncId} className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-xs flex flex-col items-center gap-1 active:scale-95 transition-all">
                 <span>🆕</span> New ID
               </button>
            </div>
         </div>
      </section>

      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="🛡️" title="Security" />
         <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
               <div className="flex flex-col">
                 <span className="text-sm font-bold">PIN Lock</span>
                 <span className="text-[10px] text-text-light">{state.settings.pin ? 'Currently Active' : 'Not configured'}</span>
               </div>
               {state.settings.pin ? (
                  <button onClick={() => { haptic(5); updateSettings({ pin: null }); }} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold">Remove</button>
               ) : (
                  <div className="flex items-center gap-2">
                     <input type="password" pattern="[0-9]*" inputMode="numeric" maxLength={4} className="w-14 p-1.5 text-center text-xs rounded-lg bg-white dark:bg-gray-800" placeholder="PIN" value={pinInput} onChange={e => setPinInput(e.target.value)} />
                     <button onClick={() => { if(pinInput.length===4) { haptic(10); updateSettings({ pin: pinInput }); setPinInput(''); showToast("PIN Set"); }}} className="text-primary text-xs font-bold">Set</button>
                  </div>
               )}
            </div>
         </div>
      </section>

      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="📩" title="Export & Backup" />
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 mb-2">
               <button onClick={handleDownloadMonthlyPDF} disabled={generatingReport} className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-[10px] flex flex-col items-center gap-1">
                 <span>📄</span> PDF Report
               </button>
               <button onClick={() => { haptic(5); exportToCSV(state.expenses); }} className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-[10px] flex flex-col items-center gap-1">
                 <span>📊</span> CSV Sheet
               </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => { haptic(5); exportData(state); }} className="py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl text-[10px] flex flex-col items-center gap-1 border border-indigo-100 dark:border-indigo-800">
                 <span>💾</span> Export JSON
               </button>
               <button onClick={() => { haptic(5); fileInputRef.current?.click(); }} className="py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-bold rounded-xl text-[10px] flex flex-col items-center gap-1 border border-green-100 dark:border-green-800">
                 <span>📥</span> Import JSON
               </button>
            </div>
         </div>
      </section>

      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="🚪" title="Account" />
         <div className="space-y-3">
            <button onClick={handleSignOut} className="w-full py-3 bg-gray-100 dark:bg-gray-900/50 text-text font-bold rounded-2xl">Sign Out</button>
            <button onClick={deleteAccount} className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-600 font-bold rounded-2xl border border-red-100 dark:border-red-900/20 active:bg-red-200 transition-colors">
              Delete All Data
            </button>
         </div>
      </section>

      <div className="text-center text-[10px] text-gray-300 pt-4 pb-8">
         v1.6.5 • E2EE Logic • PIN Security • PWA Standalone
      </div>
    </div>
  );
};
