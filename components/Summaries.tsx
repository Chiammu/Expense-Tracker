
import React, { useState, useMemo } from 'react';
import { AppState, Expense } from '../types';
import { roastSpending } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MerchantDashboard } from './MerchantDashboard';

interface SummariesProps {
  state: AppState;
  deleteExpense: (id: string) => void;
  editExpense: (expense: Expense) => void;
}

export const Summaries: React.FC<SummariesProps> = ({ state, deleteExpense, editExpense }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showMerchants, setShowMerchants] = useState(false);

  // Roast State
  const [roast, setRoast] = useState<string | null>(null);
  const [isRoasting, setIsRoasting] = useState(false);

  // Accordion state
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

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
      console.error("Roast error:", e);
      // Show the actual error message
      const errorMsg = e.message || e.toString();
      if (errorMsg.includes("API Key is missing")) {
        setRoast("⚠️ AI features require a Gemini API key. Please add GEMINI_API_KEY to your .env file. Get one free at: https://aistudio.google.com/app/apikey");
      } else if (errorMsg.includes("quota") || errorMsg.includes("429")) {
        setRoast("⚠️ AI quota exhausted. Try again later or get a new API key at: https://aistudio.google.com/app/apikey");
      } else {
        setRoast(`⚠️ AI Error: ${errorMsg}. Your spending is so chaotic it broke my circuits!`);
      }
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

  // Calendar Logic
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, dateStr: null });
    }
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const offset = d.getTimezoneOffset() * 60000;
      const dateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
      const dayExpenses = state.expenses.filter(e => e.date === dateStr);
      const total = dayExpenses.reduce((s, e) => s + e.amount, 0);
      days.push({ day: i, dateStr, total, count: dayExpenses.length });
    }
    return days;
  }, [calendarDate, state.expenses]);

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
          onClick={() => setShowMerchants(!showMerchants)}
          className={`w-12 flex items-center justify-center rounded-lg transition-colors shadow-sm ${showMerchants ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-primary'}`}
        >
          <span className="text-xl">🏪</span>
        </button>
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
          className={`w-12 flex items-center justify-center rounded-lg transition-colors shadow-sm ${viewMode === 'calendar' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-primary'}`}
        >
          {viewMode === 'list' ? <span className="text-xl">📅</span> : <span className="text-xl">☰</span>}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(['today', 'week', 'month', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap border ${filterType === f ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-md' : 'bg-surface text-text-light border-gray-100 dark:border-gray-800'}`}
          >
            {f === 'all' ? 'All Time' : f === 'month' ? 'This Month' : f === 'week' ? 'This Week' : 'Today'}
          </button>
        ))}
      </div>

      {/* Merchant Dashboard - shown when enabled */}
      {showMerchants && viewMode === 'list' && (
        <MerchantDashboard expenses={filteredExpenses} />
      )}

      {viewMode === 'list' ? (
        <>


          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-primary to-pink-600 rounded-xl p-4 text-white shadow-lg relative overflow-hidden group">
              <div className="relative z-10">
                <div className="text-xs opacity-80 uppercase font-bold">Total Spent</div>
                <div className={`text-2xl font-bold mask-value`}>₹{stats.total.toFixed(0)}</div>
                <div className="text-[10px] mt-1 opacity-80">{filteredExpenses.length} transactions</div>
              </div>
            </div>
            <div className="bg-surface rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold text-text-light">{state.settings.person1Name}</span>
                <span className="font-bold text-text mask-value">₹{stats.p1Real.toFixed(0)}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mb-2 overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: `${stats.total > 0 ? (stats.p1Real / stats.total) * 100 : 0}%` }}></div>
              </div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold text-text-light">{state.settings.person2Name}</span>
                <span className="font-bold text-text mask-value">₹{stats.p2Real.toFixed(0)}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div className="bg-accent h-full rounded-full" style={{ width: `${stats.total > 0 ? (stats.p2Real / stats.total) * 100 : 0}%` }}></div>
              </div>
            </div>
          </div>

          <button
            onClick={handleRoast}
            disabled={isRoasting}
            className="w-full bg-surface dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl flex items-center justify-center gap-3 shadow-sm hover:shadow-md transition-all active:scale-95 group"
          >
            <span className="text-2xl group-hover:animate-bounce">🔥</span>
            <span className="font-black text-text dark:text-gray-100 tracking-wide uppercase text-sm">
              {isRoasting ? 'Preparing Roast...' : 'Roast My Spending'}
            </span>
          </button>

          {roast && (
            <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl p-6 shadow-lg border-2 border-orange-200 dark:border-orange-800 animate-slide-up">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🔥</span>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-orange-800 dark:text-orange-300 uppercase tracking-widest mb-2">AI Roast</h3>
                  <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                    {roast}
                  </p>
                  <button 
                    onClick={() => setRoast(null)}
                    className="mt-4 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 font-bold uppercase tracking-wide"
                  >
                    Dismiss 🙈
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-surface rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-black text-text-light uppercase tracking-widest mb-4">Spending breakdown</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [`₹${val}`, 'Spent']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} onClick={(data) => data && toggleCategory(data.name)} cursor="pointer">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : 'var(--secondary)'} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            {stats.categories.map((cat) => (
              <div key={cat.name} id={`cat-${cat.name}`} className="bg-surface rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all">
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
                      <div className="font-black text-primary mask-value">₹{cat.total.toLocaleString()}</div>
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${exp.person === 'Person1' ? 'bg-blue-100 text-blue-600' :
                            exp.person === 'Person2' ? 'bg-orange-100 text-orange-600' :
                              'bg-purple-100 text-purple-600'
                            }`}>
                            {exp.person === 'Both' ? '👫' : (exp.person === 'Person1' ? state.settings.person1Name[0] : state.settings.person2Name[0])}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-text italic leading-tight">{exp.note || 'No note'}</div>
                            <div className="flex gap-2 mt-1 text-[10px] text-text-light uppercase font-black">
                              <span>{new Date(exp.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                              <span>•</span>
                              <span>{exp.paymentMode}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="font-bold text-sm mask-value">₹{exp.amount}</div>
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
          </div>

          <div className="bg-surface rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-black text-text-light uppercase tracking-widest">Recent Activity</h3>
            </div>
            <div className="space-y-3">
              {filteredExpenses.slice(0, 10).map(exp => (
                <div key={exp.id} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${exp.person === 'Person1' ? 'bg-blue-100 text-blue-600' :
                      exp.person === 'Person2' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'
                      }`}>
                      {exp.person === 'Both' ? '👫' : (exp.person === 'Person1' ? state.settings.person1Name[0] : state.settings.person2Name[0])}
                    </div>
                    <div onClick={() => editExpense(exp)} className="cursor-pointer">
                      <div className="text-sm font-bold text-text hover:underline">{exp.category}</div>
                      <div className="text-[10px] text-text-light">{new Date(exp.date).toLocaleDateString()} • {exp.note || 'No note'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-sm mask-value">₹{exp.amount}</div>
                    <button onClick={() => editExpense(exp)} className="text-gray-400 hover:text-primary p-1">✏️</button>
                  </div>
                </div>
              ))}
              {filteredExpenses.length > 10 && (
                <p className="text-center text-[10px] text-text-light pt-2">Showing last 10 transactions</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="animate-fade-in space-y-4">
          {/* Month Navigation */}
          <div className="bg-surface rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <button onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() - 1)))} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl">◀</button>
            <div className="font-black text-sm uppercase tracking-widest text-primary">
              {calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </div>
            <button onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() + 1)))} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl">▶</button>
          </div>

          {/* Calendar Grid */}
          <div className="bg-surface rounded-2xl p-2 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="grid grid-cols-7 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                <div key={d} className="text-center text-[10px] font-black text-text-light">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((d, i) => (
                <div key={i} className={`aspect-square rounded-lg flex flex-col items-center justify-center relative ${d.day ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}>
                  {d.day && (
                    <>
                      <span className="text-[10px] font-bold z-10">{d.day}</span>
                      {d.total > 0 && (
                        <div
                          className={`absolute inset-0 rounded-lg transition-all ${d.total > 1000 ? 'bg-primary/20' : 'bg-secondary/10'}`}
                          style={{ opacity: Math.min(d.total / 5000, 1) }}
                        />
                      )}
                      {d.total > 0 && <div className="text-[7px] font-black text-primary mt-0.5 z-10 mask-value">₹{d.total.toFixed(0)}</div>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <p className="text-[10px] text-text-light text-center">Tap on a day in the future update to view daily breakdown.</p>
          </div>
        </div>
      )}
    </div>
  );
};
