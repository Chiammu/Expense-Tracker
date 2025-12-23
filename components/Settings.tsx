
import React, { useState, useEffect, useRef } from 'react';
import { AppState, AppSettings } from '../types';
import { shareBackup, exportToCSV, exportToPDF, exportMonthlyReportPDF } from '../services/storage';
import { authService } from '../services/auth';
import { generateMonthlyDigest } from '../services/geminiService';
// @ts-ignore
import QRCode from 'qrcode';
// @ts-ignore
import jsQR from 'jsqr';

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

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      console.warn("crypto.randomUUID failed, using fallback");
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const Settings: React.FC<SettingsProps> = ({ state, updateSettings, resetData, importData, showToast, installApp, canInstall, isIos, isStandalone }) => {
  const [pinInput, setPinInput] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (state.settings.syncId) {
      QRCode.toDataURL(state.settings.syncId)
        .then((url: string) => setQrUrl(url))
        .catch((err: any) => console.error("QR Gen Error:", err));
    } else {
      setQrUrl('');
    }
  }, [state.settings.syncId]);

  const handleSendMonthlyReport = async () => {
    if (!state.settings.reportEmail) {
      showToast("Please enter an email address first.", "error");
      return;
    }
    setGeneratingReport(true);
    showToast("AI is analyzing the month...", "info");
    try {
      const digest = await generateMonthlyDigest(state);
      const subject = `Monthly Financial Digest - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`;
      const mailtoUrl = `mailto:${state.settings.reportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(digest)}`;
      window.location.href = mailtoUrl;
      showToast("Report generated! Opening your email app.", "success");
    } catch (error) {
      showToast("Failed to generate AI report.", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleDownloadMonthlyPDF = async () => {
    setGeneratingReport(true);
    showToast("Generating Monthly PDF Report...", "info");
    try {
      const digest = await generateMonthlyDigest(state);
      exportMonthlyReportPDF(state, digest);
      showToast("PDF Advisor Report downloaded!", "success");
    } catch (error) {
      showToast("PDF generation failed.", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleDownloadMonthlyExcel = () => {
    const now = new Date();
    const monthExpenses = state.expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    exportToCSV(monthExpenses, `Month-${now.getMonth() + 1}-${now.getFullYear()}`);
    showToast("Excel/CSV Data downloaded!", "success");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
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

  const handleSignOut = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      try {
        await authService.signOut();
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
      {/* REPORTS & AUTOMATION */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="📩" title="AI Monthly Reports" />
         <div className="space-y-4">
            <p className="text-xs text-text-light">Get your Personal Financial Advisor's breakdown in professional formats.</p>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
               <div className="text-sm font-bold">Monthly Reminders</div>
               <button 
                 onClick={() => updateSettings({ emailReportsEnabled: !state.settings.emailReportsEnabled })}
                 className={`w-12 h-6 rounded-full relative transition-colors ${state.settings.emailReportsEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
               >
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${state.settings.emailReportsEnabled ? 'left-7' : 'left-1'}`}></div>
               </button>
            </div>

            <div className="space-y-1">
               <label className="text-[10px] uppercase font-black text-text-light ml-1">Default Recipient</label>
               <input 
                 type="email" 
                 placeholder="your-email@example.com"
                 className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-none focus:ring-2 focus:ring-primary/20 text-sm"
                 value={state.settings.reportEmail}
                 onChange={e => updateSettings({ reportEmail: e.target.value })}
               />
            </div>

            <div className="grid grid-cols-2 gap-3">
               <button 
                 onClick={handleDownloadMonthlyPDF}
                 disabled={generatingReport}
                 className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
               >
                 {generatingReport ? "⏳..." : "📄 Export PDF"}
               </button>
               <button 
                 onClick={handleDownloadMonthlyExcel}
                 className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
               >
                 📊 Export Excel
               </button>
            </div>

            <button 
              onClick={handleSendMonthlyReport}
              disabled={generatingReport}
              className="w-full py-3 bg-gradient-to-r from-primary to-pink-600 text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {generatingReport ? (
                <span className="flex items-center gap-2">
                   <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                   Analyzing...
                </span>
              ) : (
                <><span>✨</span> Send Email Digest</>
              )}
            </button>
         </div>
      </section>

      {/* SYNC SECTION */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="☁️" title="Partner Sync" />
         <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-700/50">
            {state.settings.syncId ? (
              <div className="flex flex-col items-center gap-4">
                 <div className="bg-white p-3 rounded-2xl shadow-sm">
                   {qrUrl ? <img src={qrUrl} alt="QR" className="w-32 h-32" /> : <div className="w-32 h-32 bg-gray-100 animate-pulse rounded-xl" />}
                 </div>
                 <div className="text-center">
                    <p className="text-sm font-medium text-green-500 mb-1">● Synced Active</p>
                    <p className="text-xs text-text-light font-mono cursor-pointer hover:text-primary break-all" onClick={() => {navigator.clipboard.writeText(state.settings.syncId!); showToast("Copied");}}>
                      {state.settings.syncId}
                    </p>
                 </div>
                 <button onClick={() => { if(confirm("Unlink device?")) updateSettings({syncId: null}); }} className="text-xs text-red-500 font-bold px-4 py-2 bg-red-50 dark:bg-red-900/10 rounded-full hover:bg-red-100 transition-colors">
                   Disconnect Sync
                 </button>
              </div>
            ) : (
              <div className="space-y-4">
                 <p className="text-sm text-text-light text-center">Scan to link with your partner.</p>
                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setIsScanning(true)} className="py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all">Scan QR</button>
                    <button onClick={() => updateSettings({ syncId: generateUUID() })} className="py-3 bg-white dark:bg-gray-800 text-text font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 active:scale-95 transition-all">Show Code</button>
                 </div>
              </div>
            )}
         </div>
      </section>

      {/* APPEARANCE */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="🎨" title="Look & Feel" />
         <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-text-light uppercase mb-3 block">Theme</label>
              <div className="flex gap-2 bg-gray-100 dark:bg-gray-900/50 p-1.5 rounded-xl">
                 <button onClick={() => updateSettings({ theme: 'light' })} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${state.settings.theme === 'light' ? 'bg-white shadow-sm text-black' : 'text-gray-400'}`}>Light</button>
                 <button onClick={() => updateSettings({ theme: 'dark' })} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${state.settings.theme === 'dark' ? 'bg-gray-800 shadow-sm text-white' : 'text-gray-400'}`}>Dark</button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-text-light uppercase mb-3 block">Accent Color</label>
              <div className="flex flex-wrap gap-3">
                 {COLORS.map(c => (
                    <button key={c} onClick={() => updateSettings({ primaryColor: c })} style={{ backgroundColor: c }} className={`w-9 h-9 rounded-full transition-transform ${state.settings.primaryColor === c ? 'scale-110 ring-4 ring-gray-100 dark:ring-gray-800' : 'hover:scale-110'}`} />
                 ))}
              </div>
            </div>
         </div>
      </section>

      {/* DATA & SECURITY */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="🛡️" title="Data & Privacy" />
         <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
               <div className="flex items-center gap-3">
                  <div className="text-2xl">{state.settings.pin ? '🔒' : '🔓'}</div>
                  <div className="text-sm font-bold">App Lock</div>
               </div>
               {state.settings.pin ? (
                  <button onClick={() => updateSettings({ pin: null })} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold">Remove</button>
               ) : (
                  <div className="flex items-center gap-2">
                     <input type="password" maxLength={4} className="w-14 p-1.5 text-center text-sm rounded-lg border-none bg-white dark:bg-gray-800 shadow-sm" placeholder="PIN" value={pinInput} onChange={e => setPinInput(e.target.value)} />
                     <button onClick={setPin} disabled={pinInput.length !== 4} className="text-primary text-xs font-bold px-2">Set</button>
                  </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => exportToPDF(state)} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-bold text-text-light hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">📄 General PDF</button>
               <button onClick={() => exportToCSV(state.expenses)} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-bold text-text-light hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">📊 General CSV</button>
            </div>
            
            <div className="flex gap-3 justify-center pt-2">
               <button onClick={() => shareBackup(state)} className="text-xs font-bold text-primary hover:underline">Backup</button>
               <span className="text-gray-300">|</span>
               <label className="text-xs font-bold text-primary hover:underline cursor-pointer">
                  Restore <input type="file" accept=".json" onChange={handleImport} className="hidden" />
               </label>
               <span className="text-gray-300">|</span>
               <button onClick={resetData} className="text-xs font-bold text-red-400 hover:text-red-600">Reset App</button>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
               <button 
                 onClick={handleSignOut}
                 className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-600 font-bold rounded-2xl border border-red-100 dark:border-red-900/20 active:scale-95 transition-transform"
               >
                 Sign Out
               </button>
            </div>
         </div>
      </section>

      <div className="text-center text-[10px] text-gray-300 pt-4">
         v1.3.1 • Monthly PDF & Excel Advisor Reports • Cloud Sync enabled
      </div>
    </div>
  );
};
