
import React, { useState, useEffect } from 'react';
import { AppState, Expense, OtherIncome } from '../types';
import { generateFinancialInsights } from '../services/geminiService';

interface OverviewProps {
  state: AppState;
  updateBudget: (val: number) => void;
  updateIncome: (p1: number, p2: number) => void;
  addFixedPayment: (name: string, amt: number, day: number) => void;
  removeFixedPayment: (id: number) => void;
  updateState: (newState: Partial<AppState>) => void; // General updater
}

export const Overview: React.FC<OverviewProps> = ({ state, updateBudget, updateIncome, addFixedPayment, removeFixedPayment, updateState }) => {
  const [fixedPayForm, setFixedPayForm] = useState({ name: '', amount: '', day: '' });
  const [goalForm, setGoalForm] = useState({ name: '', target: '', current: '' });
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [showCatBudgets, setShowCatBudgets] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Other Income Form
  const [otherIncForm, setOtherIncForm] = useState({ desc: '', amount: '' });
  const [showOtherIncome, setShowOtherIncome] = useState(false);

  // Trigger animations on mount
  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  // Calculations
  const otherIncomeTotal = state.otherIncome.reduce((sum, i) => sum + i.amount, 0);
  const totalIncomeValue = (state.incomePerson1 || 0) + (state.incomePerson2 || 0) + otherIncomeTotal;
  const fixedTotal = state.fixedPayments.reduce((sum, p) => sum + p.amount, 0);
  
  // Expenses this month
  const now = new Date();
  const monthExpenses = state.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  
  // Calculate spending per category for the current month
  const categorySpending = monthExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const moneyLeft = totalIncomeValue - (monthTotal + fixedTotal);
  const savingsPercent = totalIncomeValue > 0 ? ((moneyLeft / totalIncomeValue) * 100).toFixed(1) : '0';

  // Salary Day Logic
  const getSalaryInfo = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const getLastWorkingDay = (y: number, m: number) => {
      let d = new Date(y, m + 1, 0);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
      return d;
    };

    let targetDate = getLastWorkingDay(year, month);
    
    if (today.getDate() > targetDate.getDate()) {
      targetDate = getLastWorkingDay(year, month + 1);
    }

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let color = 'from-blue-500 to-indigo-600';
    let message = "Keep grinding!";
    let subMessage = "Days until financial relief.";

    if (diffDays === 0) {
      color = 'from-green-500 to-emerald-600 animate-pulse';
      message = "IT'S PAYDAY! 🤑";
      subMessage = "Invest first, then enjoy (a little)!";
    } else if (diffDays <= 3) {
      color = 'from-yellow-400 to-orange-500';
      message = "Almost there! 🦅";
      subMessage = "Hold your horses, don't spend yet!";
    } else if (diffDays <= 10) {
      color = 'from-indigo-500 to-purple-600';
      message = "Light at the tunnel! 🕯️";
      subMessage = "You've survived the worst part.";
    } else if (diffDays > 20) {
      color = 'from-red-500 to-rose-600';
      message = "Discouragingly far... 🍜";
      subMessage = "Hide your credit cards. Seriously.";
    } else {
      color = 'from-slate-700 to-slate-900';
      message = "The Mid-Month Crunch 🛡️";
      subMessage = "Budgeting is a superpower. Use it.";
    }

    return { diffDays, color, message, subMessage, targetDate };
  };

  const salaryInfo = getSalaryInfo();

  const handleAddFixed = () => {
    if (!fixedPayForm.name || !fixedPayForm.amount || !fixedPayForm.day) return;
    addFixedPayment(fixedPayForm.name, parseFloat(fixedPayForm.amount), parseInt(fixedPayForm.day));
    setFixedPayForm({ name: '', amount: '', day: '' });
  };

  const handleApplyFixedPayment = (id: number) => {
    const payment = state.fixedPayments.find(p => p.id === id);
    if (!payment) return;
    
    if (confirm(`Add expense "${payment.name}" of ₹${payment.amount}?`)) {
      const newExp: Expense = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        amount: payment.amount,
        category: 'Bills',
        person: 'Both',
        paymentMode: 'Netbanking',
        note: `Fixed: ${payment.name}`
      };
      updateState({ expenses: [...state.expenses, newExp] });
    }
  };

  const handleAddGoal = () => {
    if (!goalForm.name || !goalForm.target) return;
    const newGoal = {
      id: Date.now(),
      name: goalForm.name,
      targetAmount: parseFloat(goalForm.target),
      currentAmount: parseFloat(goalForm.current) || 0
    };
    updateState({ savingsGoals: [...state.savingsGoals, newGoal] });
    setGoalForm({ name: '', target: '', current: '' });
  };

  const updateGoal = (id: number, addedAmount: number) => {
    const goals = state.savingsGoals.map(g => 
      g.id === id ? { ...g, currentAmount: g.currentAmount + addedAmount } : g
    );
    updateState({ savingsGoals: goals });
  };

  const deleteGoal = (id: number) => {
    updateState({ savingsGoals: state.savingsGoals.filter(g => g.id !== id) });
  };

  const addOtherIncome = () => {
    if (!otherIncForm.desc || !otherIncForm.amount) return;
    const newInc: OtherIncome = {
      id: Date.now(),
      desc: otherIncForm.desc,
      amount: parseFloat(otherIncForm.amount)
    };
    updateState({ otherIncome: [...state.otherIncome, newInc] });
    setOtherIncForm({ desc: '', amount: '' });
  };

  const removeOtherIncome = (id: number) => {
    updateState({ otherIncome: state.otherIncome.filter(i => i.id !== id) });
  };

  const handleGenerateInsights = async () => {
    setLoadingInsight(true);
    setInsight(null);
    const result = await generateFinancialInsights(state);
    setInsight(result);
    setLoadingInsight(false);
  };

  return (
    <div className="pb-24 space-y-4 sm:space-y-6">
      
      {/* Salary Countdown Card */}
      <div className={`bg-gradient-to-r ${salaryInfo.color} p-5 rounded-2xl text-white shadow-xl relative overflow-hidden transition-all duration-700`}>
        <div className="relative z-10">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] uppercase font-black tracking-widest opacity-70">Next Salary Wave</div>
              <h2 className="text-2xl font-black mb-1">{salaryInfo.message}</h2>
            </div>
            <div className="text-right">
              <span className="text-4xl font-black leading-none">{salaryInfo.diffDays}</span>
              <span className="block text-[10px] uppercase font-bold opacity-70">Days left</span>
            </div>
          </div>
          <p className="text-xs font-medium opacity-90 mt-2">{salaryInfo.subMessage}</p>
          
          <div className="mt-4 h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
             <div 
               className="h-full bg-white transition-all duration-1000 ease-out"
               style={{ width: `${Math.max(0, 100 - (salaryInfo.diffDays * 3.3))}%` }}
             ></div>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-6 text-8xl opacity-10 rotate-12 pointer-events-none">
          {salaryInfo.diffDays === 0 ? '🍾' : (salaryInfo.diffDays <= 5 ? '🚁' : '⏳')}
        </div>
      </div>

      {/* Income Section */}
      <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-gray-800 transition-shadow hover:shadow-md">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-bold text-primary flex items-center gap-2">
             <span>💰</span> Monthly Income
           </h3>
           <div className="text-[10px] sm:text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
             Total: ₹{totalIncomeValue.toLocaleString()}
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
          <div className="group">
             <label className="text-[11px] font-bold text-text-light mb-1.5 block group-focus-within:text-primary transition-colors">{state.settings.person1Name}</label>
             <input 
               type="number" 
               className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold"
               value={state.incomePerson1 || ''}
               onChange={e => updateIncome(parseFloat(e.target.value) || 0, state.incomePerson2)}
               placeholder="0"
             />
          </div>
          <div className="group">
             <label className="text-[11px] font-bold text-text-light mb-1.5 block group-focus-within:text-primary transition-colors">{state.settings.person2Name}</label>
             <input 
               type="number" 
               className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold"
               value={state.incomePerson2 || ''}
               onChange={e => updateIncome(state.incomePerson1, parseFloat(e.target.value) || 0)}
               placeholder="0"
             />
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
          <button 
             onClick={() => setShowOtherIncome(!showOtherIncome)}
             className="text-xs font-bold text-text-light flex items-center gap-1 hover:text-primary transition-colors"
          >
             {showOtherIncome ? '▼' : '▶'} Other Income Sources (₹{otherIncomeTotal})
          </button>
          
          {showOtherIncome && (
            <div className="mt-3 animate-slide-up space-y-2">
               {state.otherIncome.map(inc => (
                 <div key={inc.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <span>{inc.desc}</span>
                    <div className="flex items-center gap-2">
                       <span className="font-bold">₹{inc.amount}</span>
                       <button onClick={() => removeOtherIncome(inc.id)} className="text-gray-400 hover:text-red-500">×</button>
                    </div>
                 </div>
               ))}
               <div className="flex flex-col sm:flex-row gap-2">
                 <input 
                   className="flex-1 p-2 bg-background border border-gray-200 dark:border-gray-700 rounded-lg text-xs" 
                   placeholder="Source (e.g. Freelance)"
                   value={otherIncForm.desc}
                   onChange={e => setOtherIncForm({...otherIncForm, desc: e.target.value})}
                 />
                 <div className="flex gap-2">
                   <input 
                     className="flex-1 sm:w-20 p-2 bg-background border border-gray-200 dark:border-gray-700 rounded-lg text-xs" 
                     type="number"
                     placeholder="Amt"
                     value={otherIncForm.amount}
                     onChange={e => setOtherIncForm({...otherIncForm, amount: e.target.value})}
                   />
                   <button onClick={addOtherIncome} className="bg-secondary text-white px-4 rounded-lg text-lg leading-none hover:bg-secondary/90">+</button>
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Budget Section */}
      <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-gray-800 transition-shadow hover:shadow-md relative overflow-hidden">
         <div className="flex justify-between items-center mb-3 sm:mb-4">
           <h3 className="text-lg font-bold text-primary flex items-center gap-2">
             <span>📉</span> Monthly Budget
           </h3>
           <button onClick={() => setShowCatBudgets(!showCatBudgets)} className="text-xs text-secondary font-medium hover:bg-secondary/10 px-3 py-1.5 rounded-full transition-colors bg-gray-50 dark:bg-gray-800">
              {showCatBudgets ? 'Hide Breakdown' : 'Category Split'}
           </button>
         </div>
         
         <div className="mb-4">
           <div className="relative">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light font-bold">₹</span>
             <input 
                type="number" 
                className="w-full pl-8 pr-3 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border-none focus:ring-2 focus:ring-primary/20 transition-all text-xl font-bold text-text"
                value={state.monthlyBudget || ''}
                onChange={e => updateBudget(parseFloat(e.target.value) || 0)}
                placeholder="0"
             />
           </div>
           <p className="text-[10px] text-text-light mt-1.5 ml-1">Set your total spending limit for the month</p>
         </div>

         {state.monthlyBudget > 0 && (
           <div className="text-sm mt-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl">
             <div className="flex justify-between mb-2 text-text font-medium">
               <span>Spent: ₹{monthTotal}</span>
               <span className={monthTotal > state.monthlyBudget ? "text-red-500" : "text-green-500"}>
                 {((monthTotal / state.monthlyBudget) * 100).toFixed(0)}% Used
               </span>
             </div>
             <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
               <div 
                 className={`h-full rounded-full transition-all duration-1000 ease-out ${monthTotal > state.monthlyBudget ? 'bg-red-500' : 'bg-gradient-to-r from-green-400 to-green-500'}`} 
                 style={{ width: mounted ? `${Math.min(((monthTotal / state.monthlyBudget) * 100), 100)}%` : '0%' }}
               ></div>
             </div>
             <div className="text-xs text-text-light mt-2 text-right">
               Remaining: ₹{Math.max(state.monthlyBudget - monthTotal, 0)}
             </div>
           </div>
         )}

         {/* Category Budgets */}
         {showCatBudgets && (
           <div className="mt-4 space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700 animate-slide-up">
             {state.settings.customCategories.map(cat => {
               const budget = state.categoryBudgets[cat] || 0;
               const spent = categorySpending[cat] || 0;
               return (
                 <div key={cat} className="group">
                   <div className="flex justify-between text-xs mb-1 items-center">
                     <span className="font-medium text-text flex items-center gap-1">
                        {state.settings.categoryIcons?.[cat]} {cat}
                     </span>
                     <div className="flex gap-2 items-center">
                       <span className={spent > budget && budget > 0 ? "text-red-500 font-bold" : "text-text-light"}>₹{spent}</span>
                       <input 
                         type="number" 
                         className="w-20 p-1 text-right border-none rounded bg-gray-100 dark:bg-gray-800 focus:ring-1 focus:ring-secondary transition-all"
                         placeholder="Limit"
                         value={budget || ''}
                         onChange={e => updateState({ 
                           categoryBudgets: { ...state.categoryBudgets, [cat]: parseFloat(e.target.value) || 0 } 
                         })}
                       />
                     </div>
                   </div>
                   {budget > 0 && (
                     <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                       <div 
                         className={`h-full rounded-full transition-all duration-700 ease-out ${spent > budget ? 'bg-red-500' : 'bg-secondary'}`} 
                         style={{ width: mounted ? `${Math.min(((spent / budget) * 100), 100)}%` : '0%' }}
                       />
                     </div>
                   )}
                 </div>
               );
             })}
           </div>
         )}
      </div>

      {/* Savings Goals */}
      <div className="bg-surface rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-800 transition-shadow hover:shadow-md">
        <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
          <span>🎯</span> Savings Goals
        </h3>
        <div className="space-y-3 mb-6">
          {state.savingsGoals.map(goal => {
            const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            return (
              <div key={goal.id} className="p-4 bg-background rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                <div className="flex justify-between mb-2 relative z-10">
                  <span className="font-bold text-text text-base">{goal.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-light">₹{goal.currentAmount} / ₹{goal.targetAmount}</span>
                    <button onClick={() => deleteGoal(goal.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">✕</button>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4 dark:bg-gray-700 overflow-hidden relative z-10">
                   <div className="bg-gradient-to-r from-accent to-orange-400 h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: mounted ? `${pct}%` : '0%' }}>
                      <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 w-full animate-[shimmer_2s_infinite] translate-x-[-100%]"></div>
                   </div>
                </div>
                <div className="flex gap-2 justify-end relative z-10">
                   <button onClick={() => updateGoal(goal.id, 500)} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors active:scale-95 border border-green-200 dark:border-green-900">+500</button>
                   <button onClick={() => updateGoal(goal.id, 1000)} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors active:scale-95 border border-green-200 dark:border-green-900">+1k</button>
                   <button onClick={() => updateGoal(goal.id, 5000)} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors active:scale-95 border border-green-200 dark:border-green-900">+5k</button>
                </div>
              </div>
            );
          })}
          {state.savingsGoals.length === 0 && (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-text-light text-sm">
              <span className="text-2xl block mb-2">🏔️</span>
              No goals set. Start saving for that dream!
            </div>
          )}
        </div>
        
        <div className="flex gap-2 p-2 bg-background rounded-xl border border-gray-200 dark:border-gray-700">
          <input className="flex-1 p-2 bg-transparent text-sm focus:outline-none" placeholder="New Goal Name" value={goalForm.name} onChange={e => setGoalForm({...goalForm, name: e.target.value})} />
          <input className="w-20 p-2 bg-transparent text-sm border-l border-gray-200 dark:border-gray-700 focus:outline-none text-center" type="number" placeholder="Target" value={goalForm.target} onChange={e => setGoalForm({...goalForm, target: e.target.value})} />
          <button onClick={handleAddGoal} className="bg-accent text-white w-10 h-10 rounded-lg flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-90 shadow-md">
            <span>+</span>
          </button>
        </div>
      </div>

      {/* Fixed Payments */}
      <div className="bg-surface rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-800 transition-all hover:shadow-md">
        <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
           <span>📅</span> Fixed Payments
        </h3>
        
        {/* Responsive Grid-based Add Form */}
        <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 mb-4">
           <input 
              className="col-span-2 sm:col-span-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl px-3 py-2 text-sm border-none focus:ring-2 focus:ring-primary/20 placeholder:text-gray-400"
              placeholder="Name"
              value={fixedPayForm.name}
              onChange={e => setFixedPayForm({...fixedPayForm, name: e.target.value})}
           />
           <input 
              type="number"
              className="bg-gray-50 dark:bg-gray-900/50 rounded-xl px-3 py-2 text-sm border-none focus:ring-2 focus:ring-primary/20 placeholder:text-gray-400"
              placeholder="₹ Amt"
              value={fixedPayForm.amount}
              onChange={e => setFixedPayForm({...fixedPayForm, amount: e.target.value})}
           />
           <input 
              type="number"
              min="1"
              max="31"
              className="bg-gray-50 dark:bg-gray-900/50 rounded-xl px-3 py-2 text-sm border-none focus:ring-2 focus:ring-primary/20 text-center placeholder:text-gray-400"
              placeholder="Day"
              value={fixedPayForm.day}
              onChange={e => setFixedPayForm({...fixedPayForm, day: e.target.value})}
           />
           <button onClick={handleAddFixed} className="col-span-2 sm:col-span-1 bg-secondary text-white h-10 rounded-xl flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm font-bold">
              Add Fixed Payment
           </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
           {state.fixedPayments.map(p => (
             <div key={p.id} className="flex justify-between items-center text-sm p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors group">
               <div className="flex items-center gap-3">
                 <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 w-10 h-10 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <span className="text-[9px] text-text-light uppercase leading-none mt-0.5">Day</span>
                    <span className="text-lg font-bold text-secondary leading-none">{p.day}</span>
                 </div>
                 <span className="font-bold text-text">{p.name}</span>
               </div>
               <div className="flex items-center gap-3">
                 <span className="font-bold text-text">₹{p.amount}</span>
                 <button 
                   onClick={() => handleApplyFixedPayment(p.id)}
                   title="Add to Expenses"
                   className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors active:scale-95"
                 >
                   💸
                 </button>
                 <button onClick={() => removeFixedPayment(p.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">✕</button>
               </div>
             </div>
           ))}
           {state.fixedPayments.length === 0 && (
             <div className="text-center py-6 text-text-light text-sm italic bg-gray-50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
               No recurring payments set up.
             </div>
           )}
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
         <div className="bg-surface p-4 sm:p-5 rounded-xl shadow-sm text-center border border-gray-100 dark:border-gray-800 transition-transform hover:-translate-y-1">
            <div className="text-xs text-text-light uppercase tracking-wider font-semibold mb-1">Est. Savings</div>
            <div className={`text-xl sm:text-2xl font-bold ${moneyLeft >= 0 ? 'text-green-500' : 'text-red-500'}`}>₹{moneyLeft.toFixed(0)}</div>
         </div>
         <div className="bg-surface p-4 sm:p-5 rounded-xl shadow-sm text-center border border-gray-100 dark:border-gray-800 transition-transform hover:-translate-y-1">
            <div className="text-xs text-text-light uppercase tracking-wider font-semibold mb-1">Savings %</div>
            <div className="text-xl sm:text-2xl font-bold text-accent">{savingsPercent}%</div>
         </div>
      </div>

      {/* AI Insights */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white mb-4">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span>✨</span> AI Advisor
          </h3>
          <button 
            onClick={handleGenerateInsights}
            disabled={loadingInsight}
            className="text-xs bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 px-4 py-2 rounded-full transition-all disabled:opacity-50 active:scale-95 flex items-center gap-2"
          >
            {loadingInsight ? (
              <>
                <span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>
                Thinking...
              </>
            ) : 'Analyze'}
          </button>
        </div>
        
        {insight ? (
          <div className="relative z-10 text-sm leading-relaxed whitespace-pre-line text-indigo-50 animate-fade-in bg-black/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
            {insight}
          </div>
        ) : (
          <p className="relative z-10 text-sm text-indigo-100/80 italic">
            Tap 'Analyze' to reveal personalized insights about your spending patterns.
          </p>
        )}
      </div>

    </div>
  );
};
