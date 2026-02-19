import React, { useEffect, useState } from 'react';
import { AppState } from '../types';
import { calculateSpendScore } from '../utils/spendScore';
import { generateFinancialInsights } from '../services/geminiService';

interface SpendScoreProps {
    state: AppState;
}

export const SpendScore: React.FC<SpendScoreProps> = ({ state }) => {
    const [displayScore, setDisplayScore] = useState(0);
    const [aiTip, setAiTip] = useState<string | null>(null);
    const [loadingTip, setLoadingTip] = useState(false);

    // Calculate score derived from state
    const { score, grade, breakdown, tip: calcTip } = calculateSpendScore(state);

    // Animate score on mount/change
    useEffect(() => {
        let start = 0;
        const end = score;
        if (start === end) return;

        const duration = 1000;
        const increment = end / (duration / 16); // 60fps

        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setDisplayScore(end);
                clearInterval(timer);
            } else {
                setDisplayScore(Math.floor(start));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [score]);

    // Fetch AI tip on mount
    useEffect(() => {
        let mounted = true;
        const fetchTip = async () => {
            setLoadingTip(true);
            try {
                // We use the simpler calculation tip as immediate feedback, 
                // but we can also fetch a fresh one from Gemini if desired.
                // For now, let's settle on the calculated tip as the primary "Instant" tip,
                // and fetch a deeper one if the user clicks, or just auto-fetch if cheap.
                // The requirement said "AI tip from Gemini...".
                // Let's call it.
                const insight = await generateFinancialInsights(state);
                if (mounted) setAiTip(insight);
            } catch (e) {
                console.error("Failed to fetch AI tip", e);
            } finally {
                if (mounted) setLoadingTip(false);
            }
        };

        // Debounce/avoid spamming API on every render, maybe only if expenses change significant amount?
        // For this MVP, let's just fetch it once on mount or when score changes significantly.
        // To save tokens, I'll restrict it to user action for "Deep" insight, 
        // BUT the requirement said "Bottom: AI tip from Gemini".
        // I will use the `calcTip` as the default showing tip, and have a button to "Ask Gemini" 
        // or just show the Gemini one if available?
        // Actually, `Overview` likely has the API key.

        // Optimization: The user request implies it's always there. 
        // I'll stick to using the `calcTip` (which is instant and free) as the main view,
        // and maybe load the Gemini one in the background. 
        fetchTip();

        return () => { mounted = false; };
    }, [state.expenses.length]); // Only re-fetch if expenses count changes to avoid simple re-renders

    const getColor = (g: string) => {
        switch (g) {
            case 'A': return '#4caf50'; // Green
            case 'B': return '#009688'; // Teal
            case 'C': return '#ffeb3b'; // Yellow
            case 'D': return '#ff9800'; // Orange
            case 'F': return '#f44336'; // Red
            default: return '#9e9e9e';
        }
    };

    const color = getColor(grade);
    const strokeDasharray = 440; // 2 * pi * r (approx for r=70)
    const strokeDashoffset = strokeDasharray - (strokeDasharray * displayScore) / 100;

    return (
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">

                {/* Gauge Section */}
                <div className="relative w-40 h-40 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            className="text-gray-200 dark:text-gray-700"
                        />
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke={color}
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-text">
                        <span className="text-4xl font-black" style={{ color }}>{grade}</span>
                        <span className="text-sm font-bold opacity-60">{displayScore}/100</span>
                    </div>
                </div>

                {/* Breakdown Section */}
                <div className="flex-1 w-full">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>❤️</span> Financial Health Score
                    </h3>

                    <div className="space-y-2 text-xs font-bold text-text-light">
                        <div className="flex justify-between">
                            <span>Budget Adherence</span>
                            <span className={breakdown.budgetAdherence < 0 ? 'text-red-500' : 'text-green-500'}>
                                {breakdown.budgetAdherence === 0 ? 'Perfect' : breakdown.budgetAdherence}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Savings Rate</span>
                            <span className={breakdown.savingsRate < 0 ? 'text-red-500' : 'text-green-500'}>
                                {breakdown.savingsRate === 0 ? 'Good' : breakdown.savingsRate}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Loan Burden</span>
                            <span className={breakdown.loanBurden < 0 ? 'text-red-500' : 'text-green-500'}>
                                {breakdown.loanBurden === 0 ? 'Low' : breakdown.loanBurden}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Category Discipline</span>
                            <span className={breakdown.categoryDiscipline < 0 ? 'text-red-500' : 'text-green-500'}>
                                {breakdown.categoryDiscipline === 0 ? 'Focused' : breakdown.categoryDiscipline}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Goals Progress</span>
                            <span className={breakdown.savingsGoalProgress < 0 ? 'text-red-500' : 'text-green-500'}>
                                {breakdown.savingsGoalProgress === 0 ? 'On Track' : breakdown.savingsGoalProgress}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Tip Section */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">✨</span>
                    <span className="text-xs font-black uppercase tracking-widest text-primary">Smart Insight</span>
                </div>
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                    <p className="text-sm text-text leading-relaxed">
                        {loadingTip ? <span className="animate-pulse">Analyzing spending patterns...</span> : (aiTip || calcTip)}
                    </p>
                </div>
            </div>
        </div>
    );
};
