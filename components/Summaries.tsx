import React, { useState, useMemo } from 'react';
import { AppState, Expense } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { roastSpending } from '../services/geminiService';

interface SummariesProps {
  state: AppState;
  deleteExpense: (id: number) => void;
}

const COLORS = ['#e91e63', '#2196f3', '#ff9800', '#4caf50', '#9c27b0', '#00bcd4', '#795548', '#3f51b5', '#8bc34a', '#f44336'];
const PAYMENT_MODES = ['all', 'UPI', 'Card', 'Cash', 'Netbanking', 'Wallet', 'Other'];

export const Summaries: React.FC<SummariesProps> = ({ state, deleteExpense }) => {
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'charts' | 'calendar'>('charts');
  
  // Roast State
  const [roast, setRoast] = useState<string | null>(null);
  const [loadingRoast, setLoadingRoast] = useState(false);

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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
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
      const expDate = new Date(exp.date);
      const expDateOnly = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());

      if (filterType === 'today') {
        return expDateOnly.getTime() === today.getTime();
      } else if (filterType === 'week') {
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
        const lastDay = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        return expDateOnly >= firstDay && expDateOnly <= lastDay;
      } else if (filterType === 'month') {
        return expDateOnly.getMonth() === today.getMonth() && expDateOnly.getFullYear() === today.getFullYear();
      }
      return true;
    });
  }, [state.expenses, filterType, paymentFilter, searchTerm]);

  const stats = useMemo(() => {
    let p1 = 0, p2 = 0, shared = 0;
    const catMap: Record<string, number> = {};

    filteredExpenses.forEach(e => {
      if (e.person === 'Person1') p1 += e.amount;
      else if (e.person === 'Person2') p2 += e.amount;
      else shared += e.amount;

      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });

    const total = p1 + p2 + shared;
    const p1Real = p1 + (shared / 2);
    const p2Real = p2 + (shared / 2);

    const chartData = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { p1Real, p2Real, shared, total, chartData };
  }, [filteredExpenses]);

  // Comparison Data
  const comparisonData = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;

    let current = 0;
    let previous = 0;

    state.expenses.forEach(e => {
       const d = new Date(e.date);
       const key = `${d.getFullYear()}-${d.getMonth()}`;
       if (key === currentMonthKey) current += e.amount;
       if (key === prevMonthKey) previous += e.amount;
    });

    return [
      { name: 'Last Month', amount: previous },
      { name: 'This Month', amount: current }
    ];
  }, [state.expenses]);

  // Calendar Data
  const calendarDays = useMemo(() => {
    if (filterType !== 'month') return [];
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
       const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
       const dailyTotal = state.expenses
         .filter(e => e.date === dateStr)
         .reduce((s, e) => s + e.amount, 0);
       days.push({ day: i, total: dailyTotal });
    }
    return days;
  }, [state.expenses, filterType]);

  const formatCurrency = (val: number) => '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="pb-24">
      {/* Roast Overlay Modal */}
      {roast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setRoast(null)}>
          <div className="bg-surface p-6 rounded-2xl shadow-2xl max-w-sm w-full relative border-2 border-primary" onClick={e => e.stopPropagation()}>
            <div className="text-4xl absolute -top-5 left-1/2 -translate-x-1/2 bg-surface p-2 rounded-full border border-primary">🔥</div>
            <h3 className="text-center font-bold text-lg mt-4 mb-2">The AI Has Spoken</h3>
            <p className="text-center text-gray-700 dark:text-gray-300 italic mb-6">"{roast}"</p>
            <button 
              onClick={() => setRoast(null)}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold"
            >
              I'll Do Better 😭
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-surface p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 mb-4 sticky top-0 z-20 flex gap-2">
        <input 
          type="text" 
          placeholder="🔍 Search expenses..." 
          className="w-full bg-background border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm focus:outline-none focus:border-primary"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <button 
          onClick={handleRoast}
          disabled={loadingRoast}
          className="bg-orange-500 text-white px-3 rounded-lg text-sm font-bold shadow hover:bg-orange-600 transition-colors active:scale-95 disabled:opacity-50"
          title="Roast my spending"
        >
          {loadingRoast ? '...' : '🔥'}
        </button>
      </div>

      <div className="bg-surface rounded-xl shadow-sm p-3 sm:p-4 mb-4 border border-gray-100 dark:border-gray-800 space-y-3">
        {/* Date Filters */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-semibold text-text-light uppercase tracking-wide">Date Range</div>
            <div className="flex bg-background rounded-lg p-1 border border-gray-200 dark:border-gray-700">
               <button onClick={() => setViewMode('charts')} className={`px-2 py-1 text-xs rounded ${viewMode === 'charts' ? 'bg-white dark:bg-gray-700 shadow text-primary' : 'text-text-light'}`}>Charts</button>
               <button onClick={() => setViewMode('calendar')} className={`px-2 py-1 text-xs rounded ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-700 shadow text-primary' : 'text-text-light'}`}>Calendar</button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(['today', 'week', 'month', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  filterType === f 
                    ? 'bg-primary text-white shadow-md' 
                    : 'bg-background text-text-light border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Mode Filters */}
        <div>
          <div className="text-xs font-semibold text-text-light mb-2 uppercase tracking-wide">Payment Mode</div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {PAYMENT_MODES.map(mode => (
              <button
                key={mode}
                onClick={() => handlePaymentFilterClick(mode)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  paymentFilter === mode 
                    ? 'bg-secondary text-white shadow-md' 
                    : 'bg-background text-text-light border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {mode === 'all' ? 'All Modes' : mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'charts' ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-surface p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
              <div className="text-[10px] sm:text-xs text-text-light uppercase tracking-wider mb-1">{state.settings.person1Name} Spent</div>
              <div className="text-xl sm:text-2xl font-bold text-primary">{formatCurrency(stats.p1Real)}</div>
              <div className="text-[10px] text-text-light mt-1 bg-secondary/10 text-secondary inline-block px-2 py-0.5 rounded">Incl. 50% shared</div>
            </div>
            <div className="bg-surface p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
              <div className="text-[10px] sm:text-xs text-text-light uppercase tracking-wider mb-1">{state.settings.person2Name} Spent</div>
              <div className="text-xl sm:text-2xl font-bold text-primary">{formatCurrency(stats.p2Real)}</div>
              <div className="text-[10px] text-text-light mt-1 bg-secondary/10 text-secondary inline-block px-2 py-0.5 rounded">Incl. 50% shared</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-surface p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
              <div className="text-[10px] sm:text-xs text-text-light uppercase tracking-wider mb-1">Total Shared</div>
              <div className="text-xl sm:text-2xl font-bold text-secondary">{formatCurrency(stats.shared)}</div>
            </div>
            <div className="bg-surface p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
              <div className="text-[10px] sm:text-xs text-text-light uppercase tracking-wider mb-1">Grand Total</div>
              <div className="text-xl sm:text-2xl font-bold text-accent">{formatCurrency(stats.total)}</div>
            </div>
          </div>

          {/* Monthly Comparison Chart */}
          {filterType === 'month' && (
            <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-100 dark:border-gray-800">
               <h3 className="text-lg font-bold text-primary mb-4">Monthly Trend</h3>
               <div className="h-48 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={comparisonData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} />
                     <YAxis hide />
                     <Tooltip 
                       contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                       itemStyle={{ color: 'var(--text)' }}
                       formatter={(val: number) => formatCurrency(val)}
                     />
                     <Bar dataKey="amount" fill="var(--secondary)" radius={[4, 4, 0, 0]} barSize={40} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>
          )}

          {/* Pie Chart */}
          <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-primary mb-4">Category Breakdown</h3>
            <div className="h-64 w-full">
              {stats.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                       itemStyle={{ color: 'var(--text)' }}
                       formatter={(val: number) => formatCurrency(val)}
                    />
                    <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-light">No data to display</div>
              )}
            </div>
          </div>
        </>
      ) : (
        // Calendar View
        <div className="bg-surface rounded-xl shadow-sm p-4 mb-4 sm:mb-6 border border-gray-100 dark:border-gray-800">
           <h3 className="text-lg font-bold text-primary mb-4 text-center">{new Date().toLocaleString('default', { month: 'long' })} Spending</h3>
           {filterType !== 'month' ? (
             <p className="text-center text-text-light py-8">Select 'Month' view to see calendar.</p>
           ) : (
             <div className="grid grid-cols-7 gap-1 sm:gap-2">
               {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-xs font-bold text-text-light">{d}</div>)}
               {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
               {calendarDays.map(d => (
                 <div key={d.day} className={`aspect-square flex flex-col items-center justify-center rounded-lg border text-xs ${
                   d.total === 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' :
                   d.total > (state.monthlyBudget / 30) * 1.5 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' :
                   'bg-background border-gray-200 dark:border-gray-700'
                 }`}>
                   <span className="font-bold text-text-light mb-1">{d.day}</span>
                   {d.total > 0 && <span className="text-[10px] text-primary font-bold">₹{Math.round(d.total/1000)}k</span>}
                 </div>
               ))}
             </div>
           )}
        </div>
      )}

      {/* Recent List */}
      <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-bold text-primary mb-4">Recent Expenses</h3>
        <div className="space-y-3">
          {filteredExpenses
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 20)
            .map(exp => (
              <div key={exp.id} className="flex justify-between items-center p-3 rounded-lg bg-background border border-gray-100 dark:border-gray-700">
                <div>
                  <div className="text-xs text-text-light mb-0.5">{new Date(exp.date).toLocaleDateString()}</div>
                  <div className="font-medium text-sm">{exp.note || exp.category}</div>
                  <div className="flex gap-1 mt-1">
                    <div className="inline-block bg-secondary/10 text-secondary text-[10px] px-1.5 py-0.5 rounded">
                      {exp.category}
                    </div>
                    <div className="inline-block bg-accent/10 text-accent text-[10px] px-1.5 py-0.5 rounded">
                      {exp.paymentMode}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{formatCurrency(exp.amount)}</div>
                  <div className="text-xs text-text-light">
                    {exp.person === 'Both' ? 'Shared' : (exp.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name)}
                  </div>
                  <button onClick={() => deleteExpense(exp.id)} className="text-red-500 text-xs mt-1 hover:underline">Delete</button>
                </div>
              </div>
            ))}
            {filteredExpenses.length === 0 && <p className="text-center text-text-light text-sm">No expenses found.</p>}
        </div>
      </div>
    </div>
  );
};