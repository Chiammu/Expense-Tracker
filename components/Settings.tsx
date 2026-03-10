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
}

const haptic = (pattern: number | number[] = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const Settings: React.FC<SettingsProps> = ({ state, updateSettings, updateState, resetData, deleteAccount, showToast, userEmail }) => {
  const [pinInput, setPinInput] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  const SectionHeader = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-lg text-gray-700 dark:text-gray-300 shadow-sm">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{title}</h3>
    </div>
  );

  return (
    <div className="pb-32 max-w-xl mx-auto space-y-8 animate-fade-in relative z-0">

      {showScanner && <ScannerModal onScan={handleSyncScan} onClose={() => setShowScanner(false)} />}

      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Settings</h1>
          <p className="text-xs text-gray-500 font-medium">Preferences & Security</p>
        </div>
      </div>

      {/* PWA INSTALL PROMOTION */}
      {deferredPrompt && (
        <section className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[24px] p-6 shadow-xl animate-slide-up text-white relative overflow-hidden">
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

      {/* IDENTITY SECTION */}
      <section className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
        <SectionHeader
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
          title="Identity & Profile"
        />

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
            <input type="text" className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all" value={state.settings.person1Name} onChange={e => updateSettings({ person1Name: e.target.value })} placeholder="Name" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Person 2</label>
            <input type="text" className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-pink-500 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all" value={state.settings.person2Name} onChange={e => updateSettings({ person2Name: e.target.value })} placeholder="Name" />
          </div>
        </div>
      </section>

      {/* SYNC CENTER */}
      <section className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
        <SectionHeader
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          title="Couple Sync"
        />

        <div className="space-y-6">
          <div className="flex items-center gap-6 bg-gray-50 dark:bg-black/20 p-4 rounded-3xl">
            {state.settings.syncId ? (
              <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                <QRCodeCanvas value={state.settings.syncId} size={96} />
              </div>
            ) : (
              <div className="w-24 h-24 bg-gray-200 dark:bg-white/10 rounded-xl flex items-center justify-center text-gray-400 text-xs font-bold">No ID</div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Sync ID</p>
              <div className="relative group">
                <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 p-3 rounded-xl">
                  <code className="text-xs text-indigo-500 font-mono font-bold break-all block leading-relaxed">
                    {state.settings.syncId || 'Tap generate below'}
                  </code>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowScanner(true)} className="py-4 bg-indigo-500 text-white font-bold rounded-2xl text-sm flex flex-col items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Scan Partner
            </button>
            <button onClick={generateSyncId} className="py-4 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-sm flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-gray-200 dark:hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              New ID
            </button>
          </div>
        </div>
      </section>

      {/* NOTIFICATIONS */}
      <section className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
        <SectionHeader
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          }
          title="Notifications"
        />

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
            className={`
              relative w-14 h-8 rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-primary/20
              \${state.settings.notificationsEnabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}
            `}
          >
            <span
              className={`
                inline-block w-6 h-6 transform bg-white rounded-full transition duration-300 ease-in-out shadow-md
                \${state.settings.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'}
                top-1 absolute
              `}
            />
          </button>
        </div>
      </section>

      {/* DATA MANAGEMENT */}
      <section className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
        <SectionHeader
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          }
          title="Data Management"
        />

        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-100 dark:border-amber-500/20 mb-6 flex gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 leading-relaxed">
            Data is strictly local unless synced. Export regular backups to avoid data loss. Importing will overwrite current data.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => exportData(state)} className="py-4 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-xs flex flex-col items-center gap-2 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Backup
          </button>
          <label className="py-4 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-xs flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import Backup
            <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
          </label>
        </div>
      </section >

      {/* SECURITY & BIOMETRICS */}
      <section className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
        <SectionHeader
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
          title="Security"
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-gray-900 dark:text-white">App PIN</span>
              <span className="text-[10px] text-gray-400 font-medium">{state.settings.pinHash ? 'Active' : 'Not configured'}</span>
            </div>
            {state.settings.pinHash ? (
              <button onClick={() => { haptic(5); updateSettings({ pinHash: null }); }} className="text-xs bg-red-50 text-red-500 px-4 py-2 rounded-xl font-bold border border-red-100 hover:bg-red-100 transition-colors">Remove</button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  maxLength={4}
                  className="w-16 p-2 text-center text-sm font-bold rounded-xl bg-white dark:bg-white/10 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="PIN"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                />
                <button onClick={async () => { if (pinInput.length === 4) { const pinHash = await hashPIN(pinInput); haptic(10); updateSettings({ pinHash }); setPinInput(''); showToast("PIN Set"); } }} className="text-xs bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold shadow-md shadow-indigo-500/20">Set</button>
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
                <button onClick={() => updateSettings({ webAuthnCredentialId: null })} className="text-xs bg-red-50 text-red-500 px-4 py-2 rounded-xl font-bold border border-red-100 hover:bg-red-100 transition-colors">Disable</button>
              ) : (
                <button
                  onClick={handleRegisterBiometrics}
                  disabled={registering}
                  className="text-xs bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50"
                >
                  {registering ? '...' : 'Enable'}
                </button>
              )}
            </div>
          )}
        </div>
      </section >

      {/* REPORTS SECTION */}
      <section className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
        <SectionHeader
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          title="Reports"
        />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleDownloadMonthlyPDF} disabled={generatingReport} className="py-4 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-xs flex flex-col items-center gap-2 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
            <span className="text-xl">📄</span> Export PDF
          </button>
          <button onClick={() => { haptic(5); exportToCSV(state.expenses); }} className="py-4 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold rounded-2xl text-xs flex flex-col items-center gap-2 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
            <span className="text-xl">📊</span> Export CSV
          </button>
        </div>
      </section >

      {/* ACCOUNT ACTIONS */}
      <section className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
        <SectionHeader
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          }
          title="Account"
        />
        <div className="space-y-3">
          <button onClick={handleSignOut} className="w-full py-4 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white font-bold rounded-2xl border-2 border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-colors">
            Sign Out
          </button>

          <button onClick={() => setShowDeleteModal(true)} className="w-full py-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold rounded-2xl border-2 border-transparent hover:border-rose-100 dark:hover:border-rose-500/20 transition-colors">
            Delete Account
          </button>
        </div>
      </section >

      {/* DELETE ACCOUNT MODAL */}
      {
        showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-sm rounded-[32px] p-8 shadow-2xl border border-gray-100 dark:border-white/10 animate-slide-up">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 text-rose-500">
                🗑️
              </div>
              <h3 className="text-xl font-black mb-2 text-center text-gray-900 dark:text-white">Delete Account?</h3>
              <p className="text-sm text-center text-gray-500 mb-8 font-medium">This action can wipe your data. Please choose carefully.</p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (confirm("Reset local data only? Cloud backup remains.")) {
                      resetData();
                      setShowDeleteModal(false);
                      showToast("Device data cleared", "info");
                    }
                  }}
                  className="w-full py-4 bg-gray-50 dark:bg-white/5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
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

              <button onClick={() => setShowDeleteModal(false)} className="mt-6 w-full py-3 text-gray-400 font-bold text-xs uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )
      }


    </div >
  );
};
