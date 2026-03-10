import React, { useState, useEffect } from 'react';
import { AppState, Expense, OtherIncome } from '../types';
import { ErrorBoundary } from './ErrorBoundary';
import { SpendScore } from './SpendScore';
import { CashFlowCalendar } from './CashFlowCalendar';
import { useAppStore } from '../store/useStore';
import {
  predictNextMonthSpending as getGeminiPrediction,
  getDeepFinancialStrategy as getDeepAnalysis,
  generateFinancialInsights as getSpendingInsights
} from '../services/geminiService';
import { formatCurrency } from '../utils/currencyFormatter';
import { generateId } from '../utils/id';

export const Overview: React.FC = () => {
  const state = useAppStore(); // Use global store
  const [prediction, setPrediction] = useState<string | null>(null);
  const [deepStrategy, setDeepStrategy] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState({ pred: false, strategy: false, insight: false });

  const totalIncome = state.expenses
    .filter(e => e.amount > 0 && e.category === 'Income') // Assuming Income is a category or positive amount logic
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpenses = state.expenses
    .filter(e => e.category !== 'Income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const balance = totalIncome - totalExpenses; // If income is tracked manually

  const handlePrediction = async () => {
    setLoading(prev => ({ ...prev, pred: true }));
    try {
      const pred = await getGeminiPrediction(state);
      setPrediction(pred);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(prev => ({ ...prev, pred: false }));
    }
  };

  const handleDeepAnalysis = async () => {
    setLoading(prev => ({ ...prev, strategy: true }));
    try {
      const strategy = await getDeepAnalysis(state);
      setDeepStrategy(strategy);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(prev => ({ ...prev, strategy: false }));
    }
  };

  const handleGenerateInsights = async () => {
    setLoading(prev => ({ ...prev, insight: true }));
    try {
      const res = await getSpendingInsights(state);
      setInsight(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(prev => ({ ...prev, insight: false }));
    }
  };

  return (
    <div className="pb-24 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-light/80">Market Overview</h2>
        <div className="flex gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-emerald-500 tracking-wider">LIVE</span>
        </div>
      </div>

      {/* Stats Grid - Bloomberg Style */}
      <div className="grid grid-cols-2 gap-3">
        {/* Balance */}
        <div className="col-span-2 bg-[#0a0a0a] dark:bg-[#121212] rounded-[20px] p-5 border border-white/[0.08] shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-50 text-[10px] font-mono text-gray-500">NET.POS</div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Balance</p>
          <h3 className={`text-4xl font-mono font-medium tracking-tighter ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
            {formatCurrency(balance)}
          </h3>
          <div className="space-y-2 mb-3">
            {state.otherIncome.map(inc => (
              <div key={inc.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <span>{inc.desc}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-600">+₹{inc.amount}</span>
                  <button
                    onClick={() => state.setState({ otherIncome: state.otherIncome.filter(i => i.id !== inc.id) })}
                    className="text-gray-400 hover:text-red-500"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const desc = (form.elements.namedItem('desc') as HTMLInputElement).value;
              const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value);
              if (desc && amount) {
                state.setState({
                  otherIncome: [...state.otherIncome, { id: generateId(), desc, amount, updatedAt: Date.now() }]
                });
                form.reset();
              }
            }}
          >
            <input name="desc" className="flex-1 p-2 bg-background border border-gray-200 dark:border-gray-700 rounded-lg text-xs" placeholder="Rent, Dividends..." required />
            <input name="amount" type="number" className="w-20 p-2 bg-background border border-gray-200 dark:border-gray-700 rounded-lg text-xs" placeholder="₹" required />
            <button type="submit" className="bg-green-500 text-white px-3 rounded-lg text-xs font-bold">+</button>
          </form>
        </div>
      </div>

      {/* Cash Flow Calendar */}
      <ErrorBoundary fallbackTitle="Cash Flow Error">
        <CashFlowCalendar state={state} />
      </ErrorBoundary>

      {/* Quick AI Advisor */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary to-pink-600 rounded-2xl shadow-lg p-6 text-white">
        <div className="relative z-10 flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">✨ Quick Tips</h3>
          <button onClick={handleGenerateInsights} disabled={loading.insight} className="text-xs bg-white/20 px-4 py-2 rounded-full border border-white/30 active:scale-95 transition-all">
            {loading.insight ? '...' : 'Analyze'}
          </button>
        </div>
        {insight && <div className="relative z-10 text-sm bg-black/10 p-4 rounded-xl border border-white/10 mb-4 animate-fade-in">{insight}</div>}
        <div className="relative z-10 mt-2 p-2 bg-white/5 rounded-lg border border-white/5 text-[9px] leading-tight text-white/50 italic">
          Disclaimer: Insights are for informational purposes only.
        </div>
      </div>
    </div>
  );
};
