import React, { useState, useEffect, useRef } from 'react';
import { AppState, AppSettings } from '../types';
import { shareBackup, exportToCSV, exportToPDF } from '../services/storage';
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

// Robust UUID Generator
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
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [pinInput, setPinInput] = useState('');
  const [syncCodeInput, setSyncCodeInput] = useState('');
  
  // QR State
  const [qrUrl, setQrUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (state.settings.syncId) {
      try {
        QRCode.toDataURL(state.settings.syncId)
          .then((url: string) => setQrUrl(url))
          .catch((err: any) => console.error("QR Gen Error:", err));
      } catch (e) {
        console.error("QR Module Error:", e);
      }
    } else {
      setQrUrl('');
    }
  }, [state.settings.syncId]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;
    let isActive = true;

    const startScan = async () => {
      if (isScanning && videoRef.current) {
        try {
          // Attempt to get camera
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
          });
          
          if (isActive && videoRef.current) {
            videoRef.current.srcObject = stream;
            // Required for iOS
            videoRef.current.setAttribute("playsinline", "true"); 
            await videoRef.current.play().catch(e => console.error("Video play error:", e));
            requestAnimationFrame(tick);
          }
        } catch (err) {
          console.error("Error accessing camera", err);
          showToast("Camera access denied or unavailable", 'error');
          if (isActive) setIsScanning(false);
        }
      }
    };

    const tick = () => {
      if (!isActive) return;
      
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          
          if (code) {
             if (code.data.length > 5) {
               updateSettings({ syncId: code.data });
               showToast("QR Code Scanned!", 'success');
               setIsScanning(false);
               return; 
             }
          }
        }
      }
      if (isScanning) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (isScanning) {
      startScan();
    }

    return () => {
      isActive = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isScanning]);

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

  const addCategory = () => {
    if (newCatName && !state.settings.customCategories.includes(newCatName)) {
      updateSettings({ 
        customCategories: [...state.settings.customCategories, newCatName],
        categoryIcons: { ...state.settings.categoryIcons, [newCatName]: newCatIcon || '📦' }
      });
      setNewCatName('');
      setNewCatIcon('📦');
      showToast(`Category added`);
    }
  };

  const removeCategory = (cat: string) => {
    if (window.confirm(`Delete category "${cat}"?`)) {
      const newIcons = { ...state.settings.categoryIcons };
      delete newIcons[cat];
      updateSettings({ 
        customCategories: state.settings.customCategories.filter(c => c !== cat),
        categoryIcons: newIcons
      });
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

  const generateSyncCode = () => {
    const code = generateUUID();
    updateSettings({ syncId: code });
    showToast("Code generated!", 'success');
  };

  const joinSyncSession = () => {
    if (syncCodeInput.length > 5) {
      updateSettings({ syncId: syncCodeInput });
      setSyncCodeInput('');
      showToast("Sync ID Set", 'success');
    } else {
      showToast("Invalid Sync Code.", 'error');
    }
  };

  // UI Helper for Sections
  const SectionHeader = ({ icon, title }: { icon: string, title: string }) => (
    <div className="flex items-center gap-2 mb-4">
       <span className="text-xl">{icon}</span>
       <h3 className="text-lg font-bold text-text">{title}</h3>
    </div>
  );

  return (
    <div className="pb-24 max-w-xl mx-auto space-y-8 animate-fade-in">
      
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
                 <button type="button" onClick={() => { if(confirm("Unlink device?")) updateSettings({syncId: null}); }} className="text-xs text-red-500 font-bold px-4 py-2 bg-red-50 dark:bg-red-900/10 rounded-full hover:bg-red-100 transition-colors">
                   Disconnect
                 </button>
              </div>
            ) : (
              <div className="space-y-4">
                 <p className="text-sm text-text-light text-center">Scan to link with your partner.</p>
                 {isScanning ? (
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg">
                       <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay></video>
                       <canvas ref={canvasRef} className="hidden"></canvas>
                       <button type="button" onClick={() => setIsScanning(false)} className="absolute top-3 right-3 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md z-10">✕</button>
                    </div>
                 ) : (
                    <div className="grid grid-cols-2 gap-3">
                       <button type="button" onClick={() => setIsScanning(true)} className="py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all">Scan QR</button>
                       <button type="button" onClick={generateSyncCode} className="py-3 bg-white dark:bg-gray-800 text-text font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 active:scale-95 transition-all">Show Code</button>
                    </div>
                 )}
                 {!isScanning && (
                   <div className="flex flex-row gap-2 items-center">
                     <input 
                       value={syncCodeInput} 
                       onChange={e => setSyncCodeInput(e.target.value)} 
                       placeholder="Paste code..." 
                       className="flex-1 min-w-0 bg-white dark:bg-gray-800 p-3 rounded-xl text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" 
                     />
                     <button type="button" onClick={joinSyncSession} disabled={syncCodeInput.length < 5} className="shrink-0 bg-gray-200 dark:bg-gray-700 px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">→</button>
                   </div>
                 )}
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

            <div>
              <label className="text-xs font-bold text-text-light uppercase mb-3 block">Profiles</label>
              <div className="grid grid-cols-2 gap-4">
                 <input className="bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" value={state.settings.person1Name} onChange={e => updateSettings({ person1Name: e.target.value })} placeholder="Name 1" />
                 <input className="bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" value={state.settings.person2Name} onChange={e => updateSettings({ person2Name: e.target.value })} placeholder="Name 2" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-text-light uppercase mb-3 block">Categories</label>
              <div className="flex flex-wrap gap-2 mb-3">
                 {state.settings.customCategories.map(cat => (
                    <span key={cat} onClick={() => removeCategory(cat)} className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs font-medium border border-gray-100 dark:border-gray-800 hover:border-red-200 cursor-pointer select-none transition-colors flex items-center gap-1">
                      <span>{state.settings.categoryIcons?.[cat] || '📦'}</span>
                      {cat}
                    </span>
                 ))}
              </div>
              <div className="flex gap-2">
                 <input 
                    className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-center border-none focus:ring-2 focus:ring-primary/20 w-12" 
                    placeholder="🥦" 
                    value={newCatIcon} 
                    onChange={e => setNewCatIcon(e.target.value)}
                    maxLength={2} 
                 />
                 <input 
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-none focus:ring-2 focus:ring-primary/20 text-sm" 
                    placeholder="New Category Name" 
                    value={newCatName} 
                    onChange={e => setNewCatName(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addCategory()} 
                 />
                 <button onClick={addCategory} className="bg-primary text-white rounded-xl w-10 h-10 flex items-center justify-center font-bold shadow-sm">+</button>
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
                  <button onClick={() => {updateSettings({ pin: null }); showToast("Unlocked");}} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold">Remove</button>
               ) : (
                  <div className="flex items-center gap-2">
                     <input type="password" maxLength={4} className="w-14 p-1.5 text-center text-sm rounded-lg border-none bg-white dark:bg-gray-800 shadow-sm" placeholder="PIN" value={pinInput} onChange={e => setPinInput(e.target.value)} />
                     <button onClick={setPin} disabled={pinInput.length !== 4} className="text-primary text-xs font-bold px-2">Set</button>
                  </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => exportToPDF(state)} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-bold text-text-light hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">📄 PDF Report</button>
               <button onClick={() => exportToCSV(state.expenses)} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-bold text-text-light hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">📊 CSV Data</button>
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
         </div>
      </section>

      {/* PWA INSTALL */}
      {canInstall && !isStandalone && (
         <button onClick={installApp} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
            <span>📲</span> Install App
         </button>
      )}

      <div className="text-center text-[10px] text-gray-300 pt-4">
         v1.2.1 • Safe & Secure • Local-First
      </div>
    </div>
  );
};
