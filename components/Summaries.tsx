
import React, { useState, useMemo } from 'react';
import { AppState, Expense } from '../types';
import { roastSpending } from '../services/geminiService';
import { MerchantDashboard } from './MerchantDashboard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SplitBillModal } from './SplitBillModal';

interface SummariesProps {
  state: AppState;
  deleteExpense: (id: string) => void;
  editExpense: (expense: Expense) => void;
}

export const Summaries: React.FC<SummariesProps> = ({ state, deleteExpense, editExpense }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'custom-month' | 'all'>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0=Jan, 11=Dec
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Roast State
  const [roast, setRoast] = useState<string | null>(null);
  const [isRoasting, setIsRoasting] = useState(false);
  const [showMerchants, setShowMerchants] = useState(false);

  // Accordion state
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Split Bill State
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [expenseToSplit, setExpenseToSplit] = useState<Expense | undefined>(undefined);

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
      } else if (filterType === 'custom-month') {
        const d = new Date(exp.date + 'T00:00:00');
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.expenses, filterType, paymentFilter, searchTerm, viewMode, selectedMonth, selectedYear]);

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
      days.push({ day: null, dateStr: null, total: 0 }); // Fix implicit any or missing props if mapped
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
    <div className="pb-24 space-y-6 text-sm animate-fade-in">

      {/* Control Bar */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white dark:bg-[#1a1a1a] rounded-2xl p-1.5 flex items-center shadow-sm border border-gray-100 dark:border-white/5">
          <div className="w-8 h-8 flex items-center justify-center text-gray-400">🔍</div>
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search transactions..."
            className="bg-transparent flex-1 text-sm font-medium placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowMerchants(!showMerchants)}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${showMerchants ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white dark:bg-[#1a1a1a] text-gray-400 border border-gray-100 dark:border-white/5'}`}
        >
          🏷️
        </button>
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${viewMode === 'calendar' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-white dark:bg-[#1a1a1a] text-gray-400 border border-gray-100 dark:border-white/5'}`}
        >
          {viewMode === 'list' ? '📅' : '☰'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {(['today', 'week', 'month', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilterType(f); setShowMonthPicker(false); }}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${filterType === f
              ? 'bg-black dark:bg-white text-white dark:text-black border-transparent'
              : 'bg-transparent border-gray-200 dark:border-white/10 text-gray-400'}`}
          >
            {f === 'all' ? 'All Time' : f === 'month' ? 'This Month' : f === 'week' ? 'This Week' : 'Today'}
          </button>
        ))}
        <button
          onClick={() => { setFilterType('custom-month'); setShowMonthPicker(!showMonthPicker); }}
          className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${filterType === 'custom-month'
            ? 'bg-primary text-white border-transparent'
            : 'bg-transparent border-gray-200 dark:border-white/10 text-gray-400'}`}
        >
          <span>📅</span>
          <span>{filterType === 'custom-month' ? new Date(selectedYear, selectedMonth).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : 'Custom'}</span>
        </button>
      </div>

      {/* Month Picker */}
      {showMonthPicker && (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-4 shadow-2xl border border-gray-100 dark:border-white/5 animate-slide-up">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setSelectedYear(y => y - 1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10">‹</button>
            <span className="font-bold text-lg">{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => Math.min(y + 1, new Date().getFullYear()))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10">›</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
              <button
                key={m}
                disabled={selectedYear === new Date().getFullYear() && i > new Date().getMonth()}
                onClick={() => { setSelectedMonth(i); setFilterType('custom-month'); setShowMonthPicker(false); }}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${selectedMonth === i
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-gray-50 dark:bg-white/5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {showMerchants && <MerchantDashboard expenses={filteredExpenses} />}

      {viewMode === 'list' ? (
        <>
          {/* Total Card */}
          <div className="bg-gradient-to-br from-[#0f0f0f] to-[#1a1a1a] p-6 rounded-[28px] text-white shadow-xl border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 text-6xl">💸</div>
            <div className="relative z-10">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Spent</p>
              <h2 className="text-4xl font-mono font-medium tracking-tighter mb-4">₹{stats.total.toLocaleString()}</h2>

              <div className="space-y-3">
                {/* Person 1 Bar */}
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                    <span className="text-blue-400">{state.settings.person1Name}</span>
                    <span>₹{stats.p1Real.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.total ? (stats.p1Real / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>
                {/* Person 2 Bar */}
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                    <span className="text-purple-400">{state.settings.person2Name}</span>
                    <span>₹{stats.p2Real.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${stats.total ? (stats.p2Real / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Roast Button */}
          <button
            onClick={handleRoast}
            disabled={isRoasting}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            {isRoasting ? <span className="animate-spin">🔥</span> : <span>🔥 Roast My Spending</span>}
          </button>

          {/* Roast Display */}
          {roast && (
            <div className="bg-[#1a1a1a] rounded-[24px] p-6 border border-orange-500/20 shadow-xl animate-fade-in relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-6xl opacity-10">☠️</div>
              <h3 className="text-orange-500 font-black uppercase text-xs tracking-widest mb-2">AI Roast</h3>
              <p className="text-gray-300 text-sm leading-relaxed font-mono">{roast}</p>
              <button onClick={() => setRoast(null)} className="mt-4 text-[10px] font-bold text-gray-500 hover:text-white uppercase transition-colors">Dismiss</button>
            </div>
          )}

          {/* Chart */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Spending Breakdown</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 700 }} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', background: '#000', border: 'none', color: '#fff' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            {stats.categories.map(cat => (
              <div key={cat.name} className="bg-white dark:bg-[#1a1a1a] rounded-[20px] shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
                <button onClick={() => toggleCategory(cat.name)} className="w-full flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{state.settings.categoryIcons?.[cat.name] || '📦'}</span>
                    <div className="text-left">
                      <div className="font-bold text-sm">{cat.name}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase">{cat.expenses.length} txns</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono font-medium">₹{cat.total.toLocaleString()}</div>
                      <div className="text-[9px] font-bold text-gray-400">{((cat.total / stats.total) * 100).toFixed(0)}%</div>
                    </div>
                    <span className={`text-xs text-gray-400 transition-transform ${expandedCategories.includes(cat.name) ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </button>

                {expandedCategories.includes(cat.name) && (
                  <div className="bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5">
                    {cat.expenses.map(exp => (
                      <div key={exp.id} className="p-4 flex justify-between items-center hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${exp.person === 'Person1' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                            {exp.person === 'Person1' ? state.settings.person1Name[0] : (exp.person === 'Person2' ? state.settings.person2Name[0] : 'S')}
                          </div>
                          <div onClick={() => editExpense(exp)}>
                            <div className="text-xs font-bold text-text mb-0.5">{exp.note || 'No description'}</div>
                            <div className="text-[10px] text-gray-400">{new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-mono font-bold">₹{exp.amount}</span>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => editExpense(exp)} className="text-[10px] text-blue-500 font-bold">EDIT</button>
                            <button onClick={() => { setExpenseToSplit(exp); setShowSplitModal(true); }} className="text-[10px] text-purple-500 font-bold">SPLIT</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Recent Section */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">History</h3>
            <div className="space-y-4">
              {filteredExpenses.slice(0, 10).map(exp => (
                <div key={exp.id} className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center text-lg bg-gray-50 dark:bg-white/5`}>
                      {state.settings.categoryIcons?.[exp.category] || '📦'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text">{exp.category}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{exp.note || 'Uncategorized'} • {new Date(exp.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-bold">₹{exp.amount}</div>
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => deleteExpense(exp.id)} className="text-[10px] text-red-500 font-bold">DEL</button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && <p className="text-center text-gray-400 text-xs py-4">No transactions found.</p>}
            </div>
          </div>
        </>
      ) : (
        <div className="animate-fade-in space-y-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-4 flex justify-between items-center shadow-sm border border-gray-100 dark:border-white/5">
            <button onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() - 1)))} className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-white/5 hover:bg-gray-100">◀</button>
            <span className="font-bold text-lg">{calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() + 1)))} className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-white/5 hover:bg-gray-100">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="text-center text-[10px] font-black text-gray-400 py-2">{d}</div>)}
            {calendarDays.map((d, i) => (
              <div key={i} className={`aspect-square rounded-xl flex flex-col items-center justify-center relative ${d.day ? 'bg-white dark:bg-[#1a1a1a] border border-gray-50 dark:border-white/5' : ''}`}>
                {d.day && (
                  <>
                    <span className="text-[10px] font-bold z-10">{d.day}</span>
                    {d.total > 0 && (
                      <div
                        className={`absolute inset-0 rounded-xl ${d.total > 2000 ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}
                        style={{ opacity: Math.min(d.total / 5000 + 0.2, 1) }}
                      />
                    )}
                    {d.total > 0 && <span className="text-[8px] font-black z-10 mt-1">₹{(d.total / 1000).toFixed(1)}k</span>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showSplitModal && (
        <SplitBillModal
          expenses={filteredExpenses}
          onClose={() => setShowSplitModal(false)}
          preSelectedExpense={expenseToSplit}
        />
      )}

    </div>
  );
};
