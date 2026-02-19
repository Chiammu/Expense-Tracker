import React, { useState, useEffect, useRef } from 'react';
import { AppState } from '../types';
import { calculateSpendScore, getScoreColor, getScoreGradient } from '../utils/spendScore';
import { generateFinancialInsights } from '../services/geminiService';

interface SpendScoreProps {
  state: AppState;
}

export const SpendScore: React.FC<SpendScoreProps> = ({ state }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [aiTip, setAiTip] = useState<string>('');
  const [loadingTip, setLoadingTip] = useState(false);
  const hasFetchedTip = useRef(false);

  const { score, grade, breakdown, tip } = calculateSpendScore(state);
  const color = getScoreColor(grade);
  const gradient = getScoreGradient(grade);

  // Animate score counting up
  useEffect(() => {
    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = score / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const nextScore = Math.min(Math.round(increment * currentStep), score);
      setAnimatedScore(nextScore);
      
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [score]);

  // Fetch AI tip once
  useEffect(() => {
    if (hasFetchedTip.current) return;
    hasFetchedTip.current = true;

    const fetchTip = async () => {
      setLoadingTip(true);
      try {
        const insight = await generateFinancialInsights(state);
        setAiTip(insight);
      } catch {
        setAiTip(tip); // Fallback to calculated tip
      }
      setLoadingTip(false);
    };

    fetchTip();
  }, [state, tip]);

  // SVG circle parameters
  const size = 180;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  // Breakdown labels
  const breakdownLabels: Record<string, { label: string; icon: string }> = {
    budgetAdherence: { label: 'Budget Adherence', icon: '📊' },
    savingsRate: { label: 'Savings Rate', icon: '💰' },
    loanBurden: { label: 'Loan Burden', icon: '🏦' },
    categoryDiscipline: { label: 'Category Discipline', icon: '🎯' },
    savingsGoalProgress: { label: 'Savings Goals', icon: '🎯' },
  };

  return (
    <div className="bg-surface rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
      <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
        <span>📈</span> Financial Health Score
      </h3>

      <div className="flex flex-col items-center">
        {/* Circular Gauge */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-gray-200 dark:text-gray-700"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300 ease-out"
              style={{
                filter: `drop-shadow(0 0 6px ${color}40)`,
              }}
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span 
              className="text-5xl font-black transition-colors duration-300"
              style={{ color }}
            >
              {grade}
            </span>
            <span className="text-2xl font-bold text-text">
              {animatedScore}
            </span>
            <span className="text-xs text-text-light">/ 100</span>
          </div>
        </div>

        {/* Score label */}
        <div 
          className="mt-3 px-4 py-1.5 rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {grade === 'A' && 'Excellent'}
          {grade === 'B' && 'Good'}
          {grade === 'C' && 'Fair'}
          {grade === 'D' && 'Needs Work'}
          {grade === 'F' && 'Critical'}
        </div>

        {/* Breakdown Table */}
        <div className="w-full mt-5 space-y-2">
          {Object.entries(breakdown).map(([key, value]) => {
            const info = breakdownLabels[key];
            const isPositive = value === 0;
            return (
              <div 
                key={key}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span>{info.icon}</span>
                  <span className="text-xs font-medium text-text-light">{info.label}</span>
                </div>
                <span 
                  className={`text-xs font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}
                >
                  {isPositive ? '✓' : value}
                </span>
              </div>
            );
          })}
        </div>

        {/* AI Tip */}
        <div className="w-full mt-4 p-3 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl border border-primary/10">
          <div className="flex items-start gap-2">
            <span className="text-sm">💡</span>
            <div className="flex-1">
              <p className="text-[10px] uppercase font-black text-primary/60 tracking-wider mb-1">
                AI Insight
              </p>
              {loadingTip ? (
                <p className="text-xs text-text-light animate-pulse">Analyzing your finances...</p>
              ) : (
                <p className="text-xs text-text leading-relaxed">{aiTip || tip}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpendScore;