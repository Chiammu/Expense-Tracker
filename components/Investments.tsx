import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeVariant, spring } from '../utils/motion';
import { AppState, Loan, Investments as InvestType, CreditCard } from '../types';
import { getLatestMetalRates } from '../services/geminiService';
import { logAuditEvent } from '../services/storage';
import { generateId } from '../utils/id';

interface InvestmentsProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  // @ts-ignore (Agent 4 will wired this)
  onFilterByCard?: (cardId: string) => void;
}

export const Investments: React.FC<InvestmentsProps> = ({ state, updateState, showToast, onFilterByCard }) => {
  const [tab, setTab] = useState<'assets' | 'liabilities' | 'cards' | 'cash'>('assets');
  const [fetchingRates, setFetchingRates] = useState(false);
  const [isBalancesVisible, setIsBalancesVisible] = useState(false);

  // Form States
  const [liabTab, setLiabTab] = useState<'loans' | 'fixed'>('loans');
  const [newLoan, setNewLoan] = useState({ name: '', pending: '', emi: '', person: 'Both' });
  const [newCard, setNewCard] = useState({ name: '', limit: '', billingDay: '' });
  const [assetSubTab, setAssetSubTab] = useState<'bank' | 'investments' | 'metals'>('bank');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

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

  const deleteCashTransaction = (id: string) => {
    const tx = state.cashWallet.transactions.find(t => t.id === id);
    if (!tx) return;
    if (confirm(`Remove cash transaction?`)) {
      const newTransactions = state.cashWallet.transactions.filter(t => t.id !== id);
      const newBalance = newTransactions.reduce((acc, curr) => {
          if (curr.type === 'topup') return acc + curr.amount;
          if (curr.type === 'withdraw' || curr.type === 'expense') return acc - curr.amount;
          return acc;
      }, 0);
      updateState({ 
        cashWallet: {
            ...state.cashWallet,
            balance: newBalance,
            transactions: newTransactions,
            updatedAt: Date.now()
        } 
      });
      logAuditEvent('CASH_TX_DELETED', { amount: tx.amount });
      showToast("Cash transaction removed", "success");
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

  const totalAssets = totalBank + totalMF + totalStocks + goldVal + silverVal + (state.cashWallet?.balance || 0);
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
            {(['assets', 'liabilities', 'cards', 'cash'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-4 py-2 rounded-full text-xs font-bold transition-colors duration-300 flex items-center gap-1 ${tab === t
                    ? 'text-white dark:text-black shadow-md'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
              >
                {tab === t && (
                  <motion.div layoutId="portfolioTabIndicator" className="absolute inset-0 bg-black dark:bg-white rounded-full z-0" transition={spring} />
                )}
                <span className="relative z-10 transition-transform duration-300 inline-block" style={{ transform: tab === t ? 'scale(1.05)' : 'scale(1)' }}>
                  {t === 'cash' ? '💵 Cash' : t.charAt(0).toUpperCase() + t.slice(1)}
                </span>
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
        <AnimatePresence mode="wait">
        {tab === 'assets' && (
          <motion.div key="assets" variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="space-y-6">
            {/* Secondary Sub-tab Selector */}
            <div className="flex gap-2 mb-2 bg-gray-50/50 dark:bg-white/5 p-1 rounded-2xl w-fit border border-gray-100 dark:border-white/5">
              {([
                { id: 'bank', label: '🏦 Bank' },
                { id: 'investments', label: '📈 Investments' },
                { id: 'metals', label: '🪙 Metals' }
              ] as const).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setAssetSubTab(s.id)}
                  className={`relative px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors duration-300 ${
                    assetSubTab === s.id
                      ? 'text-indigo-500 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {assetSubTab === s.id && (
                    <motion.div layoutId="assetSubTabIndicator" className="absolute inset-0 bg-white dark:bg-[#252525] rounded-xl z-0 border border-gray-100 dark:border-white/10" transition={spring} />
                  )}
                  <span className="relative z-10">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Bank Section */}
            <AnimatePresence mode="wait">
            {assetSubTab === 'bank' && (
              <motion.div key="bank" variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">Bank Balance</h4>
                      <div className="text-xs text-gray-500">Savings & Current Accounts</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-blue-500 mask-value tracking-tight">Combined: ₹{totalBank.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Available</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{state.settings.person1Name}</label>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-blue-500 rounded-xl px-4 py-4 text-base font-black text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                        value={state.investments.bankBalance?.p1 || ''}
                        onChange={e => updateInv('bankBalance', 'p1', e.target.value)}
                        placeholder="0"
                      />
                      <span className="absolute left-4 -top-2 px-1 bg-white dark:bg-[#1a1a1a] text-[8px] font-bold text-blue-500">ACCOUNT 1</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{state.settings.person2Name}</label>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-blue-500 rounded-xl px-4 py-4 text-base font-black text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                        value={state.investments.bankBalance?.p2 || ''}
                        onChange={e => updateInv('bankBalance', 'p2', e.target.value)}
                        placeholder="0"
                      />
                      <span className="absolute left-4 -top-2 px-1 bg-white dark:bg-[#1a1a1a] text-[8px] font-bold text-blue-500">ACCOUNT 2</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Investments Section */}
            {assetSubTab === 'investments' && (
              <motion.div key="investments" variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="bg-white dark:bg-[#1a1a1a] rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">Equity & Funds</h4>
                      <div className="text-xs text-gray-500">Market linked assets</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-indigo-500 mask-value tracking-tight">Total: ₹{(totalMF + totalStocks).toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Subtotal Investments</div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Stocks */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-1 bg-indigo-500 rounded-full"></span> Direct Stocks
                      </p>
                      <span className="text-[11px] font-bold text-indigo-500">₹{totalStocks.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 ml-1">{state.settings.person1Name}</label>
                        <input
                          type="number"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                          value={state.investments.stocks.p1 || ''}
                          onChange={e => updateInv('stocks', 'p1', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 ml-1">{state.settings.person2Name}</label>
                        <input
                          type="number"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                          value={state.investments.stocks.p2 || ''}
                          onChange={e => updateInv('stocks', 'p2', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-indigo-400 ml-1">SHARED</label>
                        <input
                          type="number"
                          className="w-full bg-indigo-50 dark:bg-indigo-500/10 border border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 outline-none transition-all placeholder:text-indigo-200"
                          value={state.investments.stocks.shared || ''}
                          onChange={e => updateInv('stocks', 'shared', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mutual Funds */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-1 bg-pink-500 rounded-full"></span> Mutual Funds
                      </p>
                      <span className="text-[11px] font-bold text-pink-500">₹{totalMF.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 ml-1">{state.settings.person1Name}</label>
                        <input
                          type="number"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-pink-500 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                          value={state.investments.mutualFunds.p1 || ''}
                          onChange={e => updateInv('mutualFunds', 'p1', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 ml-1">{state.settings.person2Name}</label>
                        <input
                          type="number"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-pink-500 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-300"
                          value={state.investments.mutualFunds.p2 || ''}
                          onChange={e => updateInv('mutualFunds', 'p2', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-pink-400 ml-1">SHARED</label>
                        <input
                          type="number"
                          className="w-full bg-pink-50 dark:bg-pink-500/10 border border-transparent focus:border-pink-500 rounded-xl px-4 py-3 text-sm font-bold text-pink-600 dark:text-pink-400 outline-none transition-all placeholder:text-pink-200"
                          value={state.investments.mutualFunds.shared || ''}
                          onChange={e => updateInv('mutualFunds', 'shared', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Precious Metals Section */}
            {assetSubTab === 'metals' && (
              <motion.div key="metals" variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
                <div className="flex items-center justify-between mb-8">
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
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{fetchingRates ? 'Syncing...' : 'Market Live'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-sm font-black text-yellow-600 dark:text-yellow-500 mask-value">Gold: ₹{goldVal.toLocaleString()}</div>
                    <div className="text-sm font-black text-gray-500 dark:text-gray-400 mask-value">Silver: ₹{silverVal.toLocaleString()}</div>
                  </div>
                </div>

                <div className="space-y-10">
                  {/* Gold */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[11px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest">Gold (24K)</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Rate (₹/g):</span>
                        <input
                          type="number"
                          className="w-20 bg-gray-50 dark:bg-black/20 border border-yellow-500/20 rounded-lg px-2 py-1 text-xs font-black text-yellow-600 outline-none"
                          value={state.investments.goldRate || ''}
                          onChange={e => updateState({ investments: { ...state.investments, goldRate: parseFloat(e.target.value) || 0 }})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative group">
                        <input
                          type="number"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-yellow-500 rounded-xl px-4 py-4 text-base font-black text-gray-900 dark:text-white outline-none transition-all"
                          value={state.investments.gold.p1Grams || ''}
                          onChange={e => updateInv('gold', 'p1Grams', e.target.value)}
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-4.5 text-xs text-gray-400 font-bold">g</span>
                        <span className="absolute left-4 -top-2 px-1 bg-white dark:bg-[#1a1a1a] text-[8px] font-bold text-yellow-500">{state.settings.person1Name.toUpperCase()}</span>
                      </div>
                      <div className="relative group">
                        <input
                          type="number"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-yellow-500 rounded-xl px-4 py-4 text-base font-black text-gray-900 dark:text-white outline-none transition-all"
                          value={state.investments.gold.p2Grams || ''}
                          onChange={e => updateInv('gold', 'p2Grams', e.target.value)}
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-4.5 text-xs text-gray-400 font-bold">g</span>
                        <span className="absolute left-4 -top-2 px-1 bg-white dark:bg-[#1a1a1a] text-[8px] font-bold text-yellow-500">{state.settings.person2Name.toUpperCase()}</span>
                      </div>
                      <div className="relative group">
                        <input
                          type="number"
                          className="w-full bg-yellow-50 dark:bg-yellow-500/10 border border-transparent focus:border-yellow-500 rounded-xl px-4 py-4 text-base font-black text-yellow-700 dark:text-yellow-500 outline-none transition-all"
                          value={state.investments.gold.sharedGrams || ''}
                          onChange={e => updateInv('gold', 'sharedGrams', e.target.value)}
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-4.5 text-xs text-yellow-600/50 font-bold">g</span>
                        <span className="absolute left-4 -top-2 px-1 bg-white dark:bg-[#1a1a1a] text-[8px] font-bold text-yellow-600">SHARED</span>
                      </div>
                    </div>
                  </div>

                  {/* Silver */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Silver</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Rate (₹/g):</span>
                        <input
                          type="number"
                          className="w-20 bg-gray-50 dark:bg-black/20 border border-gray-400/20 rounded-lg px-2 py-1 text-xs font-black text-gray-600 outline-none"
                          value={state.investments.silverRate || ''}
                          onChange={e => updateState({ investments: { ...state.investments, silverRate: parseFloat(e.target.value) || 0 }})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative group">
                        <input
                          type="number"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-gray-400 rounded-xl px-4 py-4 text-base font-black text-gray-900 dark:text-white outline-none transition-all"
                          value={state.investments.silver.p1Grams || ''}
                          onChange={e => updateInv('silver', 'p1Grams', e.target.value)}
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-4.5 text-xs text-gray-400 font-bold">g</span>
                      </div>
                      <div className="relative group">
                        <input
                          type="number"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-transparent focus:border-gray-400 rounded-xl px-4 py-4 text-base font-black text-gray-900 dark:text-white outline-none transition-all"
                          value={state.investments.silver.p2Grams || ''}
                          onChange={e => updateInv('silver', 'p2Grams', e.target.value)}
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-4.5 text-xs text-gray-400 font-bold">g</span>
                      </div>
                      <div className="relative group">
                        <input
                          type="number"
                          className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-gray-400 rounded-xl px-4 py-4 text-base font-black text-gray-600 dark:text-gray-300 outline-none transition-all"
                          value={state.investments.silver.sharedGrams || ''}
                          onChange={e => updateInv('silver', 'sharedGrams', e.target.value)}
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-4.5 text-xs text-gray-400 font-bold">g</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </motion.div>
        )}


        {tab === 'liabilities' && (
          <motion.div key="liabilities" variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="space-y-6">
            {/* Liabilities Sub-Tabs */}
            <div className="flex bg-gray-100 dark:bg-black/20 rounded-full p-1 w-fit mx-auto mb-2 border border-gray-200 dark:border-white/5 relative">
              {(['loans', 'fixed'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setLiabTab(t)}
                  className={`relative px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                    liabTab === t 
                      ? 'text-rose-500 shadow-sm' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {liabTab === t && (
                    <motion.div layoutId="liabTabIndicator" className="absolute inset-0 bg-white dark:bg-white/10 rounded-full z-0" transition={spring} />
                  )}
                  <span className="relative z-10">{t === 'loans' ? 'Active Loans' : 'Fixed Bills'}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
            {liabTab === 'loans' ? (
              <motion.div key="loans" variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="space-y-6">
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
                  <AnimatePresence>
                  {state.loans.map(loan => (
                    <motion.div layout transition={spring} variants={fadeVariant} initial="initial" animate="animate" exit="exit" key={loan.id} className="group bg-white dark:bg-[#1a1a1a] rounded-[20px] p-5 shadow-sm border border-gray-100 dark:border-white/5 flex justify-between items-center transition-all hover:shadow-md hover:border-gray-200 dark:hover:border-white/10">
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
                    </motion.div>
                  ))}
                  </AnimatePresence>
                  {state.loans.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm font-medium">No active loans.</div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="fixed" variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="space-y-6">
                {/* Fixed Bills Section */}
                <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">Monthly Commitments</h4>
                      <div className="text-xs text-gray-500">Fixed recurring payments</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-rose-500 tracking-tight">₹{state.fixedPayments.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}</div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TOTAL PER MONTH</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <AnimatePresence>
                  {state.fixedPayments.map(bill => {
                    const today = new Date().getDate();
                    const isDueSoon = bill.day >= today && bill.day <= today + 5;
                    
                    return (
                      <motion.div layout transition={spring} variants={fadeVariant} initial="initial" animate="animate" exit="exit" key={bill.id} className="bg-white dark:bg-[#1a1a1a] rounded-[20px] p-5 shadow-sm border border-gray-100 dark:border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-white/5 text-gray-400 flex items-center justify-center">
                            <span className="text-xl font-black">{bill.day}</span>
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">{bill.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-gray-400 font-medium tracking-wide">Due on {bill.day}{bill.day === 1 ? 'st' : bill.day === 2 ? 'nd' : bill.day === 3 ? 'rd' : 'th'} of month</span>
                              {isDueSoon && (
                                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse border border-amber-500/20">
                                  Due Soon
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-black text-gray-900 dark:text-white text-lg tracking-tight">
                          ₹{bill.amount.toLocaleString()}
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                  {state.fixedPayments.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm font-medium">No fixed bills added yet.</div>
                  )}
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </motion.div>
        )}

        {tab === 'cards' && (
          <motion.div key="cards" variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="space-y-6">
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
              <AnimatePresence>
              {state.creditCards.map(card => {
                const usagePercent = (card.currentBalance / (card.limit || 1)) * 100;
                const cappedUsage = Math.min(usagePercent, 100);
                const daysLeft = getDaysUntilBilling(card.billingDay);
                const isExpanded = expandedCardId === card.id;

                const usageColor = usagePercent < 50 ? 'bg-emerald-500' : usagePercent < 80 ? 'bg-amber-500' : 'bg-rose-500';
                const usageTextColor = usagePercent < 50 ? 'text-emerald-500' : usagePercent < 80 ? 'text-amber-500' : 'text-rose-500';
                const daysColor = daysLeft <= 3 ? 'text-rose-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-emerald-500';

                return (
                  <motion.div 
                    layout
                    transition={spring}
                    variants={fadeVariant}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    key={card.id} 
                    className={`relative overflow-hidden bg-white dark:bg-[#1a1a1a] rounded-[24px] shadow-sm border transition-colors duration-300 group ${
                      isExpanded ? 'p-6 border-indigo-500/30 ring-1 ring-indigo-500/10' : 'p-5 border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 cursor-pointer'
                    }`}
                    onClick={() => !isExpanded && setExpandedCardId(card.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-300 ${isExpanded ? 'bg-indigo-500 text-white' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500'}`}>
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white text-lg">{card.name}</div>
                          {!isExpanded && (
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                              Limit: ₹{card.limit.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <div className={`font-black tracking-tight mask-value transition-all duration-300 ${isExpanded ? 'text-2xl text-indigo-500' : 'text-lg text-gray-900 dark:text-white'}`}>₹{card.currentBalance.toLocaleString()}</div>
                          {!isExpanded && (
                            <div className={`text-[9px] font-bold uppercase ${daysColor}`}>
                              Bill in {daysLeft}d
                            </div>
                          )}
                        </div>
                        
                        {isExpanded ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setExpandedCardId(null); }}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                        ) : (
                          <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        key={`${card.id}-expanded`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-8 space-y-6 pt-6 border-t border-gray-100 dark:border-white/5"
                      >
                        {/* Usage Details */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-end px-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Credit Usage</span>
                            <span className={`text-[11px] font-black ${usageTextColor}`}>
                              ₹{card.currentBalance.toLocaleString()} used of ₹{card.limit.toLocaleString()} ({usagePercent.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${usageColor}`}
                              style={{ width: `${cappedUsage}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Billing Info */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-white/5 transition-all">
                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Statement Day</div>
                            <div className="text-xl font-black text-gray-900 dark:text-white">{card.billingDay}th <span className="text-[10px] text-gray-400 font-medium">of month</span></div>
                          </div>
                          <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-white/5 transition-all">
                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Billing Loop</div>
                            <div className={`text-xl font-black ${daysColor}`}>
                              {daysLeft} <span className="text-[10px] font-medium uppercase">Days Left</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onFilterByCard?.(card.id); }}
                            className="text-[11px] font-black text-indigo-500 uppercase tracking-wider flex items-center gap-2 hover:gap-3 transition-all"
                          >
                            View expenses on this card <span className="text-lg">→</span>
                          </button>
                          
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }}
                            className="flex items-center gap-2 text-[10px] font-bold text-rose-500 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Card
                          </button>
                        </div>
                      </motion.div>
                    )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
              </AnimatePresence>
            </div>

          </motion.div>
        )}

        {tab === 'cash' && (
          <motion.div key="cash" variants={fadeVariant} initial="initial" animate="animate" exit="exit">
            <CashWalletPanel 
              wallet={state.cashWallet} 
              onDelete={deleteCashTransaction}
              person1Name={state.settings.person1Name}
              person2Name={state.settings.person2Name}
            />
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const CashWalletPanel: React.FC<{
  wallet: AppState['cashWallet'];
  onDelete: (id: string) => void;
  person1Name: string;
  person2Name: string;
}> = ({ wallet, onDelete, person1Name, person2Name }) => {
  const p1Total = wallet.transactions.filter(t => t.person === 'Person1').reduce((acc, curr) => curr.type === 'topup' ? acc + curr.amount : acc - curr.amount, 0);
  const p2Total = wallet.transactions.filter(t => t.person === 'Person2').reduce((acc, curr) => curr.type === 'topup' ? acc + curr.amount : acc - curr.amount, 0);

  const balanceColor = wallet.balance > 0 ? 'text-emerald-500' : wallet.balance === 0 ? 'text-amber-500' : 'text-rose-500';

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-8 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col items-center">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">CASH ON HAND</div>
        <div className={`text-5xl font-black ${balanceColor} tracking-tight mb-4 mask-value font-mono`}>
          ₹{wallet.balance.toLocaleString()}
        </div>
        <div className="flex items-center gap-6 text-sm font-bold bg-gray-50 dark:bg-black/20 px-6 py-3 rounded-full border border-gray-100 dark:border-white/5">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-400 uppercase tracking-wider">{person1Name}</span>
            <span className="text-gray-900 dark:text-white mask-value font-mono">₹{p1Total.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10"></div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-400 uppercase tracking-wider">{person2Name}</span>
            <span className="text-gray-900 dark:text-white mask-value font-mono">₹{p2Total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-white/5">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs">
             💵
          </span>
          Transaction History
        </h4>
        
        {wallet.transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm font-medium">
            No cash transactions yet. Use the Add tab to record cash.
          </div>
        ) : (
          <div className="space-y-3">
            {[...wallet.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
              <div key={tx.id} className="group flex justify-between items-center p-4 rounded-2xl bg-gray-50 dark:bg-black/20 border border-transparent hover:border-gray-100 dark:hover:border-white/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner ${
                    tx.type === 'topup' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20' : 
                    tx.type === 'withdraw' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20' : 
                    'bg-rose-100 text-rose-600 dark:bg-rose-500/20'
                  }`}>
                    {tx.type === 'topup' ? '↓' : tx.type === 'withdraw' ? '🏧' : '↑'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white">{tx.note || 'Cash Transaction'}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                        tx.type === 'topup' ? 'bg-emerald-100 text-emerald-600' :
                        tx.type === 'withdraw' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                      }`}>{tx.type}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-medium mt-1">
                      {new Date(tx.date).toLocaleDateString()} • {tx.person === 'Person1' ? person1Name : person2Name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-black text-lg tracking-tight mask-value font-mono ${tx.type === 'topup' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {tx.type === 'topup' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                  </span>
                  <button 
                    onClick={() => onDelete(tx.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
