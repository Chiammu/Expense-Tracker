
import React, { useState, useMemo } from 'react';
import { AppState, Expense } from '../types';
import { roastSpending } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SummariesProps {
  state: AppState;
  deleteExpense: (id: number) => void;
  editExpense: (expense: Expense) => void;
}

export const Summaries: React.FC<SummariesProps> = ({ state, deleteExpense, editExpense }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  
  // Roast State
  const [roast, setRoast] = useState<string | null>(null);
  const [isRoasting, setIsRoasting] = useState(false);

  // Expanded categories
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const handleRoast = async () => {
    if (state.expenses.length < 5) {
      alert("I need at least 5 transactions to find a pattern worth roasting!");
      return;
    }
    setIsRoasting(true);
    setRoast(null);
    try {
      const result = await roastSpending(state);
      setRoast(result);
    } catch (e) {
      setRoast("You spend money so fast my circuits couldn't keep up.");
    } finally {
      setIsRoasting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const todayStr = new Date(now.getTime() - offset).toISOString().split('T')[0];
    
    return state.expenses.filter(exp => {
      if (searchTerm && !exp.note.toLowerCase().includes(searchTerm.toLowerCase()) && !String(exp.amount).includes(searchTerm)) {
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
  }, [state.expenses, filterType, searchTerm, viewMode]);

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

  const chartData = useMemo(() => {
    return stats.categories.slice(0, 6).map(c => ({
      name: c.name,
      value: c.total
    }));
  }, [stats.categories]);

  // Calendar Engine
  const calendarData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Previous month padding
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ day: null, dateStr: null });
    }
    // Current month days
    for (let day = 1; day <= lastDateOfMonth; day++) {
      const date = new Date(year, month, day);
      const offset = date.getTimezoneOffset() * 60000;
      const dateStr = new Date(date.getTime() - offset).toISOString().split('T')[0];
      const dayExpenses = state.expenses.filter(e => e.date === dateStr);
      const total = dayExpenses.reduce((s, e) => s + e.amount, 0);
      days.push({ day, dateStr, total, count: dayExpenses.length });
    }
    return days;
  }, [calendarDate, state.expenses]);

  const selectedDayExpenses = useMemo(() => {
    if (!selectedCalendarDate) return [];
    return state.expenses.filter(e => e.date === selectedCalendarDate);
  }, [selectedCalendarDate, state.expenses]);

  return (
    <div className="pb-24 space-y-4 sm:space-y-6">
      
      {/* Header Actions */}
      <div className="bg-surface rounded-2xl p-2 shadow-sm border border-gray-100 dark:border-gray-800 flex gap-2">
        <div className="flex-1 flex items-center bg-gray-50 dark:bg-gray-900/50 rounded-xl px-3 border border-gray-100 dark:border-white/5">
          <span className="text-gray-400 mr-2">🔍</span>
          <input 
            className="flex-1 bg-transparent py-2.5 text-sm focus:outline-none placeholder:text-text-light font-medium"
            placeholder="Search records..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
           onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
           className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all active:scale-95 shadow-sm ${viewMode === 'calendar' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-primary'}`}
        >
           {viewMode === 'list' ? <span className="text-xl">📅</span> : <span className="text-xl">☰</span>}
        </button>
      </div>

      {viewMode === 'list' ? (
        <>
          <div className="bg-surface rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
             <h3 className="text-xs font-black text-text-light uppercase tracking-widest mb-6">Expense Weightage</h3>
             <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888811" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                        formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Spent']}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} onClick={(data) => data && toggleCategory(data.name)} cursor="pointer">
                         {chartData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : 'var(--secondary)'} opacity={0.8} />
                         ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
            {['today', 'week', 'month', 'all'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t as any)}
                className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-tight transition-all active:scale-95 ${
                  filterType === t 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-white dark:bg-gray-800 text-text-light border border-gray-200 dark:border-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {roast && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 animate-shake">
               <p className="text-xs font-bold text-red-600 dark:text-red-400 leading-relaxed italic">"{roast}"</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-primary to-pink-600 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden group">
               <div className="relative z-10">
                 <div className="text-[10px] opacity-80 uppercase font-black tracking-widest mb-1">Total Period Spend</div>
                 <div className={`text-2xl font-black tracking-tighter mask-value`}>₹{stats.total.toLocaleString()}</div>
                 <div className="text-[10px] mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-full font-bold">{filteredExpenses.length} Txns</div>
               </div>
               <button 
                 onClick={handleRoast}
                 disabled={isRoasting}
                 className="absolute bottom-2 right-2 bg-white/20 hover:bg-white/40 p-2 rounded-xl text-xs font-black backdrop-blur-md transition-all active:scale-90"
               >
                 {isRoasting ? '🔥...' : '🔥 ROAST'}
               </button>
            </div>
            <div className="bg-surface rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
               <div className="flex justify-between items-center text-[10px] font-black uppercase mb-1.5 tracking-tighter">
                 <span className="text-text-light">{state.settings.person1Name}</span>
                 <span className="text-primary mask-value">₹{stats.p1Real.toFixed(0)}</span>
               </div>
               <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-2 mb-3 overflow-hidden">
                 <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{width: `${stats.total > 0 ? (stats.p1Real/stats.total)*100 : 0}%`}}></div>
               </div>
               <div className="flex justify-between items-center text-[10px] font-black uppercase mb-1.5 tracking-tighter">
                 <span className="text-text-light">{state.settings.person2Name}</span>
                 <span className="text-secondary mask-value">₹{stats.p2Real.toFixed(0)}</span>
               </div>
               <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-2 overflow-hidden">
                 <div className="bg-secondary h-full rounded-full transition-all duration-1000" style={{width: `${stats.total > 0 ? (stats.p2Real/stats.total)*100 : 0}%`}}></div>
               </div>
            </div>
          </div>

          <div className="space-y-4">
             {stats.categories.map((cat) => (
               <div key={cat.name} className="bg-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-all hover:shadow-md">
                  <button 
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex justify-between items-center p-4"
                  >
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-2xl border border-gray-100 dark:border-white/5">
                           {state.settings.categoryIcons?.[cat.name] || '📦'}
                        </div>
                        <div className="text-left">
                           <div className="font-bold text-text text-sm">{cat.name}</div>
                           <div className="text-[10px] text-text-light uppercase font-black tracking-widest">{cat.expenses.length} txns</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="text-right">
                           <div className="font-black text-primary mask-value text-sm">₹{cat.total.toLocaleString()}</div>
                           <div className="text-[10px] text-text-light uppercase font-black">{((cat.total / stats.total) * 100).toFixed(0)}% share</div>
                        </div>
                        <span className={`text-text-light transition-transform duration-300 ${expandedCategories.includes(cat.name) ? 'rotate-180' : ''}`}>▼</span>
                     </div>
                  </button>

                  {expandedCategories.includes(cat.name) && (
                    <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-900/30 animate-slide-up bg-gray-50/30 dark:bg-black/10">
                       {cat.expenses.map(exp => (
                         <div key={exp.id} className="p-4 flex justify-between items-start group">
                            <div className="flex gap-4">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                 exp.person === 'Person1' ? 'bg-blue-100 text-blue-600' : 
                                 exp.person === 'Person2' ? 'bg-orange-100 text-orange-600' : 
                                 'bg-purple-100 text-purple-600'
                               }`}>
                                 {exp.person === 'Both' ? '👫' : (exp.person === 'Person1' ? state.settings.person1Name[0] : state.settings.person2Name[0])}
                               </div>
                               <div>
                                  <div className="text-sm font-bold text-text italic leading-tight">{exp.note || 'Unlabeled Expense'}</div>
                                  <div className="flex gap-2 mt-1.5 text-[9px] text-text-light uppercase font-black tracking-widest">
                                     <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{new Date(exp.date).toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}</span>
                                     <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{exp.paymentMode}</span>
                                  </div>
                               </div>
                            </div>
                            <div className="flex flex-col items-end">
                               <div className="font-black text-sm mask-value">₹{exp.amount.toLocaleString()}</div>
                               <div className="flex gap-1 mt-2">
                                  <button onClick={() => editExpense(exp)} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:scale-110 transition-transform">✏️</button>
                                  <button onClick={() => deleteExpense(exp.id)} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:scale-110 text-red-500 transition-transform">🗑️</button>
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
               </div>
             ))}
          </div>
        </>
      ) : (
        <div className="animate-fade-in space-y-6">
           {/* Month Nav */}
           <div className="bg-surface rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <button 
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} 
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl active:scale-90 transition-all"
              >
                ◀
              </button>
              <div className="font-black text-sm uppercase tracking-[0.2em] text-primary">
                 {calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </div>
              <button 
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} 
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl active:scale-90 transition-all"
              >
                ▶
              </button>
           </div>

           {/* Calendar Grid */}
           <div className="bg-surface rounded-3xl p-3 shadow-xl border border-gray-100 dark:border-gray-800">
              <div className="grid grid-cols-7 mb-4">
                 {['S','M','T','W','T','F','S'].map(d => (
                   <div key={d} className="text-center text-[10px] font-black text-text-light/50">{d}</div>
                 ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                 {calendarData.map((d, i) => (
                   <button 
                    key={i} 
                    disabled={!d.day}
                    onClick={() => d.dateStr && setSelectedCalendarDate(selectedCalendarDate === d.dateStr ? null : d.dateStr)}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all active:scale-90 ${
                      !d.day ? 'opacity-0 cursor-default' : 
                      selectedCalendarDate === d.dateStr ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-black bg-primary/10' : 'bg-gray-50 dark:bg-gray-900/50'
                    }`}
                   >
                      {d.day && (
                        <>
                           <span className={`text-[11px] font-black z-10 ${selectedCalendarDate === d.dateStr ? 'text-primary' : 'text-text'}`}>{d.day}</span>
                           {d.total > 0 && (
                             <div 
                               className="absolute inset-1 rounded-xl transition-all" 
                               style={{ 
                                 backgroundColor: d.total > 2000 ? 'var(--primary)' : 'var(--secondary)',
                                 opacity: Math.min(0.05 + (d.total / 5000), 0.3) 
                               }}
                             />
                           )}
                           {d.total > 0 && (
                             <div className="w-1 h-1 rounded-full bg-primary mt-1 shadow-[0_0_4px_var(--primary)] animate-pulse"></div>
                           )}
                        </>
                      )}
                   </button>
                 ))}
              </div>
           </div>

           {/* Daily Breakdown for Selected Date */}
           {selectedCalendarDate && (
             <div className="animate-slide-up space-y-3">
                <div className="flex justify-between items-center px-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-text-light">Breakdown for {new Date(selectedCalendarDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</h4>
                  <div className="text-xs font-black text-primary">₹{selectedDayExpenses.reduce((s,e) => s+e.amount, 0).toLocaleString()}</div>
                </div>
                
                {selectedDayExpenses.length === 0 ? (
                  <div className="bg-surface rounded-2xl p-8 text-center text-xs text-text-light/50 font-bold border border-dashed border-gray-200 dark:border-gray-800">
                    No transactions found for this day.
                  </div>
                ) : (
                  selectedDayExpenses.map(exp => (
                    <div key={exp.id} className="bg-surface rounded-2xl p-4 flex justify-between items-center shadow-sm border border-gray-100 dark:border-gray-800">
                       <div className="flex gap-3 items-center">
                          <span className="text-xl">{state.settings.categoryIcons?.[exp.category] || '📦'}</span>
                          <div>
                             <div className="text-sm font-bold">{exp.note || exp.category}</div>
                             <div className="text-[10px] text-text-light font-black uppercase">{exp.person} • {exp.paymentMode}</div>
                          </div>
                       </div>
                       <div className="text-right">
                          <div className="text-sm font-black text-primary">₹{exp.amount.toLocaleString()}</div>
                       </div>
                    </div>
                  ))
                )}
             </div>
           )}

           {!selectedCalendarDate && (
             <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/20 text-center flex flex-col items-center">
                <div className="text-3xl mb-2">💡</div>
                <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest leading-relaxed">
                  Tap a date to view all transactions recorded on that day.
                </p>
             </div>
           )}
        </div>
      )}
    </div>
  );
};
