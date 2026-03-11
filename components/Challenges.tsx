import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, Challenge, Section } from '../types';
import { CHALLENGE_TEMPLATES } from '../utils/challenges';
import { generateId } from '../utils/id';
import { fadeVariant, fadeUpVariant, cardVariant, spring } from '../utils/motion';

interface PlanProps {
    state: AppState;
    updateState: (updates: Partial<AppState>) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    navigate: (section: Section) => void;
}

type PlanTab = 'goals' | 'budgets' | 'challenges';
type ChallengeTab = 'active' | 'completed' | 'failed' | 'discover';

export const Challenges: React.FC<PlanProps> = ({ state, updateState, showToast, navigate }) => {
    const [activeTab, setActiveTab] = useState<PlanTab>('goals');
    
    // Challenges State
    const [challengeTab, setChallengeTab] = useState<ChallengeTab>('active');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [customTitle, setCustomTitle] = useState('');
    const [customType, setCustomType] = useState<Challenge['type']>('save_amount');
    const [customCategory, setCustomCategory] = useState(state.settings.customCategories[0]);
    const [customTarget, setCustomTarget] = useState('');
    const [customDuration, setCustomDuration] = useState('');
    const [customReward, setCustomReward] = useState('🏆 Custom Achievement');

    // Goals calculations
    const handleAddGoalFunds = (id: string, currentSaved: number) => {
        const amountStr = prompt("How much would you like to contribute to this goal?");
        if (!amountStr) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            showToast("Please enter a valid amount.", 'error');
            return;
        }

        const updatedGoals = state.savingsGoals.map(g => {
            if (g.id === id) {
                return { ...g, currentAmount: g.currentAmount + amount };
            }
            return g;
        });
        
        updateState({ savingsGoals: updatedGoals });
        showToast("Funds added to goal! 🎉", 'success');
    };

    // Budgets calculations (Current Month Only)
    const { currentMonthSpent, categorySpent } = useMemo(() => {
        let totalVal = 0;
        const cats: Record<string, number> = {};
        const d = new Date();
        const m = d.getMonth();
        const y = d.getFullYear();

        state.expenses.forEach(e => {
            const ed = new Date(e.date);
            if (ed.getMonth() === m && ed.getFullYear() === y) {
                totalVal += e.amount;
                cats[e.category] = (cats[e.category] || 0) + e.amount;
            }
        });
        
        return { currentMonthSpent: totalVal, categorySpent: cats };
    }, [state.expenses]);

    const budgetBurn = state.monthlyBudget > 0 ? (currentMonthSpent / state.monthlyBudget) * 100 : 0;
    
    const overspentCategories = useMemo(() => {
        return Object.entries(state.categoryBudgets)
            .filter(([cat, limit]) => (categorySpent[cat] || 0) > limit)
            .map(([cat, limit]) => ({
                cat, 
                limit, 
                spent: categorySpent[cat] || 0,
                over: (categorySpent[cat] || 0) - limit
            }))
            .sort((a,b) => b.over - a.over);
    }, [categorySpent, state.categoryBudgets]);

    // Challenges calculations
    const activeChallenges = state.challenges.filter(c => c.status === 'active');
    const completedChallenges = state.challenges.filter(c => c.status === 'completed');
    const failedChallenges = state.challenges.filter(c => c.status === 'failed');

    const startChallenge = (template: Partial<Challenge>) => {
        let durationDays = 30; // Default
        if (template.title?.includes('Week')) durationDays = 7;
        if (template.title?.includes('Weekend')) durationDays = 2;
        if (template.type === 'no_spend' && template.targetValue && template.targetValue < 100) {
            durationDays = template.targetValue;
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + durationDays);

        const newChallenge: Challenge = {
            id: generateId(),
            title: template.title || 'New Challenge',
            description: template.description || '',
            type: template.type || 'save_amount',
            targetValue: template.targetValue || 0,
            category: template.category,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status: 'active',
            progress: 0,
            reward: template.reward || '🏅 Challenger',
            updatedAt: Date.now()
        };

        updateState({ challenges: [...state.challenges, newChallenge] });
        showToast(`Started "${newChallenge.title}"! Good luck! 🍀`, 'success');
        setChallengeTab('active');
    };

    const handleCreateCustom = () => {
        if (!customTitle || !customTarget || !customDuration) {
            showToast("Please fill all fields", 'error');
            return;
        }

        const durationDays = parseInt(customDuration);
        const target = parseFloat(customTarget);

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + durationDays);

        const newChallenge: Challenge = {
            id: generateId(),
            title: customTitle,
            description: `Custom ${customType} challenge`,
            type: customType,
            targetValue: target,
            category: (customType === 'limit_category' || customType === 'no_spend') ? customCategory : undefined,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status: 'active',
            progress: 0,
            reward: customReward,
            updatedAt: Date.now()
        };

        updateState({ challenges: [...state.challenges, newChallenge] });
        showToast("Custom challenge created!", 'success');
        setShowCreateForm(false);
        setCustomTitle('');
        setCustomTarget('');
        setCustomDuration('');
        setChallengeTab('active');
    };

    const giveUpChallenge = (id: string) => {
        if (confirm("Are you sure you want to give up? 🥺")) {
            const updated = state.challenges.map(c =>
                c.id === id ? { ...c, status: 'failed' as const, updatedAt: Date.now() } : c
            );
            updateState({ challenges: updated });
            showToast("Challenge cancelled.", 'info');
        }
    };

    const updateProgress = (id: string, amount: number) => {
        const updated = state.challenges.map(c => {
            if (c.id === id) {
                const newProgress = Math.min(100, c.progress + (amount / c.targetValue * 100));
                const newStatus = newProgress >= 100 ? 'completed' : 'active';
                return { ...c, progress: newProgress, status: newStatus as any, updatedAt: Date.now() };
            }
            return c;
        });
        updateState({ challenges: updated });
        const c = updated.find(x => x.id === id);
        if (c?.status === 'completed') {
            showToast(`🎉 Challenge Completed! ${c.reward}`, 'success');
        }
    };

    return (
        <motion.div variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="pb-24 space-y-6">
            
            {/* Header & Tabs */}
            <div className="pt-2 px-4 pb-2">
              <h1 className="text-2xl font-black bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent mb-6 tracking-tight">
                  Your Plan
              </h1>
              
              <div className="flex bg-gray-100 dark:bg-[#1a1a1a] rounded-full p-1 border border-gray-200 dark:border-white/5 relative shadow-inner">
                  <motion.div
                    className="absolute top-1 bottom-1 bg-white dark:bg-white/10 shadow-sm rounded-full z-0"
                    animate={{
                      left: activeTab === 'goals' ? '1%' : activeTab === 'budgets' ? '33.5%' : '66.5%',
                      width: '32.5%'
                    }}
                    transition={spring}
                  />
                  {(['goals', 'budgets', 'challenges'] as const).map((tab) => (
                    <button
                        key={tab}
                        className={`flex-1 py-2.5 rounded-full text-xs font-bold relative z-10 transition-colors uppercase tracking-wider ${activeTab === tab ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                  ))}
              </div>
            </div>

            <div className="px-4">
              <AnimatePresence mode="wait">
                  
                  {/* GOALS */}
                  {activeTab === 'goals' && (
                      <motion.div key="goals" variants={fadeUpVariant} initial="initial" animate="animate" exit="exit" className="space-y-4">
                          {state.savingsGoals.length === 0 ? (
                              <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-8 text-center shadow-sm border border-gray-100 dark:border-white/5">
                                  <div className="text-4xl mb-4 opacity-50">🎯</div>
                                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">No active goals</h3>
                                  <p className="text-xs text-gray-500 mb-6">Set a savings goal in Settings to start tracking your progress here!</p>
                                  <button onClick={() => navigate('settings')} className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors">Go to Settings</button>
                              </div>
                          ) : (
                              state.savingsGoals.map(goal => {
                                  const pct = Math.min(100, Math.max(0, (goal.currentAmount / goal.targetAmount) * 100));
                                  return (
                                      <motion.div key={goal.id} variants={cardVariant} className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden relative group">
                                          <div className="flex justify-between items-start mb-4">
                                              <div>
                                                  <h3 className="font-black text-gray-900 dark:text-gray-100 text-lg">{goal.name}</h3>
                                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                                      ₹{(goal.targetAmount - goal.currentAmount).toLocaleString()} REMAINING
                                                  </p>
                                              </div>
                                              <button 
                                                  onClick={() => handleAddGoalFunds(goal.id, goal.currentAmount)}
                                                  className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-2xl w-10 h-10 rounded-[14px] flex items-center justify-center transition-all active:scale-95"
                                              >
                                                  +
                                              </button>
                                          </div>
                                          
                                          <div className="relative h-3 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-2">
                                              <motion.div
                                                  initial={{ width: 0 }}
                                                  animate={{ width: `${pct}%` }}
                                                  transition={{ duration: 1, ease: "easeOut" }}
                                                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-indigo-500"
                                              />
                                          </div>
                                          
                                          <div className="flex justify-between items-center text-xs font-mono font-medium text-gray-500">
                                              <span>₹{goal.currentAmount.toLocaleString()}</span>
                                              <span>{pct.toFixed(1)}%</span>
                                          </div>
                                      </motion.div>
                                  )
                              })
                          )}
                      </motion.div>
                  )}

                  {/* BUDGETS */}
                  {activeTab === 'budgets' && (
                      <motion.div key="budgets" variants={fadeUpVariant} initial="initial" animate="animate" exit="exit" className="space-y-4">
                          
                          {/* Total Budget Card */}
                          <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden">
                              <div className={`absolute top-0 left-0 w-1 h-full ${budgetBurn >= 100 ? 'bg-red-500' : budgetBurn > 80 ? 'bg-orange-500' : 'bg-green-500'}`} />
                              <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Monthly Allowance</h3>
                              
                              <div className="flex items-end gap-2 mb-4">
                                  <span className="text-4xl font-mono font-medium text-gray-900 dark:text-white leading-none">
                                      ₹{currentMonthSpent.toLocaleString()}
                                  </span>
                                  <span className="text-sm font-bold text-gray-400 mb-1">
                                      / ₹{state.monthlyBudget.toLocaleString()}
                                  </span>
                              </div>

                              <div className="relative h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-3">
                                  <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(100, budgetBurn)}%` }}
                                      transition={{ duration: 1, ease: "easeOut" }}
                                      className={`absolute top-0 left-0 h-full ${budgetBurn >= 100 ? 'bg-red-500' : budgetBurn > 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                                  />
                              </div>

                              <div className="flex justify-between items-center">
                                  <span className={`text-xs font-bold uppercase tracking-wider ${budgetBurn >= 100 ? 'text-red-500' : budgetBurn > 80 ? 'text-orange-500' : 'text-green-500'}`}>
                                      {budgetBurn >= 100 ? 'Over Limit' : budgetBurn > 80 ? 'Near Limit' : 'Safe Zone'}
                                  </span>
                                  <button onClick={() => navigate('settings')} className="text-[10px] text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest transition-colors">Edit</button>
                              </div>
                          </div>

                          {/* Overspent Categories */}
                          {overspentCategories.length > 0 && (
                              <div className="bg-red-50 dark:bg-red-500/5 rounded-[24px] p-5 border border-red-100 dark:border-red-500/20">
                                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 mb-4 flex items-center gap-2">
                                      ⚠️ Critical Overspend
                                  </h3>
                                  <div className="space-y-3">
                                      {overspentCategories.map(cat => (
                                          <div key={cat.cat} className="flex justify-between items-center">
                                              <div className="flex items-center gap-2">
                                                  <span className="text-sm bg-white dark:bg-white/5 w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                                                      {state.settings.categoryIcons?.[cat.cat] || '📦'}
                                                  </span>
                                                  <div>
                                                      <div className="text-xs font-bold text-gray-900 dark:text-gray-100">{cat.cat}</div>
                                                      <div className="text-[10px] text-gray-500 font-mono">Limit: ₹{cat.limit.toLocaleString()}</div>
                                                  </div>
                                              </div>
                                              <div className="text-right">
                                                  <div className="text-xs font-mono font-bold text-red-500">₹{cat.spent.toLocaleString()}</div>
                                                  <div className="text-[10px] text-red-400/80 uppercase tracking-widest font-bold mt-0.5">+{cat.over.toLocaleString()} over</div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                        <div className="mt-8 mb-4">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 px-1">🏆 Trophy Shelf</h2>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {completedChallenges.map(c => (
                                    <div key={c.id} className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border border-yellow-200/50 dark:border-yellow-700/30 p-4 rounded-[20px] flex flex-col items-center text-center shadow-sm">
                                        <span className="text-4xl mb-2 drop-shadow-sm">{c.reward.split(' ')[0]}</span>
                                        <div className="text-xs font-bold text-yellow-800 dark:text-yellow-200">{c.reward.substring(2)}</div>
                                        <div className="text-[9px] font-bold text-yellow-600/70 dark:text-yellow-400/60 uppercase tracking-widest mt-1">{new Date(c.updatedAt).toLocaleDateString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                          {/* Action Hub */}
                          <div className="flex gap-2">
                              <button onClick={() => navigate('add-expense')} className="flex-1 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 p-4 rounded-[20px] text-center transition-colors">
                                  <div className="text-2xl mb-1">📝</div>
                                  <div className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">Log Expense</div>
                              </button>
                              <button onClick={() => navigate('summaries')} className="flex-1 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 p-4 rounded-[20px] text-center transition-colors">
                                  <div className="text-2xl mb-1">📊</div>
                                  <div className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">View Stats</div>
                              </button>
                          </div>

                      </motion.div>
                  )}

                  {/* CHALLENGES */}
                  {activeTab === 'challenges' && (
                      <motion.div key="challenges" variants={fadeUpVariant} initial="initial" animate="animate" exit="exit" className="space-y-4">
                          
                          {/* Sub-tabs & Create Header */}
                          <div className="flex justify-between items-center mb-2">
                              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                  {(['active', 'completed', 'failed', 'discover'] as const).map(t => (
                                      <button
                                          key={t}
                                          onClick={() => { setShowCreateForm(false); setChallengeTab(t); }}
                                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${challengeTab === t ? (t==='active'?'bg-blue-100 text-blue-700':t==='completed'?'bg-green-100 text-green-700':t==='failed'?'bg-red-100 text-red-700':'bg-purple-100 text-purple-700') : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                      >
                                          {t} {t !== 'discover' && `(${(t==='active'?activeChallenges.length:t==='completed'?completedChallenges.length:failedChallenges.length)})`}
                                      </button>
                                  ))}
                              </div>
                              <button
                                  onClick={() => setShowCreateForm(!showCreateForm)}
                                  className="w-8 h-8 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center transition-colors text-lg flex-shrink-0 ml-2"
                              >
                                  {showCreateForm ? '×' : '+'}
                              </button>
                          </div>

                          {/* Create Form */}
                          <AnimatePresence>
                              {showCreateForm && (
                                  <motion.div
                                      initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                      exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                      className="overflow-hidden"
                                  >
                                      <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-[24px] border border-indigo-100 dark:border-indigo-500/20 shadow-lg shadow-indigo-500/5 mb-4">
                                          <h2 className="text-xs font-black uppercase tracking-widest text-indigo-500 mb-4">Craft Custom Challenge</h2>
                                          <div className="space-y-3">
                                              <input
                                                  type="text"
                                                  placeholder="Challenge Title (e.g. No Uber Week)"
                                                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 focus:bg-white dark:focus:bg-[#1a1a1a] outline-none text-sm transition-all"
                                                  value={customTitle}
                                                  onChange={e => setCustomTitle(e.target.value)}
                                              />

                                              <div className="flex gap-2">
                                                  <select
                                                      className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 outline-none text-sm appearance-none"
                                                      value={customType}
                                                      onChange={e => setCustomType(e.target.value as any)}
                                                  >
                                                      <option value="no_spend">No Spend</option>
                                                      <option value="limit_category">Limit Category</option>
                                                      <option value="save_amount">Save Amount</option>
                                                      <option value="streak">Streak</option>
                                                  </select>

                                                  {(customType === 'limit_category' || customType === 'no_spend') && (
                                                      <select
                                                          className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 outline-none text-sm appearance-none"
                                                          value={customCategory}
                                                          onChange={e => setCustomCategory(e.target.value)}
                                                      >
                                                          {state.settings.customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                      </select>
                                                  )}
                                              </div>

                                              <div className="flex gap-2">
                                                  <input
                                                      type="number"
                                                      placeholder={customType === 'streak' || customType === 'no_spend' ? "Target Days" : "Target Amt (₹)"}
                                                      className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 outline-none text-sm"
                                                      value={customTarget}
                                                      onChange={e => setCustomTarget(e.target.value)}
                                                  />
                                                  <input
                                                      type="number"
                                                      placeholder="Duration (Days)"
                                                      className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 outline-none text-sm"
                                                      value={customDuration}
                                                      onChange={e => setCustomDuration(e.target.value)}
                                                  />
                                              </div>

                                              <input
                                                  type="text"
                                                  placeholder="Reward Badge (e.g. 🦁 King of Jungle)"
                                                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 outline-none text-sm"
                                                  value={customReward}
                                                  onChange={e => setCustomReward(e.target.value)}
                                              />

                                              <button
                                                  onClick={handleCreateCustom}
                                                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[#10px] shadow-lg shadow-indigo-500/25 active:scale-95 transition-all mt-2"
                                              >
                                                  Launch Challenge
                                              </button>
                                          </div>
                                      </div>
                                  </motion.div>
                              )}
                          </AnimatePresence>

                          {/* List renderer helper */}
                          {(() => {
                              let list = activeChallenges;
                              if (challengeTab === 'completed') list = completedChallenges;
                              if (challengeTab === 'failed') list = failedChallenges;
                              
                              if (challengeTab !== 'discover') {
                                  if (list.length === 0) {
                                      return (
                                          <div className="p-8 text-center bg-gray-50 dark:bg-white/5 rounded-[24px] border border-dashed border-gray-200 dark:border-white/10">
                                              <p className="text-gray-400 text-sm font-medium">Nothing found here.</p>
                                          </div>
                                      );
                                  }
                                  
                                  return (
                                       <AnimatePresence mode="popLayout">
                                          {list.map(challenge => {
                                              const daysLeft = Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                              const isCompleted = challenge.status === 'completed';
                                              const isFailed = challenge.status === 'failed';

                                              return (
                                <motion.div
                                    key={challenge.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-[#121212] p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                                                {challenge.title}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-black uppercase tracking-wider border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded text-gray-500">
                                                    {challenge.category || challenge.type.replace('_', ' ')}
                                                </span>
                                                <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{challenge.description}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-black font-mono text-gray-900 dark:text-white leading-none">{Math.round(challenge.progress)}%</span>
                                        </div>
                                    </div>

                                    <div className="relative h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-4">
                                        <motion.div
                                            className={`absolute top-0 left-0 h-full rounded-full ${
                                                challenge.status === 'failed' ? 'bg-red-500' :
                                                challenge.progress >= 100 ? 'bg-emerald-500' : 'bg-primary'
                                            }`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, challenge.progress)}%` }}
                                            transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1.0] }}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2 font-bold">
                                            {challenge.status === 'failed' ? (
                                                <span className="text-red-500 bg-red-50 dark:bg-red-900/40 px-2 py-1 rounded">Better luck next time 💔</span>
                                            ) : challenge.progress >= 100 ? (
                                                <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-1 rounded">Victory! 🎉</span>
                                            ) : (
                                                <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${daysLeft < 3 ? 'bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'}`}>
                                                    {daysLeft} days left
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex gap-3 items-center">
                                            {challenge.status === 'active' && challenge.type === 'save_amount' && (
                                                <button
                                                    onClick={() => {
                                                        const amt = prompt("Amount saved today:");
                                                        if (amt) updateProgress(challenge.id, parseFloat(amt));
                                                    }}
                                                    className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm"
                                                >
                                                    + Add
                                                </button>
                                            )}
                                            {challenge.status === 'active' && (
                                                <button onClick={() => giveUpChallenge(challenge.id)} className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-500 transition-colors px-2">Give Up</button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                                              );
                                          })}
                                      </AnimatePresence>
                                  );
                              }
                          })()}

                          {/* Discover Vault */}
                          {challengeTab === 'discover' && (
                                     <section className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in relative z-0">
                                         {CHALLENGE_TEMPLATES.map((template, idx) => (
                                             <motion.div
                                                 key={idx}
                                                 whileHover={{ scale: 1.02 }}
                                                 whileTap={{ scale: 0.98 }}
                                                 className="bg-white dark:bg-[#121212] p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 border-l-4 border-l-primary flex flex-col justify-between cursor-pointer group transition-shadow hover:shadow-md"
                                                 onClick={() => startChallenge(template)}
                                             >
                                                 <div>
                                                     <div className="flex items-center gap-3 mb-3">
                                                         <span className="text-3xl bg-gray-50 dark:bg-white/5 p-2 rounded-xl group-hover:scale-110 transition-transform">{template.reward?.split(' ')[0] || '🎯'}</span>
                                                         <div>
                                                             <h3 className="font-bold text-gray-900 dark:text-white text-base">{template.title}</h3>
                                                             <div className="text-[10px] uppercase font-bold text-primary tracking-wider mt-0.5">
                                                                 {template.type.replace('_', ' ')}
                                                             </div>
                                                         </div>
                                                     </div>
                                                     <p className="text-xs text-gray-500 font-medium mb-4">{template.description}</p>

                                                     <div className="flex flex-wrap gap-2 mb-4">
                                                         {template.category && (
                                                             <span className="text-[10px] px-2 py-1 rounded bg-gray-100 dark:bg-white/10 text-gray-500 font-bold uppercase tracking-wider">
                                                                 {template.category}
                                                             </span>
                                                         )}
                                                         <span className="text-[10px] px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-500 font-bold uppercase tracking-wider">
                                                             Reward: {template.reward}
                                                         </span>
                                                     </div>
                                                 </div>

                                                 <button
                                                     onClick={(e) => { e.stopPropagation(); startChallenge(template); }}
                                                     className="w-full py-3 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-xs uppercase tracking-widest font-black rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                                 >
                                                     Start Challenge
                                                 </button>
                                             </motion.div>
                                         ))}
                                     </section>
                          )}

                      </motion.div>
                  )}

              </AnimatePresence>
            </div>
        </motion.div>
    );
};
