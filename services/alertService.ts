import { AppState } from '../types';

export interface Alert {
    id: string;
    type: 'warning' | 'danger' | 'info';
    title: string;
    message: string;
    category?: string;
    dismissed?: boolean;
}

export const checkBudgetAlerts = (state: AppState): Alert[] => {
    const alerts: Alert[] = [];
    const totalSpent = state.expenses.reduce((acc, curr) => acc + curr.amount, 0);

    // 1. Category Budget Alerts (> 80%)
    const categorySpending: Record<string, number> = {};
    state.expenses.forEach(e => {
        categorySpending[e.category] = (categorySpending[e.category] || 0) + e.amount;
    });

    for (const [cat, budget] of Object.entries(state.categoryBudgets)) {
        if (budget > 0) {
            const spent = categorySpending[cat] || 0;
            const percentage = spent / budget;

            if (percentage >= 1.0) {
                alerts.push({
                    id: `cat-exceed-${cat}`,
                    type: 'danger',
                    title: `Over Budget: ${cat}`,
                    message: `You've exceeded your ${cat} budget by ₹${spent - budget}.`,
                    category: cat
                });
            } else if (percentage >= 0.8) {
                alerts.push({
                    id: `cat-warn-${cat}`,
                    type: 'warning',
                    title: `Budget Warning: ${cat}`,
                    message: `You've used ${Math.round(percentage * 100)}% of your ${cat} budget.`,
                    category: cat
                });
            }
        }
    }

    // 2. Total Monthly Budget Alert (> 80%)
    if (state.monthlyBudget > 0) {
        const totalPercentage = totalSpent / state.monthlyBudget;
        if (totalPercentage >= 1.0) {
            alerts.push({
                id: 'total-exceed',
                type: 'danger',
                title: 'Monthly Budget Exceeded',
                message: `You have spent ₹${totalSpent}, exceeding your budget of ₹${state.monthlyBudget}.`
            });
        } else if (totalPercentage >= 0.8) {
            alerts.push({
                id: 'total-warn',
                type: 'warning',
                title: 'Approaching Monthly Limit',
                message: `You have spent ${Math.round(totalPercentage * 100)}% of your total budget.`
            });
        }
    }

    // 3. Loan/Fixed Payment Due (Next 7 days)
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    state.fixedPayments.forEach(fp => {
        let daysUntil = fp.day - currentDay;
        if (daysUntil < 0) {
            // If due day passed, check if it's "next month's check" or "overdue"?
            // Use logic: if today is 28, and due is 2, it's 4 days away (next month).
            daysUntil += daysInMonth;
        }

        if (daysUntil >= 0 && daysUntil <= 7) {
            alerts.push({
                id: `bill-due-${fp.id}`,
                type: 'info',
                title: 'Upcoming Bill',
                message: `${fp.name} (₹${fp.amount}) is due in ${daysUntil === 0 ? 'today' : daysUntil + ' days'}.`
            });
        }
    });

    // 4. Stagnant Savings Goal (30+ days no change)
    // We need to check 'updatedAt' of savings goals.
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    state.savingsGoals.forEach(goal => {
        if (goal.targetAmount > goal.currentAmount && (Date.now() - goal.updatedAt > thirtyDaysMs)) {
            alerts.push({
                id: `goal-stagnant-${goal.id}`,
                type: 'info',
                title: 'Stagnant Goal',
                message: `You haven't contributed to '${goal.name}' in over 30 days.`
            });
        }
    });

    return alerts;
};

// Browser Push / Local Notifications
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
};

export const sendLocalNotification = (title: string, body: string, icon?: string) => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body,
                icon: icon || '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
                vibrate: [200, 100, 200]
            } as any);
        } catch (e) {
            console.error("Notification failed", e);
        }
    }
};
