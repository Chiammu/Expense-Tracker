import { create } from 'zustand';

import { AppState, INITIAL_STATE, Expense, Section, FixedPayment } from '../types';
import { loadFromStorage, saveToStorage, forceCloudSync } from '../services/storage';

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
    deleteExpense: (id: number) => void;
    reset: () => void;
}

export const useAppStore = create<AppStore>()(
    (set, get) => ({
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
            const newExpense = { ...expense, id: Date.now(), updatedAt: Date.now() };
            let updatedCards = state.creditCards;

            if (newExpense.paymentMode === 'Card' && newExpense.cardId) {
                updatedCards = state.creditCards.map(c =>
                    c.id === newExpense.cardId
                        ? { ...c, currentBalance: c.currentBalance + newExpense.amount, updatedAt: Date.now() }
                        : c
                );
            }

            const nextState = {
                ...state,
                expenses: [...state.expenses, newExpense],
                creditCards: updatedCards,
                updatedAt: Date.now()
            };

            return nextState;
        }),

        updateExpense: (updatedExpense) => set((state) => {
            const nextState = {
                ...state,
                expenses: state.expenses.map(e => e.id === updatedExpense.id ? { ...updatedExpense, updatedAt: Date.now() } : e),
                expenseToEdit: null, // Clear edit mode
                activeSection: 'summaries', // Redirect to summaries after edit
                updatedAt: Date.now()
            };
            return nextState;
        }),

        deleteExpense: (id) => set((state) => ({
            ...state,
            expenses: state.expenses.filter(e => e.id !== id),
            updatedAt: Date.now()
        })),

        reset: () => set({ ...INITIAL_STATE, isGuest: false })
    })
);
