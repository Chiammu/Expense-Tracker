import React, { useState, useEffect } from 'react';
import { webAuthnService } from '../services/webAuthn';
import { verifyPIN } from '../utils/security';

interface LockScreenProps {
  pinHash: string | null;
  webAuthnId: string | null;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ pinHash, webAuthnId, onUnlock }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);

  useEffect(() => {
    setAnimate(true);
    if (webAuthnId) {
      webAuthnService.isSupported().then(setIsBiometricAvailable);
      // Automatically trigger biometric if available
      setTimeout(() => {
        handleBiometricUnlock();
      }, 800);
    }
  }, [webAuthnId]);

  const handleBiometricUnlock = async () => {
    if (!webAuthnId) return;
    try {
      const success = await webAuthnService.authenticateBiometrics(webAuthnId);
      if (success) {
        if (navigator.vibrate) navigator.vibrate(10);
        onUnlock();
      }
    } catch (err) {
      console.warn("Biometric failed or cancelled");
    }
  };

  const handleNumber = async (num: string) => {
    if (!pinHash) return;
    if (input.length < 4) {
      const newVal = input + num;
      setInput(newVal);
      setError(false);

      if (navigator.vibrate) navigator.vibrate(20);

      // Check optimization: if length is 4, check immediately
      if (newVal.length === 4) {
        if (await verifyPIN(newVal, pinHash)) {
          setTimeout(onUnlock, 100);
        } else {
          if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
          setTimeout(() => {
            setError(true);
            setTimeout(() => {
              setInput('');
              setError(false);
            }, 400);
          }, 300);
        }
      }
    }
  };

  const handleDelete = () => {
    if (navigator.vibrate) navigator.vibrate(10);
    setInput(prev => prev.slice(0, -1));
  };

  return (
    <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between p-8 transition-opacity duration-700 ${animate ? 'opacity-100' : 'opacity-0'}`}>

      {/* Top Section: Icon & Header */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 w-full max-w-xs animate-slide-up">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl shadow-indigo-500/10 backdrop-blur-xl group">
          <div className="text-4xl group-hover:scale-110 transition-transform duration-500">
            {error ? '🔒' : '🔓'}
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-white tracking-tight">Obsidian Finance</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em]">{error ? 'Try Again' : 'Enter Passcode'}</p>
        </div>

        {/* PIN Dots */}
        {pinHash && (
          <div className={`flex gap-6 mt-4 transition-transform duration-200 ${error ? 'translate-x-[-10px] animate-shake' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${i < input.length
                ? error
                  ? 'bg-rose-500 border-rose-500 scale-110'
                  : 'bg-white border-white scale-100 shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                : 'border-white/20 bg-transparent'
                }`} />
            ))}
          </div>
        )}
      </div>

      {/* Numpad Section */}
      <div className="w-full max-w-[320px] pb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {pinHash ? (
          <div className="grid grid-cols-3 gap-x-6 gap-y-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button
                key={n}
                onClick={() => handleNumber(n.toString())}
                className="w-20 h-20 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 backdrop-blur-md text-3xl font-medium text-white transition-all duration-200 border border-white/5 shadow-2xl flex items-center justify-center mx-auto"
              >
                {n}
              </button>
            ))}

            {/* Biometric Button */}
            <div className="flex items-center justify-center">
              {isBiometricAvailable ? (
                <button
                  onClick={handleBiometricUnlock}
                  className="w-20 h-20 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-3xl flex items-center justify-center active:scale-90 transition-all border border-indigo-500/20"
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                </button>
              ) : <div />}
            </div>

            {/* Zero Button */}
            <button
              onClick={() => handleNumber('0')}
              className="w-20 h-20 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 backdrop-blur-md text-3xl font-medium text-white transition-all duration-200 border border-white/5 shadow-2xl flex items-center justify-center mx-auto"
            >
              0
            </button>

            {/* Backspace Button */}
            <button
              onClick={handleDelete}
              className="w-20 h-20 flex items-center justify-center text-white/40 hover:text-white active:scale-90 transition-all mx-auto"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="sr-only">Delete</span>
            </button>
          </div>
        ) : (
          isBiometricAvailable && webAuthnId && (
            <button
              onClick={handleBiometricUnlock}
              className="w-full bg-white text-black font-black py-4 rounded-2xl active:scale-95 transition-all text-sm uppercase tracking-wider"
            >
              Scan Face ID
            </button>
          )
        )}
      </div>


    </div>
  );
};
