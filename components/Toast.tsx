import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay to trigger entry animation
    const timerIn = setTimeout(() => setVisible(true), 10);
    // Auto dismiss
    const timerOut = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for exit animation
    }, 3000);

    return () => {
      clearTimeout(timerIn);
      clearTimeout(timerOut);
    };
  }, [onClose]);

  const bgColors = {
    success: 'bg-[#1a1a1a] shadow-emerald-500/20 text-white',
    error: 'bg-[#1a1a1a] shadow-red-500/20 text-white',
    info: 'bg-[#1a1a1a] shadow-blue-500/20 text-white',
  };

  const icons = {
    success: <span className="text-emerald-400">✓</span>,
    error: <span className="text-red-400">✕</span>,
    info: <span className="text-blue-400">ℹ</span>
  };

  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 transform ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
      <div className={`${bgColors[type]} flex items-center gap-3 px-6 py-3 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl border border-white/10 min-w-[300px] justify-center`}>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center bg-white/10 text-xs font-bold`}>
          {icons[type]}
        </div>
        <p className="text-[13px] font-bold tracking-wide">{message}</p>
      </div>
    </div>
  );
};