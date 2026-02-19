import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, Challenge } from '../types';
import { CHALLENGE_TEMPLATES } from '../utils/challenges';



interface ChallengesProps {
    state: AppState;
    updateState: (updates: Partial<AppState>) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const Challenges: React.FC<ChallengesProps> = ({ state, updateState, showToast }) => {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'discover'>('active');

    // Custom Challenge Form State
    const [customTitle, setCustomTitle] = useState('');
    const [customType, setCustomType] = useState<Challenge['type']>('save_amount');
    const [customCategory, setCustomCategory] = useState(state.settings.customCategories[0]);
    const [customTarget, setCustomTarget] = useState('');
    const [customDuration, setCustomDuration] = useState('');
    const [customReward, setCustomReward] = useState('🏆 Custom Achievement');

    const activeChallenges = state.challenges.filter(c => c.status === 'active');
    const completedChallenges = state.challenges.filter(c => c.status === 'completed');

    const startChallenge = (template: Partial<Challenge>) => {
        let durationDays = 30; // Default
        if (template.title?.includes('Week')) durationDays = 7;
        if (template.title?.includes('Weekend')) durationDays = 2;
        // Helper to extract duration from template if possible or use defaults
        if (template.type === 'no_spend' && template.targetValue && template.targetValue < 100) {
            durationDays = template.targetValue;
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + durationDays);

        const newChallenge: Challenge = {
            id: crypto.randomUUID(),
            title: template.title || 'New Challenge',
            description: template.description || '',
            type: template.type || 'save_amount',
            targetValue: template.targetValue || 0,
            category: template.category,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status: 'active',
            progress: 0,
            reward: template.reward || '🏅 Challanger',
            updatedAt: Date.now()
        };

        updateState({ challenges: [...state.challenges, newChallenge] });
        showToast(`Started "${newChallenge.title}"! Good luck! 🍀`, 'success');
        setActiveTab('active');
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
            id: crypto.randomUUID(),
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
        setActiveTab('active');
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
        <div className="pb-24 space-y-6 animate-fade-in p-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                        Savings Challenges
                    </h1>
                    <p className="text-sm text-text-light">Gamify your financial goals!</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-primary/10 text-primary p-2 rounded-full hover:bg-primary/20 transition-colors"
                >
                    {showCreateForm ? '❌' : '➕'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-4 border-b border-border">
                <button
                    className={`pb-2 ${activeTab === 'active' ? 'border-b-2 border-primary font-bold' : 'text-text-light'}`}
                    onClick={() => setActiveTab('active')}
                >
                    Active ({activeChallenges.length})
                </button>
                <button
                    className={`pb-2 ${activeTab === 'discover' ? 'border-b-2 border-primary font-bold' : 'text-text-light'}`}
                    onClick={() => setActiveTab('discover')}
                >
                    Discover
                </button>
            </div>

            {/* Create Custom Form */}
            <AnimatePresence>
                {showCreateForm && (
                    <motion.section
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-6"
                    >
                        <div className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-primary/20 shadow-lg">
                            <h2 className="font-bold mb-3">🛠️ Create Custom Challenge</h2>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Challenge Title (e.g. No Uber Week)"
                                    className="w-full p-2 rounded bg-background border border-border"
                                    value={customTitle}
                                    onChange={e => setCustomTitle(e.target.value)}
                                />

                                <div className="flex gap-2">
                                    <select
                                        className="p-2 rounded bg-background border border-border flex-1"
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
                                            className="p-2 rounded bg-background border border-border flex-1"
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
                                        placeholder={customType === 'streak' || customType === 'no_spend' ? "Target Days" : "Target Amount"}
                                        className="w-full p-2 rounded bg-background border border-border flex-1"
                                        value={customTarget}
                                        onChange={e => setCustomTarget(e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Duration (Days)"
                                        className="w-full p-2 rounded bg-background border border-border flex-1"
                                        value={customDuration}
                                        onChange={e => setCustomDuration(e.target.value)}
                                    />
                                </div>

                                <input
                                    type="text"
                                    placeholder="Reward Badge (e.g. 🦁 King of Jungle)"
                                    className="w-full p-2 rounded bg-background border border-border"
                                    value={customReward}
                                    onChange={e => setCustomReward(e.target.value)}
                                />

                                <button
                                    onClick={handleCreateCustom}
                                    className="w-full bg-primary text-white py-2 rounded-lg font-bold shadow-lg shadow-primary/30"
                                >
                                    Start Custom Challenge
                                </button>
                            </div>
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            {/* Active Challenges */}
            {activeTab === 'active' && (
                <section className="space-y-4">
                    {activeChallenges.length === 0 ? (
                        <div className="text-center py-10 opacity-50">
                            <p>No active challenges. Start one from "Discover" tab!</p>
                        </div>
                    ) : (
                        activeChallenges.map(challenge => {
                            const daysLeft = Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                            return (
                                <motion.div
                                    key={challenge.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-surface dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-border relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold flex items-center gap-2">
                                                {challenge.title}
                                                <span className="text-xs font-normal border border-border px-1 rounded opacity-70">{challenge.category || challenge.type}</span>
                                            </h3>
                                            <p className="text-xs text-text-light">{challenge.description}</p>
                                        </div>
                                        <span className={`text-xs font-mono px-2 py-1 rounded ${daysLeft < 2 ? 'bg-red-100 text-red-800' : 'bg-black/5 dark:bg-white/10'}`}>
                                            {daysLeft} days left
                                        </span>
                                    </div>

                                    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                                        <motion.div
                                            className={`absolute top-0 left-0 h-full ${challenge.status === 'failed' ? 'bg-red-500' :
                                                challenge.progress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                                                }`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${challenge.progress}%` }}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center text-xs">
                                        <span>{Math.round(challenge.progress)}% Complete</span>
                                        <div className="flex gap-3 items-center">
                                            {challenge.type === 'save_amount' && (
                                                <button
                                                    onClick={() => {
                                                        const amt = prompt("Amount saved today:");
                                                        if (amt) updateProgress(challenge.id, parseFloat(amt));
                                                    }}
                                                    className="text-primary font-bold hover:underline"
                                                >
                                                    + Add Savings
                                                </button>
                                            )}
                                            <button onClick={() => giveUpChallenge(challenge.id)} className="text-red-400 hover:text-red-500">Give Up</button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}

                    {/* Completed Challenges History */}
                    {completedChallenges.length > 0 && (
                        <div className="mt-8">
                            <h2 className="text-lg font-semibold mb-3">🏆 Trophy Shelf</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {completedChallenges.map(c => (
                                    <div key={c.id} className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700/30 p-2 rounded-lg flex flex-col items-center text-center">
                                        <span className="text-3xl mb-1">{c.reward.split(' ')[0]}</span>
                                        <div className="text-xs font-bold text-yellow-800 dark:text-yellow-200">{c.reward.substring(2)}</div>
                                        <div className="text-[10px] text-yellow-600/70 dark:text-yellow-400/50">{new Date(c.updatedAt).toLocaleDateString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* Available Templates */}
            {activeTab === 'discover' && (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
                    {CHALLENGE_TEMPLATES.map((template, idx) => (
                        <motion.div
                            key={idx}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-surface dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-border border-l-4 border-l-primary flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{template.reward?.split(' ')[0] || '🎯'}</span>
                                        <h3 className="font-bold text-sm">{template.title}</h3>
                                    </div>
                                </div>
                                <p className="text-xs text-text-light mb-3">{template.description}</p>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 border border-border capitalize">
                                        {template.type.replace('_', ' ')}
                                    </span>
                                    {template.category && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 border border-border">
                                            {template.category}
                                        </span>
                                    )}
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                                        {template.reward}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => startChallenge(template)}
                                className="w-full py-2 bg-primary text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors"
                            >
                                Start Challenge
                            </button>
                        </motion.div>
                    ))}
                </section>
            )}
        </div>
    );
};
