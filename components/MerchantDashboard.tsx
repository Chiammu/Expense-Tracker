import React, { useState, useMemo } from 'react';
import { Expense } from '../types';
import { getMerchantStats, getMerchantEmoji, MerchantStat } from '../utils/merchantParser';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface MerchantDashboardProps {
  expenses: Expense[];
}

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({ expenses }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantStat | null>(null);

  const merchantStats = useMemo(() => getMerchantStats(expenses), [expenses]);

  const filteredMerchants = useMemo(() => {
    if (filterType === 'all') return merchantStats.slice(0, 10);
    return merchantStats.filter(m => m.category.toLowerCase() === filterType.toLowerCase()).slice(0, 10);
  }, [merchantStats, filterType]);

  const filterOptions = ['all', 'food', 'shopping', 'entertainment', 'bills'];

  const chartData = filteredMerchants.map(m => ({
    name: m.merchant.length > 12 ? m.merchant.substring(0, 12) + '...' : m.merchant,
    fullName: m.merchant,
    value: m.totalSpent
  }));

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <span className="text-red-500">↑</span>;
      case 'down': return <span className="text-green-500">↓</span>;
      case 'stable': return <span className="text-gray-500">→</span>;
    }
  };

  const getMerchantMonthlyData = (merchantName: string) => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString(undefined, { month: 'short' });
      const monthExpenses = expenses.filter(e => {
        const eDate = new Date(e.date);
        const merchant = getMerchantEmoji(merchantName);
        const extracted = e.note.toLowerCase().includes(merchantName.toLowerCase()) ||
                         e.category.toLowerCase().includes(merchantName.toLowerCase());
        return eDate.getMonth() === date.getMonth() &&
               eDate.getFullYear() === date.getFullYear() &&
               extracted;
      });
      const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
      months.push({ month: monthName, value: total });
    }
    return months;
  };

  const getMerchantTransactions = (merchantName: string) => {
    return expenses.filter(e => {
      const extracted = e.note.toLowerCase().includes(merchantName.toLowerCase()) ||
                       e.category.toLowerCase().includes(merchantName.toLowerCase());
      return extracted;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
            <span>🏪</span> Top Merchants
          </h3>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
          {filterOptions.map(opt => (
            <button
              key={opt}
              onClick={() => setFilterType(opt)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all whitespace-nowrap border ${
                filterType === opt
                  ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-md'
                  : 'bg-surface text-text-light border-gray-100 dark:border-gray-800'
              }`}
            >
              {opt === 'all' ? 'All Categories' : opt}
            </button>
          ))}
        </div>

        {filteredMerchants.length > 0 ? (
          <>
            <div className="h-56 w-full mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="horizontal" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#88888822" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [`₹${val.toFixed(0)}`, 'Total Spent']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--primary)" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {filteredMerchants.map((merchant, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedMerchant(merchant)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getMerchantEmoji(merchant.merchant)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-text text-sm truncate">{merchant.merchant}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-black text-text-light">
                            {merchant.visitCount}×
                          </span>
                          {getTrendIcon(merchant.trend)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-[10px] text-text-light capitalize">{merchant.category}</div>
                        <div className="font-black text-primary text-sm mask-value">
                          ₹{merchant.totalSpent.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {idx === 0 && merchant.visitCount >= 3 && (
                    <div className="mt-2 text-[10px] text-primary font-bold bg-primary/5 dark:bg-primary/10 px-2 py-1 rounded-lg">
                      💡 You've ordered from {merchant.merchant} {merchant.visitCount} times this month
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-text-light text-sm">
            No merchant data available for this category
          </div>
        )}
      </div>

      {selectedMerchant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setSelectedMerchant(null)}>
          <div className="bg-surface rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 animate-slide-up my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{getMerchantEmoji(selectedMerchant.merchant)}</span>
                <div>
                  <h3 className="text-lg font-bold text-text">{selectedMerchant.merchant}</h3>
                  <p className="text-sm text-text-light capitalize">{selectedMerchant.category}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMerchant(null)}
                className="text-text-light hover:text-text text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gradient-to-br from-primary to-pink-600 rounded-xl p-3 text-white">
                <div className="text-[9px] opacity-80 uppercase font-bold">Total Spent</div>
                <div className="text-lg font-black mask-value">₹{selectedMerchant.totalSpent.toFixed(0)}</div>
              </div>
              <div className="bg-surface rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                <div className="text-[9px] text-text-light uppercase font-bold">Visits</div>
                <div className="text-lg font-black text-text">{selectedMerchant.visitCount}</div>
              </div>
              <div className="bg-surface rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                <div className="text-[9px] text-text-light uppercase font-bold">Avg/Visit</div>
                <div className="text-lg font-black text-text mask-value">₹{selectedMerchant.averageSpend.toFixed(0)}</div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-xs font-black text-text-light uppercase tracking-widest mb-3">
                6-Month Trend
              </h4>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getMerchantMonthlyData(selectedMerchant.merchant)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(val: number) => [`₹${val.toFixed(0)}`, 'Spent']}
                    />
                    <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-black text-text-light uppercase tracking-widest mb-3">
                Recent Transactions
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getMerchantTransactions(selectedMerchant.merchant).slice(0, 10).map((exp, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold text-text">{exp.note || 'No note'}</div>
                      <div className="text-[10px] text-text-light">
                        {new Date(exp.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="font-bold text-text mask-value">₹{exp.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
