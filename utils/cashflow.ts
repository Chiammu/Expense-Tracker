import { AppState, FixedPayment, Expense } from '../types';

export interface CashEvent {
  label: string;
  amount: number;
  type: 'expense' | 'income' | 'bill';
}

export interface DayForecast {
  date: string;
  dayOfMonth: number;
  projectedBalance: number;
  events: CashEvent[];
  type: 'normal' | 'bill_day' | 'danger' | 'income_day';
}

function getAverageDailySpend(expenses: Expense[], days: number = 30): number {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const recentExpenses = expenses.filter(exp => {
    const expDate = new Date(exp.date);
    return expDate >= cutoff;
  });

  const totalSpent = recentExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  return totalSpent / days;
}

function getMonthlyDailyIncome(incomePerson1: number, incomePerson2: number): number {
  const totalMonthlyIncome = (incomePerson1 || 0) + (incomePerson2 || 0);
  return totalMonthlyIncome / 30;
}

export function generateCashFlowForecast(state: AppState): DayForecast[] {
  const forecasts: DayForecast[] = [];
  const today = new Date();
  const dailyIncome = getMonthlyDailyIncome(state.incomePerson1, state.incomePerson2);
  const averageDailySpend = getAverageDailySpend(state.expenses);
  const totalMonthlyIncome = (state.incomePerson1 || 0) + (state.incomePerson2 || 0);

  let runningBalance = totalMonthlyIncome;

  for (let i = 0; i < 30; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + i);

    const dayOfMonth = currentDate.getDate();
    const dateStr = currentDate.toISOString().split('T')[0];

    const events: CashEvent[] = [];

    if (i === 0) {
      events.push({
        label: 'Starting Balance (Monthly Income)',
        amount: totalMonthlyIncome,
        type: 'income'
      });
    }

    state.fixedPayments.forEach((payment: FixedPayment) => {
      if (payment.day === dayOfMonth) {
        events.push({
          label: payment.name,
          amount: -payment.amount,
          type: 'bill'
        });
      }
    });

    events.push({
      label: 'Est. Daily Spending',
      amount: -averageDailySpend,
      type: 'expense'
    });

    const dailyChange = events.reduce((sum, event) => sum + event.amount, 0);
    runningBalance += dailyChange;

    let type: 'normal' | 'bill_day' | 'danger' | 'income_day' = 'normal';
    const hasBill = events.some(e => e.type === 'bill');
    const isIncomeDay = i === 0;

    if (runningBalance < 0) {
      type = 'danger';
    } else if (hasBill) {
      type = 'bill_day';
    } else if (isIncomeDay) {
      type = 'income_day';
    } else if (runningBalance < totalMonthlyIncome * 0.2) {
      type = 'danger';
    }

    forecasts.push({
      date: dateStr,
      dayOfMonth,
      projectedBalance: runningBalance,
      events,
      type
    });
  }

  return forecasts;
}

export function getDangerZones(forecasts: DayForecast[]): DayForecast[] {
  return forecasts.filter(f => f.projectedBalance < 0);
}
