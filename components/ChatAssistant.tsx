import React, { useState, useRef, useEffect } from 'react';
import { AppState } from '../types';
import { chatWithFinances } from '../services/geminiService';

interface ChatAssistantProps {
  state: AppState;
  onClose: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ state, onClose }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', content: string}[]>([
    { role: 'model', content: `Hi! I'm your AI financial assistant. I can analyze your spending, but I can't send messages to your partner.` }
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

    const response = await chatWithFinances(messages, userMsg, state);
    setMessages(prev => [...prev, { role: 'model', content: response }]);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface w-full max-w-md h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 bg-primary text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <span>🤖</span> AI Advisor
            </h3>
            <p className="text-[10px] opacity-80">This is an automated assistant</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-1">
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                m.role === 'user' 
                  ? 'bg-primary text-white rounded-br-none' 
                  : 'bg-gray-100 dark:bg-gray-800 text-text rounded-bl-none border border-gray-200 dark:border-gray-700'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl rounded-bl-none text-xs text-text-light animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-surface border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <input 
            className="flex-1 bg-background border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
            placeholder="Ask about your spending..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-primary text-white p-2 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};