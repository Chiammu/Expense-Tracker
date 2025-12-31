
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Expense } from '../types';
import { parseReceiptImage, parseNaturalLanguageExpense } from '../services/geminiService';

interface AddExpenseProps {
  state: AppState;
  // Fix: Updated prop type to exclude updatedAt, matching App.tsx definition
  addExpense: (expense: Omit<Expense, 'id' | 'updatedAt'>) => void;
  updateExpense?: (expense: Expense) => void;
  expenseToEdit?: Expense | null;
  cancelEdit?: () => void;
  switchTab: (tab: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const PAYMENT_MODES = ["UPI", "Card", "Cash", "Netbanking", "Wallet", "Other"];

const haptic = (pattern: number | number[] = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

const getLocalDate = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

export const AddExpense: React.FC<AddExpenseProps> = ({ 
  state, 
  addExpense, 
  updateExpense,
  expenseToEdit, 
  cancelEdit,
  switchTab, 
  showToast 
}) => {
  const [formData, setFormData] = useState({
    person: '',
    date: getLocalDate(),
    amount: '',
    category: '',
    paymentMode: '',
    note: '',
    cardId: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [nlpInput, setNlpInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expenseToEdit) {
      setFormData({
        person: expenseToEdit.person,
        date: expenseToEdit.date,
        amount: expenseToEdit.amount.toString(),
        category: expenseToEdit.category,
        paymentMode: expenseToEdit.paymentMode,
        note: expenseToEdit.note,
        cardId: expenseToEdit.cardId?.toString() || ''
      });
    } else {
      setFormData({
        person: '',
        date: getLocalDate(),
        amount: '',
        category: '',
        paymentMode: '',
        note: '',
        cardId: ''
      });
    }
  }, [expenseToEdit]);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        if (ev.target?.result) {
          try {
            const data = await parseReceiptImage(ev.target.result as string);
            setFormData(prev => ({
              ...prev,
              amount: data.amount?.toString() || prev.amount,
              date: data.date || prev.date,
              category: (data.category && state.settings.customCategories.includes(data.category)) ? data.category : prev.category,
              note: data.note || prev.note || ''
            }));
            haptic(20);
            showToast("Receipt parsed successfully", 'success');
          } catch (err) {
            showToast("Failed to parse receipt", 'error');
          } finally {
            setIsProcessing(false);
          }
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleNLP = async (textOverride?: string) => {
    const textToProcess = typeof textOverride === 'string' ? textOverride : nlpInput;
    if (!textToProcess.trim()) return;
    
    setIsProcessing(true);
    try {
      const data = await parseNaturalLanguageExpense(
          textToProcess, 
          state.settings.person1Name, 
          state.settings.person2Name
      );

      setFormData(prev => ({
        ...prev,
        person: data.person || prev.person,
        amount: data.amount?.toString() || prev.amount,
        date: data.date || prev.date,
        category: (data.category && state.settings.customCategories.includes(data.category)) ? data.category : prev.category,
        paymentMode: data.paymentMode || prev.paymentMode,
        note: data.note || prev.note || textToProcess
      }));
      setNlpInput('');
      haptic(20);
      showToast("Processed", 'success');
    } catch (err) {
      showToast("Failed to understand text", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast("Voice input not supported", 'error');
      return;
    }
    
    haptic(10);
    setIsListening(true);
    // @ts-ignore
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US'; 
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      showToast("Listening...", 'info');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNlpInput(transcript);
      setIsListening(false);
      handleNLP(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      showToast("Voice input failed", 'error');
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.person || !formData.amount || !formData.category || !formData.paymentMode) {
      showToast("Please fill all required fields", 'error');
      return;
    }

    haptic([10, 5, 10]);

    // Fix: Using Omit<Expense, 'id' | 'updatedAt'> to match the addExpense prop requirement from App.tsx
    const payload: Omit<Expense, 'id' | 'updatedAt'> = {
      person: formData.person,
      date: formData.date,
      amount: parseFloat(formData.amount),
      category: formData.category,
      paymentMode: formData.paymentMode,
      note: formData.note,
      cardId: formData.paymentMode === 'Card' ? parseInt(formData.cardId) : undefined
    };
    
    if (expenseToEdit && updateExpense) {
      updateExpense({
        ...payload,
        id: expenseToEdit.id,
        updatedAt: Date.now()
      });
    } else {
      addExpense(payload);
      setFormData({
        person: '',
        date: getLocalDate(),
        amount: '',
        category: '',
        paymentMode: '',
        note: '',
        cardId: ''
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {!expenseToEdit && (
        <div className="flex gap-2 mb-4 sm:mb-6">
          <button 
            onClick={() => { haptic(5); fileInputRef.current?.click(); }}
            disabled={isProcessing}
            className="shrink-0 w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all active:scale-95 flex items-center justify-center shadow-sm"
          >
            {isProcessing ? <span className="animate-spin">🌀</span> : <span className="text-xl">📷</span>}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptUpload} />

          <button 
            onClick={startVoiceInput}
            disabled={isProcessing || isListening}
            className={`shrink-0 w-12 h-12 rounded-xl border transition-all active:scale-95 flex items-center justify-center shadow-sm ${
              isListening 
                ? 'bg-red-50 border-red-200 text-red-500 animate-pulse ring-2 ring-red-200' 
                : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100'
            }`}
          >
            <span className="text-xl">🎙️</span>
          </button>
          
          <div className="relative group flex-1">
            <input 
              type="text"
              placeholder={`Type 'spent 500 on coffee'...`}
              value={nlpInput}
              onChange={e => setNlpInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNLP()}
              className="w-full h-full p-2 pl-3 sm:p-3 sm:pl-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-background text-xs sm:text-sm pr-10 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
            />
            <button onClick={() => handleNLP()} className="absolute right-1 top-1/2 -translate-y-1/2 text-primary p-2">➤</button>
          </div>
        </div>
      )}

      {expenseToEdit && (
        <div className="flex justify-between items-center mb-4 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-800">
           <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-bold">
             <span>✏️</span> Editing Expense
           </div>
           <button onClick={cancelEdit} className="text-xs bg-white dark:bg-black/20 px-3 py-1.5 rounded-md">Cancel</button>
        </div>
      )}

      <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 mb-20 sm:mb-6 border border-gray-100 dark:border-gray-800 transition-shadow hover:shadow-md">
        <h3 className="text-base sm:text-lg font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2">
           <span>{expenseToEdit ? '📝' : '➕'}</span> {expenseToEdit ? 'Edit Expense' : 'Add New Expense'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-text-light mb-1 uppercase tracking-wide">Person *</label>
              <select 
                required
                className="w-full p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-background text-text text-sm"
                value={formData.person}
                onChange={e => { haptic(5); setFormData({...formData, person: e.target.value}); }}
              >
                <option value="">Select...</option>
                <option value="Person1">👤 {state.settings.person1Name}</option>
                <option value="Person2">👤 {state.settings.person2Name}</option>
                <option value="Both">👫 Both (Shared)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-text-light mb-1 uppercase tracking-wide">Date *</label>
              <input 
                type="date" 
                required
                className="w-full p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-background text-text text-sm"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-text-light mb-1 uppercase tracking-wide">Amount (₹) *</label>
              <input 
                type="number" 
                step="0.01" 
                min="0"
                placeholder="0.00"
                required
                className="w-full p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-background text-text text-base font-semibold"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-text-light mb-1 uppercase tracking-wide">Category *</label>
              <select 
                required
                className="w-full p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-background text-text text-sm"
                value={formData.category}
                onChange={e => { haptic(5); setFormData({...formData, category: e.target.value}); }}
              >
                <option value="">Select...</option>
                {state.settings.customCategories.map(c => (
                  <option key={c} value={c}>{state.settings.categoryIcons?.[c] || '📦'} {c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
             <label className="block text-[10px] sm:text-xs font-bold text-text-light mb-1 uppercase tracking-wide">Payment Mode *</label>
             <div className="flex flex-wrap gap-2">
               {PAYMENT_MODES.map(m => (
                 <button
                    key={m}
                    type="button"
                    onClick={() => { haptic(5); setFormData({...formData, paymentMode: m}); }}
                    className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all ${
                      formData.paymentMode === m 
                        ? 'bg-secondary text-white border-secondary shadow-md scale-105' 
                        : 'bg-background text-text-light border-gray-200 dark:border-gray-700 hover:border-secondary/50'
                    }`}
                 >
                   {m}
                 </button>
               ))}
             </div>
          </div>

          {formData.paymentMode === 'Card' && state.creditCards.length > 0 && (
            <div className="animate-slide-up">
              <label className="block text-[10px] sm:text-xs font-bold text-text-light mb-1 uppercase tracking-wide">Select Credit Card *</label>
              <select 
                required
                className="w-full p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-background text-text text-sm"
                value={formData.cardId}
                onChange={e => setFormData({...formData, cardId: e.target.value})}
              >
                <option value="">Select Card...</option>
                {state.creditCards.map(card => (
                  <option key={card.id} value={card.id}>💳 {card.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-text-light mb-1 uppercase tracking-wide">Description</label>
            <input 
              type="text" 
              placeholder="e.g., Weekly groceries"
              className="w-full p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-background text-text text-sm"
              value={formData.note}
              onChange={e => setFormData({...formData, note: e.target.value})}
            />
          </div>

          <div className="pt-2 sm:pt-4 flex gap-3">
             <button 
              type="submit" 
              className={`flex-1 text-white py-3 sm:py-3.5 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] text-sm sm:text-base ${
                expenseToEdit 
                  ? 'bg-orange-500 hover:bg-orange-600' 
                  : 'bg-gradient-to-r from-primary to-pink-600 hover:scale-[1.02]'
              }`}
            >
              {expenseToEdit ? 'Update Expense' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
