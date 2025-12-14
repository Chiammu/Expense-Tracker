import React, { useState, useMemo } from 'react';
import { AppState, Expense } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { roastSpending } from '../services/geminiService';

interface SummariesProps {
  state: AppState;
  deleteExpense: (id: number) => void;
  editExpense: (expense: Expense) => void;
}

const COLORS = ['#e91e63', '#2196f3', '#ff9800', '#4caf50', '#9c27b0', '#00bcd4', '#795548', '#3f51b5', '#8bc34a', '#f44336'];
const PAYMENT_MODES = ['all', 'UPI', 'Card', 'Cash', 'Netbanking', 'Wallet', 'Other'];

export const Summaries: React.FC<SummariesProps> = ({ state, deleteExpense, editExpense }) => {
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
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
        const firstDay = new Date(now);
        firstDay.setDate(now.getDate() - now.getDay()); // Sunday
        const lastDay = new Date(firstDay);
        lastDay.setDate(firstDay.getDate() + 6); // Saturday
        return expDateOnly >= firstDay && expDateOnly <= lastDay;
      } else if (filterType === 'month') {
        return expDateOnly.getMonth() === today.getMonth() && expDateOnly.getFullYear() === today.getFullYear();
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

    const chartData = Object.keys(catMap).map(k => ({ name: k, value: catMap[k] }));
    const personData = [
      { name: state.settings.person1Name, value: p1Real },
      { name: state.settings.person2Name, value: p2Real }
    ];

    return { total, p1, p2, shared, p1Real, p2Real, chartData, personData };
  }, [filteredExpenses, state.settings]);

  return (
    <div className="pb-24 space-y-4 sm:space-y-6">
      
      {/* Search Bar */}
      <div className="bg-surface rounded-xl p-2 shadow-sm border border-gray-100 dark:border-gray-800">
        <input 
          className="w-full bg-transparent p-2 text-sm focus:outline-none placeholder:text-text-light"
          placeholder="Search expenses..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

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

      {/* Charts */}
      {stats.chartData.length > 0 && (
        <div className="bg-surface rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-800">
           <h4 className="text-sm font-bold text-text-light uppercase mb-4">Category Breakdown</h4>
           <div className="h-64 w-full">
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
                    contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                    formatter={(value: number) => `₹${value}`}
                 />
                 <Legend verticalAlign="bottom" height={36} iconType="circle" />
               </PieChart>
             </ResponsiveContainer>
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
                    {exp.category === 'Food' ? '🍔' : 
                     exp.category === 'Travel' ? '🚕' : 
                     exp.category === 'Shopping' ? '🛍️' : 
                     exp.category === 'Groceries' ? '🥦' : '💸'}
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
                   {/* Edit Button with Symbol */}
                   <button 
                     onClick={() => editExpense(exp)}
                     className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                     title="Edit"
                   >
                     ✏️
                   </button>
                   
                   {/* Delete Button */}
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

    </div>
  );
};