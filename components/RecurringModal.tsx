import React, { useState } from 'react';
import { FixedPayment } from '../types';

interface RecurringModalProps {
  payments: FixedPayment[];
  onConfirm: (selectedIds: number[]) => void;
  onCancel: () => void;
}

export const RecurringModal: React.FC<RecurringModalProps> = ({ payments, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState<number[]>(payments.map(p => p.id));

  const toggle = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 animate-scale-in">
        <div className="flex flex-col items-center text-center mb-6">
           <div className="text-4xl mb-3">📅</div>
           <h3 className="text-xl font-bold text-text mb-1">Upcoming Bills</h3>
           <p className="text-sm text-text-light">
             It looks like some fixed payments are due since your last visit. Want to add them now?
           </p>
        </div>

        <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
           {payments.map(p => (
             <div 
               key={p.id} 
               onClick={() => toggle(p.id)}
               className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-all ${
                 selected.includes(p.id) 
                   ? 'bg-secondary/10 border-secondary' 
                   : 'bg-background border-gray-200 dark:border-gray-700 opacity-60'
               }`}
             >
               <div className="flex items-center gap-3">
                 <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected.includes(p.id) ? 'bg-secondary border-secondary text-white' : 'border-gray-300'}`}>
                   {selected.includes(p.id) && '✓'}
                 </div>
                 <span className="font-bold text-sm">{p.name}</span>
               </div>
               <span className="font-bold text-sm">₹{p.amount}</span>
             </div>
           ))}
        </div>

        <div className="flex gap-3">
           <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-text-light hover:bg-gray-100 dark:hover:bg-gray-800">
             Skip
           </button>
           <button onClick={() => onConfirm(selected)} className="flex-1 py-3 bg-secondary text-white rounded-xl font-bold shadow-lg shadow-secondary/20 hover:scale-105 transition-transform">
             Add {selected.length}
           </button>
        </div>
      </div>
    </div>
  );
};