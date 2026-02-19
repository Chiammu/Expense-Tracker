import { AppState, SavingsGoal, FixedPayment } from '../types';

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  category?: string;
}

/**
 * Check for budget alerts based on current spending patterns
 */
export const checkBudgetAlerts = (state: AppState): Alert[] => {
  const alerts: Alert[] = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  // Get current month expenses
  const currentMonthExpenses = state.expenses.filter(e => {
    const date = new Date(e.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const totalMonthlySpending = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // 1. Check category budget alerts (>80% of categoryBudgets)
  if (state.categoryBudgets && Object.keys(state.categoryBudgets).length > 0) {
    const categorySpending: Record<string, number> = {};
    currentMonthExpenses.forEach(e => {
      categorySpending[e.category] = (categorySpending[e.category] || 0) + e.amount;
    });

    for (const [category, budget] of Object.entries(state.categoryBudgets)) {
      if (budget > 0) {
        const spent = categorySpending[category] || 0;
        const ratio = spent / budget;

        if (ratio >= 0.8) {
          const isDanger = ratio >= 1;
          alerts.push({
            id: `category-${category}-${currentMonth}-${currentYear}`,
            type: isDanger ? 'danger' : 'warning',
            title: `${category} Budget ${isDanger ? 'Exceeded' : 'Warning'}`,
            message: isDanger
              ? `${category} budget of ₹${budget.toLocaleString()} exceeded! Spent: ₹${spent.toLocaleString()}`
              : `${category} spending at ${Math.round(ratio * 100)}% of budget (₹${spent.toLocaleString()} / ₹${budget.toLocaleString()})`,
            category,
          });
        }
      }
    }
  }

  // 2. Check monthly budget alert (>80% of monthlyBudget)
  if (state.monthlyBudget > 0) {
    const ratio = totalMonthlySpending / state.monthlyBudget;
    if (ratio >= 0.8) {
      const isDanger = ratio >= 1;
      alerts.push({
        id: `monthly-budget-${currentMonth}-${currentYear}`,
        type: isDanger ? 'danger' : 'warning',
        title: `Monthly Budget ${isDanger ? 'Exceeded' : 'Warning'}`,
        message: isDanger
          ? `Monthly budget of ₹${state.monthlyBudget.toLocaleString()} exceeded! Total spent: ₹${totalMonthlySpending.toLocaleString()}`
          : `Monthly spending at ${Math.round(ratio * 100)}% of budget (₹${totalMonthlySpending.toLocaleString()} / ₹${state.monthlyBudget.toLocaleString()})`,
      });
    }
  }

  // 3. Check for EMI due this week (fixedPayments within next 7 days)
  if (state.fixedPayments && state.fixedPayments.length > 0) {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    state.fixedPayments.forEach(payment => {
      const paymentDay = payment.day;
      
      // Check if payment day is within next 7 days
      let daysUntilPayment = paymentDay - currentDay;
      
      // Handle month wrap-around
      if (daysUntilPayment < 0) {
        // Payment day has passed this month, calculate for next month
        daysUntilPayment = (daysInMonth - currentDay) + paymentDay;
      } else if (daysUntilPayment > daysInMonth) {
        // Edge case: shouldn't happen normally
        daysUntilPayment = paymentDay - currentDay;
      }

      if (daysUntilPayment >= 0 && daysUntilPayment <= 7) {
        alerts.push({
          id: `payment-${payment.id}-${currentMonth}-${currentYear}`,
          type: daysUntilPayment <= 2 ? 'danger' : 'warning',
          title: `Upcoming Payment: ${payment.name}`,
          message: daysUntilPayment === 0
            ? `₹${payment.amount.toLocaleString()} payment due today!`
            : daysUntilPayment === 1
            ? `₹${payment.amount.toLocaleString()} payment due tomorrow`
            : `₹${payment.amount.toLocaleString()} payment due in ${daysUntilPayment} days`,
        });
      }
    });
  }

  // 4. Check for stagnant savings goals (no progress in 30+ days)
  if (state.savingsGoals && state.savingsGoals.length > 0) {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    state.savingsGoals.forEach(goal => {
      const progress = goal.currentAmount / goal.targetAmount;
      const lastUpdated = goal.updatedAt || 0;

      // Check if goal has been stagnant (less than 100% complete and not updated in 30 days)
      if (progress < 1 && lastUpdated < thirtyDaysAgo) {
        alerts.push({
          id: `goal-stagnant-${goal.id}`,
          type: 'info',
          title: `Stagnant Goal: ${goal.name}`,
          message: `No progress on "${goal.name}" in 30+ days. Current: ₹${goal.currentAmount.toLocaleString()} / ₹${goal.targetAmount.toLocaleString()}`,
        });
      }
    });
  }

  return alerts;
};

/**
 * Request browser notification permission
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission denied');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

/**
 * Send a local browser notification
 */
export const sendLocalNotification = (title: string, body: string, icon?: string): void => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  try {
    new Notification(title, {
      body,
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'expense-tracker-alert',
      requireInteraction: false,
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
};

/**
 * Check if notifications are supported and enabled
 */
export const canSendNotifications = (): boolean => {
  return 'Notification' in window && Notification.permission === 'granted';
};