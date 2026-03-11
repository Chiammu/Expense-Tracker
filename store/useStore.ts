import { create } from 'zustand';

import { AppState, INITIAL_STATE, Expense, Section, FixedPayment, CashTransaction } from '../types';
import { loadFromStorage, saveToStorage, forceCloudSync } from '../services/storage';
import { generateId } from '../utils/id';

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
    addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'updatedAt'>) => void;
    deleteCashTransaction: (id: string) => void;
    setCashBalance: (amount: number) => void;
    reset: () => void;
}

export const useAppStore = create<AppStore>()(
    (set, get) => ({
        ...INITIAL_STATE,
        isGuest: false,
        activeSection: 'add-expense' as Section,
        expenseToEdit: null,

        setSection: (section) => set({ activeSection: section as any }),
        setGuest: (isGuest) => set({ isGuest }),

        setExpenseToEdit: (expense) => set((state) => {
            // Automatically switch tab when editing
            return { expenseToEdit: expense, activeSection: expense ? 'add-expense' : state.activeSection };
        }),

        setState: (newState) => set((state) => ({ ...state, ...newState })),

        addExpense: (expense) => set((state) => {
            const newExpense = { ...expense, id: generateId(), updatedAt: Date.now() };
            let updatedCards = state.creditCards;
            let updatedCashWallet = state.cashWallet;

            if (newExpense.paymentMode === 'Card' && newExpense.cardId) {
                updatedCards = state.creditCards.map(c =>
                    c.id === newExpense.cardId
                        ? { ...c, currentBalance: c.currentBalance + newExpense.amount, updatedAt: Date.now() }
                        : c
                );
            } else if (newExpense.paymentMode === 'Cash') {
                const newTx: CashTransaction = {
                    id: newExpense.id,
                    type: 'expense',
                    amount: newExpense.amount,
                    note: newExpense.note,
                    date: newExpense.date,
                    person: newExpense.person,
                    updatedAt: Date.now()
                };
                updatedCashWallet = {
                    ...state.cashWallet,
                    balance: state.cashWallet.balance - newExpense.amount,
                    transactions: [newTx, ...state.cashWallet.transactions],
                    updatedAt: Date.now()
                };
            }

            const nextState = {
                ...state,
                expenses: [...state.expenses, newExpense],
                creditCards: updatedCards,
                cashWallet: updatedCashWallet,
                updatedAt: Date.now()
            };

            return nextState;
        }),

        updateExpense: (updatedExpense) => set((state) => {
            const oldExpense = state.expenses.find(e => e.id === updatedExpense.id);
            let updatedCards = state.creditCards;
            let updatedCashWallet = state.cashWallet;

            if (oldExpense) {
                // 1. Remove old amount from old card if it was a card payment
                if (oldExpense.paymentMode === 'Card' && oldExpense.cardId) {
                    updatedCards = updatedCards.map(c =>
                        c.id === oldExpense.cardId
                            ? { ...c, currentBalance: c.currentBalance - oldExpense.amount, updatedAt: Date.now() }
                            : c
                    );
                } else if (oldExpense.paymentMode === 'Cash') {
                    // Remove old cash transaction
                    updatedCashWallet = {
                        ...updatedCashWallet,
                        balance: updatedCashWallet.balance + oldExpense.amount,
                        transactions: updatedCashWallet.transactions.filter(t => t.id !== oldExpense.id),
                        updatedAt: Date.now()
                    };
                }

                // 2. Add new amount to new card if it is a card payment
                if (updatedExpense.paymentMode === 'Card' && updatedExpense.cardId) {
                    updatedCards = updatedCards.map(c =>
                        c.id === updatedExpense.cardId
                            ? { ...c, currentBalance: c.currentBalance + updatedExpense.amount, updatedAt: Date.now() }
                            : c
                    );
                } else if (updatedExpense.paymentMode === 'Cash') {
                    // Add new cash transaction
                    const newTx: CashTransaction = {
                        id: updatedExpense.id,
                        type: 'expense',
                        amount: updatedExpense.amount,
                        note: updatedExpense.note,
                        date: updatedExpense.date,
                        person: updatedExpense.person,
                        updatedAt: Date.now()
                    };
                    updatedCashWallet = {
                        ...updatedCashWallet,
                        balance: updatedCashWallet.balance - updatedExpense.amount,
                        transactions: [newTx, ...updatedCashWallet.transactions],
                        updatedAt: Date.now()
                    };
                }
            }

            const nextState = {
                ...state,
                expenses: state.expenses.map(e => e.id === updatedExpense.id ? { ...updatedExpense, updatedAt: Date.now() } : e),
                creditCards: updatedCards,
                cashWallet: updatedCashWallet,
                expenseToEdit: null,
                activeSection: 'summaries' as Section,
                updatedAt: Date.now()
            };
            return nextState;
        }),

        deleteExpense: (id) => set((state) => {
            const expense = state.expenses.find(e => e.id === id);
            let updatedCashWallet = state.cashWallet;

            if (expense && expense.paymentMode === 'Cash') {
                updatedCashWallet = {
                    ...updatedCashWallet,
                    balance: updatedCashWallet.balance + expense.amount,
                    transactions: updatedCashWallet.transactions.filter(t => t.id !== id),
                    updatedAt: Date.now()
                };
            }

            return {
                ...state,
                expenses: state.expenses.filter(e => e.id !== id),
                cashWallet: updatedCashWallet,
                updatedAt: Date.now()
            };
        }),

        addCashTransaction: (tx) => set((state) => {
            const newTx: CashTransaction = { ...tx, id: generateId(), updatedAt: Date.now() };
            const newTransactions = [...state.cashWallet.transactions, newTx];
            const newBalance = newTransactions.reduce((acc, curr) => {
                if (curr.type === 'topup') return acc + curr.amount;
                if (curr.type === 'withdraw' || curr.type === 'expense') return acc - curr.amount;
                return acc;
            }, 0);
            
            return {
                ...state,
                cashWallet: {
                    balance: newBalance,
                    transactions: newTransactions,
                    updatedAt: Date.now()
                },
                updatedAt: Date.now()
            };
        }),

        deleteCashTransaction: (id) => set((state) => {
            const newTransactions = state.cashWallet.transactions.filter(t => t.id !== id);
            const newBalance = newTransactions.reduce((acc, curr) => {
                if (curr.type === 'topup') return acc + curr.amount;
                if (curr.type === 'withdraw' || curr.type === 'expense') return acc - curr.amount;
                return acc;
            }, 0);
            
            return {
                ...state,
                cashWallet: {
                    balance: newBalance,
                    transactions: newTransactions,
                    updatedAt: Date.now()
                },
                updatedAt: Date.now()
            };
        }),

        setCashBalance: (amount) => set((state) => ({
            ...state,
            cashWallet: {
                ...state.cashWallet,
                balance: amount,
                updatedAt: Date.now()
            },
            updatedAt: Date.now()
        })),

        reset: () => set({ ...INITIAL_STATE, isGuest: false })
    })
);
