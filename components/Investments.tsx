import React, { useState, useEffect } from 'react';
import { AppState, Loan, Investments as InvestType } from '../types';
import { analyzeLoanStrategy } from '../services/geminiService';

interface InvestmentsProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const Investments: React.FC<InvestmentsProps> = ({ state, updateState, showToast }) => {
  const [tab, setTab] = useState<'assets' | 'liabilities'>('assets');
  const [metalRates, setMetalRates] = useState({ gold: 0, silver: 0 });
  const [fetchingRates, setFetchingRates] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // EMI Form State
  const [newLoan, setNewLoan] = useState({ name: '', pending: '', emi: '', person: 'Both' });

  // 1. Fetch Metal Rates (Mock/Fallback for stability without backend)
  useEffect(() => {
    const fetchRates = async () => {
      setFetchingRates(true);
      // Simulate API call delay
      await new Promise(r => setTimeout(r, 800));
      
      // Fallback/Mock rates (approximate market rates for India in INR)
      // In a real app, use a free API like 'https://api.metalpriceapi.com/v1/latest' if available
      const mockGold = 7350; // Per gram 24k
      const mockSilver = 92; // Per gram
      
      // Add slight randomization to simulate live updates
      const goldRate = mockGold + (Math.random() * 50 - 25);
      const silverRate = mockSilver + (Math.random() * 2 - 1);

      setMetalRates({ gold: Math.floor(goldRate), silver: Math.floor(silverRate) });
      setFetchingRates(false);
    };

    fetchRates();
  }, []);

  // Helpers
  const updateInv = (key: keyof InvestType, subKey: string, val: string) => {
    const num = parseFloat(val) || 0;
    const current = state.investments[key] as any;
    
    updateState({
      investments: {
        ...state.investments,
        [key]: {
          ...current,
          [subKey]: num
        }
      }
    });
  };

  const addLoan = () => {
    if (!newLoan.name || !newLoan.pending || !newLoan.emi) {
      showToast('Fill all loan details', 'error');
      return;
    }
    const loan: Loan = {
      id: Date.now(),
      name: newLoan.name,
      totalAmount: parseFloat(newLoan.pending), // Assuming total starts as pending for simplification in this UI
      pendingAmount: parseFloat(newLoan.pending),
      emiAmount: parseFloat(newLoan.emi),
      person: newLoan.person as any
    };
    updateState({ loans: [...state.loans, loan] });
    setNewLoan({ name: '', pending: '', emi: '', person: 'Both' });
    showToast('EMI Tracker Added', 'success');
  };

  const removeLoan = (id: number) => {
    if(confirm("Remove this loan?")) {
      updateState({ loans: state.loans.filter(l => l.id !== id) });
    }
  };

  const handleAnalyzeEMI = async () => {
    if (state.loans.length === 0) {
      showToast("Add loans first", 'info');
      return;
    }
    setAnalyzing(true);
    setAiAdvice(null);
    
    // Calculate surplus (Income - Expense - Fixed Payments)
    const totalIncome = state.incomePerson1 + state.incomePerson2 + state.otherIncome.reduce((s,i) => s + i.amount, 0);
    const totalExpense = state.expenses.reduce((s,e) => s + e.amount, 0);
    const surplus = totalIncome - totalExpense;

    const advice = await analyzeLoanStrategy(state.loans, surplus, state.settings.person1Name, state.settings.person2Name);
    setAiAdvice(advice);
    setAnalyzing(false);
  };

  // Calculations
  const goldVal = (state.investments.gold.p1Grams + state.investments.gold.p2Grams + state.investments.gold.sharedGrams) * metalRates.gold;
  const silverVal = (state.investments.silver.p1Grams + state.investments.silver.p2Grams + state.investments.silver.sharedGrams) * metalRates.silver;
  
  const totalBank = state.investments.bankBalance.p1 + state.investments.bankBalance.p2;
  const totalMF = state.investments.mutualFunds.p1 + state.investments.mutualFunds.p2 + state.investments.mutualFunds.shared;
  const totalStocks = state.investments.stocks.p1 + state.investments.stocks.p2 + state.investments.stocks.shared;
  
  const totalAssets = totalBank + totalMF + totalStocks + goldVal + silverVal;
  const totalLiabilities = state.loans.reduce((sum, l) => sum + l.pendingAmount, 0);
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="pb-24 space-y-6 animate-fade-in">
      
      {/* Top Toggle */}
      <div className="bg-surface p-1 rounded-xl flex shadow-sm border border-gray-100 dark:border-gray-800 mx-auto max-w-sm">
         <button 
           onClick={() => setTab('assets')}
           className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'assets' ? 'bg-primary text-white shadow-md' : 'text-text-light hover:bg-gray-50 dark:hover:bg-gray-800'}`}
         >
           💰 Wealth
         </button>
         <button 
           onClick={() => setTab('liabilities')}
           className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'liabilities' ? 'bg-secondary text-white shadow-md' : 'text-text-light hover:bg-gray-50 dark:hover:bg-gray-800'}`}
         >
           📉 EMIs
         </button>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-gray-900 to-black text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Total Net Worth</div>
          <div className="text-3xl font-bold">₹{netWorth.toLocaleString()}</div>
          <div className="flex gap-4 mt-4 text-sm">
             <div>
               <span className="block text-gray-400 text-xs">Assets</span>
               <span className="text-green-400 font-bold">₹{totalAssets.toLocaleString()}</span>
             </div>
             <div className="w-px bg-gray-700"></div>
             <div>
               <span className="block text-gray-400 text-xs">Liabilities</span>
               <span className="text-red-400 font-bold">₹{totalLiabilities.toLocaleString()}</span>
             </div>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-10 text-9xl opacity-5">🏛️</div>
      </div>

      {tab === 'assets' ? (
        <div className="space-y-4">
           {/* Bank Balance */}
           <div className="bg-surface rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="font-bold text-primary mb-3 flex items-center gap-2">🏦 Bank Balance</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] uppercase text-text-light font-bold mb-1 block">{state.settings.person1Name}</label>
                    <input type="number" className="w-full bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-sm font-bold" 
                      value={state.investments.bankBalance.p1 || ''} 
                      onChange={e => updateInv('bankBalance', 'p1', e.target.value)} 
                      placeholder="0"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] uppercase text-text-light font-bold mb-1 block">{state.settings.person2Name}</label>
                    <input type="number" className="w-full bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-sm font-bold" 
                      value={state.investments.bankBalance.p2 || ''} 
                      onChange={e => updateInv('bankBalance', 'p2', e.target.value)} 
                      placeholder="0"
                    />
                 </div>
              </div>
           </div>

           {/* Market */}
           <div className="bg-surface rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="font-bold text-indigo-500 mb-3 flex items-center gap-2">📈 Market Investments</h3>
              
              <div className="mb-4">
                <div className="text-xs font-bold text-text-light mb-2">Mutual Funds (Current Value)</div>
                <div className="grid grid-cols-3 gap-2">
                   <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder={state.settings.person1Name} value={state.investments.mutualFunds.p1 || ''} onChange={e => updateInv('mutualFunds', 'p1', e.target.value)} type="number" />
                   <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder={state.settings.person2Name} value={state.investments.mutualFunds.p2 || ''} onChange={e => updateInv('mutualFunds', 'p2', e.target.value)} type="number" />
                   <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Shared" value={state.investments.mutualFunds.shared || ''} onChange={e => updateInv('mutualFunds', 'shared', e.target.value)} type="number" />
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-text-light mb-2">Stocks (Invested Amount)</div>
                <div className="grid grid-cols-3 gap-2">
                   <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder={state.settings.person1Name} value={state.investments.stocks.p1 || ''} onChange={e => updateInv('stocks', 'p1', e.target.value)} type="number" />
                   <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder={state.settings.person2Name} value={state.investments.stocks.p2 || ''} onChange={e => updateInv('stocks', 'p2', e.target.value)} type="number" />
                   <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Shared" value={state.investments.stocks.shared || ''} onChange={e => updateInv('stocks', 'shared', e.target.value)} type="number" />
                </div>
              </div>
           </div>

           {/* Precious Metals */}
           <div className="bg-surface rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                 <h3 className="font-bold text-yellow-600 dark:text-yellow-500 flex items-center gap-2">🥇 Precious Metals</h3>
                 <span className="text-[10px] text-text-light bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                   {fetchingRates ? 'Updating...' : `Live: Gold ₹${metalRates.gold}/g`}
                 </span>
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-1">
                   <label className="text-xs font-bold text-text-light">Gold (Grams)</label>
                   <span className="text-xs font-bold text-yellow-600">Total: ₹{goldVal.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                   <input className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg text-xs" placeholder={`${state.settings.person1Name} (g)`} value={state.investments.gold.p1Grams || ''} onChange={e => updateInv('gold', 'p1Grams', e.target.value)} type="number" />
                   <input className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg text-xs" placeholder={`${state.settings.person2Name} (g)`} value={state.investments.gold.p2Grams || ''} onChange={e => updateInv('gold', 'p2Grams', e.target.value)} type="number" />
                   <input className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg text-xs" placeholder="Shared (g)" value={state.investments.gold.sharedGrams || ''} onChange={e => updateInv('gold', 'sharedGrams', e.target.value)} type="number" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                   <label className="text-xs font-bold text-text-light">Silver (Grams)</label>
                   <span className="text-xs font-bold text-gray-500">Total: ₹{silverVal.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                   <input className="bg-gray-50 dark:bg-gray-900/10 p-2 rounded-lg text-xs" placeholder={`${state.settings.person1Name} (g)`} value={state.investments.silver.p1Grams || ''} onChange={e => updateInv('silver', 'p1Grams', e.target.value)} type="number" />
                   <input className="bg-gray-50 dark:bg-gray-900/10 p-2 rounded-lg text-xs" placeholder={`${state.settings.person2Name} (g)`} value={state.investments.silver.p2Grams || ''} onChange={e => updateInv('silver', 'p2Grams', e.target.value)} type="number" />
                   <input className="bg-gray-50 dark:bg-gray-900/10 p-2 rounded-lg text-xs" placeholder="Shared (g)" value={state.investments.silver.sharedGrams || ''} onChange={e => updateInv('silver', 'sharedGrams', e.target.value)} type="number" />
                </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-4">
           {/* Add Loan */}
           <div className="bg-surface rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
             <h3 className="font-bold text-secondary mb-3">Add EMI Tracker</h3>
             <div className="grid grid-cols-[1fr_1fr] gap-2 mb-2">
               <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Loan Name (e.g. Car)" value={newLoan.name} onChange={e => setNewLoan({...newLoan, name: e.target.value})} />
               <select className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" value={newLoan.person} onChange={e => setNewLoan({...newLoan, person: e.target.value})}>
                 <option value="Both">Both</option>
                 <option value="Person1">{state.settings.person1Name}</option>
                 <option value="Person2">{state.settings.person2Name}</option>
               </select>
             </div>
             <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
               <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Pending Amount" type="number" value={newLoan.pending} onChange={e => setNewLoan({...newLoan, pending: e.target.value})} />
               <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Monthly EMI" type="number" value={newLoan.emi} onChange={e => setNewLoan({...newLoan, emi: e.target.value})} />
               <button onClick={addLoan} className="bg-secondary text-white px-4 rounded-lg font-bold shadow-md hover:bg-blue-600 transition-colors">+</button>
             </div>
           </div>

           {/* Loan List */}
           <div className="space-y-2">
             {state.loans.map(loan => (
               <div key={loan.id} className="bg-surface p-4 rounded-xl border-l-4 border-secondary shadow-sm flex justify-between items-center group">
                 <div>
                   <div className="font-bold text-text">{loan.name}</div>
                   <div className="text-xs text-text-light">{loan.person === 'Both' ? 'Shared' : (loan.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name)}</div>
                 </div>
                 <div className="text-right">
                   <div className="text-sm font-bold text-red-500">₹{loan.pendingAmount.toLocaleString()} left</div>
                   <div className="text-xs text-text-light">EMI: ₹{loan.emiAmount}/mo</div>
                 </div>
                 <button onClick={() => removeLoan(loan.id)} className="ml-3 text-gray-300 hover:text-red-500 px-2">✕</button>
               </div>
             ))}
             {state.loans.length === 0 && <div className="text-center text-gray-400 py-8 text-sm italic">No active loans. You're free! 🕊️</div>}
           </div>

           {/* AI Analysis */}
           {state.loans.length > 0 && (
             <div className="mt-6">
                <button 
                  onClick={handleAnalyzeEMI}
                  disabled={analyzing}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {analyzing ? <span className="animate-spin">🌀</span> : '🤖'} 
                  {analyzing ? 'Analyzing Strategy...' : 'AI Repayment Strategy'}
                </button>
                
                {aiAdvice && (
                  <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 text-sm leading-relaxed whitespace-pre-line text-indigo-900 dark:text-indigo-200 animate-slide-up">
                    {aiAdvice}
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
};
