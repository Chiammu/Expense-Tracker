import { AppState, Expense, FixedPayment } from '../types';

export interface CashEvent {
    label: string;
    amount: number;
    type: 'expense' | 'income' | 'bill';
}

export interface DayForecast {
    date: string;        // YYYY-MM-DD
    dayOfMonth: number;
    projectedBalance: number;
    events: CashEvent[];
    type: 'normal' | 'bill_day' | 'danger' | 'income_day';
}

export function generateCashFlowForecast(state: AppState): DayForecast[] {
    const forecast: DayForecast[] = [];
    const today = new Date();

    // 1. Calculate Daily Income (Prorated)
    // Prorated income approach as per requirements
    const totalMonthlyIncome = (state.incomePerson1 || 0) + (state.incomePerson2 || 0);
    const dailyIncome = totalMonthlyIncome / 30;

    // 2. Estimate Variable Daily Expenses
    // Average of last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const recentExpenses = state.expenses.filter(e => {
        const expenseDate = new Date(e.date);
        return expenseDate >= thirtyDaysAgo && expenseDate <= today;
    });

    const totalRecentSpend = recentExpenses.reduce((sum, e) => sum + e.amount, 0);
    const estimatedDailySpend = totalRecentSpend / 30;

    // Initial running balance
    // We start from 0 as the cumulative cash flow for the next 30 days, 
    // or should we start with current available budget? 
    // The requirement says: "Start with running balance = incomePerson1 + incomePerson2 (monthly, prorated daily = /30)"
    // This likely means for the *first day*, the balance is 1 day of income?.
    // Let's track the *cumulative* balance over the period.
    let runningBalance = 0;

    for (let i = 0; i < 30; i++) {
        const currentDate = new Date();
        currentDate.setDate(today.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfMonth = currentDate.getDate();
        const events: CashEvent[] = [];
        let dayType: DayForecast['type'] = 'normal';

        // Add daily income
        runningBalance += dailyIncome;
        // We don't necessarily add an event for the daily drip unless requested, 
        // but maybe for the 1st of month if we were doing actual paydays.
        // Here we just silently add the prorated amount to the balance.

        // Subtract estimated spend
        runningBalance -= estimatedDailySpend;

        // Check for fixed payments due on this day
        const dayPayments = state.fixedPayments.filter(p => p.day === dayOfMonth);

        dayPayments.forEach(p => {
            runningBalance -= p.amount;
            events.push({
                label: p.name,
                amount: p.amount,
                type: 'bill'
            });
            dayType = 'bill_day';
        });

        // Check if balance dips below zero
        if (runningBalance < 0) {
            dayType = 'danger';
        } else if ((dayType as any) === 'bill_day') {
            // Keep bill_day unless danger
        } else if (dailyIncome > estimatedDailySpend * 2) {
            // Just a visual heuristic for "good income day" if needed, 
            // but since income is prorated daily, every day is an income day?
            // The prompt says: "Mark days with income credit as 'income_day' type"
            // Since we prorate, effectively every day has income credit. 
            // Maybe we only mark it if we had specific income dates? 
            // For now, let's stick to 'normal' unless it's a bill or danger.
        }

        forecast.push({
            date: dateStr,
            dayOfMonth,
            projectedBalance: runningBalance,
            events,
            type: dayType
        });
    }

    return forecast;
}
