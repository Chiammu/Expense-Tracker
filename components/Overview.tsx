
import React, { useState, useEffect } from 'react';
import { AppState, Expense, OtherIncome } from '../types';
import { generateFinancialInsights, predictNextMonthSpending, getDeepFinancialStrategy } from '../services/geminiService';
import { ErrorBoundary } from './ErrorBoundary';

interface OverviewProps {
  state: AppState;
  updateBudget: (val: number) => void;
  updateIncome: (p1: number, p2: number) => void;
  addFixedPayment: (name: string, amt: number, day: number) => void;
  removeFixedPayment: (id: number) => void;
  updateState: (newState: Partial<AppState>) => void;
}

export const Overview: React.FC<OverviewProps> = ({ state, updateBudget, updateIncome, addFixedPayment, removeFixedPayment, updateState }) => {
  const [prediction, setPrediction] = useState<string | null>(null);
  const [deepStrategy, setDeepStrategy] = useState<string | null>(null);
  const [loadingPro, setLoadingPro] = useState(false);
  const [loadingPred, setLoadingPred] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    handlePrediction();
  }, []);

  const totalIncomeValue = (state.incomePerson1 || 0) + (state.incomePerson2 || 0) + state.otherIncome.reduce((sum, i) => sum + i.amount, 0);
  
  const handlePrediction = async () => {
    setLoadingPred(true);
    const res = await predictNextMonthSpending(state);
    setPrediction(res);
    setLoadingPred(false);
  };

  const handleDeepAnalysis = async () => {
    setLoadingPro(true);
    const res = await getDeepFinancialStrategy(state);
    setDeepStrategy(res);
    setLoadingPro(false);
  };

  const handleGenerateInsights = async () => {
    setLoadingInsight(true);
    setInsight(null);
    const result = await generateFinancialInsights(state);
    setInsight(result);
    setLoadingInsight(false);
  };

  return (
    <div className="pb-24 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Predictive Budgeting Card */}
      <ErrorBoundary fallbackTitle="Prediction Error">
        <div className="bg-surface rounded-2xl p-5 border border-primary/20 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
          <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
            <span>🔮</span> AI Spending Forecast
          </h3>
          <div className="text-sm font-bold text-text">
            {loadingPred ? <span className="animate-pulse">Analyzing historical trends...</span> : prediction}
          </div>
          <button onClick={handlePrediction} className="mt-3 text-[10px] font-bold text-primary uppercase tracking-tighter hover:underline">Refresh Forecast</button>
        </div>
      </ErrorBoundary>

      {/* Deep Analysis Strategy with Gemini Pro */}
      <ErrorBoundary fallbackTitle="Strategy Error">
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
              <span>🧠</span> Deep Strategy (Gemini 3 Pro)
            </h3>
            <p className="text-xs text-indigo-100/70 mb-4 leading-relaxed">
              Use the powerful Gemini 3 Pro model for long-term financial modeling and payoff planning.
            </p>
            {deepStrategy ? (
              <div className="text-sm bg-white/10 p-4 rounded-xl border border-white/5 mb-4 animate-slide-up leading-relaxed whitespace-pre-wrap">
                {deepStrategy}
              </div>
            ) : null}
            <button 
              onClick={handleDeepAnalysis} 
              disabled={loadingPro}
              className="w-full py-3 bg-white text-indigo-900 rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loadingPro ? 'Thinking Step-by-Step...' : 'Generate 10-Year Vision'}
            </button>
          </div>
          <div className="absolute top-0 right-0 p-8 text-8xl opacity-10 pointer-events-none">📈</div>
        </div>
      </ErrorBoundary>

      {/* Income Section */}
      <div className="bg-surface rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-bold text-primary flex items-center gap-2">💰 Monthly Income</h3>
           <div className="text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full">₹{totalIncomeValue.toLocaleString()}</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input type="number" className="p-3 rounded-xl bg-background text-sm font-bold border border-gray-100 focus:ring-2 focus:ring-primary/20" value={state.incomePerson1 || ''} onChange={e => updateIncome(parseFloat(e.target.value) || 0, state.incomePerson2)} placeholder={state.settings.person1Name} />
          <input type="number" className="p-3 rounded-xl bg-background text-sm font-bold border border-gray-100 focus:ring-2 focus:ring-primary/20" value={state.incomePerson2 || ''} onChange={e => updateIncome(state.incomePerson1, parseFloat(e.target.value) || 0)} placeholder={state.settings.person2Name} />
        </div>
      </div>

      {/* Quick AI Advisor */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary to-pink-600 rounded-2xl shadow-lg p-6 text-white">
        <div className="relative z-10 flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">✨ Quick Tips</h3>
          <button onClick={handleGenerateInsights} disabled={loadingInsight} className="text-xs bg-white/20 px-4 py-2 rounded-full border border-white/30 active:scale-95 transition-all">
            {loadingInsight ? '...' : 'Analyze'}
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
