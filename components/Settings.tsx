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

export const Settings: React.FC<SettingsProps> = ({ state, updateSettings, resetData, importData, showToast, installApp, canInstall, isIos, isStandalone }) => {
  const [newCat, setNewCat] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [syncCodeInput, setSyncCodeInput] = useState('');
  
  // QR State
  const [qrUrl, setQrUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR when ID changes
  useEffect(() => {
    if (state.settings.syncId) {
      QRCode.toDataURL(state.settings.syncId)
        .then((url: string) => setQrUrl(url))
        .catch((err: any) => console.error(err));
    } else {
      setQrUrl('');
    }
  }, [state.settings.syncId]);

  // Handle Scanning Logic
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startScan = async () => {
      if (isScanning && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute("playsinline", "true"); 
            videoRef.current.play();
            requestAnimationFrame(tick);
          }
        } catch (err) {
          console.error("Error accessing camera", err);
          showToast("Camera access denied", 'error');
          setIsScanning(false);
        }
      }
    };

    const tick = () => {
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
             if (code.data.length > 5) { // Basic validation
               updateSettings({ syncId: code.data });
               showToast("QR Code Scanned! Connecting...", 'success');
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
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameId);
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

  const generateSyncCode = () => {
    const newCode = crypto.randomUUID();
    updateSettings({ syncId: newCode });
    showToast("Code generated!", 'success');
  };

  const joinSyncSession = () => {
    if (syncCodeInput.length > 5) {
      updateSettings({ syncId: syncCodeInput });
      setSyncCodeInput('');
    } else {
      showToast("Invalid Sync Code.", 'error');
    }
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto space-y-6">
      
      {/* 1. Sync & Devices Card */}
      <section className="bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
         <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 text-white flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2 text-lg">
              <span>☁️</span> Cloud Sync
            </h3>
            {state.settings.syncId && <span className="bg-white/20 text-xs px-2 py-1 rounded-full font-medium">Active</span>}
         </div>

         <div className="p-6">
            {state.settings.syncId ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center">
                  <div className="bg-white p-3 rounded-xl shadow-inner border border-gray-100 mb-3">
                     {qrUrl ? <img src={qrUrl} alt="Sync QR" className="w-40 h-40 mix-blend-multiply dark:mix-blend-normal" /> : <div className="w-40 h-40 bg-gray-100 animate-pulse rounded-lg"></div>}
                  </div>
                  <p className="text-sm text-text-light text-center mb-2">Scan on your partner's phone to link.</p>
                  
                  <div className="w-full bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center group cursor-pointer" onClick={() => { navigator.clipboard.writeText(state.settings.syncId || ''); showToast("Copied ID"); }}>
                     <code className="text-xs font-mono text-text truncate max-w-[200px]">{state.settings.syncId}</code>
                     <span className="text-primary text-xs font-bold group-hover:underline">Copy</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => { 
                    if(confirm("Disconnect sync? Updates will stop.")) {
                      updateSettings({ syncId: null });
                      showToast("Disconnected.");
                    }
                  }}
                  className="w-full py-2.5 text-sm text-red-500 font-bold border border-red-100 dark:border-red-900/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Unlink Device
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                 <p className="text-sm text-text-light leading-relaxed">
                   Link two devices to share expenses and chat in real-time. Data is synced securely.
                 </p>
                 
                 {isScanning ? (
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                       <video ref={videoRef} className="w-full h-full object-cover"></video>
                       <canvas ref={canvasRef} className="hidden"></canvas>
                       <button onClick={() => setIsScanning(false)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5">✕</button>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       <button onClick={generateSyncCode} className="py-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 font-bold rounded-xl border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-all active:scale-95 text-sm">
                         Generate Code
                       </button>
                       <button onClick={() => setIsScanning(true)} className="py-3 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-bold rounded-xl border border-blue-100 dark:border-blue-800 hover:bg-blue-100 transition-all active:scale-95 text-sm">
                         Scan QR
                       </button>
                    </div>
                 )}

                 {!isScanning && (
                   <div className="flex gap-2 items-center pt-2">
                     <input 
                       value={syncCodeInput}
                       onChange={e => setSyncCodeInput(e.target.value)}
                       placeholder="Or paste code here..."
                       className="flex-1 p-2 text-sm border-b border-gray-300 dark:border-gray-700 bg-transparent focus:border-primary outline-none"
                     />
                     <button onClick={joinSyncSession} className="text-sm font-bold text-primary disabled:opacity-50" disabled={syncCodeInput.length < 5}>Link</button>
                   </div>
                 )}
              </div>
            )}
         </div>
      </section>

      {/* 2. Customization Card */}
      <section className="bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
         <h3 className="font-bold text-lg text-text mb-4 flex items-center gap-2">
            <span>🎨</span> Personalize
         </h3>
         
         <div className="space-y-6">
            {/* Theme & Colors */}
            <div className="space-y-3">
               <label className="text-xs font-bold text-text-light uppercase tracking-wider">Appearance</label>
               <div className="flex gap-3">
                  <button 
                    onClick={() => updateSettings({ theme: 'light' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold border transition-all ${state.settings.theme === 'light' ? 'bg-gray-100 border-gray-300 text-black' : 'border-gray-200 text-gray-500'}`}
                  >
                    Light
                  </button>
                  <button 
                    onClick={() => updateSettings({ theme: 'dark' })}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold border transition-all ${state.settings.theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'border-gray-200 text-gray-500'}`}
                  >
                    Dark
                  </button>
               </div>
               
               <div className="flex flex-wrap gap-2 pt-2">
                  {COLORS.map(c => (
                     <button 
                       key={c} 
                       style={{ backgroundColor: c }}
                       onClick={() => updateSettings({ primaryColor: c })}
                       className={`w-8 h-8 rounded-full transition-transform ${state.settings.primaryColor === c ? 'scale-110 ring-2 ring-offset-2 ring-gray-300 dark:ring-gray-600' : 'hover:scale-110'}`}
                     />
                  ))}
               </div>
            </div>

            {/* Names */}
            <div className="space-y-3">
               <label className="text-xs font-bold text-text-light uppercase tracking-wider">Display Names</label>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <span className="text-[10px] text-text-light">Me</span>
                     <input 
                       className="w-full p-2 border-b border-gray-200 dark:border-gray-700 bg-transparent text-sm font-medium focus:border-primary outline-none transition-colors"
                       value={state.settings.person1Name}
                       onChange={e => updateSettings({ person1Name: e.target.value })}
                       placeholder="Person 1"
                     />
                  </div>
                  <div className="space-y-1">
                     <span className="text-[10px] text-text-light">Partner</span>
                     <input 
                       className="w-full p-2 border-b border-gray-200 dark:border-gray-700 bg-transparent text-sm font-medium focus:border-primary outline-none transition-colors"
                       value={state.settings.person2Name}
                       onChange={e => updateSettings({ person2Name: e.target.value })}
                       placeholder="Person 2"
                     />
                  </div>
               </div>
            </div>
            
            {/* Categories */}
            <div className="space-y-3">
               <label className="text-xs font-bold text-text-light uppercase tracking-wider">Categories</label>
               <div className="flex flex-wrap gap-2">
                  {state.settings.customCategories.map(cat => (
                     <span key={cat} className="inline-flex items-center px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-md text-xs">
                        {cat}
                        <button onClick={() => removeCategory(cat)} className="ml-1.5 text-gray-400 hover:text-red-500">×</button>
                     </span>
                  ))}
                  <div className="inline-flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2">
                     <input 
                        className="w-20 bg-transparent text-xs py-1 outline-none"
                        placeholder="New..."
                        value={newCat}
                        onChange={e => setNewCat(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCategory()}
                     />
                     <button onClick={addCategory} className="text-primary font-bold text-sm">+</button>
                  </div>
               </div>
            </div>

            {/* Cover Photo */}
            <div className="space-y-2">
               <label className="text-xs font-bold text-text-light uppercase tracking-wider">Cover Photo</label>
               <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <span className="text-sm text-text-light flex items-center gap-2">
                     <span>🖼️</span> {state.settings.coverPhotoData ? 'Change Cover Photo' : 'Upload Cover Photo'}
                  </span>
               </label>
            </div>
         </div>
      </section>

      {/* 3. Security & Data Card */}
      <section className="bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
         <h3 className="font-bold text-lg text-text mb-4 flex items-center gap-2">
            <span>🛡️</span> Security & Data
         </h3>
         
         <div className="space-y-6">
            {/* PIN */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl">
               <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${state.settings.pin ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                     {state.settings.pin ? '🔒' : '🔓'}
                  </div>
                  <div>
                     <div className="font-bold text-sm text-text">App Lock</div>
                     <div className="text-xs text-text-light">{state.settings.pin ? 'Active' : 'Disabled'}</div>
                  </div>
               </div>
               
               {state.settings.pin ? (
                  <button onClick={() => { updateSettings({ pin: null }); showToast("PIN removed"); }} className="text-red-500 text-xs font-bold px-3 py-1 bg-red-50 rounded-lg">Disable</button>
               ) : (
                  <div className="flex gap-2">
                     <input 
                       className="w-16 p-1 text-center bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded text-sm"
                       placeholder="1234"
                       maxLength={4}
                       type="password"
                       value={pinInput}
                       onChange={e => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                     />
                     <button onClick={setPin} disabled={pinInput.length !== 4} className="text-primary text-xs font-bold">Set</button>
                  </div>
               )}
            </div>

            {/* Export Actions */}
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => exportToPDF(state)} className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-1">
                  <span className="text-xl">📄</span>
                  <span className="text-xs font-bold text-text">PDF Report</span>
               </button>
               <button onClick={() => exportToCSV(state.expenses)} className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-1">
                  <span className="text-xl">📊</span>
                  <span className="text-xs font-bold text-text">CSV Export</span>
               </button>
               <button onClick={() => shareBackup(state)} className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-1">
                  <span className="text-xl">📤</span>
                  <span className="text-xs font-bold text-text">Backup File</span>
               </button>
               <label className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-1 cursor-pointer">
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                  <span className="text-xl">📥</span>
                  <span className="text-xs font-bold text-text">Restore</span>
               </label>
            </div>
            
            {/* Install App */}
            {canInstall && !isStandalone && (
               <button onClick={installApp} className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-black font-bold rounded-xl shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2">
                  <span>📲</span> Install App
               </button>
            )}

            {/* Reset */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-center">
               <button onClick={resetData} className="text-red-400 text-xs hover:text-red-600 underline decoration-red-200">
                  Reset Everything
               </button>
            </div>
         </div>
      </section>

    </div>
  );
};