
import React, { useState, useEffect } from 'react';

interface LockScreenProps {
  pin: string | null;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ pin, onUnlock }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
  }, []);

  const handleNumber = (num: string) => {
    if (!pin) return;
    if (input.length < 4) {
      const newVal = input + num;
      setInput(newVal);
      setError(false);
      
      if (navigator.vibrate) navigator.vibrate(20);

      if (newVal === pin) {
        setTimeout(onUnlock, 200);
      } else if (newVal.length === 4) {
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
  };

  const handleDelete = () => setInput(prev => prev.slice(0, -1));

  return (
    <div className={`fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 transition-opacity duration-500 ${animate ? 'opacity-100' : 'opacity-0'}`}>
      
      <div className="mb-10 text-center animate-slide-up">
        <div className="text-6xl mb-4 drop-shadow-lg">🔐</div>
        <h2 className="text-2xl font-bold text-primary mb-1">Enter PIN</h2>
        <p className="text-text-light text-sm">Security enabled for this workspace</p>
      </div>
      
      <div className={`flex gap-6 mb-12 transition-transform duration-200 ${error ? 'translate-x-[-10px] animate-shake' : ''}`}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
            i < input.length 
              ? error 
                ? 'bg-red-500 border-red-500 scale-110' 
                : 'bg-primary border-primary scale-110 shadow-[0_0_10px_var(--primary)]' 
              : 'border-gray-300 dark:border-gray-600 bg-transparent'
          }`} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-x-8 gap-y-6 w-full max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button 
            key={n} 
            onClick={() => handleNumber(n.toString())}
            className="w-20 h-20 rounded-full bg-surface border border-gray-100 dark:border-gray-800 text-2xl font-bold text-text hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-90 active:bg-primary/10 transition-all shadow-sm"
          >
            {n}
          </button>
        ))}
        <div className="flex items-center justify-center"></div>
        <button 
          onClick={() => handleNumber('0')}
          className="w-20 h-20 rounded-full bg-surface border border-gray-100 dark:border-gray-800 text-2xl font-bold text-text hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-90 active:bg-primary/10 transition-all shadow-sm"
        >
          0
        </button>
        <button 
          onClick={handleDelete}
          className="w-20 h-20 flex items-center justify-center text-text-light hover:text-red-500 active:scale-90 transition-transform"
        >
          <span className="text-2xl">⌫</span>
        </button>
      </div>
    </div>
  );
};
