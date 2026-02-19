import { AppState, SavingsGoal, Loan, FixedPayment } from '../types';

export interface SpendScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: Record<string, number>;
  tip: string;
}

const NON_ESSENTIAL_CATEGORIES = ['Shopping', 'Entertainment', 'Travel', 'Food'];

/**
 * Calculate the Financial Spend Score (FinScore) based on budget adherence,
 * savings rate, loan burden, category discipline, and savings goal progress.
 * 
 * Score starts at 100 and deductions are applied based on various factors.
 */
export const calculateSpendScore = (state: AppState): SpendScoreResult => {
  const breakdown: Record<string, number> = {
    budgetAdherence: 0,
    savingsRate: 0,
    loanBurden: 0,
    categoryDiscipline: 0,
    savingsGoalProgress: 0,
  };

  // Calculate current month expenses
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const currentMonthExpenses = state.expenses.filter(e => {
    const date = new Date(e.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
  
  const totalMonthlySpending = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = (state.incomePerson1 || 0) + (state.incomePerson2 || 0) + 
    state.otherIncome.reduce((sum, i) => sum + i.amount, 0);

  // 1. Budget Adherence (-30 max)
  if (state.monthlyBudget > 0) {
    const budgetRatio = totalMonthlySpending / state.monthlyBudget;
    if (budgetRatio > 1) {
      // Over budget - deduct proportionally
      // Full -30 if >= 150% of budget
      const overBudgetRatio = Math.min((budgetRatio - 1) / 0.5, 1);
      breakdown.budgetAdherence = -Math.round(overBudgetRatio * 30);
    }
  }

  // 2. Savings Rate (-25 max)
  if (totalIncome > 0) {
    const savings = totalIncome - totalMonthlySpending;
    const savingsRate = savings / totalIncome;
    // Ideal is 20% savings rate
    if (savingsRate < 0.2) {
      // Deduct proportionally - full -25 if saving nothing or negative
      const savingsDeficit = Math.max(0, 0.2 - savingsRate) / 0.2;
      breakdown.savingsRate = -Math.round(Math.min(savingsDeficit, 1) * 25);
    }
  } else {
    // No income set - deduct maximum
    breakdown.savingsRate = -25;
  }

  // 3. Loan Burden (-20 max)
  const totalEMI = state.loans.reduce((sum, loan) => sum + (loan.emiAmount || 0), 0);
  if (totalIncome > 0 && totalEMI > 0) {
    const emiRatio = totalEMI / totalIncome;
    // Full -20 if EMIs > 50% of income
    if (emiRatio > 0.3) {
      const emiBurden = Math.min((emiRatio - 0.3) / 0.2, 1);
      breakdown.loanBurden = -Math.round(emiBurden * 20);
    }
  }

  // 4. Category Discipline (-15 max)
  if (totalMonthlySpending > 0) {
    const categorySpending: Record<string, number> = {};
    currentMonthExpenses.forEach(e => {
      categorySpending[e.category] = (categorySpending[e.category] || 0) + e.amount;
    });

    // Check if any non-essential category > 30% of total spending
    for (const category of NON_ESSENTIAL_CATEGORIES) {
      const categoryAmount = categorySpending[category] || 0;
      const categoryRatio = categoryAmount / totalMonthlySpending;
      if (categoryRatio > 0.3) {
        const overSpend = Math.min((categoryRatio - 0.3) / 0.2, 1);
        breakdown.categoryDiscipline = -Math.round(overSpend * 15);
        break; // Only penalize once for the worst offender
      }
    }
  }

  // 5. Savings Goal Progress (-10 max)
  if (state.savingsGoals.length === 0) {
    // No savings goals - small penalty
    breakdown.savingsGoalProgress = -5;
  } else {
    // Check if any goal has been stagnant for 30+ days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const stagnantGoals = state.savingsGoals.filter(goal => {
      const progress = goal.currentAmount / goal.targetAmount;
      const lastUpdated = goal.updatedAt || 0;
      return progress < 0.5 && lastUpdated < thirtyDaysAgo;
    });
    
    if (stagnantGoals.length > 0) {
      breakdown.savingsGoalProgress = -10;
    } else {
      // Calculate average progress
      const avgProgress = state.savingsGoals.reduce((sum, g) => 
        sum + (g.currentAmount / g.targetAmount), 0) / state.savingsGoals.length;
      if (avgProgress < 0.25) {
        breakdown.savingsGoalProgress = -5;
      }
    }
  }

  // Calculate final score
  let score = 100;
  Object.values(breakdown).forEach(deduction => {
    score += deduction;
  });
  score = Math.max(0, Math.min(100, score));

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 80) grade = 'A';
  else if (score >= 60) grade = 'B';
  else if (score >= 40) grade = 'C';
  else if (score >= 20) grade = 'D';
  else grade = 'F';

  // Generate tip
  const tip = generateTip(breakdown, state, totalMonthlySpending, totalIncome);

  return { score, grade, breakdown, tip };
};

const generateTip = (
  breakdown: Record<string, number>, 
  state: AppState, 
  totalSpending: number, 
  totalIncome: number
): string => {
  const tips: string[] = [];

  if (breakdown.budgetAdherence <= -20) {
    tips.push("You're significantly over budget this month. Review your recent expenses and identify areas to cut back.");
  } else if (breakdown.budgetAdherence <= -10) {
    tips.push("You've exceeded your budget. Consider postponing non-essential purchases until next month.");
  }

  if (breakdown.savingsRate <= -15) {
    tips.push("Your savings rate is critically low. Aim to save at least 20% of your income for financial security.");
  } else if (breakdown.savingsRate <= -10) {
    tips.push("Try to increase your savings rate. Even small automatic transfers can help build wealth over time.");
  }

  if (breakdown.loanBurden <= -15) {
    tips.push("Your EMI burden is very high. Consider refinancing or creating a debt payoff strategy.");
  } else if (breakdown.loanBurden <= -10) {
    tips.push("Consider prioritizing debt repayment to reduce your monthly EMI obligations.");
  }

  if (breakdown.categoryDiscipline <= -10) {
    tips.push("One of your non-essential categories is consuming too much of your budget. Set category-specific limits.");
  }

  if (breakdown.savingsGoalProgress <= -5) {
    tips.push("Your savings goals need attention. Set up automatic contributions to stay on track.");
  }

  if (tips.length === 0) {
    return "Great job! You're managing your finances well. Keep up the good work and consider setting more ambitious savings goals.";
  }

  return tips[Math.floor(Math.random() * tips.length)];
};

/**
 * Get color for score grade
 */
export const getScoreColor = (grade: 'A' | 'B' | 'C' | 'D' | 'F'): string => {
  switch (grade) {
    case 'A': return '#22c55e'; // green
    case 'B': return '#14b8a6'; // teal
    case 'C': return '#eab308'; // yellow
    case 'D': return '#f97316'; // orange
    case 'F': return '#ef4444'; // red
  }
};

/**
 * Get hex color for grade for gradient backgrounds
 */
export const getScoreGradient = (grade: 'A' | 'B' | 'C' | 'D' | 'F'): { start: string; end: string } => {
  switch (grade) {
    case 'A': return { start: '#22c55e', end: '#16a34a' };
    case 'B': return { start: '#14b8a6', end: '#0d9488' };
    case 'C': return { start: '#eab308', end: '#ca8a04' };
    case 'D': return { start: '#f97316', end: '#ea580c' };
    case 'F': return { start: '#ef4444', end: '#dc2626' };
  }
};