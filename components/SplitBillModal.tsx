import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { overlayVariant, modalVariant } from '../utils/motion';
import { Expense } from '../types';
import { supabase } from '../services/supabaseClient';
import { QRCodeCanvas } from 'qrcode.react';

interface SplitBillModalProps {
    expenses: Expense[];
    onClose: () => void;
    defaultTitle?: string;
    preSelectedExpense?: Expense;
}

export const SplitBillModal: React.FC<SplitBillModalProps> = ({ expenses, onClose, defaultTitle = "Shared Bill", preSelectedExpense }) => {
    const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>(preSelectedExpense ? [preSelectedExpense.id] : []);
    const [personCount, setPersonCount] = useState(2);
    const [title, setTitle] = useState(defaultTitle);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [creatorName, setCreatorName] = useState('');

    const selectedExpenses = expenses.filter(e => selectedExpenseIds.includes(e.id));
    const totalAmount = selectedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const perPerson = totalAmount / personCount;

    const toggleExpense = (id: string) => {
        setSelectedExpenseIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleGenerateLink = async () => {
        if (selectedExpenses.length === 0) return;
        setLoading(true);

        try {
            if (!supabase) throw new Error("Supabase not initialized");

            const { data, error } = await supabase
                .from('shared_bills')
                .insert({
                    title,
                    items: selectedExpenses,
                    total: totalAmount,
                    split_count: personCount,
                    per_person: perPerson,
                    creator_name: creatorName || 'A friend',
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
                })
                .select()
                .single();

            if (error) throw error;

            const link = `${window.location.origin}/split/${data.id}`;
            setGeneratedLink(link);
        } catch (err) {
            console.error("Failed to generate link:", err);
            alert("Failed to generate link. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            alert("Link copied to clipboard!");
        }
    };

    return (
        <motion.div variants={overlayVariant} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div variants={modalVariant} className="bg-surface dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-surface dark:bg-gray-900 z-10">
                    <h2 className="text-lg font-black uppercase tracking-wide">Split Bill 💸</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">✕</button>
                </div>

                <div className="p-4 space-y-6 flex-1">
                    {!generatedLink ? (
                        <>
                            {/* Step 1: Configuration */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-text-light uppercase mb-1 block">Bill Title</label>
                                    <input
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl p-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="e.g. Weekend Trip"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-text-light uppercase mb-1 block">Your Name (Optional)</label>
                                    <input
                                        value={creatorName}
                                        onChange={e => setCreatorName(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl p-3 font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="e.g. John"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-text-light uppercase mb-1 block">Split Between</label>
                                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 p-2 rounded-xl">
                                        <button
                                            onClick={() => setPersonCount(Math.max(2, personCount - 1))}
                                            className="w-10 h-10 bg-white dark:bg-gray-700 rounded-lg shadow-sm font-bold text-xl"
                                        >-</button>
                                        <span className="flex-1 text-center font-black text-xl">{personCount} People</span>
                                        <button
                                            onClick={() => setPersonCount(Math.min(10, personCount + 1))}
                                            className="w-10 h-10 bg-white dark:bg-gray-700 rounded-lg shadow-sm font-bold text-xl"
                                        >+</button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-text-light uppercase mb-2 block">Select Expenses ({selectedExpenses.length})</label>
                                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                        {expenses.slice(0, 20).map(exp => ( // Show recent 20
                                            <div
                                                key={exp.id}
                                                onClick={() => toggleExpense(exp.id)}
                                                className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${selectedExpenseIds.includes(exp.id)
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                    }`}
                                            >
                                                <div>
                                                    <div className="font-bold text-sm">{exp.category}</div>
                                                    <div className="text-xs text-text-light">{exp.note || 'No note'} • {new Date(exp.date).toLocaleDateString()}</div>
                                                </div>
                                                <div className="font-black text-sm">₹{exp.amount}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Summary Card */}
                            <div className="bg-gradient-to-br from-primary to-pink-600 rounded-xl p-4 text-white shadow-lg">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="opacity-80 text-xs font-bold uppercase">Total Bill</span>
                                    <span className="text-2xl font-black">₹{totalAmount}</span>
                                </div>
                                <div className="bg-white/20 h-px w-full my-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="opacity-90 font-bold">Per Person</span>
                                    <span className="text-xl font-black bg-white/20 px-2 py-1 rounded-lg">₹{perPerson.toFixed(0)}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerateLink}
                                disabled={selectedExpenses.length === 0 || loading}
                                className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-black uppercase tracking-wide shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {loading ? 'Generating...' : 'Generate Share Link 🔗'}
                            </button>
                        </>
                    ) : (
                        <div className="space-y-6 text-center animate-fade-in">
                            <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-3 rounded-xl font-bold text-sm">
                                Link Generated Successfully! 🎉
                            </div>

                            <div className="flex justify-center">
                                <div className="p-4 bg-white rounded-xl shadow-lg">
                                    <QRCodeCanvas value={generatedLink} size={180} />
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-text-light uppercase mb-2">Share this link</p>
                                <div
                                    onClick={copyToClipboard}
                                    className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <span className="text-sm font-mono truncate flex-1 text-left">{generatedLink}</span>
                                    <span className="font-bold text-primary text-xs uppercase px-2 py-1 bg-primary/10 rounded-lg">Copy</span>
                                </div>
                            </div>

                            <p className="text-xs text-text-light">
                                This link expires in 7 days. Anyone with the link can view the bill details.
                            </p>

                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-text rounded-xl font-bold"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};
