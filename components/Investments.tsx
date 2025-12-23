
import React, { useState, useEffect } from 'react';
import { AppState, Loan, Investments as InvestType, CreditCard } from '../types';
import { getLatestMetalRates } from '../services/geminiService';
import { logAuditEvent } from '../services/storage';

interface InvestmentsProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const Investments: React.FC<InvestmentsProps> = ({ state, updateState, showToast }) => {
  const [tab, setTab] = useState<'assets' | 'liabilities' | 'cards'>('assets');
  const [fetchingRates, setFetchingRates] = useState(false);
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
            silverRate: rates.silver,
            updatedAt: Date.now()
          }
        });
      } catch (e) {
        if (state.investments.goldRate === 0) {
            updateState({
              investments: {
                ...state.investments,
                goldRate: 7300,
                silverRate: 90,
                updatedAt: Date.now()
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
        },
        updatedAt: Date.now()
      }
    });
  };

  const deleteLoan = (id: number) => {
    const loan = state.loans.find(l => l.id === id);
    if (confirm(`Delete loan "${loan?.name}"?`)) {
      updateState({ loans: state.loans.filter(l => l.id !== id) });
      logAuditEvent('LOAN_DELETED', { name: loan?.name, amount: loan?.pendingAmount });
      showToast("Loan removed", "success");
    }
  };

  const deleteCard = (id: number) => {
    const card = state.creditCards.find(c => c.id === id);
    if (confirm(`Remove card "${card?.name}"?`)) {
      updateState({ creditCards: state.creditCards.filter(c => c.id !== id) });
      logAuditEvent('CARD_DELETED', { name: card?.name });
      showToast("Card removed", "success");
    }
  };

  const addLoan = () => {
    if (!newLoan.name || !newLoan.pending) return;
    const loan: Loan = {
      id: Date.now(),
      name: newLoan.name,
      totalAmount: parseFloat(newLoan.pending),
      pendingAmount: parseFloat(newLoan.pending),
      emiAmount: parseFloat(newLoan.emi) || 0,
      person: newLoan.person as any,
      updatedAt: Date.now()
    };
    updateState({ loans: [...state.loans, loan] });
    logAuditEvent('LOAN_ADDED', { name: loan.name, amount: loan.pendingAmount });
    setNewLoan({ name: '', pending: '', emi: '', person: 'Both' });
    showToast("Loan added");
  };

  const addCard = () => {
    if (!newCard.name || !newCard.limit) return;
    const card: CreditCard = {
      id: Date.now(),
      name: newCard.name,
      limit: parseFloat(newCard.limit),
      billingDay: parseInt(newCard.billingDay) || 1,
      currentBalance: 0,
      updatedAt: Date.now()
    };
    updateState({ creditCards: [...state.creditCards, card] });
    logAuditEvent('CARD_ADDED', { name: card.name });
    setNewCard({ name: '', limit: '', billingDay: '' });
    showToast("Card added");
  };

  const formatValue = (val: number) => {
    if (!isBalancesVisible || state.settings.privacyMode) return '••••';
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
             <button onClick={() => setTab('assets')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tab === 'assets' ? 'bg-primary text-white shadow-md' : 'text-text-light hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Wealth</button>
             <button onClick={() => setTab('liabilities')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tab === 'liabilities' ? 'bg-secondary text-white shadow-md' : 'text-text-light hover:bg-gray-50 dark:hover:bg-gray-800'}`}>EMIs</button>
             <button onClick={() => setTab('cards')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tab === 'cards' ? 'bg-indigo-500 text-white shadow-md' : 'text-text-light hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Cards</button>
          </div>
          <button 
            onClick={() => setIsBalancesVisible(!isBalancesVisible)}
            disabled={state.settings.privacyMode}
            className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-xl shadow-sm border transition-all ${state.settings.privacyMode ? 'bg-gray-100 opacity-50 cursor-not-allowed' : (isBalancesVisible ? 'bg-white border-gray-100 text-text-light' : 'bg-primary text-white border-primary shadow-lg ring-2 ring-primary/20')}`}
          >
            {isBalancesVisible ? '👁️' : '🙈'}
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-black text-white p-6 rounded-2xl shadow-xl relative overflow-hidden transition-all duration-500">
        <div className="relative z-10">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Total Net Worth</div>
          <div className="text-3xl font-bold tracking-tight mask-value">{formatValue(netWorth)}</div>
          <div className="flex gap-4 mt-4 text-sm">
             <div>
               <span className="block text-gray-400 text-xs">Assets</span>
               <span className="text-green-400 font-bold mask-value">{formatValue(totalAssets)}</span>
             </div>
             <div className="w-px bg-gray-700"></div>
             <div>
               <span className="block text-gray-400 text-xs">Liabilities</span>
               <span className="text-red-400 font-bold mask-value">{formatValue(totalLiabilities)}</span>
             </div>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-10 text-9xl opacity-5 pointer-events-none">🏛️</div>
      </div>

      {tab === 'assets' && (
        <div className="space-y-4">
           {/* Bank Balances */}
           <div className="bg-surface rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
              <h4 className="text-xs font-black uppercase text-text-light tracking-widest mb-4">Bank Balances</h4>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-bold text-text-light block mb-1">{state.settings.person1Name}</label>
                    <input type="number" className="w-full bg-background p-2 rounded-lg text-sm font-bold" value={state.investments.bankBalance.p1 || ''} onChange={e => updateInv('bankBalance', 'p1', e.target.value)} placeholder="0" />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-text-light block mb-1">{state.settings.person2Name}</label>
                    <input type="number" className="w-full bg-background p-2 rounded-lg text-sm font-bold" value={state.investments.bankBalance.p2 || ''} onChange={e => updateInv('bankBalance', 'p2', e.target.value)} placeholder="0" />
                 </div>
              </div>
           </div>
           
           {/* Mutual Funds */}
           <div className="bg-surface rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
              <h4 className="text-xs font-black uppercase text-text-light tracking-widest mb-4">Mutual Funds</h4>
              <div className="grid grid-cols-3 gap-3">
                 <div>
                    <label className="text-[8px] font-bold text-text-light block mb-1">{state.settings.person1Name}</label>
                    <input type="number" className="w-full bg-background p-2 rounded-lg text-[11px] font-bold" value={state.investments.mutualFunds.p1 || ''} onChange={e => updateInv('mutualFunds', 'p1', e.target.value)} placeholder="0" />
                 </div>
                 <div>
                    <label className="text-[8px] font-bold text-text-light block mb-1">{state.settings.person2Name}</label>
                    <input type="number" className="w-full bg-background p-2 rounded-lg text-[11px] font-bold" value={state.investments.mutualFunds.p2 || ''} onChange={e => updateInv('mutualFunds', 'p2', e.target.value)} placeholder="0" />
                 </div>
                 <div>
                    <label className="text-[8px] font-bold text-text-light block mb-1">Shared</label>
                    <input type="number" className="w-full bg-background p-2 rounded-lg text-[11px] font-bold" value={state.investments.mutualFunds.shared || ''} onChange={e => updateInv('mutualFunds', 'shared', e.target.value)} placeholder="0" />
                 </div>
              </div>
           </div>
        </div>
      )}

      {tab === 'liabilities' && (
        <div className="space-y-4">
           <div className="bg-surface rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <h4 className="text-sm font-bold mb-4">Add Active Loan</h4>
              <div className="space-y-3">
                 <input type="text" placeholder="Loan Name (e.g. Home Loan)" className="w-full bg-background p-3 rounded-xl text-sm border-none" value={newLoan.name} onChange={e => setNewLoan({...newLoan, name: e.target.value})} />
                 <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Pending Amt" className="w-full bg-background p-3 rounded-xl text-sm border-none" value={newLoan.pending} onChange={e => setNewLoan({...newLoan, pending: e.target.value})} />
                    <input type="number" placeholder="Monthly EMI" className="w-full bg-background p-3 rounded-xl text-sm border-none" value={newLoan.emi} onChange={e => setNewLoan({...newLoan, emi: e.target.value})} />
                 </div>
                 <button onClick={addLoan} className="w-full py-3 bg-secondary text-white font-bold rounded-xl active:scale-95 transition-transform shadow-md">Add Loan</button>
              </div>
           </div>

           {state.loans.map(loan => (
             <div key={loan.id} className="bg-surface rounded-2xl p-4 border border-gray-100 dark:border-gray-800 flex justify-between items-center group">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">🏛️</div>
                   <div>
                      <div className="font-bold text-sm">{loan.name}</div>
                      <div className="text-[10px] text-text-light uppercase tracking-widest">EMI: ₹{loan.emiAmount}/mo</div>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="text-right">
                      <div className="font-bold text-red-500 text-sm mask-value">₹{loan.pendingAmount.toLocaleString()}</div>
                      <div className="text-[10px] text-text-light">Pending</div>
                   </div>
                   <button onClick={() => deleteLoan(loan.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-500">🗑️</button>
                </div>
             </div>
           ))}
        </div>
      )}

      {tab === 'cards' && (
        <div className="space-y-4">
           <div className="bg-surface rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <h4 className="text-sm font-bold mb-4">Add Credit Card</h4>
              <div className="space-y-3">
                 <input type="text" placeholder="Card Name (e.g. HDFC Millenia)" className="w-full bg-background p-3 rounded-xl text-sm border-none" value={newCard.name} onChange={e => setNewCard({...newCard, name: e.target.value})} />
                 <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Limit" className="w-full bg-background p-3 rounded-xl text-sm border-none" value={newCard.limit} onChange={e => setNewCard({...newCard, limit: e.target.value})} />
                    <input type="number" placeholder="Billing Day (1-31)" className="w-full bg-background p-3 rounded-xl text-sm border-none" value={newCard.billingDay} onChange={e => setNewCard({...newCard, billingDay: e.target.value})} />
                 </div>
                 <button onClick={addCard} className="w-full py-3 bg-indigo-500 text-white font-bold rounded-xl active:scale-95 transition-transform shadow-md">Add Card</button>
              </div>
           </div>

           {state.creditCards.map(card => (
             <div key={card.id} className="bg-surface rounded-2xl p-4 border border-gray-100 dark:border-gray-800 flex justify-between items-center group">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">💳</div>
                   <div>
                      <div className="font-bold text-sm">{card.name}</div>
                      <div className="text-[10px] text-text-light uppercase tracking-widest">Limit: ₹{card.limit.toLocaleString()}</div>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="text-right">
                      <div className="font-bold text-indigo-600 text-sm mask-value">₹{card.currentBalance.toLocaleString()}</div>
                      <div className="text-[10px] text-text-light">Current Owed</div>
                   </div>
                   <button onClick={() => deleteCard(card.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-500">🗑️</button>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
};
