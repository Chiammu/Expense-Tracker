
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
          } catch (err: any) {
            console.error("Receipt parsing error:", err);
            const errorMsg = err.message || err.toString();
            if (errorMsg.includes("API Key is missing")) {
              showToast("AI features require Gemini API key in .env file", 'error');
            } else {
              showToast(`Failed to parse receipt: ${errorMsg}`, 'error');
            }
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
    } catch (err: any) {
      console.error("NLP parsing error:", err);
      const errorMsg = err.message || err.toString();
      if (errorMsg.includes("API Key is missing")) {
        showToast("AI features require Gemini API key in .env file", 'error');
      } else {
        showToast(`Failed to understand text: ${errorMsg}`, 'error');
      }
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
      setIsListening(true);
      haptic(50);
    };

    recognition.onend = () => setIsListening(false);

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      await handleNLP(transcript);
    };

    recognition.start();
  };

  const resetForm = () => {
    setFormData({
      person: '',
      date: getLocalDate(),
      amount: '',
      category: '',
      paymentMode: '',
      note: '',
      cardId: ''
    });
    setNlpInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.note) return;

    const expenseData = {
      ...formData,
      amount: parseFloat(formData.amount),
      cardId: formData.cardId ? parseInt(formData.cardId) : undefined,
      id: expenseToEdit?.id || Date.now(),
      updatedAt: Date.now()
    };

    if (expenseToEdit && updateExpense) {
      updateExpense(expenseData as Expense);
    } else {
      addExpense(expenseData as any);
    }

    haptic([50, 50]);
    resetForm();
    if (expenseToEdit && cancelEdit) cancelEdit();
  };

  return (
    <div className="max-w-2xl mx-auto pb-24 px-4 sm:px-0">

      {/* AI Input Bar */}
      <div className="mb-8">
        <div className="bg-surface dark:bg-[#1a1a1a] rounded-[24px] p-2 flex items-center gap-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-white/[0.06] transition-all focus-within:ring-2 focus-within:ring-primary/20">
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-white/[0.06] text-text-light hover:bg-gray-100 dark:hover:bg-white/[0.1] transition-colors active:scale-95"
            >
              {isProcessing ? <span className="animate-spin text-xl">⏳</span> : <span className="text-xl">📸</span>}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleReceiptUpload}
            />

            <input
              type="text"
              placeholder="Type 'Lunch 500 by Cash'..."
              className="flex-1 bg-transparent border-none outline-none text-text placeholder:text-text-light/50 text-[15px] font-medium"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNLP(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />

            <button
              type="button"
              onClick={startVoiceInput}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${isListening
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                : 'bg-primary text-white shadow-lg shadow-primary/30'
                }`}
            >
              {isListening ? <span className="animate-pulse">🎙️</span> : <span>🎤</span>}
            </button>

            <button
              type="submit"
              className={`px-4 py-2 text-white rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] text-sm whitespace-nowrap ${expenseToEdit
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-gradient-to-r from-primary to-pink-600 hover:scale-[1.02]'
                }`}
            >
              {expenseToEdit ? 'Update' : 'Add'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
