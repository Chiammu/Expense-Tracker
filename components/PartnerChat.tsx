import React, { useState, useEffect, useRef } from 'react';
import { AppState } from '../types';
import { useChat } from '../hooks/useChat';

interface PartnerChatProps {
  state: AppState;
}

export const PartnerChat: React.FC<PartnerChatProps> = ({ state }) => {
  const [identity, setIdentity] = useState<'Person1' | 'Person2' | null>(null);
  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Use the new Hook
  const { messages, loading, sendMessage } = useChat(state.settings.syncId);

  // Load identity from local storage
  useEffect(() => {
    const savedIdentity = localStorage.getItem('deviceUserIdentity');
    if (savedIdentity === 'Person1' || savedIdentity === 'Person2') {
      setIdentity(savedIdentity);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, identity]);

  const handleSetIdentity = (id: 'Person1' | 'Person2') => {
    localStorage.setItem('deviceUserIdentity', id);
    setIdentity(id);
  };

  const handleSend = () => {
    if (!inputText.trim() || !identity) return;
    sendMessage(inputText, identity);
    setInputText('');
  };

  if (!state.settings.syncId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 opacity-60">
        <div className="text-6xl mb-4 grayscale">☁️</div>
        <h3 className="text-xl font-bold mb-2">Not Connected</h3>
        <p className="text-sm">Link your devices in Settings to chat with your partner.</p>
      </div>
    );
  }

  // Identity Selection Screen
  if (!identity) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
        <div className="text-4xl mb-4">👋</div>
        <h2 className="text-xl font-bold text-primary mb-2">Who are you?</h2>
        <p className="text-center text-sm text-text-light mb-8">
          Select your profile so we know which side to show your messages on. This is saved only on this device.
        </p>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button 
            onClick={() => handleSetIdentity('Person1')}
            className="p-4 bg-surface border-2 border-gray-100 dark:border-gray-800 rounded-xl hover:border-primary hover:bg-primary/5 transition-all font-bold text-left flex justify-between items-center group"
          >
            <span>{state.settings.person1Name}</span>
            <span className="opacity-0 group-hover:opacity-100 text-primary">✓</span>
          </button>
          
          <button 
            onClick={() => handleSetIdentity('Person2')}
            className="p-4 bg-surface border-2 border-gray-100 dark:border-gray-800 rounded-xl hover:border-secondary hover:bg-secondary/5 transition-all font-bold text-left flex justify-between items-center group"
          >
            <span>{state.settings.person2Name}</span>
            <span className="opacity-0 group-hover:opacity-100 text-secondary">✓</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] sm:h-[600px] bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-inner">
      {/* Header */}
      <div className="p-3 bg-surface border-b border-gray-200 dark:border-gray-800 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400' : 'bg-green-500 animate-pulse'}`}></div>
           <span className="text-xs font-bold text-text-light uppercase tracking-wide">
             {loading ? 'Connecting...' : `Chatting with ${identity === 'Person1' ? state.settings.person2Name : state.settings.person1Name}`}
           </span>
        </div>
        <button 
          onClick={() => { localStorage.removeItem('deviceUserIdentity'); setIdentity(null); }}
          className="text-[10px] text-text-light hover:text-red-500 underline"
        >
          Reset Me
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center py-10 opacity-30">
            <p>No messages yet.</p>
            <p className="text-xs mt-1">Say hello! 👋</p>
          </div>
        )}
        
        {messages.map((msg) => {
          const isMe = msg.sender === identity;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-scale-in`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm relative ${
                isMe 
                  ? 'bg-gradient-to-br from-primary to-pink-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-gray-800 text-text border border-gray-100 dark:border-gray-700 rounded-bl-none'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-text-light'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-surface border-t border-gray-200 dark:border-gray-800 flex gap-2">
        <input 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 bg-gray-100 dark:bg-gray-900 border-0 rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
        />
        <button 
          onClick={handleSend}
          disabled={!inputText.trim()}
          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:shadow-none transition-all"
        >
          ➤
        </button>
      </div>
    </div>
  );
};