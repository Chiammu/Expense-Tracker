
import React, { useState, useEffect } from 'react';
import { AppState, AppSettings } from '../types';
import { shareBackup, exportToCSV, exportToPDF, exportMonthlyReportPDF, logAuditEvent } from '../services/storage';
import { authService } from '../services/auth';
import { generateMonthlyDigest } from '../services/geminiService';
import { webAuthnService } from '../services/webAuthn';
import { ScannerModal } from './ScannerModal';
// @ts-ignore
import QRCode from 'qrcode';

interface SettingsProps {
  state: AppState;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetData: () => void;
  deleteAccount: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  installApp: () => void;
  canInstall: boolean;
  isIos: boolean;
  isStandalone: boolean;
}

const haptic = (pattern: number | number[] = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const Settings: React.FC<SettingsProps> = ({ state, updateSettings, resetData, deleteAccount, showToast }) => {
  const [pinInput, setPinInput] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [manualSyncId, setManualSyncId] = useState('');
  
  useEffect(() => {
    // Generate QR for our sync ID (which we'll assume is the user ID if not explicitly set)
    const idToShare = state.settings.syncId || 'NOT_PAIRED';
    QRCode.toDataURL(idToShare)
      .then((url: string) => setQrUrl(url))
      .catch((err: any) => console.error("QR Gen Error:", err));

    webAuthnService.isSupported().then(setBiometricSupported);
  }, [state.settings.syncId]);

  const handleRegisterBiometrics = async () => {
    setRegistering(true);
    try {
      const result = await webAuthnService.registerBiometrics(state.settings.person1Name);
      updateSettings({ webAuthnCredentialId: result.credentialId });
      logAuditEvent('BIOMETRICS_REGISTERED');
      showToast("Biometrics registered successfully!", "success");
      haptic([10, 5, 10]);
    } catch (err: any) {
      console.error(err);
      showToast("Biometric registration failed", "error");
    } finally {
      setRegistering(false);
    }
  };

  const handleSyncScan = (data: string) => {
    if (data && data.length > 10) {
      updateSettings({ syncId: data });
      setShowScanner(false);
      logAuditEvent('COUPLE_SYNC_PAIRED', { method: 'QR' });
      showToast("Couple Sync Active!", "success");
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

      {/* IDENTITY SECTION */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="👤" title="Identity & Profile" />
         <div className="grid grid-cols-2 gap-4">
            <input type="text" className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-sm font-bold" value={state.settings.person1Name} onChange={e => updateSettings({ person1Name: e.target.value })} placeholder="Person 1" />
            <input type="text" className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-sm font-bold" value={state.settings.person2Name} onChange={e => updateSettings({ person2Name: e.target.value })} placeholder="Person 2" />
         </div>
      </section>

      {/* SYNC CENTER */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="👫" title="Couple Sync" />
         <div className="space-y-6">
            <div className="flex flex-col items-center">
               {qrUrl ? (
                 <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100 mb-4">
                    <img src={qrUrl} alt="Sync QR" className="w-32 h-32" />
                 </div>
               ) : (
                 <div className="w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-text-light mb-4">No ID</div>
               )}
               <div className="text-center">
                 <p className="text-[10px] font-black uppercase text-text-light tracking-widest mb-1">Your Sync ID</p>
                 <code className="text-xs bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded text-primary font-mono">{state.settings.syncId || 'None'}</code>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setShowScanner(true)} className="py-3 bg-primary text-white font-bold rounded-xl text-xs flex flex-col items-center gap-1 shadow-lg shadow-primary/20 active:scale-95 transition-all">
                 <span>📷</span> Scan Partner
               </button>
               <button onClick={generateSyncId} className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-xs flex flex-col items-center gap-1 active:scale-95 transition-all">
                 <span>🆕</span> New ID
               </button>
            </div>

            <div className="relative pt-4 flex gap-2">
               <input 
                 type="text" 
                 placeholder="Manual Sync ID..." 
                 className="flex-1 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-xs border-none focus:ring-1 focus:ring-primary/20"
                 value={manualSyncId}
                 onChange={e => setManualSyncId(e.target.value)}
               />
               <button onClick={() => handleSyncScan(manualSyncId)} className="bg-secondary text-white px-4 rounded-xl text-xs font-bold">Join</button>
            </div>
         </div>
      </section>

      {/* SECURITY & BIOMETRICS */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="🛡️" title="Security & Biometrics" />
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
                     <input type="password" maxLength={4} className="w-14 p-1.5 text-center text-xs rounded-lg bg-white dark:bg-gray-800" placeholder="PIN" value={pinInput} onChange={e => setPinInput(e.target.value)} />
                     <button onClick={() => { if(pinInput.length===4) { haptic(10); updateSettings({ pin: pinInput }); setPinInput(''); showToast("PIN Set"); }}} className="text-primary text-xs font-bold">Set</button>
                  </div>
               )}
            </div>

            {biometricSupported && (
               <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Biometric Unlock</span>
                    <span className="text-[10px] text-text-light">{state.settings.webAuthnCredentialId ? 'Registered (FaceID/TouchID)' : 'Register your device'}</span>
                  </div>
                  {state.settings.webAuthnCredentialId ? (
                    <button onClick={() => updateSettings({ webAuthnCredentialId: null })} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold">Disable</button>
                  ) : (
                    <button 
                      onClick={handleRegisterBiometrics}
                      disabled={registering}
                      className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                    >
                      {registering ? '...' : 'Register'}
                    </button>
                  )}
               </div>
            )}
         </div>
      </section>

      {/* REPORTS SECTION */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="📩" title="Reports & Data" />
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
               <button onClick={handleDownloadMonthlyPDF} disabled={generatingReport} className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-xs">📄 Export PDF</button>
               <button onClick={() => { haptic(5); exportToCSV(state.expenses); }} className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-xs">📊 Export CSV</button>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-[10px] text-text-light italic">
              AI reports include data processing and insights. Disclaimer: Not professional advice.
            </div>
         </div>
      </section>

      {/* APPEARANCE */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="🎨" title="Appearance" />
         <div className="flex gap-2 bg-gray-100 dark:bg-gray-900/50 p-1.5 rounded-xl">
            <button onClick={() => { haptic(5); updateSettings({ theme: 'light' }); }} className={`flex-1 py-2 rounded-lg text-sm font-bold ${state.settings.theme === 'light' ? 'bg-white shadow-sm' : ''}`}>Light</button>
            <button onClick={() => { haptic(5); updateSettings({ theme: 'dark' }); }} className={`flex-1 py-2 rounded-lg text-sm font-bold ${state.settings.theme === 'dark' ? 'bg-gray-800 text-white shadow-sm' : ''}`}>Dark</button>
         </div>
      </section>

      {/* ACCOUNT ACTIONS */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
         <SectionHeader icon="🚪" title="Account Actions" />
         <div className="space-y-3">
            <button onClick={handleSignOut} className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-2xl">Sign Out</button>
            <button onClick={deleteAccount} className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-600 font-bold rounded-2xl border border-red-100 dark:border-red-900/20 active:bg-red-200 transition-colors">
              Delete My Account & Data
            </button>
            <p className="text-[9px] text-center text-text-light px-4">
              Deleting your account will purge all cloud-stored financial rows and remove your local profile. This action complies with GDPR/CCPA data deletion policies.
            </p>
         </div>
      </section>

      <div className="text-center text-[10px] text-gray-300 pt-4">
         v1.6.0 • Audit Logging • Biometric Unlock • Couple Sync Pro
      </div>
    </div>
  );
};
