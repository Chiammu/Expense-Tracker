import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Challenges } from './Challenges';
import { ErrorBoundary } from './ErrorBoundary';
import { useAppStore } from '../store/useStore';
import { formatCurrency } from '../utils/currencyFormatter';
import { cardVariant, pageVariant } from '../utils/motion';
import { CashFlowCalendar } from './CashFlowCalendar';
import { generateFinancialInsights as getSpendingInsights } from '../services/geminiService';

export const Overview: React.FC = () => {
  const state = useAppStore();
  const navigate = useNavigate();

  // For the AI Insights at the bottom
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Time calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const isThisMonth = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const isPrevMonth = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === prevMonthDate.getMonth() && d.getFullYear() === prevMonthDate.getFullYear();
  };

  const safeExpenses = state.expenses || [];
  const safeCashTx = state.cashWallet?.transactions || [];
  const safeFixed = state.fixedPayments || [];
  const safeGoals = state.savingsGoals || [];

  // 1. This Month Summary calculations
  const thisMonthNormalExpenses = safeExpenses.filter(e => e.category !== 'Income' && isThisMonth(e.date));
  const thisMonthCashExpenses = safeCashTx.filter(tx => tx.type === 'expense' && isThisMonth(tx.date));
  const totalSpentThisMonth = thisMonthNormalExpenses.reduce((acc, e) => acc + e.amount, 0) + thisMonthCashExpenses.reduce((acc, tx) => acc + tx.amount, 0);

  const prevMonthNormalExpenses = safeExpenses.filter(e => e.category !== 'Income' && isPrevMonth(e.date));
  const prevMonthCashExpenses = safeCashTx.filter(tx => tx.type === 'expense' && isPrevMonth(tx.date));
  const totalSpentPrevMonth = prevMonthNormalExpenses.reduce((acc, e) => acc + e.amount, 0) + prevMonthCashExpenses.reduce((acc, tx) => acc + tx.amount, 0);

  const thisMonthIncomeTx = safeExpenses.filter(e => e.category === 'Income' && isThisMonth(e.date)).reduce((acc, e) => acc + e.amount, 0);
  const totalIncomeThisMonth = (state.incomePerson1 || 0) + (state.incomePerson2 || 0) + thisMonthIncomeTx;

  const netSavingsThisMonth = totalIncomeThisMonth - totalSpentThisMonth;
  const spentDiff = totalSpentThisMonth - totalSpentPrevMonth;

  // 2. Budget Health
  const budget = state.monthlyBudget || 0;
  const spendPercent = budget > 0 ? Math.min((totalSpentThisMonth / budget) * 100, 100) : 0;
  const isOverBudget = budget > 0 && totalSpentThisMonth > budget;
  const isWatchlist = budget > 0 && totalSpentThisMonth > budget * 0.8 && !isOverBudget;
  const budgetStatus = isOverBudget ? 'Over Budget' : isWatchlist ? 'Watchlist' : 'On Track';
  const progressColor = isOverBudget ? 'bg-red-500' : isWatchlist ? 'bg-yellow-500' : 'bg-emerald-500';

  const categoryTotals: Record<string, number> = {};
  thisMonthNormalExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  let highestCategory = 'None';
  let highestAmount = 0;
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    if (amt > highestAmount) {
      highestAmount = amt;
      highestCategory = cat;
    }
  });

  // 3. Upcoming Bills
  const today = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const upcomingBills = [...safeFixed].map(bill => {
    let daysUntilDue = bill.day - today;
    if (daysUntilDue < 0) {
      daysUntilDue += daysInMonth; // Next month
    }
    return { ...bill, daysUntilDue };
  }).sort((a, b) => a.daysUntilDue - b.daysUntilDue).slice(0, 3);

  // 4. Recent Activity
  const recentExpenses = safeExpenses.map(e => ({
    id: e.id,
    title: e.note || e.category,
    amount: e.amount,
    date: e.date,
    type: e.category === 'Income' ? 'Income' : 'Expense',
    rawDate: new Date(e.date).getTime()
  }));
  const recentWallet = safeCashTx.map(tx => ({
    id: tx.id,
    title: tx.note || 'Cash Transaction',
    amount: tx.amount,
    date: tx.date,
    type: tx.type === 'expense' ? 'Cash Expense' : (tx.type === 'topup' ? 'Cash Add' : 'Cash Withdraw'),
    rawDate: new Date(tx.date).getTime()
  }));
  const recentActivity = [...recentExpenses, ...recentWallet]
    .sort((a, b) => b.rawDate - a.rawDate)
    .slice(0, 5);

  // 5. Savings Goals Snapshot
  const topGoals = [...safeGoals]
    .sort((a, b) => {
      const pA = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
      const pB = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
      return pB - pA;
    })
    .slice(0, 3);

  const containerVariants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const handleGenerateInsights = async () => {
    setLoadingInsight(true);
    try {
      const res = await getSpendingInsights(state);
      setInsight(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInsight(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'goals' | 'budgets' | 'challenges'>('goals');
  
  // Add contribute state
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);

  return (
    <div className="pb-32 space-y-6 animate-fade-in relative z-0">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Plan</h1>
          <p className="text-xs text-gray-500 font-medium">Manage your goals & budgets</p>
        </div>

        <div className="flex items-center w-full">
          <div className="bg-white dark:bg-[#1a1a1a] p-1 rounded-full flex shadow-sm border border-gray-100 dark:border-white/5 w-full">
            {(['goals', 'budgets', 'challenges'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`relative flex-1 py-2 rounded-full text-xs font-bold transition-colors duration-300 flex items-center justify-center gap-1 ${activeTab === t
                    ? 'text-white dark:text-black shadow-md'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
              >
                {activeTab === t && (
                  <motion.div layoutId="planTabIndicator" className="absolute inset-0 bg-black dark:bg-white rounded-full z-0" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10 transition-transform duration-300 inline-block" style={{ transform: activeTab === t ? 'scale(1.05)' : 'scale(1)' }}>
                  {t === 'goals' ? '🎯 Goals' : t === 'budgets' ? '📊 Budgets' : '🏆 Challenges'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4">
        <AnimatePresence mode="wait">
          {activeTab === 'goals' && (
            <motion.div key="goals" variants={pageVariant} initial="initial" animate="animate" exit="exit" className="space-y-6">
              {/* Savings Goals Snapshot */}
              <div className="flex justify-between items-center px-1 border-b border-gray-100 dark:border-white/5 pb-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">Active Goals</h3>
                <button 
                  onClick={() => navigate('/settings')} // Assuming goal settings are managed there or we could just show it
                  className="text-[10px] font-black uppercase tracking-wider text-primary hover:underline transition-all"
                >
                  Manage →
                </button>
              </div>

              {safeGoals.length > 0 ? (
                <div className="space-y-4">
                  {safeGoals.map((goal, idx) => {
                    const perc = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
                    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
                    
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={goal.id} 
                        className="bg-white dark:bg-[#121212] rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-white/5 group transition-all hover:shadow-md"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white text-lg">{goal.name}</h4>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                              Target: {formatCurrency(goal.targetAmount)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black text-primary font-mono">{perc.toFixed(0)}%</span>
                          </div>
                        </div>

                        <div className="relative h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-4">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${perc}%` }}
                            transition={{ duration: 1.2, delay: 0.1, ease: [0.25, 0.1, 0.25, 1.0] }}
                            className="absolute top-0 left-0 h-full bg-primary rounded-full"
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300">
                             {remaining > 0 ? `${formatCurrency(remaining)} remaining` : '🎉 Goal Achieved!'}
                          </div>
                          <button
                            onClick={() => {
                              const amountStr = prompt(`Contribute to "${goal.name}". Amount?`);
                              if (amountStr) {
                                const amount = parseFloat(amountStr);
                                if (!isNaN(amount) && amount > 0) {
                                  const updatedGoals = [...safeGoals];
                                  const goalIndex = updatedGoals.findIndex(g => g.id === goal.id);
                                  if (goalIndex >= 0) {
                                    updatedGoals[goalIndex] = {
                                      ...updatedGoals[goalIndex],
                                      currentAmount: updatedGoals[goalIndex].currentAmount + amount,
                                      updatedAt: Date.now()
                                    };
                                    state.setState({ savingsGoals: updatedGoals });
                                  }
                                }
                              }
                            }}
                            className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-4 py-2 rounded-xl text-xs font-bold shadow-sm"
                          >
                           + Contribute
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white dark:bg-[#121212] rounded-[24px] p-8 text-center border border-dashed border-gray-300 dark:border-white/10">
                  <div className="text-4xl mb-2">🎯</div>
                  <p className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">No savings goals yet</p>
                  <p className="text-xs text-gray-400 mb-4">Set up a goal to start tracking progress</p>
                  <button onClick={() => navigate('/settings')} className="bg-primary text-white px-6 py-2 rounded-full text-xs font-bold shadow-md hover:bg-primary-dark transition-colors">
                    Create Goal
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'budgets' && (
            <motion.div key="budgets" variants={pageVariant} initial="initial" animate="animate" exit="exit" className="space-y-6">
              
              {/* Monthly Overview */}
              <div className="bg-white dark:bg-[#121212] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                    isOverBudget ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' 
                    : isWatchlist ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' 
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                  }`}>
                    {budgetStatus}
                  </span>
                </div>

                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Monthly Budget Burn</h3>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-4xl font-black font-mono tracking-tight text-gray-900 dark:text-white">
                    {formatCurrency(totalSpentThisMonth)}
                  </span>
                  <span className="text-sm font-bold text-gray-400 mb-1">/ {formatCurrency(budget)}</span>
                </div>

                <div className="h-4 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-6 relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-black/10 dark:bg-white/20 z-10`} style={{ left: '80%' }}></div>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${spendPercent}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className={`h-full ${progressColor} rounded-full`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-white/5">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Safe to Spend</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white font-mono">
                      {budget > totalSpentThisMonth ? formatCurrency(budget - totalSpentThisMonth) : '₹0'}
                    </div>
                  </div>
                  <div>
                     <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Top Spend Concept</div>
                     <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{highestCategory}</div>
                  </div>
                </div>
              </div>

              {/* Category Budgets */}
              <div>
                <div className="flex justify-between items-center mb-4 px-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">Category Budgets</h3>
                  <button 
                    onClick={() => navigate('/summaries')}
                    className="text-[10px] font-black uppercase tracking-wider text-indigo-500 hover:underline transition-all"
                  >
                    View Stats →
                  </button>
                </div>
                
                {Object.keys(state.categoryBudgets || {}).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(state.categoryBudgets).map(([cat, catBudget]) => {
                       const catSpent = categoryTotals[cat] || 0;
                       const catPercent = catBudget > 0 ? Math.min((catSpent / catBudget) * 100, 100) : 0;
                       
                       const isCatOver = catBudget > 0 && catSpent > catBudget;
                       const isCatWatch = catBudget > 0 && catSpent > catBudget * 0.8 && !isCatOver;
                       const catProgressColor = isCatOver ? 'bg-red-500' : isCatWatch ? 'bg-yellow-500' : 'bg-emerald-500';

                       return (
                          <div key={cat} className="bg-white dark:bg-[#121212] rounded-[20px] p-4 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                 {cat}
                                 {isCatOver && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black uppercase">Over</span>}
                              </span>
                              <div className="text-right">
                                <span className="font-mono text-sm font-bold">{formatCurrency(catSpent)}</span>
                                <span className="text-[10px] text-gray-400 font-bold ml-1">/ {formatCurrency(catBudget)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${catPercent}%` }}
                                className={`h-full ${catProgressColor} rounded-full`}
                              />
                            </div>
                          </div>
                       );
                    })}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 italic">No category budgets set in settings.</p>
                )}
              </div>
              
              {/* Insight Wrapper */}
              <div className="pt-4">
                <motion.div variants={cardVariant} className="relative overflow-hidden bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] dark:from-[#121212] dark:to-[#1e1e1e] rounded-[24px] p-5 border border-gray-100 dark:border-white/[0.08] shadow-sm text-white">
                    <div className="absolute top-0 right-0 p-4 opacity-50 text-[10px] font-mono text-gray-500">AI.ADVISOR</div>
                    <div className="relative z-10 flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">✨ Quick Tips</h3>
                    <button onClick={handleGenerateInsights} disabled={loadingInsight} className="text-[10px] font-black uppercase tracking-wider bg-white/10 px-3 py-1.5 rounded border border-white/20 active:scale-95 transition-all">
                        {loadingInsight ? 'ANALYZING...' : 'ANALYZE'}
                    </button>
                    </div>
                    {insight && <div className="relative z-10 text-xs font-medium leading-relaxed bg-white/5 p-4 rounded-xl border border-white/10 mb-4 animate-fade-in">{insight}</div>}
                    <div className="relative z-10 text-[9px] font-medium text-gray-500 uppercase tracking-widest mt-2">
                    Insights are informational only.
                    </div>
                </motion.div>
              </div>

            </motion.div>
          )}

          {activeTab === 'challenges' && (
            <motion.div key="challenges" variants={pageVariant} initial="initial" animate="animate" exit="exit">
               <Challenges 
                  state={state}
                  updateState={state.setState}
                  showToast={() => {}} // Pass down a dummy or real toast if injected contextually. We can mock it for now since Overview doesn't get showToast passed to it in App.tsx
                  navigate={(path) => navigate('/' + path)}
               />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};


