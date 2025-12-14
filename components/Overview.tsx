import React, { useState, useEffect } from 'react';
import { AppState, Expense } from '../types';
import { generateFinancialInsights, suggestSmartBudget } from '../services/geminiService';

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
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [showCatBudgets, setShowCatBudgets] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Trigger animations on mount
  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  // Calculations
  const totalIncome = state.incomePerson1 + state.incomePerson2 + state.otherIncome.reduce((sum, i) => sum + i.amount, 0);
  const fixedTotal = state.fixedPayments.reduce((sum, p) => sum + p.amount, 0);
  
  // Expenses this month
  const now = new Date();
  const monthExpenses = state.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  
  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const moneyLeft = totalIncome - (monthTotal + fixedTotal);
  const savingsPercent = totalIncome > 0 ? ((moneyLeft / totalIncome) * 100).toFixed(1) : '0';

  // Category Spending
  const categorySpending = monthExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

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

  const handleGenerateInsights = async () => {
    setLoadingInsight(true);
    setInsight(null);
    const result = await generateFinancialInsights(state);
    setInsight(result);
    setLoadingInsight(false);
  };

  const handleSmartBudget = async () => {
    if (state.expenses.length < 5) {
      alert("Please add at least 5 expenses so I can learn your habits!");
      return;
    }
    if (!confirm("AI will analyze your history and overwrite your current budget settings. Continue?")) return;
    
    setLoadingBudget(true);
    try {
      const result = await suggestSmartBudget(state);
      if (result.totalBudget > 0) {
        updateBudget(result.totalBudget);
        updateState({ categoryBudgets: result.categoryBudgets || {} });
        setShowCatBudgets(true);
      }
    } catch (e) {
      alert("Failed to generate budget plan.");
    } finally {
      setLoadingBudget(false);
    }
  };

  return (
    <div className="pb-24 space-y-4 sm:space-y-6">
      
      {/* Income Section */}
      <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-gray-800 transition-shadow hover:shadow-md">
        <h3 className="text-lg font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2">
          <span>💰</span> Monthly Income
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="group">
             <label className="text-xs text-text-light mb-1 block group-focus-within:text-primary transition-colors">{state.settings.person1Name}</label>
             <input 
               type="number" 
               className="w-full p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm sm:text-base"
               value={state.incomePerson1 || ''}
               onChange={e => updateIncome(parseFloat(e.target.value) || 0, state.incomePerson2)}
               placeholder="0"
             />
          </div>
          <div className="group">
             <label className="text-xs text-text-light mb-1 block group-focus-within:text-primary transition-colors">{state.settings.person2Name}</label>
             <input 
               type="number" 
               className="w-full p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm sm:text-base"
               value={state.incomePerson2 || ''}
               onChange={e => updateIncome(state.incomePerson1, parseFloat(e.target.value) || 0)}
               placeholder="0"
             />
          </div>
        </div>
      </div>

      {/* Budget Section */}
      <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-gray-800 transition-shadow hover:shadow-md relative overflow-hidden">
         <div className="flex justify-between items-center mb-3 sm:mb-4">
           <h3 className="text-lg font-bold text-primary flex items-center gap-2">
             <span>📉</span> Monthly Budget
           </h3>
           <div className="flex gap-2">
            <button 
              onClick={handleSmartBudget}
              disabled={loadingBudget}
              className="text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1 active:scale-95"
            >
              {loadingBudget ? <span className="animate-spin">🌀</span> : '🪄'} Auto-Plan
            </button>
            <button onClick={() => setShowCatBudgets(!showCatBudgets)} className="text-xs text-secondary font-medium hover:bg-secondary/10 px-2 py-1 rounded transition-colors">
              {showCatBudgets ? 'Hide Categories' : 'Category Budgets'}
            </button>
           </div>
         </div>
         
         <input 
            type="number" 
            className="w-full p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-background mb-4 focus:border-secondary focus:ring-0 transition-all text-lg font-semibold"
            value={state.monthlyBudget || ''}
            onChange={e => updateBudget(parseFloat(e.target.value) || 0)}
            placeholder="Set Total Monthly Budget"
         />
         {state.monthlyBudget > 0 && (
           <div className="text-sm mt-2">
             <div className="flex justify-between mb-1 text-text-light font-medium">
               <span>Used: {((monthTotal / state.monthlyBudget) * 100).toFixed(0)}%</span>
               <span className={monthTotal > state.monthlyBudget ? "text-red-500 font-bold" : "text-green-500"}>
                 ₹{monthTotal} / ₹{state.monthlyBudget}
               </span>
             </div>
             <div className="w-full bg-gray-100 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
               <div 
                 className={`h-full rounded-full transition-all duration-1000 ease-out ${monthTotal > state.monthlyBudget ? 'bg-red-500' : 'bg-gradient-to-r from-green-400 to-green-500'}`} 
                 style={{ width: mounted ? `${Math.min(((monthTotal / state.monthlyBudget) * 100), 100)}%` : '0%' }}
               ></div>
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
                     <span className="font-medium text-text">{cat}</span>
                     <div className="flex gap-2 items-center">
                       <span className={spent > budget && budget > 0 ? "text-red-500 font-bold" : "text-text-light"}>₹{spent}</span>
                       <input 
                         type="number" 
                         className="w-20 p-1 text-right border rounded bg-background focus:border-secondary transition-colors"
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
      <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-gray-800 transition-shadow hover:shadow-md">
        <h3 className="text-lg font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2">
          <span>🎯</span> Savings Goals
        </h3>
        <div className="space-y-3 mb-4 sm:mb-6">
          {state.savingsGoals.map(goal => {
            const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            return (
              <div key={goal.id} className="p-3 sm:p-4 bg-background rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                 {/* Background pattern/effect could go here */}
                <div className="flex justify-between mb-2 relative z-10">
                  <span className="font-bold text-text text-sm sm:text-base">{goal.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-medium text-text-light">₹{goal.currentAmount} / ₹{goal.targetAmount}</span>
                    <button onClick={() => deleteGoal(goal.id)} className="text-text-light hover:text-red-500 transition-colors p-1">✕</button>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3 dark:bg-gray-700 overflow-hidden relative z-10">
                   <div className="bg-gradient-to-r from-accent to-orange-400 h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: mounted ? `${pct}%` : '0%' }}>
                      {/* Shimmer effect */}
                      <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 w-full animate-[shimmer_2s_infinite] translate-x-[-100%]"></div>
                   </div>
                </div>
                <div className="flex gap-2 justify-end relative z-10">
                   <button onClick={() => updateGoal(goal.id, 500)} className="text-xs px-2 py-1 sm:px-3 sm:py-1.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors active:scale-95">+500</button>
                   <button onClick={() => updateGoal(goal.id, 1000)} className="text-xs px-2 py-1 sm:px-3 sm:py-1.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors active:scale-95">+1k</button>
                   <button onClick={() => updateGoal(goal.id, 5000)} className="text-xs px-2 py-1 sm:px-3 sm:py-1.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors active:scale-95">+5k</button>
                </div>
              </div>
            );
          })}
          {state.savingsGoals.length === 0 && (
            <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-text-light text-sm">
              No goals set. Start saving for that dream!
            </div>
          )}
        </div>
        
        <div className="flex gap-2 p-2 bg-background rounded-xl border border-gray-200 dark:border-gray-700">
          <input className="flex-1 p-2 bg-transparent text-sm focus:outline-none" placeholder="New Goal Name" value={goalForm.name} onChange={e => setGoalForm({...goalForm, name: e.target.value})} />
          <input className="w-16 sm:w-20 p-2 bg-transparent text-sm border-l border-gray-200 dark:border-gray-700 focus:outline-none" type="number" placeholder="Target" value={goalForm.target} onChange={e => setGoalForm({...goalForm, target: e.target.value})} />
          <button onClick={handleAddGoal} className="bg-accent text-white w-10 h-10 rounded-lg flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-90 shadow-md">
            <span>+</span>
          </button>
        </div>
      </div>

      {/* Fixed Payments */}
      <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-gray-800 transition-shadow hover:shadow-md">
        <h3 className="text-lg font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2">
           <span>📅</span> Fixed Monthly Payments
        </h3>
        <div className="flex gap-2 mb-4 p-2 bg-background rounded-xl border border-gray-200 dark:border-gray-700">
          <input className="flex-1 p-2 bg-transparent text-sm focus:outline-none" placeholder="Name" value={fixedPayForm.name} onChange={e => setFixedPayForm({...fixedPayForm, name: e.target.value})} />
          <input className="w-14 sm:w-16 p-2 bg-transparent text-sm border-l border-gray-200 dark:border-gray-700 focus:outline-none" type="number" placeholder="Amt" value={fixedPayForm.amount} onChange={e => setFixedPayForm({...fixedPayForm, amount: e.target.value})} />
          <input className="w-10 sm:w-12 p-2 bg-transparent text-sm border-l border-gray-200 dark:border-gray-700 focus:outline-none" type="number" placeholder="Day" max="31" value={fixedPayForm.day} onChange={e => setFixedPayForm({...fixedPayForm, day: e.target.value})} />
          <button onClick={handleAddFixed} className="bg-secondary text-white w-10 h-10 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors active:scale-90 shadow-md">
             <span>+</span>
          </button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
           {state.fixedPayments.map(p => (
             <div key={p.id} className="flex justify-between items-center text-sm p-3 bg-background rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors group">
               <div className="flex items-center gap-3">
                 <span className="w-6 h-6 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-[10px] font-bold">{p.day}</span>
                 <span>{p.name}</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="font-bold">₹{p.amount}</span>
                 <button 
                   onClick={() => handleApplyFixedPayment(p.id)}
                   title="Add to Expenses"
                   className="bg-primary/10 text-primary px-3 py-1 rounded-md text-xs font-medium hover:bg-primary hover:text-white transition-colors active:scale-95"
                 >
                   Pay
                 </button>
                 <button onClick={() => removeFixedPayment(p.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100">✕</button>
               </div>
             </div>
           ))}
           {state.fixedPayments.length === 0 && <span className="text-text-light text-xs italic p-2 block text-center">No fixed payments added.</span>}
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