
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Expense } from '../types';

interface SharedBill {
    id: string;
    title: string;
    items: Expense[];
    total: number;
    per_person: number;
    created_at: string;
    expires_at: string;
    creator_name: string;
}

export const SplitBillView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [bill, setBill] = useState<SharedBill | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBill = async () => {
            if (!supabase || !id) return;
            try {
                const { data, error } = await supabase
                    .from('shared_bills')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setBill(data);
            } catch (err: any) {
                console.error("Error fetching bill:", err);
                setError("Bill not found or expired.");
            } finally {
                setLoading(false);
            }
        };
        fetchBill();
    }, [id]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background text-text">
            <div className="animate-spin text-4xl">⏳</div>
        </div>
    );

    if (error || !bill) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-text p-4 text-center">
            <h1 className="text-2xl font-black mb-2">Oops! 🤷‍♂️</h1>
            <p className="text-text-light">{error || "This link seems to be broken."}</p>
        </div>
    );

    const daysLeft = Math.max(0, Math.ceil((new Date(bill.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    return (
        <div className="min-h-screen bg-surface px-4 py-8 max-w-md mx-auto relative">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-black mb-1">{bill.title}</h1>
                <p className="text-text-light text-sm font-bold uppercase tracking-wide">
                    Shared by {bill.creator_name || 'Someone'}
                </p>
            </div>

            <div className="space-y-6">
                {/* Total Card */}
                <div className="bg-gradient-to-br from-primary to-pink-600 rounded-3xl p-6 text-white shadow-xl transform hover:scale-[1.02] transition-transform">
                    <div className="text-xs font-bold uppercase opacity-80 mb-1">Total Bill</div>
                    <div className="text-4xl font-black tracking-tight mb-4">₹{bill.total}</div>

                    <div className="bg-white/20 h-px w-full mb-4"></div>

                    <div className="flex justify-between items-center">
                        <span className="font-bold opacity-90">Your Share</span>
                        <span className="bg-white/20 px-3 py-1 rounded-xl font-black text-xl">₹{bill.per_person}</span>
                    </div>
                </div>

                {/* Breakdown */}
                <div>
                    <h2 className="text-xs font-black text-text-light uppercase tracking-widest mb-4 ml-1">Item Breakdown</h2>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800 overflow-hidden">
                        {bill.items.map((item, idx) => (
                            <div key={idx} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div>
                                    <div className="font-bold text-sm text-text">{item.category}</div>
                                    {item.note && <div className="text-xs text-text-light mt-0.5">{item.note}</div>}
                                    <div className="text-[10px] text-text-light mt-1 font-mono opacity-70">{new Date(item.date).toLocaleDateString()}</div>
                                </div>
                                <div className="font-black text-sm">₹{item.amount}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <button
                    onClick={() => alert("This just marks it for your own reference! No money actually moved within the app.")}
                    className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black uppercase tracking-wide shadow-lg shadow-green-500/30 transition-all active:scale-95"
                >
                    Mark Share as Paid ✅
                </button>

                <p className="text-center text-xs text-text-light mt-4">
                    This link expires in {daysLeft} days.
                </p>
            </div>
        </div>
    );
};
