import React, { useState, useEffect, useRef } from 'react';
import { AppState, ChatMessage, Section } from '../types';
import { format } from 'date-fns';

interface ChatProps {
    state: AppState;
    updateState: (updates: Partial<AppState>) => void;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    session: any;
    onRead: () => void;
}

export const Chat: React.FC<ChatProps> = ({ state, updateState, showToast, session, onRead }) => {
    const [inputText, setInputText] = useState('');
    const [identity, setIdentity] = useState<'Person1' | 'Person2' | null>(() => {
        return localStorage.getItem('chat_identity') as 'Person1' | 'Person2' | null;
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [state.chatMessages]);

    useEffect(() => {
        // Mark as read when entering chat or when new messages arrive while in chat
        onRead();
    }, [state.chatMessages, onRead]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !identity) return;

        const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            sender: identity,
            text: inputText.trim(),
            timestamp: new Date().toISOString(),
            type: 'text'
        };

        updateState({
            chatMessages: [...state.chatMessages, newMessage],
            updatedAt: Date.now()
        } as any);

        setInputText('');
    };

    const handleSetIdentity = (id: 'Person1' | 'Person2') => {
        setIdentity(id);
        localStorage.setItem('chat_identity', id);
    };

    const getSenderName = (sender: 'Person1' | 'Person2') => {
        return sender === 'Person1' ? state.settings.person1Name : state.settings.person2Name;
    };

    if (!identity) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-6 animate-fade-in">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">Who are you?</h2>
                    <p className="text-text-light">Select your identity for the chat.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => handleSetIdentity('Person1')}
                        className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-transform"
                    >
                        {state.settings.person1Name}
                    </button>
                    <button
                        onClick={() => handleSetIdentity('Person2')}
                        className="px-6 py-3 bg-secondary text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-transform"
                    >
                        {state.settings.person2Name}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/5 mb-4">
                <h2 className="text-xl font-black tracking-tight">Chat 💬</h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-light bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-full">
                        You are: {getSenderName(identity)}
                    </span>
                    <button
                        onClick={() => { localStorage.removeItem('chat_identity'); setIdentity(null); }}
                        className="text-xs text-primary font-bold"
                    >
                        Change
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scrollbar-hide">
                {state.chatMessages.length === 0 ? (
                    <div className="text-center text-text-light/50 py-10">
                        No messages yet. Start the conversation! 👋
                    </div>
                ) : (
                    state.chatMessages.map((msg) => {
                        const isMe = msg.sender === identity;
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div
                                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm relative group ${isMe
                                        ? 'bg-primary text-white rounded-br-none'
                                        : 'bg-white dark:bg-white/10 text-text rounded-bl-none border border-gray-100 dark:border-white/5'
                                        }`}
                                >
                                    {/* Expense Reference Card */}
                                    {msg.type === 'expense_ref' && msg.expenseId && (
                                        <div className={`mb-2 p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'}`}>
                                            {(() => {
                                                const exp = state.expenses.find(e => e.id === msg.expenseId);
                                                if (!exp) return <span className="text-xs italic">Expense deleted</span>;
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{state.settings.categoryIcons[exp.category] || '💸'}</span>
                                                        <div className="text-xs text-left">
                                                            <div className="font-bold">{exp.note || exp.category}</div>
                                                            <div className="opacity-80">${exp.amount}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {msg.text}

                                    <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-text-light'}`}>
                                        {format(new Date(msg.timestamp), 'h:mm a')}
                                    </div>
                                </div>
                                <span className="text-[10px] text-text-light mt-1 px-1">
                                    {!isMe && getSenderName(msg.sender)}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="mt-2 flex gap-2">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-text-light/50"
                />
                <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="w-12 h-12 flex items-center justify-center bg-primary text-white rounded-full shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-90"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </form>
        </div>
    );
};
