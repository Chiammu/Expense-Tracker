
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Expense } from '../types';
import { chatWithFinances } from '../services/geminiService';

interface ChatAssistantProps {
  state: AppState;
  // Fix: Updated prop type to exclude updatedAt, matching App.tsx definition
  addExpense: (expense: Omit<Expense, 'id' | 'updatedAt'>) => void;
  onClose: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ state, addExpense, onClose }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', content: string}[]>([
    { role: 'model', content: `Hi! I'm your AI financial assistant. I can help you track expenses. Just say "Added 500 for lunch paid by ${state.settings.person1Name}".` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    // Convert history for Gemini
    const history = messages.map(m => ({ 
      role: m.role, 
      parts: [{ text: m.content }] 
    }));

    const response = await chatWithFinances(history, userMsg, state);

    // Handle Tool Calls (Function Calling)
    if (response.toolCall && response.toolCall.name === 'add_expense') {
      const args = response.toolCall.args;
      // Fix: Payload now correctly excludes updatedAt to match prop definition and App.tsx implementation
      const expense: Omit<Expense, 'id' | 'updatedAt'> = {
        amount: args.amount,
        category: args.category || 'Others',
        person: args.person || 'Both',
        note: args.note || userMsg,
        date: args.date || new Date().toISOString().split('T')[0],
        paymentMode: 'UPI' // Default
      };
      addExpense(expense);
      setMessages(prev => [...prev, { role: 'model', content: `✅ Added: ₹${args.amount} for ${args.category}.` }]);
    } else {
      setMessages(prev => [...prev, { role: 'model', content: response.text }]);
    }
    
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface w-full max-w-md h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-scale-in">
        {/* Header */}
        <div className="p-4 bg-primary text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <span>🤖</span> AI Smart Entry
            </h3>
            <p className="text-[10px] opacity-80">Add expenses with natural voice/text</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-1 transition-colors">✕</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                m.role === 'user' 
                  ? 'bg-primary text-white rounded-br-none shadow-sm' 
                  : 'bg-surface text-text rounded-bl-none border border-gray-200 dark:border-gray-700 shadow-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface p-3 rounded-2xl rounded-bl-none text-xs text-text-light animate-pulse border border-gray-100">
                Processing...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-surface border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <input 
            className="flex-1 bg-background border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
            placeholder="e.g. Added 200 for milk..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-primary text-white p-2.5 rounded-full w-11 h-11 flex items-center justify-center disabled:opacity-50 active:scale-90 transition-transform shadow-md shadow-primary/20"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};
