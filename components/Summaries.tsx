import React, { useState, useMemo } from 'react';
import { AppState, Expense } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { roastSpending } from '../services/geminiService';

interface SummariesProps {
  state: AppState;
  deleteExpense: (id: number) => void;
  editExpense: (expense: Expense) => void;
}

const COLORS = ['#e91e63', '#2196f3', '#ff9800', '#4caf50', '#9c27b0', '#00bcd4', '#795548', '#3f51b5', '#8bc34a', '#f44336'];
const PAYMENT_MODES = ['all', 'UPI', 'Card', 'Cash', 'Netbanking', 'Wallet', 'Other'];

export const Summaries: React.FC<SummariesProps> = ({ state, deleteExpense, editExpense }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Roast State
  const [roast, setRoast] = useState<string | null>(null);
  const [loadingRoast, setLoadingRoast] = useState(false);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const handlePaymentFilterClick = (mode: string) => {
    setPaymentFilter(mode);
    if (mode !== 'all' && filterType !== 'all') {
      setFilterType('all');
    }
  };

  const handleRoast = async () => {
    setLoadingRoast(true);
    const result = await roastSpending(state);
    setRoast(result);
    setLoadingRoast(false);
  };

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    // Normalize today to local YYYY-MM-DD to match storage
    const offset = now.getTimezoneOffset() * 60000;
    const todayStr = new Date(now.getTime() - offset).toISOString().split('T')[0];
    
    return state.expenses.filter(exp => {
      // Search Term
      if (searchTerm && !exp.note.toLowerCase().includes(searchTerm.toLowerCase()) && !String(exp.amount).includes(searchTerm)) {
        return false;
      }
      
      // Payment Mode Filter
      if (paymentFilter !== 'all' && exp.paymentMode !== paymentFilter) {
        return false;
      }

      // Date Filter
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
    const catMap: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};

    filteredExpenses.forEach(e => {
      if (e.person === 'Person1') p1 += e.amount;
      else if (e.person === 'Person2') p2 += e.amount;
      else shared += e.amount;

      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
      
      // Short date for bar chart
      const day = new Date(e.date).toLocaleDateString(undefined, {weekday: 'short'});
      dailyMap[day] = (dailyMap[day] || 0) + e.amount;
    });

    const total = p1 + p2 + shared;
    const p1Real = p1 + (shared / 2);
    const p2Real = p2 + (shared / 2);

    const chartData = Object.keys(catMap)
      .map(k => ({ name: k, value: catMap[k] }))
      .sort((a,b) => b.value - a.value);

    // Last 7 entries for bar chart (just rough approximation for "Recent activity")
    const barData = Object.keys(dailyMap).map(k => ({name: k, amount: dailyMap[k]})).slice(0, 7);

    return { total, p1, p2, shared, p1Real, p2Real, chartData, barData };
  }, [filteredExpenses, state.settings]);

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    
    // Empty slots for start of month
    for(let i=0; i<firstDay; i++) days.push(null);
    for(let i=1; i<=daysInMonth; i++) days.push(new Date(year, month, i));
    
    return days;
  };

  return (
    <div className="pb-24 space-y-4 sm:space-y-6">
      
      {/* Search Bar & Toggle (Persistent) */}
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
           title={viewMode === 'list' ? "Switch to Calendar" : "Switch to List"}
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

          {/* Payment Filters */}
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
            <div className="bg-gradient-to-br from-primary to-pink-600 rounded-xl p-4 text-white shadow-lg">
               <div className="text-xs opacity-80 uppercase font-bold">Total Spent</div>
               <div className="text-2xl font-bold">₹{stats.total.toFixed(0)}</div>
               <div className="text-[10px] mt-1 opacity-80">{filteredExpenses.length} transactions</div>
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

          {/* Roast Button */}
          <div className="flex justify-center">
             <button 
               onClick={handleRoast} 
               disabled={loadingRoast}
               className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full text-xs font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-2"
             >
               {loadingRoast ? 'Cooking...' : '🔥 Roast My Spending'}
             </button>
          </div>
          {roast && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-xl text-sm italic text-red-800 dark:text-red-200 animate-slide-up">
              "{roast}"
            </div>
          )}

          {/* Charts Section */}
          {stats.chartData.length > 0 && (
            <div className="space-y-4">
              
              {/* Donut Chart */}
              <div className="bg-surface rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-800">
                 <h4 className="text-sm font-bold text-text-light uppercase mb-4">Expense Distribution</h4>
                 <div className="h-64 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={stats.chartData}
                         cx="50%"
                         cy="50%"
                         innerRadius={65}
                         outerRadius={85}
                         paddingAngle={3}
                         dataKey="value"
                         stroke="none"
                       >
                         {stats.chartData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Pie>
                       <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', backgroundColor: 'var(--surface)', color: 'var(--text)'}} 
                          formatter={(value: number) => `₹${value}`}
                       />
                       <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
              </div>

              {/* Breakdown Table */}
              <div className="bg-surface rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs text-text-light uppercase">
                    <tr>
                      <th className="px-4 py-3 font-bold">Category</th>
                      <th className="px-4 py-3 font-bold text-right">Amount</th>
                      <th className="px-4 py-3 font-bold text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {stats.chartData.map((item, idx) => {
                      const percentage = ((item.value / stats.total) * 100).toFixed(1);
                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3 flex items-center gap-2">
                             <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></span>
                             {item.name}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">₹{item.value.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-text-light text-xs">{percentage}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bar Chart Trend */}
              <div className="bg-surface rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-bold text-text-light uppercase mb-4">Spending Activity</h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.barData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888'}} dy={10} />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{fill: 'rgba(0,0,0,0.05)'}}
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                      />
                      <Bar dataKey="amount" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* Recent Transactions List */}
          <div>
             <h4 className="text-sm font-bold text-text-light uppercase mb-3 ml-1">Recent Activity</h4>
             <div className="space-y-3">
               {filteredExpenses.map((exp) => (
                 <div key={exp.id} className="bg-surface p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-start group hover:border-primary/30 transition-colors">
                   <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                        exp.person === 'Person1' ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/20' : 
                        exp.person === 'Person2' ? 'bg-orange-50 text-orange-500 dark:bg-orange-900/20' : 
                        'bg-purple-50 text-purple-500 dark:bg-purple-900/20'
                      }`}>
                        {state.settings.categoryIcons?.[exp.category] || '💸'}
                      </div>
                      <div>
                        <div className="font-bold text-text text-sm sm:text-base">{exp.category}</div>
                        <div className="text-xs text-text-light flex items-center gap-1">
                          <span>{new Date(exp.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                          <span>•</span>
                          <span className="italic">{exp.note || 'No note'}</span>
                        </div>
                        <div className="mt-1 flex gap-1">
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-text-light uppercase">{exp.paymentMode}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-text-light">
                            {exp.person === 'Both' ? 'Shared' : (exp.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name)}
                          </span>
                        </div>
                      </div>
                   </div>
                   <div className="flex flex-col items-end gap-2">
                     <div className="font-bold text-base sm:text-lg text-primary">₹{exp.amount}</div>
                     
                     <div className="flex gap-1">
                       <button 
                         onClick={() => editExpense(exp)}
                         className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                         title="Edit"
                       >
                         ✏️
                       </button>
                       <button 
                         onClick={() => deleteExpense(exp.id)} 
                         className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                         title="Delete"
                       >
                         🗑️
                       </button>
                     </div>
                   </div>
                 </div>
               ))}
               {filteredExpenses.length === 0 && (
                 <div className="text-center py-10 opacity-50">
                   <div className="text-4xl mb-2">🍃</div>
                   <div>No expenses found</div>
                 </div>
               )}
             </div>
          </div>
        </>
      ) : (
        /* Calendar View */
        <div className="bg-surface rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-2 sm:p-4 animate-fade-in">
          {/* Calendar Header */}
          <div className="flex justify-between items-center mb-4">
             <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() - 1)))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">◀</button>
             <h3 className="font-bold text-lg">{calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
             <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() + 1)))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
             {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="text-xs font-bold text-text-light uppercase">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
             {getDaysInMonth(calendarMonth).map((date, idx) => {
               if (!date) return <div key={idx} className="aspect-square"></div>;
               
               // Fix: Match date strings correctly using local time logic
               const offset = date.getTimezoneOffset() * 60000;
               const dayStr = new Date(date.getTime() - offset).toISOString().split('T')[0];
               
               // Use filteredExpenses so search works in calendar too
               const dailyTotal = filteredExpenses
                 .filter(e => e.date === dayStr)
                 .reduce((sum, e) => sum + e.amount, 0);
               
               const fixedDue = state.fixedPayments.some(p => p.day === date.getDate());

               const isToday = new Date().toDateString() === date.toDateString();

               return (
                 <div key={idx} className={`aspect-square rounded-lg border flex flex-col items-center justify-between p-1 transition-all hover:border-primary cursor-pointer relative ${isToday ? 'bg-primary/5 border-primary' : 'bg-background border-transparent'}`}>
                    <span className={`text-[10px] sm:text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-text-light'}`}>{date.getDate()}</span>
                    
                    {dailyTotal > 0 && (
                      <span className="text-[8px] sm:text-[10px] font-bold text-text truncate w-full text-center">₹{dailyTotal >= 1000 ? (dailyTotal/1000).toFixed(1)+'k' : dailyTotal}</span>
                    )}

                    {/* Indicators */}
                    <div className="flex gap-0.5">
                      {fixedDue && <div className="w-1.5 h-1.5 rounded-full bg-secondary" title="Bill Due"></div>}
                      {dailyTotal > 0 && <div className="w-1.5 h-1.5 rounded-full bg-primary" title="Spent"></div>}
                    </div>
                 </div>
               );
             })}
          </div>
          
          <div className="mt-4 flex gap-4 justify-center text-xs text-text-light">
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary"></div> Expense</div>
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-secondary"></div> Fixed Bill</div>
          </div>
        </div>
      )}

    </div>
  );
};