import React, { useState, useMemo } from 'react';
import { AppState, Expense } from '../types';
import { roastSpending } from '../services/geminiService';
import { MerchantDashboard } from './MerchantDashboard';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SplitBillModal } from './SplitBillModal';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeVariant, fadeUpVariant, cardVariant, spring } from '../utils/motion';

interface SummariesProps {
  state: AppState;
  deleteExpense: (id: string) => void;
  editExpense: (expense: Expense) => void;
  cardFilter?: string | null;
  setCardFilter?: (id: string | null) => void;
}

export const Summaries: React.FC<SummariesProps> = ({ state, deleteExpense, editExpense, cardFilter, setCardFilter }) => {
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0); // 0 = current, -1 = prev
  const [personView, setPersonView] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showMerchants, setShowMerchants] = useState(false);

  // Roast State
  const [roast, setRoast] = useState<string | null>(null);
  const [isRoasting, setIsRoasting] = useState(false);

  // Split Bill State
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [expenseToSplit, setExpenseToSplit] = useState<Expense | undefined>(undefined);

  // --- Dates ---
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + selectedMonthOffset);
    return d;
  }, [selectedMonthOffset]);

  const monthLabel = targetDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // --- Base Filtering (Month & Person) ---
  const filteredMonthExpenses = useMemo(() => {
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    return state.expenses.filter(exp => {
      const d = new Date(exp.date);
      if (d.getMonth() !== targetMonth || d.getFullYear() !== targetYear) return false;

      if (personView !== 'all' && exp.person !== personView) return false;
      
      return true;
    });
  }, [state.expenses, targetDate, personView, state.settings]);

  // --- List Filtering (Search + Category + Card) ---
  const displayExpenses = useMemo(() => {
    return filteredMonthExpenses.filter(exp => {
      if (searchTerm && !exp.note.toLowerCase().includes(searchTerm.toLowerCase()) && !String(exp.amount).includes(searchTerm)) {
        return false;
      }
      if (selectedCategory && exp.category !== selectedCategory) {
        return false;
      }
      if (cardFilter && exp.cardId !== cardFilter) {
        return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredMonthExpenses, searchTerm, selectedCategory, cardFilter]);

  // --- Computations ---
  const totalSpent = useMemo(() => filteredMonthExpenses.reduce((s, e) => s + e.amount, 0), [filteredMonthExpenses]);

  const categoryStats = useMemo(() => {
    const map: Record<string, { total: number, count: number }> = {};
    filteredMonthExpenses.forEach(e => {
      if (!map[e.category]) map[e.category] = { total: 0, count: 0 };
      map[e.category].total += e.amount;
      map[e.category].count += 1;
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [filteredMonthExpenses]);

  const paymentModeStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredMonthExpenses.forEach(e => {
      const mode = e.paymentMode || 'Unknown';
      map[mode] = (map[mode] || 0) + e.amount;
    });
    return Object.entries(map).map(([mode, total]) => ({ mode, total })).sort((a, b) => b.total - a.total);
  }, [filteredMonthExpenses]);

  const topMerchants = useMemo(() => {
    const map: Record<string, number> = {};
    filteredMonthExpenses.forEach(e => {
      const merchant = e.note.trim().split(/\s+/).slice(0, 3).join(' '); // Capitalizer logic can be added, keep it simple for now
      if (!merchant) return;
      const key = merchant.toLowerCase();
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredMonthExpenses]);

  const sixMonthTrend = useMemo(() => {
    const months = [];
    const currentMonthDate = targetDate;
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      
      const total = state.expenses.reduce((sum, e) => {
         const ed = new Date(e.date);
         if (ed.getMonth() === m && ed.getFullYear() === y) {
            // Apply person filter
            if (personView !== 'all' && e.person !== personView) return sum;
            return sum + e.amount;
         }
         return sum;
      }, 0);
      
      months.push({ 
        name: d.toLocaleDateString(undefined, { month: 'short' }),
        value: total 
      });
    }
    return months;
  }, [state.expenses, targetDate, personView, state.settings]);

  const handleRoast = async () => {
    if (state.expenses.length < 5) {
      alert("Add more expenses before I can properly roast you!");
      return;
    }
    setIsRoasting(true);
    setRoast(null);
    try {
      const result = await roastSpending(state);
      setRoast(result);
    } catch (e: any) {
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes("API Key is missing")) {
        setRoast("⚠️ AI features require a Gemini API key. Please add GEMINI_API_KEY to your .env file.");
      } else {
        setRoast(`⚠️ AI Error: ${errorMsg}`);
      }
    } finally {
      setIsRoasting(false);
    }
  };

  return (
    <motion.div variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="pb-24 space-y-6 text-sm">
      
      {/* Month Selector */}
      <div className="flex items-center justify-between bg-white dark:bg-[#1a1a1a] rounded-[24px] p-2 shadow-sm border border-gray-100 dark:border-white/5">
        <button 
          onClick={() => setSelectedMonthOffset(o => o - 1)}
          className="w-12 h-12 flex items-center justify-center rounded-[18px] hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500 active:scale-95 transition-all"
        >
          <span className="text-xl">‹</span>
        </button>
        <div className="flex-1 text-center overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={selectedMonthOffset}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={spring}
                className="font-black tracking-widest uppercase text-gray-800 dark:text-gray-200"
              >
                {monthLabel}
              </motion.div>
            </AnimatePresence>
        </div>
        <button 
          onClick={() => setSelectedMonthOffset(o => o + 1)}
          disabled={selectedMonthOffset >= 0}
          className={`w-12 h-12 flex items-center justify-center rounded-[18px] transition-all ${selectedMonthOffset >= 0 ? 'opacity-30' : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500 active:scale-95'}`}
        >
          <span className="text-xl">›</span>
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex bg-gray-100 dark:bg-[#1a1a1a] rounded-full p-1 border border-gray-200 dark:border-white/5 mx-auto max-w-sm relative">
          <motion.div
            className="absolute top-1 bottom-1 bg-white dark:bg-white/10 shadow-sm rounded-full z-0"
            animate={{
              left: personView === 'all' ? '1%' : personView === state.settings.person1Name ? '33.5%' : '66.5%',
              width: '32.5%'
            }}
            transition={spring}
          />
          <button
            className={`flex-1 py-2 rounded-full text-xs font-bold relative z-10 transition-colors ${personView === 'all' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
            onClick={() => setPersonView('all')}
          >
            Combined
          </button>
          <button
            className={`flex-1 py-2 rounded-full text-xs font-bold relative z-10 transition-colors ${personView === state.settings.person1Name ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
            onClick={() => setPersonView(state.settings.person1Name)}
          >
            {state.settings.person1Name}
          </button>
          <button
            className={`flex-1 py-2 rounded-full text-xs font-bold relative z-10 transition-colors ${personView === state.settings.person2Name ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
            onClick={() => setPersonView(state.settings.person2Name)}
          >
            {state.settings.person2Name}
          </button>
      </div>

      {/* Total Card */}
      <motion.div variants={cardVariant} className="bg-gradient-to-br from-[#0f0f0f] to-[#1a1a1a] p-8 rounded-[32px] text-white shadow-xl shadow-black/10 border border-white/5 relative overflow-hidden flex flex-col items-center justify-center min-h-[160px]">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl pointer-events-none">💸</div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2 z-10">Total Spent</p>
        <h2 className="text-5xl font-mono font-medium tracking-tighter z-10">₹{totalSpent.toLocaleString('en-IN')}</h2>
      </motion.div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Monthly Trend Card */}
        <motion.div variants={cardVariant} className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">6-Month Trend</h3>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sixMonthTrend}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 700 }} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '16px', background: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {sixMonthTrend.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 5 ? '#3b82f6' : '#3b82f640'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Payment Modes */}
        <motion.div variants={cardVariant} className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Payment Modes</h3>
          <div className="flex-1 flex flex-col justify-center gap-3">
            {paymentModeStats.length === 0 ? (
              <p className="text-center text-xs text-gray-400 font-medium">No data</p>
            ) : paymentModeStats.map(stat => (
              <div key={stat.mode} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${stat.mode === 'Cash' ? 'bg-green-500' : stat.mode === 'UPI' ? 'bg-purple-500' : stat.mode === 'Card' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{stat.mode}</span>
                </div>
                <div className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400">
                  ₹{stat.total.toLocaleString('en-IN')} <span className="opacity-50 ml-1">({((stat.total / totalSpent) * 100).toFixed(0)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Breakdown */}
        <motion.div variants={cardVariant} className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col h-[320px]">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 flex-shrink-0">Categories</h3>
          <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-4">
            {categoryStats.length === 0 ? (
               <p className="text-center text-xs text-gray-400 font-medium mt-10">No expenses this month</p>
            ) : categoryStats.map(cat => (
              <button 
                key={cat.name} 
                onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                className={`w-full text-left group transition-all ${selectedCategory === cat.name ? 'opacity-100' : selectedCategory ? 'opacity-40 hover:opacity-100' : 'opacity-100'}`}
              >
                <div className="flex justify-between text-xs font-bold mb-1.5 pt-1">
                  <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                    <span>{state.settings.categoryIcons?.[cat.name] || '📦'}</span>
                    {cat.name}
                  </span>
                  <span className="font-mono text-gray-500">₹{cat.total.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.total / totalSpent) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-primary rounded-full" 
                  />
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Top Merchants */}
        <motion.div variants={cardVariant} className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col h-[320px]">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 flex-shrink-0">Top Destinations</h3>
          <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-3">
             {topMerchants.length === 0 ? (
               <p className="text-center text-xs text-gray-400 font-medium mt-10">No data</p>
             ) : topMerchants.map((merchant, i) => (
                <div key={merchant.name} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-black/20 flex items-center justify-center text-xs font-black text-gray-400">
                    #{i + 1}
                  </div>
                  <div className="flex-1 truncate text-sm font-bold text-gray-800 dark:text-gray-200">
                    {merchant.name || 'Unknown'}
                  </div>
                  <div className="text-sm font-mono font-medium text-gray-500">
                    ₹{merchant.total.toLocaleString()}
                  </div>
                </div>
             ))}
          </div>
        </motion.div>
      </div>

      {/* AI Roast */}
      <motion.button
        variants={fadeUpVariant}
        onClick={handleRoast}
        disabled={isRoasting}
        className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 overflow-hidden relative"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300" />
        {isRoasting ? <span className="animate-spin relative z-10">🔥</span> : <span className="relative z-10">🔥 Roast My Spending</span>}
      </motion.button>

      <AnimatePresence>
        {roast && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#1a1a1a] rounded-[24px] p-6 border border-orange-500/20 shadow-xl relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 text-6xl opacity-10 pointer-events-none">☠️</div>
            <h3 className="text-orange-500 font-black uppercase text-[10px] tracking-[0.2em] mb-3">AI Analysis</h3>
            <p className="text-gray-300 text-sm leading-relaxed font-mono">{roast}</p>
            <button onClick={() => setRoast(null)} className="mt-4 text-[10px] font-bold text-gray-500 hover:text-white uppercase transition-colors tracking-wider">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent my-8" />

      {/* Expense List Section */}
      <motion.div variants={cardVariant} className="space-y-4">
        
        {/* Filters and Search */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 items-center">
            <div className="flex-1 bg-[var(--control-bg)] dark:bg-[#0f0f15] rounded-2xl px-4 py-3 flex items-center shadow-[var(--control-shadow)] border border-[var(--control-border)] focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-primary/10 transition-all duration-300">
              <span className="mr-3 opacity-50">🔍</span>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search transactions, notes..."
                className="bg-transparent flex-1 text-sm font-semibold placeholder:text-[var(--text-placeholder)] focus:outline-none text-[var(--text-primary)]"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="ml-2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 dark:bg-white/10 text-[10px] hover:bg-gray-300 dark:hover:bg-white/20 transition-colors">✕</button>
              )}
            </div>
          </div>
          
          {/* Active Filter Chips */}
          <div className="flex flex-wrap gap-2 min-h-[32px]">
            <AnimatePresence>
              {selectedCategory && (
                <motion.button
                  key="cat-filter"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSelectedCategory(null)}
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5 hover:bg-primary/20 transition-colors"
                >
                  <span>{state.settings.categoryIcons?.[selectedCategory] || '📦'} {selectedCategory}</span>
                  <span className="opacity-50">✕</span>
                </motion.button>
              )}
              {cardFilter && (
                <motion.button
                  key="card-filter"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setCardFilter?.(null)}
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1.5 hover:bg-blue-500/20 transition-colors"
                >
                  <span>💳 Card Ref</span>
                  <span className="opacity-50">✕</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {displayExpenses.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-12 flex flex-col items-center justify-center text-center"
              >
                <div className="text-4xl mb-4 opacity-50 text-gray-400">📭</div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">No Transactions Found</h3>
                <p className="text-xs text-gray-400 max-w-[200px]">Looks like there's no spending matching these filters.</p>
              </motion.div>
            ) : (
              <motion.div key="list" className="divide-y divide-gray-50 dark:divide-white/5">
                {displayExpenses.map(exp => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={exp.id} 
                    className="p-4 flex justify-between items-center group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-sm border border-black/5 dark:border-white/5 ${exp.person === state.settings.person1Name ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-purple-50 dark:bg-purple-500/10'}`}>
                        {state.settings.categoryIcons?.[exp.category] || '📦'}
                      </div>
                      <div className="cursor-pointer" onClick={() => editExpense(exp)}>
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-0.5">{exp.note || 'Uncategorized'}</div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium tracking-wide">
                          <span className="uppercase">{exp.category}</span>
                          <span>•</span>
                          <span>{new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">₹{exp.amount.toLocaleString()}</span>
                      <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => deleteExpense(exp.id)} className="text-[10px] text-red-500 font-bold tracking-wider hover:text-red-600 transition-colors">DEL</button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

    </motion.div>
  );
};
