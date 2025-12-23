
import React, { useState, useMemo } from 'react';
import { AppState, Expense } from '../types';
import { roastSpending } from '../services/geminiService';

interface SummariesProps {
  state: AppState;
  deleteExpense: (id: number) => void;
  editExpense: (expense: Expense) => void;
}

const PAYMENT_MODES = ['all', 'UPI', 'Card', 'Cash', 'Netbanking', 'Wallet', 'Other'];

const INDIAN_HOLIDAYS: Record<string, string> = {
  '01-01': 'New Year',
  '01-26': 'Republic Day',
  '03-14': 'Holi',
  '03-31': 'Eid al-Fitr',
  '04-14': 'Ambedkar Jayanti',
  '05-01': 'May Day',
  '08-15': 'Independence Day',
  '10-02': 'Gandhi Jayanti',
  '10-20': 'Diwali',
  '12-25': 'Christmas'
};

export const Summaries: React.FC<SummariesProps> = ({ state, deleteExpense, editExpense }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [roast, setRoast] = useState<string | null>(null);
  const [loadingRoast, setLoadingRoast] = useState(false);
  
  // Accordion state: tracking expanded categories
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const handlePaymentFilterClick = (mode: string) => {
    setPaymentFilter(mode);
    if (mode !== 'all' && filterType !== 'all') {
      setFilterType('all');
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleRoast = async () => {
    setLoadingRoast(true);
    setRoast(null);
    try {
      const result = await roastSpending(state);
      setRoast(result);
    } catch (e) {
      setRoast("Your spending is so bad even the AI is speechless.");
    } finally {
      setLoadingRoast(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const todayStr = new Date(now.getTime() - offset).toISOString().split('T')[0];
    
    return state.expenses.filter(exp => {
      if (searchTerm && !exp.note.toLowerCase().includes(searchTerm.toLowerCase()) && !String(exp.amount).includes(searchTerm)) {
        return false;
      }
      
      if (paymentFilter !== 'all' && exp.paymentMode !== paymentFilter) {
        return false;
      }

      if (viewMode === 'calendar') return true;

      if (filterType === 'today') {
        return exp.date === todayStr;
      } else if (filterType === 'week') {
        const d = new Date(exp.date);
        const diff = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        return diff <= 7 && diff >= 0;
      } else if (filterType === 'month') {
        const d = new Date(exp.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.expenses, filterType, paymentFilter, searchTerm, viewMode]);

  const recentExpenses = useMemo(() => {
    return [...state.expenses].sort((a, b) => b.id - a.id).slice(0, 10);
  }, [state.expenses]);

  const stats = useMemo(() => {
    let p1 = 0, p2 = 0, shared = 0;
    const catMap: Record<string, Expense[]> = {};

    filteredExpenses.forEach(e => {
      if (e.person === 'Person1') p1 += e.amount;
      else if (e.person === 'Person2') p2 += e.amount;
      else shared += e.amount;

      if (!catMap[e.category]) catMap[e.category] = [];
      catMap[e.category].push(e);
    });

    const total = p1 + p2 + shared;
    const p1Real = p1 + (shared / 2);
    const p2Real = p2 + (shared / 2);

    const categories = Object.keys(catMap).map(cat => ({
      name: cat,
      expenses: catMap[cat],
      total: catMap[cat].reduce((sum, e) => sum + e.amount, 0)
    })).sort((a, b) => b.total - a.total);

    return { total, p1Real, p2Real, categories };
  }, [filteredExpenses]);

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    
    for(let i=0; i<firstDay; i++) days.push(null);
    for(let i=1; i<=daysInMonth; i++) days.push(new Date(year, month, i));
    
    return days;
  };

  const getLastWorkingDay = (year: number, month: number) => {
    let date = new Date(year, month + 1, 0);
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() - 1);
    }
    return date.getDate();
  };

  return (
    <div className="pb-24 space-y-4 sm:space-y-6">
      
      {/* Search Bar & Toggle */}
      <div className="bg-surface rounded-xl p-2 shadow-sm border border-gray-100 dark:border-gray-800 flex gap-2">
        <div className="flex-1 flex items-center bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3">
          <span className="text-gray-400 mr-2">🔍</span>
          <input 
            className="flex-1 bg-transparent py-2.5 text-sm focus:outline-none placeholder:text-text-light"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
           onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
           className="w-12 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-primary hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
           {viewMode === 'list' ? <span className="text-xl">📅</span> : <span className="text-xl">☰</span>}
        </button>
      </div>

      {viewMode === 'list' ? (
        <>
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['today', 'week', 'month', 'all'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-colors ${
                  filterType === t 
                    ? 'bg-primary text-white shadow-md' 
                    : 'bg-white dark:bg-gray-800 text-text-light border border-gray-200 dark:border-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {PAYMENT_MODES.map(m => (
              <button
                key={m}
                onClick={() => handlePaymentFilterClick(m)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap border transition-colors ${
                  paymentFilter === m
                    ? 'bg-secondary text-white border-secondary'
                    : 'bg-transparent text-text-light border-gray-200 dark:border-gray-700 hover:border-secondary'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-primary to-pink-600 rounded-xl p-4 text-white shadow-lg relative overflow-hidden group">
               <div className="text-xs opacity-80 uppercase font-bold">Total Spent</div>
               <div className="text-2xl font-bold">₹{stats.total.toFixed(0)}</div>
               <div className="text-[10px] mt-1 opacity-80">{filteredExpenses.length} transactions</div>
               
               <button 
                  onClick={handleRoast}
                  disabled={loadingRoast || state.expenses.length === 0}
                  className="absolute bottom-2 right-2 p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all active:scale-90 disabled:opacity-50"
               >
                 {loadingRoast ? "🔥..." : "Roast Me"}
               </button>
            </div>
            <div className="bg-surface rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
               <div className="flex justify-between items-center text-xs mb-1">
                 <span className="font-bold text-text-light">{state.settings.person1Name}</span>
                 <span className="font-bold text-text">₹{stats.p1Real.toFixed(0)}</span>
               </div>
               <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mb-2 overflow-hidden">
                 <div className="bg-secondary h-full rounded-full" style={{width: `${stats.total > 0 ? (stats.p1Real/stats.total)*100 : 0}%`}}></div>
               </div>
               <div className="flex justify-between items-center text-xs mb-1">
                 <span className="font-bold text-text-light">{state.settings.person2Name}</span>
                 <span className="font-bold text-text">₹{stats.p2Real.toFixed(0)}</span>
               </div>
               <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                 <div className="bg-accent h-full rounded-full" style={{width: `${stats.total > 0 ? (stats.p2Real/stats.total)*100 : 0}%`}}></div>
               </div>
            </div>
          </div>

          {/* Roast Output */}
          {roast && (
            <div className="animate-shake bg-gray-900 rounded-2xl p-4 border-2 border-orange-500 shadow-xl shadow-orange-500/10 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-20 text-4xl">🔥</div>
               <div className="flex justify-between items-start mb-2">
                 <h4 className="text-orange-400 font-black uppercase text-[10px] tracking-widest">Savage AI Roast</h4>
                 <button onClick={() => setRoast(null)} className="text-gray-500 hover:text-white">✕</button>
               </div>
               <p className="text-orange-50 text-sm font-medium leading-relaxed italic">
                 "{roast}"
               </p>
               <div className="mt-3 flex justify-end">
                 <div className="text-[9px] text-orange-500/50 font-bold uppercase">Truth hurts. 💀</div>
               </div>
            </div>
          )}

          {/* Categories Accordion List */}
          <div className="space-y-3">
             {stats.categories.map((cat) => (
               <div key={cat.name} className="bg-surface rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all">
                  <button 
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                     <div className="flex items-center gap-3">
                        <span className="text-2xl">{state.settings.categoryIcons?.[cat.name] || '📦'}</span>
                        <div className="text-left">
                           <div className="font-bold text-text">{cat.name}</div>
                           <div className="text-[10px] text-text-light uppercase font-black">{cat.expenses.length} txns</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="text-right">
                           <div className="font-black text-primary">₹{cat.total.toLocaleString()}</div>
                           <div className="text-[10px] text-text-light uppercase font-black">{((cat.total / stats.total) * 100).toFixed(0)}%</div>
                        </div>
                        <span className={`text-text-light transition-transform duration-300 ${expandedCategories.includes(cat.name) ? 'rotate-180' : ''}`}>▼</span>
                     </div>
                  </button>

                  {expandedCategories.includes(cat.name) && (
                    <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-900/50 animate-slide-up bg-gray-50/50 dark:bg-black/10">
                       {cat.expenses.map(exp => (
                         <div key={exp.id} className="p-3 flex justify-between items-start group">
                            <div className="flex gap-3">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                 exp.person === 'Person1' ? 'bg-blue-100 text-blue-600' : 
                                 exp.person === 'Person2' ? 'bg-orange-100 text-orange-600' : 
                                 'bg-purple-100 text-purple-600'
                               }`}>
                                 {exp.person === 'Both' ? '👫' : (exp.person === 'Person1' ? state.settings.person1Name[0] : state.settings.person2Name[0])}
                               </div>
                               <div>
                                  <div className="text-sm font-bold text-text italic leading-tight">{exp.note || 'No note'}</div>
                                  <div className="flex gap-2 mt-1 text-[10px] text-text-light uppercase font-black">
                                     <span>{new Date(exp.date).toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}</span>
                                     <span>•</span>
                                     <span>{exp.paymentMode}</span>
                                  </div>
                               </div>
                            </div>
                            <div className="flex flex-col items-end">
                               <div className="font-bold text-sm">₹{exp.amount}</div>
                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                  <button onClick={() => editExpense(exp)} className="p-1 hover:bg-white dark:hover:bg-gray-800 rounded">✏️</button>
                                  <button onClick={() => deleteExpense(exp.id)} className="p-1 hover:bg-white dark:hover:bg-gray-800 rounded">🗑️</button>
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
               </div>
             ))}
             {stats.categories.length === 0 && (
               <div className="text-center py-12 opacity-50 bg-surface rounded-xl border border-dashed border-gray-300">
                 <div className="text-4xl mb-2">🍃</div>
                 <div className="text-sm font-bold">No expenses found for this selection</div>
               </div>
             )}
          </div>

          {/* RECENTLY ADDED SECTION (Last 10) */}
          <div className="pt-4">
             <h3 className="text-xs font-black text-text-light uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>🕒</span> Recent Added Expense (Last 10)
             </h3>
             <div className="bg-surface rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-900/50">
                {recentExpenses.map(exp => (
                   <div key={exp.id} className="p-3 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                         <span className="text-xl">{state.settings.categoryIcons?.[exp.category] || '📦'}</span>
                         <div>
                            <div className="text-sm font-bold text-text truncate max-w-[120px] sm:max-w-xs">{exp.note || exp.category}</div>
                            <div className="text-[10px] text-text-light uppercase font-black">
                               {new Date(exp.date).toLocaleDateString()} • {exp.person === 'Both' ? 'Shared' : (exp.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name)}
                            </div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="font-bold text-sm text-primary">₹{exp.amount}</div>
                         <div className="text-[8px] text-text-light uppercase font-bold">{exp.paymentMode}</div>
                      </div>
                   </div>
                ))}
                {recentExpenses.length === 0 && (
                   <div className="p-6 text-center text-xs text-text-light italic">No transactions yet.</div>
                )}
             </div>
          </div>
        </>
      