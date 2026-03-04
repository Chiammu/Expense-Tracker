import React, { useState, useEffect } from 'react';
import { AppState, Loan, Investments as InvestType, CreditCard } from '../types';
import { getLatestMetalRates } from '../services/geminiService';
import { logAuditEvent } from '../services/storage';
import { generateId } from '../utils/id';

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

  const deleteLoan = (id: string) => {
    const loan = state.loans.find(l => l.id === id);
    if (confirm(`Delete loan "${loan?.name}"?`)) {
      updateState({ loans: state.loans.filter(l => l.id !== id) });
      logAuditEvent('LOAN_DELETED', { name: loan?.name, amount: loan?.pendingAmount });
      showToast("Loan removed", "success");
    }
  };

  const deleteCard = (id: string) => {
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
      id: generateId(),
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
      id: generateId(),
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

  const getDaysUntilBilling = (billingDay: number) => {
    const now = new Date();
    const currentDay = now.getDate();
    if (currentDay < billingDay) return billingDay - currentDay;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, billingDay);
    return Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 3600 * 24));
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
    <div className="pb-32 space-y-8 animate-fade-in relative z-0">
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Portfolio</h1>
          <p className="text-xs text-gray-500 font-medium">Manage your net worth</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white dark:bg-[#1a1a1a] p-1 rounded-full flex shadow-sm border border-gray-100 dark:border-white/5">
            {(['assets', 'liabilities', 'cards'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 ${tab === t
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-md transform scale-105'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsBalancesVisible(!isBalancesVisible)}
            disabled={state.settings.privacyMode}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${state.settings.privacyMode
                ? 'bg-gray-100 dark:bg-white/5 opacity-50 cursor-not-allowed'
                : isBalancesVisible
                  ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-white/5 hover:scale-105'
                  : 'bg-black dark:bg-white text-white dark:text-black shadow-lg hover:scale-105'
              }`}
          >
            {isBalancesVisible ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Net Worth Card - Obsidian Style */}
      <div className="relative overflow-hidden bg-white dark:bg-[#1a1a1a] rounded-[32px] p-6 shadow-xl border border-gray-100 dark:border-white/5 group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-pink-500/5 dark:from-indigo-400/10 dark:to-pink-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Total Net Worth</span>
          <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter mask-value font-mono">
            {formatValue(netWorth)}
          </div>

          <div className="flex items-center gap-8 mt-6 w-full justify-center">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Assets</span>
              <span className="text-lg font-bold text-emerald-500 mask-value font-mono">{formatValue(totalAssets)}</span>
            </div>
            <div className="h-8 w-px bg-gray-100 dark:bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Liabilities</span>
              <span className="text-lg font-bold text-rose-500 mask-value font-mono">{formatValue(totalLiabilities)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {tab === 'assets' && (
          <div className="space-y-6">
            {/* Investments Section */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">Equity & Funds</h4>
                    <div className="text-xs text-gray-500">Stocks and Mutual Funds</div>
                  </div>
                </div>
                <span className="text-lg font-black text-indigo-500 mask-value tracking-tight">₹{(totalMF + totalStocks).toLocaleString()}</span>
              </div>

              <div className="space-y-6">
                {/* Stocks */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider pl-1">Direct Stocks</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 ml-1">{state.settings.person1Name}</label>
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                        value={state.investments.stocks.p1 || ''}
                        onChange={e => updateInv('stocks', 'p1', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 ml-1">{state.settings.person2Name}</label>
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                        value={state.investments.stocks.p2 || ''}
                        onChange={e => updateInv('stocks', 'p2', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-indigo-400 ml-1">SHARED</label>
                      <input
                        type="number"
                        className="w-full bg-indigo-50 dark:bg-indigo-500/10 border border-transparent focus:border-indigo-500 rounded-xl px-3 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 outline-none transition-all placeholder:text-indigo-200"
                        value={state.investments.stocks.shared || ''}
                        onChange={e => updateInv('stocks', 'shared', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Mutual Funds */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider pl-1">Mutual Funds</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 ml-1">{state.settings.person1Name}</label>
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-pink-500 dark:focus:border-pink-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                        value={state.investments.mutualFunds.p1 || ''}
                        onChange={e => updateInv('mutualFunds', 'p1', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 ml-1">{state.settings.person2Name}</label>
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-pink-500 dark:focus:border-pink-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                        value={state.investments.mutualFunds.p2 || ''}
                        onChange={e => updateInv('mutualFunds', 'p2', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-pink-400 ml-1">SHARED</label>
                      <input
                        type="number"
                        className="w-full bg-pink-50 dark:bg-pink-500/10 border border-transparent focus:border-pink-500 rounded-xl px-3 py-2 text-sm font-bold text-pink-600 dark:text-pink-400 outline-none transition-all placeholder:text-pink-200"
                        value={state.investments.mutualFunds.shared || ''}
                        onChange={e => updateInv('mutualFunds', 'shared', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Precious Metals Section */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-50 dark:bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">Precious Metals</h4>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${fetchingRates ? 'bg-gray-400 animate-pulse' : 'bg-green-500'}`}></div>
                      <span className="text-xs text-gray-500">{fetchingRates ? 'Updating rates...' : 'Live Market Rates'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Gold */}
                <div className="space-y-3">
                  <div className="flex justify-between items-end px-1">
                    <p className="text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-wider">Gold (24K)</p>
                    <span className="text-[10px] font-medium text-gray-400">Rate: ₹{state.investments.goldRate}/g</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="relative group">
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-yellow-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all"
                        value={state.investments.gold.p1Grams || ''}
                        onChange={e => updateInv('gold', 'p1Grams', e.target.value)}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-gray-400 font-bold group-focus-within:text-yellow-500">g</span>
                    </div>
                    <div className="relative group">
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-yellow-500 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all"
                        value={state.investments.gold.p2Grams || ''}
                        onChange={e => updateInv('gold', 'p2Grams', e.target.value)}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-gray-400 font-bold group-focus-within:text-yellow-500">g</span>
                    </div>
                    <div className="relative group">
                      <input
                        type="number"
                        className="w-full bg-yellow-50 dark:bg-yellow-500/10 border border-transparent focus:border-yellow-500 rounded-xl px-3 py-2 text-sm font-bold text-yellow-700 dark:text-yellow-500 outline-none transition-all"
                        value={state.investments.gold.sharedGrams || ''}
                        onChange={e => updateInv('gold', 'sharedGrams', e.target.value)}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-yellow-600/50 font-bold group-focus-within:text-yellow-600">g</span>
                    </div>
                  </div>
                </div>

                {/* Silver */}
                <div className="space-y-3">
                  <div className="flex justify-between items-end px-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Silver</p>
                    <span className="text-[10px] font-medium text-gray-400">Rate: ₹{state.investments.silverRate}/g</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="relative group">
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-gray-400 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all"
                        value={state.investments.silver.p1Grams || ''}
                        onChange={e => updateInv('silver', 'p1Grams', e.target.value)}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-gray-400 font-bold group-focus-within:text-gray-600">g</span>
                    </div>
                    <div className="relative group">
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-gray-400 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all"
                        value={state.investments.silver.p2Grams || ''}
                        onChange={e => updateInv('silver', 'p2Grams', e.target.value)}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-gray-400 font-bold group-focus-within:text-gray-600">g</span>
                    </div>
                    <div className="relative group">
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-gray-400 rounded-xl px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 outline-none transition-all"
                        value={state.investments.silver.sharedGrams || ''}
                        onChange={e => updateInv('silver', 'sharedGrams', e.target.value)}
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] text-gray-400 font-bold group-focus-within:text-gray-600">g</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'liabilities' && (
          <div className="space-y-6">
            {/* Add Loan Form */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 text-xs">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                Add New Loan
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Loan Name (e.g. Home Loan)"
                  className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-rose-500 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
                  value={newLoan.name}
                  onChange={e => setNewLoan({ ...newLoan, name: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Pending Amt"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-rose-500 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
                    value={newLoan.pending}
                    onChange={e => setNewLoan({ ...newLoan, pending: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Monthly EMI"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-rose-500 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
                    value={newLoan.emi}
                    onChange={e => setNewLoan({ ...newLoan, emi: e.target.value })}
                  />
                </div>
                <button
                  onClick={addLoan}
                  className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-rose-500/20"
                >
                  Add Loan
                </button>
              </div>
            </div>

            {/* Loan List */}
            <div className="space-y-3">
              {state.loans.map(loan => (
                <div key={loan.id} className="group bg-white dark:bg-[#1a1a1a] rounded-[20px] p-5 shadow-sm border border-gray-100 dark:border-white/5 flex justify-between items-center transition-all hover:shadow-md hover:border-gray-200 dark:hover:border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center shadow-inner">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white text-base">{loan.name}</div>
                      <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">EMI: ₹{loan.emiAmount.toLocaleString()}/mo</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <div className="font-black text-rose-500 text-lg mask-value tracking-tight">₹{loan.pendingAmount.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 font-bold">OUTSTANDING</div>
                    </div>
                    <button
                      onClick={() => deleteLoan(loan.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'cards' && (
          <div className="space-y-6">
            {/* Add Card Form */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-xs">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                Add Credit Card
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Card Name (e.g. HDFC Millenia)"
                  className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
                  value={newCard.name}
                  onChange={e => setNewCard({ ...newCard, name: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Limit"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
                    value={newCard.limit}
                    onChange={e => setNewCard({ ...newCard, limit: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Billing Day (1-31)"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
                    value={newCard.billingDay}
                    onChange={e => setNewCard({ ...newCard, billingDay: e.target.value })}
                  />
                </div>
                <button
                  onClick={addCard}
                  className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
                >
                  Add Card
                </button>
              </div>
            </div>

            {/* Cards List */}
            <div className="space-y-4">
              {state.creditCards.map(card => {
                const usagePercent = Math.min((card.currentBalance / card.limit) * 100, 100);
                const daysLeft = getDaysUntilBilling(card.billingDay);

                return (
                  <div key={card.id} className="relative overflow-hidden bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5 group transition-all hover:shadow-md">
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center shadow-inner">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white text-lg">{card.name}</div>
                          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">
                            Bill on <span className="text-gray-600 dark:text-gray-300 font-bold">{card.billingDay}th</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-indigo-500 text-xl mask-value tracking-tight">₹{card.currentBalance.toLocaleString()}</div>
                        <div className={`text-[10px] font-bold uppercase mt-1 ${daysLeft <= 3 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`}>
                          Bill in {daysLeft} days
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative z-10 mt-6">
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                        <span>Usage: {usagePercent.toFixed(1)}%</span>
                        <span>Limit: ₹{card.limit.toLocaleString()}</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${usagePercent > 80 ? 'bg-rose-500' :
                              usagePercent > 40 ? 'bg-yellow-500' : 'bg-indigo-500'
                            }`}
                          style={{ width: `${usagePercent}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
