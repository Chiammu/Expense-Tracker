import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small timeout to trigger enter animation
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
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-primary'
  };

  const icons = {
    success: '✅',
    error: '⚠️',
    info: 'ℹ️'
  };

  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-6 py-3 rounded-full shadow-lg shadow-black/10 text-white font-medium text-sm transition-all duration-300 ease-out transform ${visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'} ${bgColors[type]} backdrop-blur-md`}>
      <span className="text-lg">{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
};