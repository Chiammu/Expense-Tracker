import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, Challenge, Section } from '../types';
import { CHALLENGE_TEMPLATES } from '../utils/challenges';
import { generateId } from '../utils/id';
import { fadeVariant, fadeUpVariant, cardVariant } from '../utils/motion';
import { CustomSelect } from './CustomSelect';

interface ChallengesProps {
    state: AppState;
    updateState: (updates: Partial<AppState>) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    navigate: (section: Section) => void;
}

type ChallengeTab = 'active' | 'completed' | 'failed' | 'discover';

export const Challenges: React.FC<ChallengesProps> = ({ state, updateState, showToast, navigate }) => {
    // Challenges State
    const [challengeTab, setChallengeTab] = useState<ChallengeTab>('active');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [customTitle, setCustomTitle] = useState('');
    const [customType, setCustomType] = useState<Challenge['type']>('save_amount');
    const [customCategory, setCustomCategory] = useState(state.settings.customCategories[0]);
    const [customTarget, setCustomTarget] = useState('');
    const [customDuration, setCustomDuration] = useState('');
    const [customReward, setCustomReward] = useState('🏆 Custom Achievement');

    const challengeTypeOptions = useMemo(() => ([
        { label: 'No Spend', value: 'no_spend' },
        { label: 'Limit Category', value: 'limit_category' },
        { label: 'Save Amount', value: 'save_amount' },
        { label: 'Streak', value: 'streak' },
    ]), []);

    const categoryOptions = useMemo(
        () => state.settings.customCategories.map(c => ({ label: c, value: c })),
        [state.settings.customCategories]
    );

    // Challenges calculations
    const activeChallenges = state.challenges.filter(c => c.status === 'active');
    const completedChallenges = state.challenges.filter(c => c.status === 'completed');
    const failedChallenges = state.challenges.filter(c => c.status === 'failed');

    const startChallenge = (template: Partial<Challenge>) => {
        let durationDays = 30; // Default
        if (template.title?.includes('Week')) durationDays = 7;
        if (template.title?.includes('Weekend')) durationDays = 2;
        if (template.type === 'no_spend' && template.targetValue && template.targetValue < 100) {
            durationDays = template.targetValue;
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + durationDays);

        const newChallenge: Challenge = {
            id: generateId(),
            title: template.title || 'New Challenge',
            description: template.description || '',
            type: template.type || 'save_amount',
            targetValue: template.targetValue || 0,
            category: template.category,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status: 'active',
            progress: 0,
            reward: template.reward || '🏅 Challenger',
            updatedAt: Date.now()
        };

        updateState({ challenges: [...state.challenges, newChallenge] });
        showToast(`Started "${newChallenge.title}"! Good luck! 🍀`, 'success');
        setChallengeTab('active');
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
            id: generateId(),
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
        setChallengeTab('active');
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
        <motion.div variants={fadeVariant} initial="initial" animate="animate" exit="exit" className="space-y-4">
            
            {/* Sub-tabs & Create Header */}
            <div className="flex justify-between items-center mb-2">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {(['active', 'completed', 'failed', 'discover'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => { setShowCreateForm(false); setChallengeTab(t); }}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${challengeTab === t ? (t==='active'?'bg-blue-100 text-blue-700':t==='completed'?'bg-green-100 text-green-700':t==='failed'?'bg-red-100 text-red-700':'bg-purple-100 text-purple-700') : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                        >
                            {t} {t !== 'discover' && `(${(t==='active'?activeChallenges.length:t==='completed'?completedChallenges.length:failedChallenges.length)})`}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="w-8 h-8 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center transition-colors text-lg flex-shrink-0 ml-2"
                >
                    {showCreateForm ? '×' : '+'}
                </button>
            </div>

            {/* Create Form */}
            <AnimatePresence>
                {showCreateForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-[24px] border border-indigo-100 dark:border-indigo-500/20 shadow-lg shadow-indigo-500/5 mb-4">
                            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-500 mb-4">Craft Custom Challenge</h2>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Challenge Title (e.g. No Uber Week)"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 focus:bg-white dark:focus:bg-[#1a1a1a] outline-none text-sm transition-all"
                                    value={customTitle}
                                    onChange={e => setCustomTitle(e.target.value)}
                                />

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <CustomSelect
                                            value={customType}
                                            onChange={(val) => setCustomType(val as any)}
                                            options={challengeTypeOptions}
                                        />
                                    </div>

                                    {(customType === 'limit_category' || customType === 'no_spend') && (
                                        <div className="flex-1">
                                            <CustomSelect
                                                value={customCategory}
                                                onChange={setCustomCategory}
                                                options={categoryOptions}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        placeholder={customType === 'streak' || customType === 'no_spend' ? "Target Days" : "Target Amt (₹)"}
                                        className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 outline-none text-sm"
                                        value={customTarget}
                                        onChange={e => setCustomTarget(e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Duration (Days)"
                                        className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 outline-none text-sm"
                                        value={customDuration}
                                        onChange={e => setCustomDuration(e.target.value)}
                                    />
                                </div>

                                <input
                                    type="text"
                                    placeholder="Reward Badge (e.g. 🦁 King of Jungle)"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-transparent focus:border-indigo-500/30 outline-none text-sm"
                                    value={customReward}
                                    onChange={e => setCustomReward(e.target.value)}
                                />

                                <button
                                    onClick={handleCreateCustom}
                                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[#10px] shadow-lg shadow-indigo-500/25 active:scale-95 transition-all mt-2"
                                >
                                    Launch Challenge
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* List renderer helper */}
            {(() => {
                let list = activeChallenges;
                if (challengeTab === 'completed') list = completedChallenges;
                if (challengeTab === 'failed') list = failedChallenges;
                
                if (challengeTab !== 'discover') {
                    if (list.length === 0) {
                        return (
                            <div className="p-8 text-center bg-gray-50 dark:bg-white/5 rounded-[24px] border border-dashed border-gray-200 dark:border-white/10">
                                <p className="text-gray-400 text-sm font-medium">Nothing found here.</p>
                            </div>
                        );
                    }
                    
                    return (
                            <AnimatePresence mode="popLayout">
                            {list.map(challenge => {
                                const daysLeft = Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                                return (
                <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-[#121212] p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                                {challenge.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black uppercase tracking-wider border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded text-gray-500">
                                    {challenge.category || challenge.type.replace('_', ' ')}
                                </span>
                                <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{challenge.description}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-black font-mono text-gray-900 dark:text-white leading-none">{Math.round(challenge.progress)}%</span>
                        </div>
                    </div>

                    <div className="relative h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-4">
                        <motion.div
                            className={`absolute top-0 left-0 h-full rounded-full ${
                                challenge.status === 'failed' ? 'bg-red-500' :
                                challenge.progress >= 100 ? 'bg-emerald-500' : 'bg-primary'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, challenge.progress)}%` }}
                            transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1.0] }}
                        />
                    </div>

                    <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 font-bold">
                            {challenge.status === 'failed' ? (
                                <span className="text-red-500 bg-red-50 dark:bg-red-900/40 px-2 py-1 rounded">Better luck next time 💔</span>
                            ) : challenge.progress >= 100 ? (
                                <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-1 rounded">Victory! 🎉</span>
                            ) : (
                                <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${daysLeft < 3 ? 'bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'}`}>
                                    {daysLeft} days left
                                </span>
                            )}
                        </div>

                        <div className="flex gap-3 items-center">
                            {challenge.status === 'active' && challenge.type === 'save_amount' && (
                                <button
                                    onClick={() => {
                                        const amt = prompt("Amount saved today:");
                                        if (amt) updateProgress(challenge.id, parseFloat(amt));
                                    }}
                                    className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm"
                                >
                                    + Add
                                </button>
                            )}
                            {challenge.status === 'active' && (
                                <button onClick={() => giveUpChallenge(challenge.id)} className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-500 transition-colors px-2">Give Up</button>
                            )}
                        </div>
                    </div>
                </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    );
                }
                return null;
            })()}

            {/* Discover Vault */}
            {challengeTab === 'discover' && (
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in relative z-0">
                            {CHALLENGE_TEMPLATES.map((template, idx) => (
                                <motion.div
                                    key={idx}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="bg-white dark:bg-[#121212] p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 border-l-4 border-l-primary flex flex-col justify-between cursor-pointer group transition-shadow hover:shadow-md"
                                    onClick={() => startChallenge(template)}
                                >
                                    <div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-3xl bg-gray-50 dark:bg-white/5 p-2 rounded-xl group-hover:scale-110 transition-transform">{template.reward?.split(' ')[0] || '🎯'}</span>
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white text-base">{template.title}</h3>
                                                <div className="text-[10px] uppercase font-bold text-primary tracking-wider mt-0.5">
                                                    {template.type.replace('_', ' ')}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 font-medium mb-4">{template.description}</p>

                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {template.category && (
                                                <span className="text-[10px] px-2 py-1 rounded bg-gray-100 dark:bg-white/10 text-gray-500 font-bold uppercase tracking-wider">
                                                    {template.category}
                                                </span>
                                            )}
                                            <span className="text-[10px] px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-500 font-bold uppercase tracking-wider">
                                                Reward: {template.reward}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); startChallenge(template); }}
                                        className="w-full py-3 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white text-xs uppercase tracking-widest font-black rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                    >
                                        Start Challenge
                                    </button>
                                </motion.div>
                            ))}
                        </section>
            )}
        </motion.div>
    );
};
