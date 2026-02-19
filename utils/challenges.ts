import { Challenge, Expense } from '../types';

export const CHALLENGE_TEMPLATES: Omit<Challenge, 'id' | 'startDate' | 'endDate' | 'status' | 'progress' | 'updatedAt'>[] = [
    {
        title: "No Eating Out Week",
        description: "Avoid spending on Food for 7 days",
        type: 'no_spend',
        category: 'Food',
        targetValue: 7, // days
        reward: "🥗 Health Hero"
    },
    {
        title: "Coffee Budget Challenge",
        description: "Limit Food spending to ₹500 this week",
        type: 'limit_category',
        category: 'Food',
        targetValue: 500, // amount limit
        reward: "☕ Caffeine Control"
    },
    {
        title: "₹5000 Emergency Fund Sprint",
        description: "Save ₹5000 in 30 days",
        type: 'save_amount',
        targetValue: 5000,
        reward: "🛡️ Safety Net Builder"
    },
    {
        title: "No Shopping Month",
        description: "No spending on Shopping for 30 days",
        type: 'no_spend',
        category: 'Shopping',
        targetValue: 30, // days
        reward: "💎 Minimalist Master"
    },
    {
        title: "30-Day Streak Logger",
        description: "Log at least 1 expense every day for 30 days",
        type: 'streak',
        targetValue: 30, // days
        reward: "🔥 Consistency King"
    },
    {
        title: "Bill-Free Weekend",
        description: "No Entertainment spending for 2 days",
        type: 'no_spend',
        category: 'Entertainment',
        targetValue: 2, // days
        reward: "🌿 Weekend Warrior"
    }
];

export function evaluateChallenges(challenges: Challenge[], expenses: Expense[]): Challenge[] {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return challenges.map(challenge => {
        if (challenge.status !== 'active') return challenge;

        const startDate = new Date(challenge.startDate);
        const endDate = new Date(challenge.endDate);

        // Check if time expired
        if (now > endDate && challenge.status === 'active') {
            // For no_spend, if time is up and we haven't failed yet, we succeeded!
            if (challenge.type === 'no_spend') {
                return { ...challenge, status: 'completed', progress: 100, updatedAt: Date.now() };
            }
            // For others, if time is up and progress < 100, we failed
            if (challenge.progress < 100) {
                return { ...challenge, status: 'failed', updatedAt: Date.now() };
            }
        }

        let progress = challenge.progress;
        let status: Challenge['status'] = challenge.status;

        // Filter expenses within challenge period
        const challengeExpenses = expenses.filter(e => {
            const eDate = new Date(e.date);
            return eDate >= startDate && eDate <= endDate;
        });

        switch (challenge.type) {
            case 'no_spend':
                if (challenge.category) {
                    const failedExpense = challengeExpenses.find(e => e.category === challenge.category);
                    if (failedExpense) {
                        status = 'failed';
                        progress = 0;
                    } else {
                        // Calculate progress based on time passed
                        const totalDuration = endDate.getTime() - startDate.getTime();
                        const timePassed = now.getTime() - startDate.getTime();
                        progress = Math.min(100, (timePassed / totalDuration) * 100);
                    }
                }
                break;

            case 'limit_category':
                if (challenge.category) {
                    const spent = challengeExpenses
                        .filter(e => e.category === challenge.category)
                        .reduce((sum, e) => sum + e.amount, 0);

                    // Progress is how close we are to the LIMIT (inverse?)
                    // Actually, usually these challenges are "don't exceed X".
                    // So progress towards failure? Or progress towards completion (time)?
                    // Let's say: Progress = time passed, BUT if spent > limit, status = failed.

                    if (spent > challenge.targetValue) {
                        status = 'failed';
                        progress = 0;
                    } else {
                        const totalDuration = endDate.getTime() - startDate.getTime();
                        const timePassed = now.getTime() - startDate.getTime();
                        progress = Math.min(100, (timePassed / totalDuration) * 100);
                    }
                }
                break;

            case 'save_amount':
                // This is tricky without a separate "savings" transaction type.
                // For now, let's assume manual progress updates via UI (which we might not have built yet),
                // OR we just leave it as is for now if we don't have a way to track "savings".
                // Alternative: Track "Income" - "Expense" ? Too complex.
                // Let's stick to the prompt: "manually tracking (show 'Add Savings' input)"
                // So evaluation logic might not auto-update this, unless we store 'currentAmount' in challenge?
                // The Challenge interface has `progress` (0-100). 
                // We need a place to store "currentValue" for save_amount type.
                // For now, we'll rely on the manual input to update 'progress' directly.
                break;

            case 'streak':
                // Check days with at least one expense
                // This is a bit complex. We need to check continuity.
                // Or just count "days with expense" within the period?
                // Prompt says: "at least 1 expense logged each day"

                // 1. Get all unique dates with expenses in range
                const daysWithExpense = new Set(
                    challengeExpenses.map(e => new Date(e.date).toDateString())
                );

                // 2. Check strict streak from start date? or just count?
                // "30-Day Streak" usually implies consecutive.
                // Let's count consecutive days from startDate? 
                // Or just total unique days? "Log... every day" implies consecutive.

                let streak = 0;
                let activeStreak = true;

                // Iterate day by day from start
                // This could be heavy if long duration, but usually < 30 days.
                const loopDate = new Date(startDate);
                while (loopDate <= now && activeStreak) {
                    if (daysWithExpense.has(loopDate.toDateString())) {
                        streak++;
                    } else {
                        // If today is the missing day, and it's not over yet, maybe we don't fail yet?
                        // But for a past day, it breaks the streak.
                        if (loopDate.toDateString() !== now.toDateString()) {
                            // Missed a past day
                            // status = 'failed'; // Or reset streak?
                            // Usually streak challenges reset or fail. Let's fail for strictness.
                            status = 'failed';
                            activeStreak = false;
                        }
                    }
                    loopDate.setDate(loopDate.getDate() + 1);
                }

                if (status !== 'failed') {
                    progress = Math.min(100, (streak / challenge.targetValue) * 100);
                    if (streak >= challenge.targetValue) {
                        status = 'completed';
                        progress = 100;
                    }
                }
                break;
        }

        if (progress >= 100 && status !== 'failed') {
            status = 'completed';
        }

        return { ...challenge, status, progress, updatedAt: Date.now() };
    });
}
