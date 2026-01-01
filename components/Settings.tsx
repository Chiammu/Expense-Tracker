
import React, { useState, useEffect } from 'react';
import { AppState, AppSettings, INITIAL_STATE } from '../types';
import { shareBackup, exportToCSV, exportToPDF, exportMonthlyReportPDF, logAuditEvent, exportData, deleteCloudData } from '../services/storage';
import { authService } from '../services/auth';
import { generateMonthlyDigest } from '../services/geminiService';
import { webAuthnService } from '../services/webAuthn';
import { ScannerModal } from './ScannerModal';
// @ts-ignore
import QRCode from 'qrcode';

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
  const [qrUrl, setQrUrl] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [manualSyncId, setManualSyncId] = useState('');
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

        // Robust merge: Ensure all current schema fields exist even if backup is old
        const newState: AppState = {
          ...INITIAL_STATE,
          ...parsed,
          settings: {
            ...INITIAL_STATE.settings,
            ...(parsed.settings || {})
          },
          investments: {
            ...INITIAL_STATE.investments,
            ...(parsed.investments || {})
          }
        };

        if (confirm(`Found ${newState.expenses.length} expenses. Restore now?`)) {
          updateState(newState);
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
    const idToShare = state.settings.syncId || 'NOT_PAIRED';
    QRCode.toDataURL(idToShare)
      .then((url: string) => setQrUrl(url))
      .catch((err: any) => console.error("QR Gen Error:", err));

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

      {/* PWA INSTALL PROMOTION */}
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

      {/* IDENTITY SECTION */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <SectionHeader icon="👤" title="Identity & Profile" />
        {userEmail && (
          <div className="mb-4 p-3 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3">
            <span className="text-xl">📧</span>
            <div>
              <p className="text-[10px] uppercase font-black text-primary/60 tracking-wider">Logged in as</p>
              <p className="text-sm font-bold text-primary">{userEmail}</p>
            </div>
          </div>
        )}
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
        </div>
      </section>

      {/* DATA MANAGEMENT */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <SectionHeader icon="💾" title="Data Management" />
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/20 mb-4">
          <p className="text-[10px] text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> Data is synchronized to the secure cloud. Use Export to create a manual backup. Importing will overwrite current data.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => exportData(state)} className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-xs flex flex-col items-center gap-1">
            <span>📤</span> Export JSON
          </button>
          <label className="py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-xl text-xs flex flex-col items-center gap-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <span>📥</span> Import JSON
            <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
          </label>
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
                <button onClick={() => { if (pinInput.length === 4) { haptic(10); updateSettings({ pin: pinInput }); setPinInput(''); showToast("PIN Set"); } }} className="text-primary text-xs font-bold">Set</button>
              </div>
            )}
          </div>

          {biometricSupported && (
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-sm font-bold">Biometric Unlock</span>
                <span className="text-[10px] text-text-light">{state.settings.webAuthnCredentialId ? 'Registered' : 'FaceID/Fingerprint'}</span>
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
        </div>
      </section>

      {/* ACCOUNT ACTIONS */}
      <section className="bg-surface rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <SectionHeader icon="🚪" title="Account Actions" />
        <div className="space-y-3">
          <button onClick={handleSignOut} className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-2xl">Sign Out</button>
          <button onClick={handleSignOut} className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-text font-bold rounded-2xl">Sign Out</button>
          <button onClick={() => setShowDeleteModal(true)} className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-600 font-bold rounded-2xl border border-red-100 dark:border-red-900/20 active:bg-red-200 transition-colors">
            Delete My Account
          </button>
        </div>
      </section>

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-xl font-bold mb-2 text-center text-red-600">Delete Account?</h3>
            <p className="text-sm text-center text-gray-500 mb-6">Choose an action to perform.</p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  if (confirm("Reset local data only? Cloud backup remains.")) {
                    resetData();
                    setShowDeleteModal(false);
                    showToast("Device data cleared", "info");
                  }
                }}
                className="w-full py-4 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <span>🧹</span> Clear Data from Device
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
                className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
              >
                <span>🗑️</span> Delete EVERYTHING
              </button>
            </div>

            <button onClick={() => setShowDeleteModal(false)} className="mt-6 w-full py-3 text-gray-400 font-bold text-xs uppercase tracking-wider">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="text-center text-[10px] text-gray-300 pt-4 pb-8">
        v1.6.2 • E2EE Chat • Biometric Pro • PWA Standalone
      </div>
    </div>
  );
};
