import { AppState } from '../types';

export const calculateSpendScore = (state: AppState): {
    score: number,
    grade: 'A' | 'B' | 'C' | 'D' | 'F',
    breakdown: Record<string, number>,
    tip: string
} => {
    let score = 100;
    let breakdown: Record<string, number> = {
        budgetAdherence: 0,
        savingsRate: 0,
        loanBurden: 0,
        categoryDiscipline: 0,
        savingsGoalProgress: 0
    };

    const totalSpent = state.expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const totalIncome = (state.incomePerson1 || 0) + (state.incomePerson2 || 0) + state.otherIncome.reduce((acc, curr) => acc + curr.amount, 0);

    // 1. Budget Adherence (Max -30)
    if (state.monthlyBudget > 0) {
        const budgetRatio = totalSpent / state.monthlyBudget;
        if (budgetRatio > 1) {
            // Deduct proportionally: 100% budget = 0 deduction, 150% budget = 30 deduction
            // Formula: (ratio - 1) * 60, capped at 30
            // e.g. 1.1 (10% over) -> 0.1 * 60 = 6 deduction
            // e.g. 1.5 (50% over) -> 0.5 * 60 = 30 deduction
            const penalty = Math.min(30, (budgetRatio - 1) * 60);
            score -= penalty;
            breakdown.budgetAdherence = -Math.round(penalty);
        }
    } else if (totalSpent > 0) {
        // No budget set but spending money? Small penalty for lack of planning
        score -= 10;
        breakdown.budgetAdherence = -10;
    }

    // 2. Savings Rate (Max -25)
    // Target: 20% savings. < 0% savings (spending > income) = full penalty
    if (totalIncome > 0) {
        const savings = totalIncome - totalSpent;
        const savingsRate = savings / totalIncome;

        if (savingsRate < 0.2) {
            // 20% savings = 0 penalty. 0% savings = 25 penalty.
            // Formula: (0.2 - rate) * 125
            // e.g. 0.1 (10%) -> 0.1 * 125 = 12.5 deduction
            // e.g. 0 (0%) -> 0.2 * 125 = 25 deduction
            // e.g. -0.1 (-10%) -> 0.3 * 125 = 37.5 -> capped at 25
            const penalty = Math.min(25, Math.max(0, (0.2 - savingsRate) * 125));
            score -= penalty;
            breakdown.savingsRate = -Math.round(penalty);
        }
    } else {
        // No income recorded?
        score -= 5;
        breakdown.savingsRate = -5;
    }

    // 3. Loan Burden (Max -20)
    // EMI / Income ratio. > 50% is dangerous (full penalty).
    const totalEMI = state.loans.reduce((acc, loan) => acc + loan.emiAmount, 0) +
        state.fixedPayments.filter(fp => fp.name.toLowerCase().includes('emi') || fp.name.includes('loan')).reduce((acc, fp) => acc + fp.amount, 0);

    if (totalIncome > 0) {
        const debtRatio = totalEMI / totalIncome;
        if (debtRatio > 0.1) { // 10% is healthy-ish, start deducting after that? Or start from 0?
            // Let's adhere to spec: Deduct based on total EMI as % of income. Full -20 if EMIs > 50% of income.
            // Let's say 0-10% is fine. 10%-50% scales to 20 pts.
            // (ratio - 0.1) * (20 / 0.4) = (ratio - 0.1) * 50
            if (debtRatio > 0.5) {
                score -= 20;
                breakdown.loanBurden = -20;
            } else if (debtRatio > 0.1) {
                const penalty = (debtRatio - 0.1) * 50;
                score -= penalty;
                breakdown.loanBurden = -Math.round(penalty);
            }
        }
    } else if (totalEMI > 0) {
        score -= 20; // High burden if no income
        breakdown.loanBurden = -20;
    }

    // 4. Category Discipline (Max -15)
    // Deduct if any single non-essential category > 30% of total spending
    const categoryBreakdown: Record<string, number> = {};
    state.expenses.forEach(e => {
        categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
    });

    const essentials = ['rent', 'emi', 'bills', 'medical', 'education', 'groceries'];
    let maxCategoryShare = 0;
    let penaltyCat = '';

    for (const [cat, amount] of Object.entries(categoryBreakdown)) {
        if (totalSpent > 0 && !essentials.includes(cat.toLowerCase())) {
            const share = amount / totalSpent;
            if (share > 0.3) {
                maxCategoryShare = Math.max(maxCategoryShare, share);
                penaltyCat = cat;
            }
        }
    }

    if (maxCategoryShare > 0.3) {
        // 30% -> 0 penalty. 60% -> 15 penalty? Or flat 15?
        // Spec says: "Deduct if any single non-essential category > 30% of total spending"
        // Implies binary or proportional. Let's make it proportional up to 60% (intense concentration).
        // (share - 0.3) * 50
        // 0.3 -> 0
        // 0.6 -> 0.3 * 50 = 15
        const penalty = Math.min(15, (maxCategoryShare - 0.3) * 50);
        score -= penalty;
        breakdown.categoryDiscipline = -Math.round(penalty);
    }

    // 5. Savings Goal Progress (Max -10)
    // Deduct if no savings goals or goals have 0 progress
    if (state.savingsGoals.length === 0) {
        score -= 10;
        breakdown.savingsGoalProgress = -10;
    } else {
        const totalTarget = state.savingsGoals.reduce((sum, g) => sum + g.targetAmount, 0);
        const totalSaved = state.savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);
        if (totalTarget > 0) {
            const progress = totalSaved / totalTarget;
            if (progress === 0) {
                score -= 10;
                breakdown.savingsGoalProgress = -10;
            } else if (progress < 0.1) {
                // Low progress penalty
                score -= 5;
                breakdown.savingsGoalProgress = -5;
            }
        }
    }

    // Clamp Score
    score = Math.max(0, Math.min(100, Math.round(score)));

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (score >= 80) grade = 'A';
    else if (score >= 60) grade = 'B';
    else if (score >= 40) grade = 'C';
    else if (score >= 20) grade = 'D';

    let tip = "Great job! Keep it up.";
    if (score < 80) tip = "Review your budget to improve your score.";
    if (breakdown.budgetAdherence < -5) tip = "You're overspending your monthly budget.";
    if (breakdown.savingsRate < -5) tip = "Try to save at least 20% of your income.";
    if (breakdown.loanBurden < -5) tip = "Debt payments are eating up too much income.";
    if (breakdown.categoryDiscipline < -5) tip = `You're spending too much on ${penaltyCat || 'one category'}.`;
    if (breakdown.savingsGoalProgress < -5) tip = "Set aside some money for your goals.";

    return { score, grade, breakdown, tip };
};
