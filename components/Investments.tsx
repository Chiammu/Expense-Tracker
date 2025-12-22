
import React, { useState, useEffect } from 'react';
import { AppState, Loan, Investments as InvestType, CreditCard } from '../types';
import { analyzeLoanStrategy, getLatestMetalRates } from '../services/geminiService';

interface InvestmentsProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const Investments: React.FC<InvestmentsProps> = ({ state, updateState, showToast }) => {
  const [tab, setTab] = useState<'assets' | 'liabilities' | 'cards'>('assets');
  const [fetchingRates, setFetchingRates] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  const [isBalancesVisible, setIsBalancesVisible] = useState(false);

  // Form States
  const [newLoan, setNewLoan] = useState({ name: '', pending: '', emi: '', person: 'Both' });
  const [newCard, setNewCard] = useState({ name: '', limit: '', billingDay: '' });

  useEffect(() => {
    const fetchRates = async () => {
      if (state.investments.goldRate > 0 && state.investments.silverRate > 0) return;

      setFetchingRates(true);
      try {
        const rates = await getLatestMetalRates();
        updateState({
          investments: {
            ...state.investments,
            goldRate: rates.gold,
            silverRate: rates.silver
          }
        });
      } catch (e) {
        if (state.investments.goldRate === 0) {
            updateState({
              investments: {
                ...state.investments,
                goldRate: 7300,
                silverRate: 90
              }
            });
        }
      }
      setFetchingRates(false);
    };

    fetchRates();
  }, []);

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

  const updateRate = (metal: 'goldRate' | 'silverRate', val: string) => {
    const num = parseFloat(val) || 0;
    updateState({
      investments: {
        ...state.investments,
        [metal]: num
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
      totalAmount: parseFloat(newLoan.pending), 
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

  const addCard = () => {
    if (!newCard.name || !newCard.limit || !newCard.billingDay) {
      showToast('Fill all card details', 'error');
      return;
    }
    const card: CreditCard = {
      id: Date.now(),
      name: newCard.name,
      limit: parseFloat(newCard.limit),
      billingDay: parseInt(newCard.billingDay),
      currentBalance: 0
    };
    updateState({ creditCards: [...state.creditCards, card] });
    setNewCard({ name: '', limit: '', billingDay: '' });
    showToast('Credit Card Added', 'success');
  };

  const removeCard = (id: number) => {
    if(confirm("Remove this card?")) {
      updateState({ creditCards: state.creditCards.filter(c => c.id !== id) });
    }
  };

  const formatValue = (val: number) => {
    if (!isBalancesVisible) return '••••';
    return `₹${(val || 0).toLocaleString()}`;
  };

  const goldVal = (state.investments.gold.p1Grams + state.investments.gold.p2Grams + state.investments.gold.sharedGrams) * (state.investments.goldRate || 0);
  const silverVal = (state.investments.silver.p1Grams + state.investments.silver.p2Grams + state.investments.silver.sharedGrams) * (state.investments.silverRate || 0);
  const totalBank = (state.investments.bankBalance?.p1 || 0) + (state.investments.bankBalance?.p2 || 0);
  const totalMF = state.investments.mutualFunds.p1 + state.investments.mutualFunds.p2 + state.investments.mutualFunds.shared;
  const totalStocks = state.investments.stocks.p1 + state.investments.stocks.p2 + state.investments.stocks.shared;
  
  const totalAssets = totalBank + totalMF + totalStocks + goldVal + silverVal;
  const totalLiabilities = state.loans.reduce((sum, l) => sum + l.pendingAmount, 0) + state.creditCards.reduce((sum, c) => sum + c.currentBalance, 0);
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="pb-24 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-surface p-1 rounded-xl flex shadow-sm border border-gray-100 dark:border-gray-800 flex-1 overflow-x-auto">
             <button 
               onClick={() => setTab('assets')}
               className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tab === 'assets' ? 'bg-primary text-white shadow-md' : 'text-text-light hover:bg-gray-50 dark:hover:bg-gray-800'}`}
             >
               Wealth
             </button>
             <button 
               onClick={() => setTab('liabilities')}
               className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tab === 'liabilities' ? 'bg-secondary text-white shadow-md' : 'text-text-light hover:bg-gray-50 dark:hover:bg-gray-800'}`}
             >
               EMIs
             </button>
             <button 
               onClick={() => setTab('cards')}
               className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tab === 'cards' ? 'bg-indigo-500 text-white shadow-md' : 'text-text-light hover:bg-gray-50 dark:hover:bg-gray-800'}`}
             >
               Cards
             </button>
          </div>
          <button 
            onClick={() => setIsBalancesVisible(!isBalancesVisible)}
            className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-xl shadow-sm border transition-all ${isBalancesVisible ? 'bg-white border-gray-100 text-text-light dark:bg-gray-800 dark:border-gray-700' : 'bg-primary text-white border-primary shadow-lg ring-2 ring-primary/20'}`}
          >
            {isBalancesVisible ? '👁️' : '🙈'}
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-black text-white p-6 rounded-2xl shadow-xl relative overflow-hidden transition-all duration-500">
        <div className="relative z-10">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Total Net Worth</div>
          <div className="text-3xl font-bold tracking-tight">{formatValue(netWorth)}</div>
          <div className="flex gap-4 mt-4 text-sm">
             <div>
               <span className="block text-gray-400 text-xs">Assets</span>
               <span className="text-green-400 font-bold">{formatValue(totalAssets)}</span>
             </div>
             <div className="w-px bg-gray-700"></div>
             <div>
               <span className="block text-gray-400 text-xs">Liabilities</span>
               <span className="text-red-400 font-bold">{formatValue(totalLiabilities)}</span>
             </div>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-10 text-9xl opacity-5 pointer-events-none">🏛️</div>
      </div>

      {tab === 'assets' && (
        <div className="space-y-4 animate-slide-up">
           <div className="bg-surface rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="font-bold text-primary mb-3 flex items-center gap-2">🏦 Bank Balance</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] uppercase text-text-light font-bold mb-1 block">{state.settings.person1Name}</label>
                    <input type={isBalancesVisible ? "number" : "text"} className={`w-full bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-sm font-bold outline-none transition-all ${!isBalancesVisible ? 'text-transparent' : ''}`} value={isBalancesVisible ? (state.investments.bankBalance?.p1 || '') : '••••'} onChange={e => isBalancesVisible && updateInv('bankBalance', 'p1', e.target.value)} />
                 </div>
                 <div>
                    <label className="text-[10px] uppercase text-text-light font-bold mb-1 block">{state.settings.person2Name}</label>
                    <input type={isBalancesVisible ? "number" : "text"} className={`w-full bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-sm font-bold outline-none transition-all ${!isBalancesVisible ? 'text-transparent' : ''}`} value={isBalancesVisible ? (state.investments.bankBalance?.p2 || '') : '••••'} onChange={e => isBalancesVisible && updateInv('bankBalance', 'p2', e.target.value)} />
                 </div>
              </div>
           </div>

           <div className="bg-surface rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="font-bold text-indigo-500 mb-3 flex items-center gap-2">📈 Market Investments</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                 <div className="col-span-3 text-xs font-bold text-text-light mb-1">Mutual Funds</div>
                 <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder={state.settings.person1Name} value={isBalancesVisible ? (state.investments.mutualFunds.p1 || '') : '••••'} onChange={e => updateInv('mutualFunds', 'p1', e.target.value)} />
                 <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder={state.settings.person2Name} value={isBalancesVisible ? (state.investments.mutualFunds.p2 || '') : '••••'} onChange={e => updateInv('mutualFunds', 'p2', e.target.value)} />
                 <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Shared" value={isBalancesVisible ? (state.investments.mutualFunds.shared || '') : '••••'} onChange={e => updateInv('mutualFunds', 'shared', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                 <div className="col-span-3 text-xs font-bold text-text-light mb-1">Stocks</div>
                 <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder={state.settings.person1Name} value={isBalancesVisible ? (state.investments.stocks.p1 || '') : '••••'} onChange={e => updateInv('stocks', 'p1', e.target.value)} />
                 <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder={state.settings.person2Name} value={isBalancesVisible ? (state.investments.stocks.p2 || '') : '••••'} onChange={e => updateInv('stocks', 'p2', e.target.value)} />
                 <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Shared" value={isBalancesVisible ? (state.investments.stocks.shared || '') : '••••'} onChange={e => updateInv('stocks', 'shared', e.target.value)} />
              </div>
           </div>

           <div className="bg-surface rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="font-bold text-yellow-600 mb-3 flex items-center gap-2"><span>🪙</span> Precious Metals</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                 <div className="space-y-1">
                   <label className="text-[9px] uppercase font-bold text-text-light">Gold Rate (₹/g)</label>
                   <input type="number" className="w-full bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Gold Rate" value={state.investments.goldRate || ''} onChange={e => updateRate('goldRate', e.target.value)} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] uppercase font-bold text-text-light">Silver Rate (₹/g)</label>
                   <input type="number" className="w-full bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Silver Rate" value={state.investments.silverRate || ''} onChange={e => updateRate('silverRate', e.target.value)} />
                 </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mb-4">
                 <div className="col-span-3 text-xs font-bold text-text-light mb-1">🥇 Gold (Grams)</div>
                 <input className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg text-xs" placeholder={state.settings.person1Name} value={state.investments.gold.p1Grams || ''} onChange={e => updateInv('gold', 'p1Grams', e.target.value)} />
                 <input className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg text-xs" placeholder={state.settings.person2Name} value={state.investments.gold.p2Grams || ''} onChange={e => updateInv('gold', 'p2Grams', e.target.value)} />
                 <input className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg text-xs" placeholder="Shared" value={state.investments.gold.sharedGrams || ''} onChange={e => updateInv('gold', 'sharedGrams', e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                 <div className="col-span-3 text-xs font-bold text-text-light mb-1">🥈 Silver (Grams)</div>
                 <input className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-xs" placeholder={state.settings.person1Name} value={state.investments.silver.p1Grams || ''} onChange={e => updateInv('silver', 'p1Grams', e.target.value)} />
                 <input className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-xs" placeholder={state.settings.person2Name} value={state.investments.silver.p2Grams || ''} onChange={e => updateInv('silver', 'p2Grams', e.target.value)} />
                 <input className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-xs" placeholder="Shared" value={state.investments.silver.sharedGrams || ''} onChange={e => updateInv('silver', 'sharedGrams', e.target.value)} />
              </div>
           </div>
        </div>
      )}

      {tab === 'liabilities' && (
        <div className="space-y-4 animate-slide-up">
           <div className="bg-surface rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
             <h3 className="font-bold text-secondary mb-3">Add Loan / EMI</h3>
             <div className="grid grid-cols-2 gap-2 mb-2">
               <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Loan Name" value={newLoan.name} onChange={e => setNewLoan({...newLoan, name: e.target.value})} />
               <select className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" value={newLoan.person} onChange={e => setNewLoan({...newLoan, person: e.target.value})}>
                 <option value="Both">Both</option>
                 <option value="Person1">{state.settings.person1Name}</option>
                 <option value="Person2">{state.settings.person2Name}</option>
               </select>
               <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Pending Amount" type="number" value={newLoan.pending} onChange={e => setNewLoan({...newLoan, pending: e.target.value})} />
               <input className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="EMI Amount" type="number" value={newLoan.emi} onChange={e => setNewLoan({...newLoan, emi: e.target.value})} />
             </div>
             <button onClick={addLoan} className="w-full bg-secondary text-white py-2 rounded-lg font-bold shadow-md">Add Tracker</button>
           </div>
           <div className="space-y-2">
             {state.loans.map(loan => (
               <div key={loan.id} className="bg-surface p-4 rounded-xl border-l-4 border-secondary shadow-sm flex justify-between items-center">
                 <div>
                   <div className="font-bold">{loan.name}</div>
                   <div className="text-xs text-text-light">{(loan.person === 'Both' ? 'Shared' : (loan.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name))} • EMI: ₹{loan.emiAmount}</div>
                 </div>
                 <div className="text-right">
                   <div className="font-bold text-red-500">{formatValue(loan.pendingAmount)}</div>
                   <button onClick={() => removeLoan(loan.id)} className="text-xs text-red-400 mt-1">Remove</button>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {tab === 'cards' && (
        <div className="space-y-4 animate-slide-up">
           <div className="bg-surface rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
             <h3 className="font-bold text-indigo-600 mb-3 flex items-center gap-2">💳 Credit Cards</h3>
             <div className="grid grid-cols-3 gap-2 mb-2">
                <input className="col-span-2 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Card Name (e.g. HDFC)" value={newCard.name} onChange={e => setNewCard({...newCard, name: e.target.value})} />
                <input type="number" className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Limit" value={newCard.limit} onChange={e => setNewCard({...newCard, limit: e.target.value})} />
                <input type="number" min="1" max="31" className="col-span-3 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg text-xs" placeholder="Billing Cycle Day (e.g. 15th)" value={newCard.billingDay} onChange={e => setNewCard({...newCard, billingDay: e.target.value})} />
             </div>
             <button onClick={addCard} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold shadow-md">Add Credit Card</button>
           </div>
           
           <div className="grid grid-cols-1 gap-3">
             {state.creditCards.map(card => {
               const util = (card.currentBalance / card.limit) * 100;
               return (
                 <div key={card.id} className="bg-surface p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-3">
                       <div>
                          <h4 className="font-black text-text italic">{card.name}</h4>
                          <p className="text-[10px] text-text-light font-black uppercase tracking-widest">Bill on {card.billingDay}th</p>
                       </div>
                       <button onClick={() => removeCard(card.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </div>
                    
                    <div className="flex justify-between items-end mb-1.5">
                       <div>
                          <div className="text-[9px] uppercase font-black text-text-light">Current Owed</div>
                          <div className="text-xl font-black text-indigo-600">{formatValue(card.currentBalance)}</div>
                       </div>
                       <div className="text-right">
                          <div className="text-[9px] uppercase font-black text-text-light">Limit</div>
                          <div className="text-sm font-black text-text">{formatValue(card.limit)}</div>
                       </div>
                    </div>
                    
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                       <div className={`h-full transition-all duration-700 ${util > 80 ? 'bg-red-500' : (util > 40 ? 'bg-orange-400' : 'bg-indigo-500')}`} style={{ width: `${Math.min(util, 100)}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                       <span className="text-[9px] font-black text-text-light uppercase tracking-tighter">Utilization: {util.toFixed(1)}%</span>
                       <span className="text-[9px] font-black text-text-light uppercase tracking-tighter">Available: {formatValue(card.limit - card.currentBalance)}</span>
                    </div>
                 </div>
               );
             })}
             {state.creditCards.length === 0 && (
               <div className="text-center py-8 opacity-40 italic text-sm">No credit cards added yet.</div>
             )}
           </div>
        </div>
      )}
    </div>
  );
};
