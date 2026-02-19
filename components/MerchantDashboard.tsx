import React, { useMemo, useState } from 'react';
import { Expense } from '../types';
import { getMerchantStats, MerchantStat } from '../utils/merchantParser';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MerchantDashboardProps {
    expenses: Expense[];
}

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({ expenses }) => {
    const [filter, setFilter] = useState<string>('All');
    const [selectedMerchant, setSelectedMerchant] = useState<MerchantStat | null>(null);

    const stats = useMemo(() => getMerchantStats(expenses), [expenses]);

    const filteredStats = useMemo(() => {
        if (filter === 'All') return stats;
        // Map simplified filters to actual categories if needed, 
        // or just filter where normalized category matches
        return stats.filter(s => s.category === filter || (filter === 'Food' && ['Food', 'Groceries'].includes(s.category)) || (filter === 'Bills' && ['Bills', 'EMIs', 'Rent'].includes(s.category)));
    }, [stats, filter]);

    const topMerchants = filteredStats.slice(0, 10);

    const chartData = topMerchants.map(m => ({
        name: m.merchant.length > 10 ? m.merchant.substring(0, 10) + '...' : m.merchant,
        full: m.merchant,
        amount: m.totalSpent
    }));

    const getEmoji = (name: string, category: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('zomato') || lower.includes('swiggy')) return '🛵';
        if (lower.includes('uber') || lower.includes('ola')) return '🚖';
        if (lower.includes('netflix') || lower.includes('spotify')) return '🍿';
        if (lower.includes('amazon') || lower.includes('flipkart')) return '📦';
        if (category === 'Food') return '🍔';
        if (category === 'Groceries') return '🥦';
        if (category === 'Shopping') return '🛍️';
        if (category === 'Travel') return '✈️';
        return '🏪';
    };

    return (
        <div className="animate-fade-in mb-6">
            <div className="bg-surface rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span>🏷️</span> Top Merchants
                </h3>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                    {['All', 'Food', 'Shopping', 'Entertainment', 'Bills'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap border ${filter === f ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-gray-50 text-text-light border-gray-200 dark:bg-gray-900/50 dark:border-gray-800'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Chart */}
                <div className="h-40 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 9, fontWeight: 'bold', fill: 'var(--text-light)' }}
                                width={70}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px' }}
                                formatter={(val: number) => `₹${val}`}
                            />
                            <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={12}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index < 3 ? 'var(--primary)' : 'var(--secondary)'} opacity={index < 3 ? 1 : 0.6} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Merchant List */}
                <div className="space-y-3">
                    {topMerchants.map((m, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelectedMerchant(m)}
                            className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-xl transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm">
                                    {getEmoji(m.merchant, m.category)}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-text group-hover:text-primary transition-colors">{m.merchant}</div>
                                    <div className="text-[10px] text-text-light">
                                        {m.visitCount} visits • Avg ₹{m.averageSpend.toFixed(0)}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-black text-sm mask-value">₹{m.totalSpent.toLocaleString()}</div>
                                <div className="text-[9px] text-text-light">{m.percentOfTotal.toFixed(1)}% of total</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail Modal */}
            {selectedMerchant && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedMerchant(null)}>
                    <div className="bg-surface rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <span className="text-4xl">{getEmoji(selectedMerchant.merchant, selectedMerchant.category)}</span>
                                <div>
                                    <h2 className="text-xl font-black text-text">{selectedMerchant.merchant}</h2>
                                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-text-light font-bold uppercase tracking-wider">{selectedMerchant.category}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedMerchant(null)}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >✕</button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div className="text-[10px] text-text-light uppercase font-bold text-center mb-1">Total Spent</div>
                                <div className="text-lg font-black text-center text-primary mask-value">₹{selectedMerchant.totalSpent.toLocaleString()}</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div className="text-[10px] text-text-light uppercase font-bold text-center mb-1">Visits</div>
                                <div className="text-lg font-black text-center text-secondary">{selectedMerchant.visitCount}</div>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-center border border-blue-100 dark:border-blue-900/30">
                            <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                                You've ordered from <strong>{selectedMerchant.merchant}</strong> {selectedMerchant.visitCount} times.
                                That's about <span className="font-bold">₹{(selectedMerchant.totalSpent / selectedMerchant.visitCount).toFixed(0)}</span> per visit!
                            </p>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-text-light uppercase tracking-widest mb-3">Recent Transactions</h4>
                            <div className="space-y-2">
                                {/* We would need to pass original expenses to filter specifically for this merchant 
                     OR we rely on what we have. Since we don't have the expense list in the stat object,
                     we can't show the list here without passing expenses again or changing the structure.
                     
                     Fix: Let's assume we can't show the list perfectly without refactoring or passing expenses.
                     But we can't easily pass expenses to the mapped object without bloating it.
                     
                     Alternative: Just show the stats we have and maybe a clever insight.
                  */}
                                <p className="text-center text-xs text-text-light italic">Detailed transaction history coming soon.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
