import { create } from 'zustand';

import { AppState, INITIAL_STATE, Expense, Section, CashTransaction } from '../types';
interface AppStore extends AppState {
    isGuest: boolean;
    activeSection: Section;
    expenseToEdit: Expense | null; // Added state
    setSection: (section: Section) => void;
    setGuest: (isGuest: boolean) => void;
    setExpenseToEdit: (expense: Expense | null) => void; // Added action
    setState: (state: Partial<AppState>) => void;
    addExpense: (expense: Omit<Expense, 'id' | 'updatedAt'>) => void;
    updateExpense: (expense: Expense) => void;
    deleteExpense: (id: string) => void;
    addCashTransaction: (tx: CashTransaction) => void;
    deleteCashTransaction: (id: string) => void;
    setCashBalance: (amount: number) => void;
    reset: () => void;
}

const applyCardDelta = (cards: AppState['creditCards'], cardId: string, delta: number, timestamp: number) => {
    return cards.map((card) =>
        card.id === cardId
            ? { ...card, currentBalance: card.currentBalance + delta, updatedAt: timestamp }
            : card
    );
};

export const useAppStore = create<AppStore>()(
    (set) => ({
        ...INITIAL_STATE,
        isGuest: false,
        activeSection: 'add-expense',
        expenseToEdit: null,

        setSection: (section) => set({ activeSection: section }),
        setGuest: (isGuest) => set({ isGuest }),

        setExpenseToEdit: (expense) => set((state) => {
            // Automatically switch tab when editing
            return { expenseToEdit: expense, activeSection: expense ? 'add-expense' : state.activeSection };
        }),

        setState: (newState) => set((state) => ({ ...state, ...newState })),

        addExpense: (expense) => set((state) => {
            const now = Date.now();
            const newExpense: Expense = { ...expense, id: String(now), updatedAt: now };
            let updatedCards = state.creditCards;

            if (newExpense.paymentMode === 'Card' && newExpense.cardId) {
                updatedCards = applyCardDelta(state.creditCards, newExpense.cardId, newExpense.amount, now);
            }

            const nextState = {
                ...state,
                expenses: [...state.expenses, newExpense],
                creditCards: updatedCards,
                updatedAt: now
            };

            return nextState;
        }),

        updateExpense: (updatedExpense) => set((state) => {
            const now = Date.now();
            const originalExpense = state.expenses.find((expense) => expense.id === updatedExpense.id);
            let updatedCards = state.creditCards;

            if (originalExpense?.paymentMode === 'Card' && originalExpense.cardId) {
                updatedCards = applyCardDelta(updatedCards, originalExpense.cardId, -originalExpense.amount, now);
            }

            if (updatedExpense.paymentMode === 'Card' && updatedExpense.cardId) {
                updatedCards = applyCardDelta(updatedCards, updatedExpense.cardId, updatedExpense.amount, now);
            }

            const nextState = {
                ...state,
                expenses: state.expenses.map(e => e.id === updatedExpense.id ? { ...updatedExpense, updatedAt: now } : e),
                creditCards: updatedCards,
                expenseToEdit: null, // Clear edit mode
                activeSection: 'summaries' as Section, // Redirect to summaries after edit
                updatedAt: now
            };
            return nextState;
        }),

        deleteExpense: (id) => set((state) => {
            const now = Date.now();
            const expenseToDelete = state.expenses.find((expense) => expense.id === id);
            let updatedCards = state.creditCards;

            if (expenseToDelete?.paymentMode === 'Card' && expenseToDelete.cardId) {
                updatedCards = applyCardDelta(updatedCards, expenseToDelete.cardId, -expenseToDelete.amount, now);
            }

            return {
                ...state,
                expenses: state.expenses.filter(e => e.id !== id),
                creditCards: updatedCards,
                updatedAt: now
            };
        }),

        addCashTransaction: (tx) => set((state) => ({
            ...state,
            cashWallet: {
                ...state.cashWallet,
                balance: tx.type === 'topup' ? state.cashWallet.balance + tx.amount : state.cashWallet.balance - tx.amount,
                transactions: [tx, ...state.cashWallet.transactions],
                updatedAt: Date.now()
            }
        })),

        deleteCashTransaction: (id) => set((state) => {
            const tx = state.cashWallet.transactions.find(t => t.id === id);
            if (!tx) return state;
            return {
                ...state,
                cashWallet: {
                    ...state.cashWallet,
                    balance: tx.type === 'topup' ? state.cashWallet.balance - tx.amount : state.cashWallet.balance + tx.amount,
                    transactions: state.cashWallet.transactions.filter(t => t.id !== id),
                    updatedAt: Date.now()
                }
            };
        }),

        setCashBalance: (amount) => set((state) => ({
            ...state,
            cashWallet: {
                ...state.cashWallet,
                balance: amount,
                updatedAt: Date.now()
            }
        })),

        reset: () => set({
            ...INITIAL_STATE,
            isGuest: false,
            activeSection: 'add-expense',
            expenseToEdit: null
        })
    })
);
