import React, { useState, useEffect } from 'react';
import { AppState, AppSettings } from '../types';
import { shareBackup, exportToCSV, exportToPDF, exportMonthlyReportPDF, logAuditEvent, exportData, deleteCloudData, triggerCloudSave, normalizeAppState } from '../services/storage';
import { requestNotificationPermission, sendLocalNotification } from '../services/alertService';
import { authService } from '../services/auth';
import { generateMonthlyDigest } from '../services/geminiService';
import { webAuthnService } from '../services/webAuthn';
import { ScannerModal } from './ScannerModal';
import { QRCodeCanvas } from 'qrcode.react';
import { generateId } from '../utils/id';
import { hashPIN } from '../utils/security';
import { BankImport } from './BankImport';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsProps {
  state: AppState;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  updateState: (newState: Partial<AppState>) => void;
  resetData: () => void;
  deleteAccount: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  installApp: () => void;
  canInstall: boolean;
  isIos: boolean;
  isStandalone: boolean;
  userEmail?: string;
  addExpense: (expense: any) => void;
}

const haptic = (pattern: number | number[] = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

const AccordionItem: React.FC<{
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, icon, isOpen, onClick, children }) => {
  return (
    <div className={`
      bg-white dark:bg-[#1a1a1a] rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 
      overflow-hidden transition-all duration-300
      ${isOpen ? 'ring-2 ring-indigo-500/20 shadow-xl' : 'hover:border-gray-200 dark:hover:border-white/10'}
    `}>
      <button
        onClick={() => {
          haptic(5);
          onClick();
        }}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group text-left"
      >
        <div className="flex items-center gap-4">
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300
            ${isOpen ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 group-hover:scale-110'}
          `}>
            {icon}
          </div>
          <span className={`text-base font-bold tracking-tight transition-colors ${isOpen ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
            {title}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="text-gray-400"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="p-6 pt-0 border-t border-gray-50 dark:border-white/5 bg-gray-50/20 dark:bg-white/[0.01]">
              <div className="pt-6">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Settings: React.FC<SettingsProps> = ({ state, updateSettings, updateState, resetData, deleteAccount, showToast, userEmail, addExpense }) => {
  const [pinInput, setPinInput] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [openSection, setOpenSection] = useState<string | null>('Profile');

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        console.log("Importing JSON length:", json.length);

        let parsed: any;
        try {
          parsed = JSON.parse(json);
        } catch (e) {
          throw new Error("File is not valid JSON");
        }

        // 1. Handle double-stringified JSON (e.g. "{\"state\":...}")
        if (typeof parsed === 'string') {
          console.log("Detected stringified JSON. Parsing again...");
          try {
            parsed = JSON.parse(parsed);
          } catch (e) {
            // It was just a string, ignore
          }
        }

        // 2. Handle simple object wrapper (e.g. { "coupleExpenseTrackerV4_React": ... })
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const keys = Object.keys(parsed);
          if (keys.length === 1) {
            const inner = parsed[keys[0]];
            // Case A: Inner is string (double serialized)
            if (typeof inner === 'string') {
              console.log(`Detected single key '${keys[0]}' containing string. Parsing inner...`);
              try {
                const unwrapped = JSON.parse(inner);
                if (typeof unwrapped === 'object') parsed = unwrapped;
              } catch (e) { }
            }
            // Case B: Inner is object (just nested)
            else if (typeof inner === 'object' && !Array.isArray(inner)) {
              // Check if this inner object looks promising (has state or expenses)
              if (inner.state || inner.expenses) {
                console.log(`Unwrapping single key '${keys[0]}' object...`);
                parsed = inner;
              }
            }
          }
        }

        // 3. Handle Zustand wrapper { state: ... }
        if (parsed?.state && typeof parsed.state === 'object' && !parsed.expenses) {
          console.log("Triggering Zustand unwrap...");
          parsed = parsed.state;
        }

        console.log("Final parsed keys:", parsed ? Object.keys(parsed) : 'null');

        // Validate critical fields
        if (!parsed || !Array.isArray(parsed.expenses)) {
          const foundKeys = parsed ? Object.keys(parsed).join(", ") : "null";
          console.error("Validation failed. Found keys:", foundKeys);
          throw new Error(`Invalid data structure. Found: [${foundKeys}]. Expected 'expenses' array.`);
        }

        // Robust merge + ID migration: normalize legacy numeric IDs to string IDs.
        const newState: AppState = normalizeAppState(parsed);

        if (confirm(`Found ${newState.expenses.length} expenses. Restore now?`)) {
          updateState(newState);
          triggerCloudSave(newState); // Force immediate cloud sync
          showToast(`Success! Restored ${newState.expenses.length} expenses.`, "success");
          haptic([10, 10]);
        }
      } catch (err: any) {
        console.error("Import error:", err);
        showToast("Import Failed: " + (err.message || "Unknown error"), "error");
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  useEffect(() => {
    webAuthnService.isSupported().then(setBiometricSupported);

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
    const newId = generateId();
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


  return (
    <div className="pb-32 max-w-xl mx-auto space-y-4 animate-fade-in relative z-0 px-4 pt-4">

      {showScanner && <ScannerModal onScan={handleSyncScan} onClose={() => setShowScanner(false)} />}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Settings</h1>
          <p className="text-xs text-gray-500 font-medium">Preferences & Management</p>
        </div>
      </div>

      {/* PWA INSTALL PROMOTION */}
      {deferredPrompt && (
        <section className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[24px] p-6 shadow-xl animate-slide-up text-white relative overflow-hidden mb-6">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl">📱</div>
              <div>
                <h3 className="font-bold text-lg">Install App</h3>
                <p className="text-white/80 text-xs">For the best fullscreen experience</p>
              </div>
            </div>
            <button onClick={handleInstallClick} className="bg-white text-indigo-600 font-bold px-5 py-2.5 rounded-xl shadow-lg active:scale-95 transition-transform text-sm">
              Install
            </button>
          </div>
        </section>
      )}

      {/* PROFILE ACCORDION */}
      <AccordionItem 
        title="Identity & Profile" 
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        isOpen={openSection === 'Profile'}
        onClick={() => setOpenSection(openSection === 'Profile' ? null : 'Profile')}
      >
        {userEmail && (
          <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-black text-indigo-400 dark:text-indigo-300 tracking-wider">Logged in as</p>
              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100 truncate">{userEmail}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Person 1</label>
            <input type="text" className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all" value={state.settings.person1Name} onChange={e => { updateSettings({ person1Name: e.target.value }); showToast('Saved', 'success'); }} placeholder="Name" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Person 2</label>
            <input type="text" className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-pink-500 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all" value={state.settings.person2Name} onChange={e => { updateSettings({ person2Name: e.target.value }); showToast('Saved', 'success'); }} placeholder="Name" />
          </div>
        </div>
      </AccordionItem>

      {/* APPEARANCE ACCORDION */}
        <AccordionItem 
        title="Appearance" 
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
        isOpen={openSection === 'Appearance'}
        onClick={() => setOpenSection(openSection === 'Appearance' ? null : 'Appearance')}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Choose how the app looks. <span className="font-semibold">System</span> follows your device preference automatically.
          </p>
          <div className="flex gap-3">
            {(['light', 'dark', 'system'] as const).map((t) => {
              const labels: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' };
              const isActive = (state.settings.theme || 'dark') === t;
              return (
                <button
                  key={t}
                  onClick={() => {
                    updateSettings({ theme: t });
                    haptic(5);
                    showToast(`Theme set to ${t}`, 'success');
                  }}
                  className="flex-1 py-3 px-2 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all border"
                  style={{
                    background: isActive ? 'var(--text-primary)' : 'var(--control-bg)',
                    color: isActive ? 'var(--bg-base)' : 'var(--text-secondary)',
                    borderColor: isActive ? 'transparent' : 'var(--border-default)',
                    boxShadow: isActive ? 'var(--shadow-subtle)' : 'none',
                  }}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </div>
      </AccordionItem>

      {/* NOTIFICATIONS ACCORDION */}
      <AccordionItem 
        title="Notifications" 
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
        isOpen={openSection === 'Notifications'}
        onClick={() => setOpenSection(openSection === 'Notifications' ? null : 'Notifications')}
      >
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Smart Alerts</span>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${state.settings.notificationsEnabled ? 'text-green-500' : 'text-gray-400'}`}>
              {state.settings.notificationsEnabled ? 'Active (Background)' : 'Disabled'}
            </span>
          </div>
          <button
            aria-label="Toggle Smart Alerts"
            onClick={async () => {
              if (!state.settings.notificationsEnabled) {
                const granted = await requestNotificationPermission();
                if (granted) {
                  updateSettings({ notificationsEnabled: true });
                  sendLocalNotification("Notifications Active", "You'll now receive smart budget alerts.");
                  showToast("Notifications Enabled", "success");
                  haptic(10);
                } else {
                  showToast("Permission denied", "error");
                }
              } else {
                updateSettings({ notificationsEnabled: false });
                haptic(5);
              }
            }}
            className={`relative w-14 h-8 rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-primary/20 ${state.settings.notificationsEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            <span className={`inline-block w-6 h-6 transform bg-white rounded-full transition-transform duration-300 ease-in-out shadow-md ${state.settings.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'} top-1 absolute`} />
          </button>
        </div>
      </AccordionItem>

      {/* DATA ACCORDION */}
      <AccordionItem 
        title="Data & Utilities" 
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
        isOpen={openSection === 'Data'}
        onClick={() => setOpenSection(openSection === 'Data' ? null : 'Data')}
      >
        <div className="space-y-6">
          {/* Couple Sync */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Couple Sync</h4>
            <div className="flex items-center gap-6 bg-gray-50 dark:bg-black/20 p-4 rounded-3xl">
              {state.settings.syncId ? (
                <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                  <QRCodeCanvas value={state.settings.syncId} size={72} />
                </div>
              ) : (
                <div className="w-20 h-20 bg-gray-200 dark:bg-white/10 rounded-xl flex items-center justify-center text-gray-400 text-[10px] font-bold text-center p-2">No ID generated</div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Sync ID</p>
                <div className="relative group">
                  <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 p-2.5 rounded-xl">
                    <code className="text-[10px] sm:text-xs text-indigo-500 font-mono font-bold break-all block leading-relaxed">
                      {state.settings.syncId || 'Tap button to generate'}
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <button onClick={() => setShowScanner(true)} className="py-3 bg-indigo-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/20 active:scale-95 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Scan Partner
              </button>
              <button onClick={generateSyncId} className="py-3 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-gray-200 dark:hover:bg-white/10">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                New ID
              </button>
            </div>
          </div>

          <div className="h-px w-full bg-gray-100 dark:bg-white/5" />

          {/* Import / Export / Reports */}
          <div>
             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Reports & Bank Import</h4>
             
             {/* Bank Import Tool */}
             <div className="mb-4 bg-gray-50 dark:bg-black/20 rounded-[20px] p-1 border border-gray-100 dark:border-white/5">
                <BankImport 
                  state={state} 
                  addExpense={(exp: any) => { addExpense(exp); showToast("Imported successfully!", "success"); }}
                  showToast={showToast}
                />
             </div>

             <div className="grid grid-cols-2 gap-3 mb-3">
              <button onClick={handleDownloadMonthlyPDF} disabled={generatingReport} className="py-3 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-xs flex flex-col items-center gap-1 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5">
                <span className="text-xl">📄</span> AI PDF Report
              </button>
              <button onClick={() => { haptic(5); exportToCSV(state.expenses); showToast("CSV Exported", "info"); }} className="py-3 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-xs flex flex-col items-center gap-1 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5">
                <span className="text-xl">📊</span> Export CSV
              </button>
             </div>

             <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { exportData(state); showToast("Backup Exported", "info"); }} className="py-3 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-xs flex flex-col items-center gap-1 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5">
                <span className="text-xl">💾</span> Export Backup
              </button>
              <label className="py-3 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-xs flex flex-col items-center gap-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5">
                <span className="text-xl">📥</span> Import Backup
                <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
              </label>
            </div>
          </div>

          <div className="h-px w-full bg-gray-100 dark:bg-white/5" />
          
          {/* Danger Zone */}
          <div>
            <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Danger Zone
            </h4>
            <div className="bg-rose-50/50 dark:bg-rose-500/5 rounded-2xl p-4 border border-rose-100 dark:border-rose-500/10">
              <button onClick={() => setShowDeleteModal(true)} className="w-full py-3 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold rounded-xl border border-rose-200 dark:border-rose-500/30 hover:bg-rose-200 dark:hover:bg-rose-500/30 transition-colors text-xs flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Clear Data / Reset Account
              </button>
            </div>
          </div>
        </div>
      </AccordionItem>

      {/* SECURITY ACCORDION */}
      <AccordionItem 
        title="Security & Account" 
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
        isOpen={openSection === 'Security'}
        onClick={() => setOpenSection(openSection === 'Security' ? null : 'Security')}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-gray-900 dark:text-white">App PIN</span>
              <span className="text-[10px] text-gray-400 font-medium">{state.settings.pinHash ? 'Active' : 'Not configured'}</span>
            </div>
            {state.settings.pinHash ? (
              <button onClick={() => { haptic(5); updateSettings({ pinHash: null }); showToast('PIN Removed', 'info'); }} className="text-xs bg-red-50 text-red-500 px-4 py-2 rounded-xl font-bold border border-red-100 hover:bg-red-100 transition-colors">Remove</button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  maxLength={4}
                  className="w-16 p-2 text-center text-sm font-bold rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-transparent outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="PIN"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                />
                <button onClick={async () => { if (pinInput.length === 4) { const pinHash = await hashPIN(pinInput); haptic(10); updateSettings({ pinHash }); setPinInput(''); showToast("PIN Set"); } }} className="text-xs bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all w-[50px]">Set</button>
              </div>
            )}
          </div>

          {biometricSupported && (
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-gray-900 dark:text-white">Biometrics</span>
                <span className="text-[10px] text-gray-400 font-medium">{state.settings.webAuthnCredentialId ? 'Registered' : 'FaceID / Fingerprint'}</span>
              </div>
              {state.settings.webAuthnCredentialId ? (
                <button onClick={() => { updateSettings({ webAuthnCredentialId: null }); showToast('Biometrics Disabled', 'info'); }} className="text-xs bg-red-50 text-red-500 px-4 py-2 rounded-xl font-bold border border-red-100 hover:bg-red-100 transition-colors">Disable</button>
              ) : (
                <button
                  onClick={handleRegisterBiometrics}
                  disabled={registering}
                  className="text-xs bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 active:scale-95 transition-all"
                >
                  {registering ? '...' : 'Enable'}
                </button>
              )}
            </div>
          )}

          <div className="h-px w-full bg-gray-100 dark:bg-white/5 my-2" />

          <button onClick={handleSignOut} className="w-full py-4 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white font-bold rounded-2xl border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all flex justify-center items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </AccordionItem>

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-sm rounded-[32px] p-8 shadow-2xl border border-gray-100 dark:border-white/10 animate-slide-up">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 text-rose-500">
              🗑️
            </div>
            <h3 className="text-xl font-black mb-2 text-center text-gray-900 dark:text-white">Danger Zone</h3>
            <p className="text-sm text-center text-gray-500 mb-8 font-medium">Please select how you want to handle your data.</p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  if (confirm("Reset local data only? Cloud backup remains.")) {
                    resetData();
                    setShowDeleteModal(false);
                    showToast("Device data cleared", "info");
                  }
                }}
                className="w-full py-4 bg-gray-50 dark:bg-white/5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 transition-colors"
              >
                <span>🧹</span> Clear Device Data Only
              </button>

              <button
                onClick={async () => {
                  if (confirm("⚠️ PERMANENTLY DELETE account & all cloud data? This cannot be undone.")) {
                    const success = await deleteCloudData();
                    if (success) {
                      await authService.signOut();
                      showToast("Account deleted successfully", "success");
                    } else {
                      showToast("Failed to delete cloud data", "error");
                    }
                    setShowDeleteModal(false);
                  }
                }}
                className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 active:scale-95 transition-all"
              >
                <span>⚠️</span> Permanently Delete All
              </button>
            </div>

            <button onClick={() => setShowDeleteModal(false)} className="mt-8 w-full py-3 text-gray-400 font-bold text-xs uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-xl border border-transparent hover:border-gray-100 dark:hover:border-white/5">
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
